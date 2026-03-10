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
    // Verify the caller is authenticated and has owner/gestor hierarchy
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
      throw new Error('Sem permissão para convidar membros');
    }

    const { email, full_name, hierarchy, department_id } = await req.json();
    if (!email || !full_name) throw new Error('Email e nome são obrigatórios');

    // Use service role to create user
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Create the user with a temporary password and send password reset
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

    // Update profile with hierarchy and department
    if (newUser?.user) {
      await adminClient.from('profiles').update({
        hierarchy: hierarchy || 'user',
        department_id: department_id || null,
      }).eq('id', newUser.user.id);
    }

    // Send password reset email so user can set their own password
    const siteUrl = Deno.env.get('SITE_URL') || 'https://sign-sweetly-clone.lovable.app';
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/login` },
    });

    if (resetError) {
      console.warn('Could not generate reset link:', resetError);
    }

    // Also send via Resend if configured
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey && newUser?.user) {
      try {
        // Generate a magic link for first access
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: `${siteUrl}/login` },
        });

        const actionLink = linkData?.properties?.action_link || `${siteUrl}/login`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SignProof by Valeris <onboarding@resend.dev>',
            to: [email],
            subject: '🔑 Bem-vindo ao SignProof — Configure sua senha',
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
        <tr><td style="padding:36px 40px;">
          <h2 style="margin:0 0 16px;color:#1a3a3a;font-size:20px;">Olá ${full_name}!</h2>
          <p style="color:#2d4a4a;font-size:15px;line-height:1.6;">
            Você foi convidado para acessar o SignProof como <strong>${hierarchy === 'owner' ? 'Owner' : hierarchy === 'gestor' ? 'Gestor' : 'Usuário'}</strong>.
          </p>
          <p style="color:#2d4a4a;font-size:15px;line-height:1.6;">
            Clique no botão abaixo para configurar sua senha e acessar o sistema:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
            <tr><td align="center">
              <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#2d5a5a,#1a3a3a);color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;box-shadow:0 4px 12px rgba(26,58,58,0.3);">
                🔑 Acessar o sistema
              </a>
            </td></tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;text-align:center;">
            Após acessar, defina uma nova senha em Configurações.<br>
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
        console.log(`✅ Invite email sent to ${email}`);
      } catch (emailErr) {
        console.warn('Invite email failed (Resend):', emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser?.user?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Invite error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
