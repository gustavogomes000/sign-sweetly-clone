import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { createHash } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Content-Type': 'application/json',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// Hash API key for lookup
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Authenticate via API key header
async function authenticate(req: Request): Promise<{ userId: string; scopes: string[] } | null> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return null;

  const keyHash = await hashKey(apiKey);
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('validate_api_key', { p_key_hash: keyHash });
  if (error || !data || data.length === 0) return null;

  // Update last_used_at
  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash);

  return { userId: data[0].user_id, scopes: data[0].scopes };
}

function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes('*');
}

// Parse route
function parseRoute(url: string): { path: string; segments: string[] } {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/api-gateway\/?/, '/').replace(/\/+/g, '/');
  const segments = path.split('/').filter(Boolean);
  return { path, segments };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return error('API key inválida ou ausente. Envie o header x-api-key.', 401);
    }

    const { segments } = parseRoute(req.url);
    const method = req.method;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ─── POST /documents ───────────────────────────────
    // Create document + signers + fields + auto-send emails
    if (method === 'POST' && segments[0] === 'documents' && segments.length === 1) {
      if (!hasScope(auth.scopes, 'documents:write')) return error('Permissão insuficiente', 403);

      const body = await req.json();
      const { name, file_url, signature_type, deadline, signers, fields, callback_url } = body;

      if (!name || !signers || !Array.isArray(signers) || signers.length === 0) {
        return error('Campos obrigatórios: name, signers (array com name e email)');
      }

      // 1. Create document
      const { data: doc, error: docErr } = await supabase.from('documents').insert({
        user_id: auth.userId,
        name,
        file_path: file_url || null,
        signature_type: signature_type || 'electronic',
        status: body.auto_send === false ? 'draft' : 'pending',
        deadline: deadline || null,
        origin: 'api',
        external_ref: body.external_ref || null,
        source_system: body.source_system || null,
      }).select().single();

      if (docErr) return error(`Erro ao criar documento: ${docErr.message}`, 500);

      // 2. Create signers
      const signerInserts = signers.map((s: any, i: number) => ({
        document_id: doc.id,
        name: s.name,
        email: s.email,
        phone: s.phone || null,
        role: s.role || 'Signatário',
        sign_order: s.order || i + 1,
        status: 'pending',
      }));

      const { data: dbSigners, error: sigErr } = await supabase.from('signers').insert(signerInserts).select();
      if (sigErr) return error(`Erro ao criar signatários: ${sigErr.message}`, 500);

      // 3. Create fields if provided
      let dbFields: any[] = [];
      if (fields && Array.isArray(fields) && fields.length > 0) {
        // Map signer index to DB ID
        const fieldInserts = fields.map((f: any) => {
          const signerIdx = f.signer_index ?? 0;
          return {
            document_id: doc.id,
            signer_id: dbSigners[signerIdx]?.id || dbSigners[0]?.id,
            field_type: f.type || 'signature',
            label: f.label || null,
            x: f.x ?? 100,
            y: f.y ?? 600,
            width: f.width ?? 200,
            height: f.height ?? 60,
            page: f.page ?? 1,
            required: f.required !== false,
          };
        });

        const { data: fData, error: fErr } = await supabase.from('document_fields').insert(fieldInserts).select();
        if (!fErr && fData) dbFields = fData;
      }

      // 4. Register callback_url as webhook if provided
      if (callback_url) {
        await supabase.from('webhooks').insert({
          user_id: auth.userId,
          url: callback_url,
          events: ['document.signed', 'document.completed', 'signer.signed', 'signer.refused'],
          active: true,
        });
      }

      // 5. Auto-send emails to all signers
      const emailResults: { email: string; success: boolean }[] = [];
      for (const signer of dbSigners!) {
        try {
          await supabase.functions.invoke('send-signing-email', {
            body: {
              signerName: signer.name,
              signerEmail: signer.email,
              documentName: name,
              signToken: signer.sign_token,
            },
          });
          emailResults.push({ email: signer.email, success: true });
        } catch {
          emailResults.push({ email: signer.email, success: false });
        }
      }

      // 6. Add audit trail
      await supabase.from('audit_trail').insert({
        document_id: doc.id,
        action: 'created',
        actor: 'API',
        details: `Documento criado via API com ${dbSigners!.length} signatário(s)`,
      });

      await supabase.from('audit_trail').insert({
        document_id: doc.id,
        action: 'sent',
        actor: 'API',
        details: `Enviado para assinatura via API`,
      });

      return json({
        id: doc.id,
        name: doc.name,
        status: doc.status,
        created_at: doc.created_at,
        signers: dbSigners!.map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          sign_token: s.sign_token,
          sign_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || ''}/sign/${s.sign_token}`,
          status: s.status,
        })),
        fields: dbFields.map((f: any) => ({ id: f.id, type: f.field_type, page: f.page, x: f.x, y: f.y })),
        emails: emailResults,
      }, 201);
    }

    // ─── GET /documents ────────────────────────────────
    if (method === 'GET' && segments[0] === 'documents' && segments.length === 1) {
      if (!hasScope(auth.scopes, 'documents:read')) return error('Permissão insuficiente', 403);

      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase.from('documents').select('*', { count: 'exact' })
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);

      const { data: docs, error: qErr, count } = await query;
      if (qErr) return error(qErr.message, 500);

      // Fetch signers for all docs
      const docIds = (docs || []).map((d: any) => d.id);
      const { data: allSigners } = docIds.length > 0
        ? await supabase.from('signers').select('*').in('document_id', docIds)
        : { data: [] };

      const signersByDoc = new Map<string, any[]>();
      (allSigners || []).forEach((s: any) => {
        const list = signersByDoc.get(s.document_id) || [];
        list.push(s);
        signersByDoc.set(s.document_id, list);
      });

      return json({
        data: (docs || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          signature_type: d.signature_type,
          created_at: d.created_at,
          updated_at: d.updated_at,
          deadline: d.deadline,
          signers: (signersByDoc.get(d.id) || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            status: s.status,
            signed_at: s.signed_at,
          })),
        })),
        total: count,
        limit,
        offset,
      });
    }

    // ─── GET /documents/:id ────────────────────────────
    if (method === 'GET' && segments[0] === 'documents' && segments.length === 2) {
      if (!hasScope(auth.scopes, 'documents:read')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documents').select('*').eq('id', docId).eq('user_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);

      const [signersRes, fieldsRes, auditRes] = await Promise.all([
        supabase.from('signers').select('*').eq('document_id', docId).order('sign_order'),
        supabase.from('document_fields').select('*').eq('document_id', docId),
        supabase.from('audit_trail').select('*').eq('document_id', docId).order('created_at'),
      ]);

      return json({
        id: doc.id,
        name: doc.name,
        status: doc.status,
        signature_type: doc.signature_type,
        file_path: doc.file_path,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        deadline: doc.deadline,
        signers: (signersRes.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.role,
          status: s.status,
          signed_at: s.signed_at,
          sign_token: s.sign_token,
        })),
        fields: (fieldsRes.data || []).map((f: any) => ({
          id: f.id,
          type: f.field_type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          value: f.value,
        })),
        audit_trail: (auditRes.data || []).map((a: any) => ({
          action: a.action,
          actor: a.actor,
          details: a.details,
          created_at: a.created_at,
        })),
      });
    }

    // ─── POST /documents/:id/cancel ────────────────────
    if (method === 'POST' && segments[0] === 'documents' && segments[2] === 'cancel') {
      if (!hasScope(auth.scopes, 'documents:write')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documents').select('id, status').eq('id', docId).eq('user_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);
      if (doc.status !== 'pending' && doc.status !== 'draft') return error('Só é possível cancelar documentos pendentes ou rascunhos');

      await supabase.from('documents').update({ status: 'cancelled' }).eq('id', docId);
      await supabase.from('audit_trail').insert({
        document_id: docId,
        action: 'cancelled',
        actor: 'API',
        details: 'Documento cancelado via API',
      });

      // Trigger webhook
      await triggerWebhooks(supabase, auth.userId, 'document.cancelled', { document_id: docId });

      return json({ id: docId, status: 'cancelled' });
    }

    // ─── POST /documents/:id/resend ────────────────────
    if (method === 'POST' && segments[0] === 'documents' && segments[2] === 'resend') {
      if (!hasScope(auth.scopes, 'documents:write')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documents').select('*').eq('id', docId).eq('user_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);

      const { data: pendingSigners } = await supabase.from('signers').select('*').eq('document_id', docId).eq('status', 'pending');
      if (!pendingSigners || pendingSigners.length === 0) return error('Nenhum signatário pendente');

      const results: { email: string; success: boolean }[] = [];
      for (const s of pendingSigners) {
        try {
          await supabase.functions.invoke('send-signing-email', {
            body: { signerName: s.name, signerEmail: s.email, documentName: doc.name, signToken: s.sign_token },
          });
          results.push({ email: s.email, success: true });
        } catch {
          results.push({ email: s.email, success: false });
        }
      }

      await supabase.from('audit_trail').insert({
        document_id: docId,
        action: 'reminder',
        actor: 'API',
        details: `Lembrete reenviado para ${pendingSigners.length} signatário(s) via API`,
      });

      return json({ resent_to: results });
    }

    // ─── GET /documents/:id/status ─────────────────────
    if (method === 'GET' && segments[0] === 'documents' && segments[2] === 'status') {
      if (!hasScope(auth.scopes, 'documents:read')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documents').select('id, status, name').eq('id', docId).eq('user_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);

      const { data: signers } = await supabase.from('signers').select('name, email, status, signed_at').eq('document_id', docId).order('sign_order');

      return json({
        document_id: doc.id,
        document_name: doc.name,
        status: doc.status,
        signers: signers || [],
        progress: {
          total: (signers || []).length,
          signed: (signers || []).filter((s: any) => s.status === 'signed').length,
          pending: (signers || []).filter((s: any) => s.status === 'pending').length,
          refused: (signers || []).filter((s: any) => s.status === 'refused').length,
        },
      });
    }

    // ─── Webhooks CRUD ─────────────────────────────────
    if (segments[0] === 'webhooks') {
      if (method === 'GET' && segments.length === 1) {
        const { data } = await supabase.from('webhooks').select('*').eq('user_id', auth.userId).order('created_at', { ascending: false });
        return json({ data: data || [] });
      }

      if (method === 'POST' && segments.length === 1) {
        const body = await req.json();
        if (!body.url) return error('Campo obrigatório: url');
        const { data, error: wErr } = await supabase.from('webhooks').insert({
          user_id: auth.userId,
          url: body.url,
          events: body.events || ['document.signed', 'document.completed'],
          secret: body.secret || crypto.randomUUID(),
          active: true,
        }).select().single();
        if (wErr) return error(wErr.message, 500);
        return json(data, 201);
      }

      if (method === 'DELETE' && segments.length === 2) {
        const whId = segments[1];
        await supabase.from('webhooks').delete().eq('id', whId).eq('user_id', auth.userId);
        return json({ deleted: true });
      }
    }

    return error(`Rota não encontrada: ${method} /${segments.join('/')}`, 404);

  } catch (err) {
    console.error('API Error:', err);
    return error(err instanceof Error ? err.message : 'Erro interno', 500);
  }
});

// ─── Webhook Dispatcher ──────────────────────────────
async function triggerWebhooks(supabase: any, userId: string, event: string, payload: Record<string, unknown>) {
  try {
    const { data: webhooks } = await supabase.from('webhooks')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .contains('events', [event]);

    if (!webhooks || webhooks.length === 0) return;

    for (const wh of webhooks) {
      try {
        const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
        const res = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': wh.secret || '',
            'X-Webhook-Event': event,
          },
          body,
        });

        await supabase.from('webhook_deliveries').insert({
          webhook_id: wh.id,
          event,
          payload: { event, payload },
          status_code: res.status,
          success: res.ok,
          response_body: await res.text().catch(() => ''),
        });

        await supabase.from('webhooks').update({
          last_triggered_at: new Date().toISOString(),
          failure_count: res.ok ? 0 : wh.failure_count + 1,
        }).eq('id', wh.id);

      } catch (err) {
        await supabase.from('webhook_deliveries').insert({
          webhook_id: wh.id,
          event,
          payload: { event, payload },
          status_code: 0,
          success: false,
          response_body: err instanceof Error ? err.message : 'Connection error',
        });
      }
    }
  } catch (err) {
    console.error('Webhook dispatch error:', err);
  }
}
