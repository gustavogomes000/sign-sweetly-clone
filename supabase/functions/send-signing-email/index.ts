import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signerName, signerEmail, documentName, signToken, message, senderName } = await req.json();

    if (!signerEmail || !signToken) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: signerEmail and signToken are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://sign-sweetly-clone.lovable.app';
    const signUrl = `${siteUrl}/sign/${signToken}`;
    const fromName = senderName || 'SignProof by Valeris';

    // Use Gmail address as reply-to if configured
    const gmailUser = Deno.env.get('GMAIL_USER');

    const htmlBody = buildEmailHtml({
      signerName,
      documentName: documentName || 'Documento',
      signUrl,
      message,
      senderName: fromName,
    });

    const emailPayload: Record<string, unknown> = {
      from: `${fromName} <onboarding@resend.dev>`,
      to: [signerEmail],
      subject: `📝 Documento para assinatura: ${documentName || 'Documento'}`,
      html: htmlBody,
    };

    // Add reply-to with the user's Gmail so replies go to them
    if (gmailUser) {
      emailPayload.reply_to = gmailUser;
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend API error:', resendData);
      throw new Error(resendData.message || `Resend error: ${resendRes.status}`);
    }

    console.log(`✅ Email sent to ${signerEmail} — Resend ID: ${resendData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        signUrl,
        emailId: resendData.id,
        message: `Email enviado para ${signerEmail}`,
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildEmailHtml(opts: {
  signerName?: string;
  documentName: string;
  signUrl: string;
  message?: string;
  senderName: string;
}): string {
  const { signerName, documentName, signUrl, message, senderName } = opts;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f5f4;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f5f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a3a 0%,#2d5a5a 50%,#8a6d3b 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;font-family:'Trebuchet MS',sans-serif;">SignProof</h1>
              <p style="margin:6px 0 0;color:#d4c5a0;font-size:13px;letter-spacing:0.5px;">by Valeris</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#5a7a7a;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Documento para assinatura</p>
              <h2 style="margin:0 0 24px;color:#1a3a3a;font-size:20px;font-weight:700;">${escapeHtml(documentName)}</h2>
              
              <p style="margin:0 0 20px;color:#2d4a4a;font-size:15px;line-height:1.6;">
                Olá${signerName ? ' <strong>' + escapeHtml(signerName) + '</strong>' : ''},
              </p>
              <p style="margin:0 0 20px;color:#2d4a4a;font-size:15px;line-height:1.6;">
                ${escapeHtml(senderName)} enviou um documento que requer a sua assinatura eletrônica.
              </p>

              ${message ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#f0f5f4;border-left:3px solid #2d5a5a;padding:14px 18px;border-radius:0 8px 8px 0;">
                    <p style="margin:0;color:#3a5a5a;font-size:14px;font-style:italic;line-height:1.5;">"${escapeHtml(message)}"</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${signUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#2d5a5a 0%,#1a3a3a 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(26,58,58,0.3);">
                      ✍️ Assinar documento
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${signUrl}" style="color:#2d5a5a;word-break:break-all;">${signUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f0f5f4;padding:20px 40px;border-top:1px solid #d0ddd8;text-align:center;">
              <p style="margin:0;color:#7a9a8a;font-size:12px;line-height:1.5;">
                Este e-mail foi enviado automaticamente pela plataforma <strong>SignProof by Valeris</strong>.<br>
                Se você não esperava este documento, ignore esta mensagem.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
