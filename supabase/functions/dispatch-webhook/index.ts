import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Called internally when a signature event occurs
// Dispatches webhooks to all registered endpoints for the document owner
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event, document_id, signer_id, payload } = await req.json();
    if (!event || !document_id) {
      return new Response(JSON.stringify({ error: 'Missing event or document_id' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get document owner
    const { data: doc } = await supabase.from('documents').select('user_id, name, status').eq('id', document_id).single();
    if (!doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: corsHeaders });
    }

    // Get active webhooks for this user & event
    const { data: webhooks } = await supabase.from('webhooks')
      .select('*')
      .eq('user_id', doc.user_id)
      .eq('active', true);

    const matchingWebhooks = (webhooks || []).filter((wh: any) =>
      wh.events.includes(event) || wh.events.includes('*')
    );

    if (matchingWebhooks.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), { headers: corsHeaders });
    }

    // Build webhook payload
    const webhookPayload = {
      event,
      document_id,
      document_name: doc.name,
      document_status: doc.status,
      signer_id: signer_id || null,
      data: payload || {},
      timestamp: new Date().toISOString(),
    };

    let dispatched = 0;
    for (const wh of matchingWebhooks) {
      try {
        const res = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': wh.secret || '',
            'X-Webhook-Event': event,
          },
          body: JSON.stringify(webhookPayload),
        });

        await supabase.from('webhook_deliveries').insert({
          webhook_id: wh.id,
          event,
          payload: webhookPayload,
          status_code: res.status,
          success: res.ok,
          response_body: await res.text().catch(() => ''),
        });

        await supabase.from('webhooks').update({
          last_triggered_at: new Date().toISOString(),
          failure_count: res.ok ? 0 : (wh.failure_count || 0) + 1,
        }).eq('id', wh.id);

        if (res.ok) dispatched++;
      } catch (err) {
        await supabase.from('webhook_deliveries').insert({
          webhook_id: wh.id,
          event,
          payload: webhookPayload,
          status_code: 0,
          success: false,
          response_body: err instanceof Error ? err.message : 'Connection error',
        });
      }
    }

    return new Response(JSON.stringify({ dispatched, total: matchingWebhooks.length }), { headers: corsHeaders });
  } catch (err) {
    console.error('Webhook dispatch error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
