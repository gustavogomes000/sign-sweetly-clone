import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signerName, signerEmail, documentName, signToken, message } = await req.json();

    if (!signerEmail || !signToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build signing URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://sign-sweetly-clone.lovable.app';
    const signUrl = `${siteUrl}/sign/${signToken}`;

    // For now, log the email (in production, integrate with email service)
    console.log(`📧 Email notification:`);
    console.log(`  To: ${signerName} <${signerEmail}>`);
    console.log(`  Document: ${documentName}`);
    console.log(`  Sign URL: ${signUrl}`);
    console.log(`  Message: ${message || '(none)'}`);

    // TODO: Integrate with actual email service (Resend, SendGrid, etc.)
    // For now, return success with the sign URL so it can be used for testing
    return new Response(
      JSON.stringify({
        success: true,
        signUrl,
        message: `Email would be sent to ${signerEmail}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
