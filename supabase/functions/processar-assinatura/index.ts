/**
 * ═══════════════════════════════════════════════════════════════════════
 * Edge Function: processar-assinatura
 * ═══════════════════════════════════════════════════════════════════════
 *
 * MÓDULO 2: Workflow de Múltiplos Assinantes e Validação de Imagem.
 *
 * Responsabilidades:
 *   1. Validação de Magic Numbers (JPG/PNG)
 *   2. Upload das fotos KYC para bucket privado 'evidencias_kyc'
 *   3. Registro na trilha_auditoria (cofre de evidências unificado)
 *   4. Lógica de Conclusão: verifica se TODOS assinaram → Módulo 3
 *   5. Disparo de e-mails de notificação
 *   6. Envio automático dos PDFs finais por e-mail
 *
 * DB SIMPLIFICADO: usa signatarios (unificado) e trilha_auditoria (unificado)
 * ═══════════════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function validarMagicNumbers(buffer: Uint8Array): {
  valido: boolean;
  formato: 'jpeg' | 'png' | 'desconhecido';
  motivo?: string;
} {
  if (buffer.length < 8) {
    return { valido: false, formato: 'desconhecido', motivo: `Buffer muito pequeno: ${buffer.length} bytes` };
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valido: true, formato: 'jpeg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return { valido: true, formato: 'png' };
  }
  const hexPrimeiros = Array.from(buffer.slice(0, 8)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  return { valido: false, formato: 'desconhecido', motivo: `Magic numbers não reconhecidos: [${hexPrimeiros}]` };
}

const TAMANHO_MAXIMO_BASE64 = 14_000_000;

function base64ParaUint8Array(base64: string): Uint8Array {
  if (base64.length > TAMANHO_MAXIMO_BASE64) {
    throw new Error(`Payload base64 excede o limite de ${TAMANHO_MAXIMO_BASE64} caracteres (~10MB)`);
  }
  const base64Puro = base64.includes(',') ? base64.split(',')[1] : base64;
  const binario = atob(base64Puro);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      documentoId, participanteId, tipoEvento,
      selfieBase64, documentoBase64, tipoDocumento,
      latitude, longitude, enderecoFormatado,
      agenteUsuario, hashDocumento, biometriaAprovada,
    } = body;

    if (!documentoId || !participanteId || !tipoEvento) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: documentoId, participanteId, tipoEvento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const enderecoIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      'desconhecido';

    // ── Upload de fotos com validação de Magic Numbers ──
    let caminhoSelfie: string | null = null;
    let caminhoDocumento: string | null = null;
    const timestamp = Date.now();

    if (selfieBase64) {
      const bufferSelfie = base64ParaUint8Array(selfieBase64);
      const validacaoSelfie = validarMagicNumbers(bufferSelfie);
      if (!validacaoSelfie.valido) {
        return new Response(
          JSON.stringify({ error: `Selfie inválida: ${validacaoSelfie.motivo}`, codigo: 'MAGIC_NUMBERS_INVALIDOS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const ext = validacaoSelfie.formato === 'png' ? 'png' : 'jpg';
      const ct = validacaoSelfie.formato === 'png' ? 'image/png' : 'image/jpeg';
      const caminho = `${documentoId}/${participanteId}/selfie_${timestamp}.${ext}`;
      const { error: erroUpload } = await supabase.storage.from('evidencias_kyc').upload(caminho, bufferSelfie, { contentType: ct, upsert: false });
      if (!erroUpload) { caminhoSelfie = caminho; console.log(`[OK] Selfie: ${caminho}`); }
      else { console.error('[ERRO] Upload selfie:', erroUpload); }
    }

    if (documentoBase64) {
      const bufferDocumento = base64ParaUint8Array(documentoBase64);
      const validacaoDoc = validarMagicNumbers(bufferDocumento);
      if (!validacaoDoc.valido) {
        return new Response(
          JSON.stringify({ error: `Documento inválido: ${validacaoDoc.motivo}`, codigo: 'MAGIC_NUMBERS_INVALIDOS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const ext = validacaoDoc.formato === 'png' ? 'png' : 'jpg';
      const ct = validacaoDoc.formato === 'png' ? 'image/png' : 'image/jpeg';
      const caminho = `${documentoId}/${participanteId}/documento_${tipoDocumento || 'id'}_${timestamp}.${ext}`;
      const { error: erroUpload } = await supabase.storage.from('evidencias_kyc').upload(caminho, bufferDocumento, { contentType: ct, upsert: false });
      if (!erroUpload) { caminhoDocumento = caminho; console.log(`[OK] Documento: ${caminho}`); }
      else { console.error('[ERRO] Upload documento:', erroUpload); }
    }

    // ── Registrar na trilha_auditoria (tabela unificada) ──
    await supabase.from('trilha_auditoria').insert({
      documento_id: documentoId,
      signatario_id: participanteId,
      acao: tipoEvento,
      ator: 'Signatário',
      endereco_ip: enderecoIp,
      agente_usuario: agenteUsuario || req.headers.get('user-agent'),
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      endereco_formatado: enderecoFormatado || null,
      hash_documento: hashDocumento || null,
      caminho_foto_selfie: caminhoSelfie,
      caminho_foto_documento_oficial: caminhoDocumento,
      metadados: {
        tipo_documento: tipoDocumento,
        biometria_aprovada: biometriaAprovada,
        ip_headers: {
          'x-forwarded-for': req.headers.get('x-forwarded-for'),
          'x-real-ip': req.headers.get('x-real-ip'),
          'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
        },
      },
    });

    // ── Atualizar status do signatário e verificar conclusão ──
    if (tipoEvento === 'ASSINOU') {
      // Usar tabela unificada signatarios
      await supabase.from('signatarios')
        .update({ status: 'signed', assinado_em: new Date().toISOString() })
        .eq('id', participanteId);

      const { data: signatarios } = await supabase
        .from('signatarios')
        .select('id, papel, funcao, status, ordem_assinatura, email, nome, token_assinatura')
        .eq('documento_id', documentoId);

      const assinantes = (signatarios || []).filter(s => s.papel === 'ASSINANTE' || s.funcao === 'signer');
      const todosConcluidos = assinantes.every(a => a.status === 'signed');

      if (todosConcluidos) {
        console.log(`✅ Documento ${documentoId} — todas as assinaturas concluídas.`);

        try {
          const respostaPdf = await fetch(`${supabaseUrl}/functions/v1/gerar-documento-final`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ documentoId }),
          });
          const dadosPdf = await respostaPdf.json();

          if (respostaPdf.ok && dadosPdf.sucesso) {
            console.log('📄 Dossiê Final gerado com sucesso');

            const observadores = (signatarios || []).filter(s => s.papel === 'OBSERVADOR' || s.funcao === 'observer');
            const todosDestinatarios = [...assinantes, ...observadores];
            const { data: docData } = await supabase.from('documentos').select('nome').eq('id', documentoId).single();

            for (const dest of todosDestinatarios) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-signing-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
                  body: JSON.stringify({
                    signerName: dest.nome, signerEmail: dest.email,
                    documentName: docData?.nome || 'Documento', signToken: '',
                    message: '✅ Todas as assinaturas foram concluídas e o dossiê final foi gerado.',
                  }),
                });
              } catch (e) { console.warn(`[AVISO] E-mail falhou para ${dest.email}:`, e); }
            }
          } else {
            console.error('[ERRO] Falha dossiê:', dadosPdf);
            await supabase.from('documentos').update({ status: 'signed' }).eq('id', documentoId);
          }
        } catch (e) {
          console.error('[ERRO] Exceção PDFs:', e);
          await supabase.from('documentos').update({ status: 'signed' }).eq('id', documentoId);
        }
      } else {
        // Notificar próximo
        const pendentes = assinantes.filter(a => a.status === 'pending').sort((a, b) => a.ordem_assinatura - b.ordem_assinatura);
        if (pendentes.length > 0) {
          const proximo = pendentes[0];
          const { data: docData } = await supabase.from('documentos').select('nome').eq('id', documentoId).single();

          if (proximo.token_assinatura) {
            await supabase.from('signatarios').update({ status: 'pending' }).eq('id', proximo.id);
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-signing-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
                body: JSON.stringify({
                  signerName: proximo.nome, signerEmail: proximo.email,
                  documentName: docData?.nome || 'Documento', signToken: proximo.token_assinatura,
                  message: 'É a sua vez de assinar! Clique no botão abaixo.',
                }),
              });
            } catch (e) { console.warn(`[AVISO] Falha notificar ${proximo.email}:`, e); }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ sucesso: true, caminhoSelfie, caminhoDocumento, enderecoIp, mensagem: `Evento '${tipoEvento}' registrado` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (erro) {
    console.error('[ERRO FATAL]', erro);
    return new Response(
      JSON.stringify({ error: erro instanceof Error ? erro.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
