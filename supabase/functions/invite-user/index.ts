import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autenticado');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Check caller permissions
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error('Não autenticado');

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('hierarchy')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || !['owner', 'gestor'].includes(callerProfile.hierarchy)) {
      throw new Error('Sem permissão para gerenciar membros');
    }

    const { email, full_name, hierarchy, department_id, reset_only } = await req.json();
    if (!email) throw new Error('Email é obrigatório');

    const adminClient = createClient(supabaseUrl, serviceKey);
    const siteUrl = Deno.env.get('SITE_URL') || 'https://sign-sweetly-clone.lovable.app';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // ── Password reset only ──
    if (reset_only) {
      // Generate recovery link
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${siteUrl}/login` },
      });

      if (linkError) throw linkError;

      const actionLink = linkData?.properties?.action_link || `${siteUrl}/login`;

      // Send via Resend
      if (resendApiKey) {
        await sendEmail(resendApiKey, email, full_name || 'Usuário', '🔑 Redefina sua senha — SignProof', `
          <p>Olá ${full_name || ''},</p>
          <p>Foi solicitada a redefinição da sua senha no SignProof.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
        `, actionLink, '🔑 Redefinir senha');
      }

      return jsonResponse({ success: true, message: 'Reset email sent' });
    }

    // ── Create new user ──
    if (!full_name) throw new Error('Nome é obrigatório');

    const tempPassword = crypto.randomUUID() + 'Aa1!';
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      if (createError.message?.includes('already been registered')) {
        throw new Error('Este email já está cadastrado no sistema');
      }
      throw createError;
    }

    // Update profile
    if (newUser?.user) {
      await adminClient.from('profiles').update({
        hierarchy: hierarchy || 'user',
        department_id: department_id || null,
      }).eq('id', newUser.user.id);
    }

    // Generate magic link for first access
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/login` },
    });

    const actionLink = linkData?.properties?.action_link || `${siteUrl}/login`;

    const hierarchyLabel = hierarchy === 'owner' ? 'Owner' : hierarchy === 'gestor' ? 'Gestor' : 'Usuário';

    if (resendApiKey) {
      await sendEmail(resendApiKey, email, full_name, '🔑 Bem-vindo ao SignProof — Configure sua senha', `
        <p>Olá <strong>${escapeHtml(full_name)}</strong>!</p>
        <p>Você foi convidado para acessar o SignProof como <strong>${hierarchyLabel}</strong>.</p>
        <p>Clique no botão abaixo para configurar sua senha e acessar o sistema:</p>
      `, actionLink, '🔑 Acessar o sistema');
      console.log(`✅ Invite email sent to ${email}`);
    }

    return jsonResponse({ success: true, user_id: newUser?.user?.id });
  } catch (error) {
    console.error('Invite error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendEmail(apiKey: string, to: string, name: string, subject: string, bodyHtml: string, actionLink: string, btnText: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'SignProof by Valeris <onboarding@resend.dev>',
      to: [to],
      subject,
      html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f5f4;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f5f4;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#1a3a3a,#2d5a5a,#8a6d3b);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">SignProof</h1>
          <p style="margin:6px 0 0;color:#d4c5a0;font-size:13px;">by Valeris</p>
        </td></tr>
        <tr><td style="padding:36px 40px;color:#2d4a4a;font-size:15px;line-height:1.6;">
          ${bodyHtml}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr><td align="center">
              <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#2d5a5a,#1a3a3a);color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(26,58,58,0.3);">
                ${btnText}
              </a>
            </td></tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;text-align:center;">
            <a href="${actionLink}" style="color:#2d5a5a;word-break:break-all;">${actionLink}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f0f5f4;padding:20px 40px;border-top:1px solid #d0ddd8;text-align:center;">
          <p style="margin:0;color:#7a9a8a;font-size:12px;">SignProof by Valeris</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }),
  });
}
