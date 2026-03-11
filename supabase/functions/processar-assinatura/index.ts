/**
 * Edge Function: processar-assinatura
 *
 * Responsável por:
 * 1. Upload das fotos de KYC para bucket privado 'evidencias_kyc'
 * 2. Registro na trilha_auditoria_documentos com IP, GPS, hash
 * 3. Disparo de emails respeitando ordem_assinatura
 * 4. Geração dos dois PDFs (Original + Dossiê) quando todas as assinaturas concluem
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      documentoId,
      participanteId,
      tipoEvento,
      selfieBase64,
      documentoBase64,
      tipoDocumento,
      latitude,
      longitude,
      enderecoFormatado,
      agenteUsuario,
      hashDocumento,
      biometriaAprovada,
    } = body;

    if (!documentoId || !participanteId || !tipoEvento) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: documentoId, participanteId, tipoEvento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 1. Extrair IP real ──
    // O IP pode vir em diversos headers dependendo do proxy/CDN:
    // x-forwarded-for: IP mais comum em proxies reversos
    // x-real-ip: Alternativa usada por nginx
    // cf-connecting-ip: Cloudflare
    const enderecoIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      'desconhecido';

    // ── 2. Upload de fotos para bucket privado ──
    let caminhoSelfie: string | null = null;
    let caminhoDocumento: string | null = null;
    const timestamp = Date.now();

    if (selfieBase64) {
      const selfieBuffer = base64ToUint8Array(selfieBase64);
      const caminho = `${documentoId}/${participanteId}/selfie_${timestamp}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('evidencias_kyc')
        .upload(caminho, selfieBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) {
        console.error('Erro ao fazer upload da selfie:', uploadErr);
      } else {
        caminhoSelfie = caminho;
      }
    }

    if (documentoBase64) {
      const docBuffer = base64ToUint8Array(documentoBase64);
      const caminho = `${documentoId}/${participanteId}/documento_${tipoDocumento || 'id'}_${timestamp}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('evidencias_kyc')
        .upload(caminho, docBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) {
        console.error('Erro ao fazer upload do documento:', uploadErr);
      } else {
        caminhoDocumento = caminho;
      }
    }

    // ── 3. Registrar na trilha de auditoria (cofre de evidências) ──
    const { error: auditError } = await supabase
      .from('trilha_auditoria_documentos')
      .insert({
        documento_id: documentoId,
        participante_id: participanteId,
        tipo_evento: tipoEvento,
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

    if (auditError) {
      console.error('Erro ao registrar auditoria:', auditError);
    }

    // ── 4. Atualizar status do participante ──
    if (tipoEvento === 'ASSINOU') {
      await supabase
        .from('participantes_documento')
        .update({
          status: 'ASSINADO',
          data_assinatura: new Date().toISOString(),
        })
        .eq('id', participanteId);

      // Verificar se todos os assinantes concluíram
      const { data: participantes } = await supabase
        .from('participantes_documento')
        .select('id, papel, status, ordem_assinatura, email, nome')
        .eq('documento_id', documentoId);

      const assinantes = (participantes || []).filter(p => p.papel === 'ASSINANTE');
      const todosConcluidos = assinantes.every(a => a.status === 'ASSINADO');

      if (todosConcluidos) {
        // ── 5. Todos assinaram → gerar PDFs finais ──
        console.log(`✅ Documento ${documentoId} — todas as assinaturas concluídas. Gerando PDFs...`);

        try {
          await fetch(`${supabaseUrl}/functions/v1/gerar-documento-final`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ documentoId }),
          });
          console.log('📄 PDFs Original + Dossiê gerados com sucesso');
        } catch (pdfErr) {
          console.error('Erro ao gerar PDFs:', pdfErr);
          // Ainda marca como signed mesmo se falhar a geração de PDF
          await supabase
            .from('documentos')
            .update({ status: 'signed' })
            .eq('id', documentoId);
        }

        // Disparar e-mail para todos (signatários + observadores)
        const observadores = (participantes || []).filter(p => p.papel === 'OBSERVADOR');
        const todosDestinatarios = [...assinantes, ...observadores];

        for (const destinatario of todosDestinatarios) {
          try {
            const { data: docData } = await supabase
              .from('documentos')
              .select('nome')
              .eq('id', documentoId)
              .single();

            await fetch(`${supabaseUrl}/functions/v1/send-signing-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                signerName: destinatario.nome,
                signerEmail: destinatario.email,
                documentName: docData?.nome || 'Documento',
                signToken: '', // Conclusão — sem token
                message: '✅ Todas as assinaturas foram concluídas. Segue o documento final.',
              }),
            });
          } catch (emailErr) {
            console.warn(`Falha ao enviar e-mail para ${destinatario.email}:`, emailErr);
          }
        }
      } else {
        // ── Enviar e-mail para o próximo assinante na fila ──
        const pendentes = assinantes
          .filter(a => a.status === 'PENDENTE')
          .sort((a, b) => a.ordem_assinatura - b.ordem_assinatura);

        if (pendentes.length > 0) {
          const proximo = pendentes[0];
          const { data: docData } = await supabase
            .from('documentos')
            .select('nome')
            .eq('id', documentoId)
            .single();

          // Buscar token do signatário (tabela signatarios)
          const { data: signatario } = await supabase
            .from('signatarios')
            .select('token_assinatura')
            .eq('documento_id', documentoId)
            .eq('email', proximo.email)
            .single();

          if (signatario?.token_assinatura) {
            await supabase
              .from('participantes_documento')
              .update({ status: 'NOTIFICADO' })
              .eq('id', proximo.id);

            try {
              await fetch(`${supabaseUrl}/functions/v1/send-signing-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  signerName: proximo.nome,
                  signerEmail: proximo.email,
                  documentName: docData?.nome || 'Documento',
                  signToken: signatario.token_assinatura,
                  message: 'É a sua vez de assinar! Clique no botão abaixo.',
                }),
              });
            } catch (emailErr) {
              console.warn(`Falha ao notificar próximo: ${proximo.email}`, emailErr);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        caminhoSelfie,
        caminhoDocumento,
        enderecoIp,
        mensagem: `Evento '${tipoEvento}' registrado com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro no processamento:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Converte base64 (com ou sem prefixo data:...) para Uint8Array para upload.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Remover prefixo data:image/...;base64, se existir
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(pureBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
