/**
 * Edge Function: gerar-documento-final
 *
 * Gera dois PDFs quando todas as assinaturas de um documento são concluídas:
 * 1. PDF Original — documento com assinaturas sobrepostas + hash SHA-256 no rodapé
 * 2. PDF Dossiê de Auditoria — evidências KYC, logs, IP, GPS, timestamps
 *
 * Ambos são armazenados no bucket 'documents' e os caminhos salvos na tabela documentos.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { documentoId } = await req.json();
    if (!documentoId) {
      return new Response(JSON.stringify({ error: 'documentoId obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Buscar dados do documento ──
    const { data: doc, error: docErr } = await supabase
      .from('documentos')
      .select('*')
      .eq('id', documentoId)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: 'Documento não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar dados relacionados em paralelo
    const [signersRes, fieldsRes, signaturesRes, auditRes, participantsRes] = await Promise.all([
      supabase.from('signatarios').select('*').eq('documento_id', documentoId).order('ordem_assinatura'),
      supabase.from('campos_documento').select('*').eq('documento_id', documentoId),
      supabase.from('assinaturas').select('*').eq('documento_id', documentoId),
      supabase.from('trilha_auditoria_documentos').select('*').eq('documento_id', documentoId).order('criado_em'),
      supabase.from('participantes_documento').select('*').eq('documento_id', documentoId).order('ordem_assinatura'),
    ]);

    const signers = signersRes.data || [];
    const fields = fieldsRes.data || [];
    const signatures = signaturesRes.data || [];
    const auditTrail = auditRes.data || [];
    const participants = participantsRes.data || [];

    // ── Baixar PDF original do Storage ──
    let originalPdfBytes: Uint8Array;
    if (doc.caminho_arquivo) {
      const { data: fileData, error: fileErr } = await supabase.storage
        .from('documents')
        .download(doc.caminho_arquivo);

      if (fileErr || !fileData) {
        console.error('Erro ao baixar PDF:', fileErr);
        return new Response(JSON.stringify({ error: 'Erro ao baixar arquivo original' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      originalPdfBytes = new Uint8Array(await fileData.arrayBuffer());
    } else {
      return new Response(JSON.stringify({ error: 'Documento sem arquivo associado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Gerar Hash SHA-256 do documento original ──
    const hashBuffer = await crypto.subtle.digest('SHA-256', originalPdfBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // ═══════════════════════════════════════════════════════════
    // PDF 1: DOCUMENTO ORIGINAL COM ASSINATURAS
    // ═══════════════════════════════════════════════════════════
    const finalPdf = await PDFDocument.load(originalPdfBytes);
    const helvetica = await finalPdf.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await finalPdf.embedFont(StandardFonts.HelveticaBold);
    const pages = finalPdf.getPages();

    // Sobrepor assinaturas nos campos
    for (const field of fields) {
      const pageIdx = (field.pagina || 1) - 1;
      if (pageIdx >= pages.length) continue;
      const page = pages[pageIdx];
      const { width: pageW, height: pageH } = page.getSize();

      // Encontrar assinatura correspondente
      const sig = signatures.find((s: any) => s.campo_id === field.id);
      const signer = signers.find((s: any) => s.id === field.signatario_id);

      if (field.tipo_campo === 'signature' || field.tipo_campo === 'initials') {
        if (sig && sig.imagem_base64) {
          try {
            // Assinatura desenhada — embutir imagem PNG
            const base64Data = sig.imagem_base64.includes(',')
              ? sig.imagem_base64.split(',')[1]
              : sig.imagem_base64;
            const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const pngImage = await finalPdf.embedPng(imgBytes);
            page.drawImage(pngImage, {
              x: field.x,
              y: pageH - field.y - field.height,
              width: field.width,
              height: field.height,
            });
          } catch (imgErr) {
            console.warn('Erro ao embutir imagem de assinatura:', imgErr);
            // Fallback: escrever texto
            page.drawText(sig.texto_digitado || signer?.nome || 'Assinado', {
              x: field.x + 4,
              y: pageH - field.y - field.height + 10,
              size: 12,
              font: helvetica,
              color: rgb(0.1, 0.1, 0.4),
            });
          }
        } else if (sig?.texto_digitado || field.valor) {
          // Assinatura tipográfica
          const text = sig?.texto_digitado || field.valor || '';
          page.drawText(text, {
            x: field.x + 4,
            y: pageH - field.y - field.height / 2 - 6,
            size: 14,
            font: helvetica,
            color: rgb(0.1, 0.1, 0.4),
          });
        }

        // Adicionar linha e data abaixo da assinatura
        if (signer) {
          const signDate = signer.assinado_em
            ? new Date(signer.assinado_em).toLocaleString('pt-BR')
            : new Date().toLocaleString('pt-BR');
          page.drawText(`${signer.nome} — ${signDate}`, {
            x: field.x + 2,
            y: pageH - field.y - field.height - 10,
            size: 6,
            font: helvetica,
            color: rgb(0.4, 0.4, 0.4),
          });
        }
      } else if (field.valor) {
        // Campos de texto/data/checkbox
        page.drawText(field.valor, {
          x: field.x + 3,
          y: pageH - field.y - field.height / 2 - 4,
          size: 10,
          font: helvetica,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    }

    // Adicionar rodapé com hash SHA-256 em todas as páginas
    for (const page of pages) {
      const { width: pageW } = page.getSize();
      page.drawText(`Hash SHA-256: ${hashHex}`, {
        x: 40,
        y: 15,
        size: 6,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(`Documento assinado eletronicamente via SignProof`, {
        x: pageW - 250,
        y: 15,
        size: 6,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const finalPdfBytes = await finalPdf.save();

    // ═══════════════════════════════════════════════════════════
    // PDF 2: DOSSIÊ DE AUDITORIA
    // ═══════════════════════════════════════════════════════════
    const dossiePdf = await PDFDocument.create();
    const dossieFont = await dossiePdf.embedFont(StandardFonts.Helvetica);
    const dossieFontBold = await dossiePdf.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN = 50;
    let currentPage = dossiePdf.addPage([PAGE_W, PAGE_H]);
    let yPos = PAGE_H - MARGIN;

    const addPage = () => {
      currentPage = dossiePdf.addPage([PAGE_W, PAGE_H]);
      yPos = PAGE_H - MARGIN;
    };

    const checkPageBreak = (needed: number) => {
      if (yPos - needed < MARGIN) addPage();
    };

    const drawText = (text: string, opts: { bold?: boolean; size?: number; color?: any; indent?: number } = {}) => {
      const size = opts.size || 10;
      const font = opts.bold ? dossieFontBold : dossieFont;
      const color = opts.color || rgb(0.1, 0.1, 0.1);
      const indent = opts.indent || 0;
      checkPageBreak(size + 4);
      currentPage.drawText(text, {
        x: MARGIN + indent,
        y: yPos,
        size,
        font,
        color,
      });
      yPos -= size + 4;
    };

    const drawLine = () => {
      checkPageBreak(10);
      currentPage.drawLine({
        start: { x: MARGIN, y: yPos },
        end: { x: PAGE_W - MARGIN, y: yPos },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });
      yPos -= 10;
    };

    // ── Cabeçalho ──
    drawText('DOSSIE DE AUDITORIA', { bold: true, size: 18, color: rgb(0.1, 0.2, 0.5) });
    drawText('Documento de Evidencias para Validacao Juridica', { size: 10, color: rgb(0.4, 0.4, 0.4) });
    yPos -= 10;
    drawLine();

    // ── Informações do Documento ──
    drawText('1. INFORMACOES DO DOCUMENTO', { bold: true, size: 13, color: rgb(0.1, 0.2, 0.5) });
    yPos -= 4;
    drawText(`Nome: ${doc.nome}`, { indent: 10 });
    drawText(`ID: ${doc.id}`, { indent: 10 });
    drawText(`Status: ${doc.status}`, { indent: 10 });
    drawText(`Tipo de Assinatura: ${doc.tipo_assinatura}`, { indent: 10 });
    drawText(`Criado em: ${new Date(doc.criado_em).toLocaleString('pt-BR')}`, { indent: 10 });
    drawText(`Finalizado em: ${new Date().toLocaleString('pt-BR')}`, { indent: 10 });
    drawText(`Hash SHA-256 do Original: ${hashHex}`, { indent: 10, size: 8, color: rgb(0.3, 0.3, 0.3) });
    yPos -= 6;
    drawLine();

    // ── Signatários ──
    drawText('2. SIGNATARIOS E ASSINATURAS', { bold: true, size: 13, color: rgb(0.1, 0.2, 0.5) });
    yPos -= 4;

    for (const signer of signers) {
      checkPageBreak(80);
      drawText(`Signatario #${signer.ordem_assinatura}: ${signer.nome}`, { bold: true, indent: 10 });
      drawText(`Email: ${signer.email}`, { indent: 20, size: 9 });
      drawText(`Funcao: ${signer.funcao}`, { indent: 20, size: 9 });
      drawText(`Status: ${signer.status}`, { indent: 20, size: 9 });
      if (signer.assinado_em) {
        drawText(`Data da Assinatura: ${new Date(signer.assinado_em).toLocaleString('pt-BR')}`, { indent: 20, size: 9 });
      }

      // Buscar assinatura correspondente
      const sig = signatures.find((s: any) => s.signatario_id === signer.id);
      if (sig) {
        drawText(`Tipo: ${sig.tipo_assinatura === 'drawn' ? 'Desenhada' : 'Tipografica'}`, { indent: 20, size: 9 });
        if (sig.endereco_ip) drawText(`IP: ${sig.endereco_ip}`, { indent: 20, size: 9 });
        if (sig.user_agent) {
          const ua = String(sig.user_agent).substring(0, 80);
          drawText(`User Agent: ${ua}...`, { indent: 20, size: 7, color: rgb(0.4, 0.4, 0.4) });
        }
      }
      yPos -= 6;
    }
    drawLine();

    // ── Participantes ──
    if (participants.length > 0) {
      drawText('3. PARTICIPANTES DO DOCUMENTO', { bold: true, size: 13, color: rgb(0.1, 0.2, 0.5) });
      yPos -= 4;
      for (const p of participants) {
        checkPageBreak(50);
        drawText(`${p.nome} (${p.email})`, { bold: true, indent: 10, size: 9 });
        drawText(`Papel: ${p.papel} | Autenticacao: ${p.tipo_autenticacao} | Status: ${p.status}`, { indent: 20, size: 8 });
        if (p.data_assinatura) {
          drawText(`Assinado em: ${new Date(p.data_assinatura).toLocaleString('pt-BR')}`, { indent: 20, size: 8 });
        }
        yPos -= 4;
      }
      drawLine();
    }

    // ── Trilha de Auditoria Completa ──
    const sectionNum = participants.length > 0 ? 4 : 3;
    drawText(`${sectionNum}. TRILHA DE AUDITORIA — EVIDENCIAS COLETADAS`, { bold: true, size: 13, color: rgb(0.1, 0.2, 0.5) });
    yPos -= 4;

    if (auditTrail.length === 0) {
      drawText('Nenhum registro de auditoria encontrado.', { indent: 10, color: rgb(0.5, 0.5, 0.5) });
    }

    for (const entry of auditTrail) {
      checkPageBreak(90);
      drawText(`Evento: ${entry.tipo_evento}`, { bold: true, indent: 10, size: 9 });
      drawText(`Data/Hora: ${new Date(entry.criado_em).toLocaleString('pt-BR')}`, { indent: 20, size: 8 });
      if (entry.endereco_ip) drawText(`Endereco IP: ${entry.endereco_ip}`, { indent: 20, size: 8 });
      if (entry.agente_usuario) {
        const ua = String(entry.agente_usuario).substring(0, 90);
        drawText(`User Agent: ${ua}`, { indent: 20, size: 7, color: rgb(0.4, 0.4, 0.4) });
      }
      if (entry.latitude && entry.longitude) {
        drawText(`GPS: ${entry.latitude}, ${entry.longitude}`, { indent: 20, size: 8 });
      }
      if (entry.endereco_formatado) {
        drawText(`Endereco: ${entry.endereco_formatado}`, { indent: 20, size: 8 });
      }
      if (entry.hash_documento) {
        drawText(`Hash: ${entry.hash_documento}`, { indent: 20, size: 7, color: rgb(0.3, 0.3, 0.3) });
      }
      if (entry.caminho_foto_selfie) {
        drawText(`[Selfie KYC armazenada: ${entry.caminho_foto_selfie}]`, { indent: 20, size: 7, color: rgb(0.2, 0.4, 0.2) });
      }
      if (entry.caminho_foto_documento_oficial) {
        drawText(`[Documento oficial armazenado: ${entry.caminho_foto_documento_oficial}]`, { indent: 20, size: 7, color: rgb(0.2, 0.4, 0.2) });
      }
      if (entry.metadados && typeof entry.metadados === 'object') {
        const meta = entry.metadados as Record<string, any>;
        if (meta.biometria_aprovada !== undefined) {
          drawText(`Biometria aprovada: ${meta.biometria_aprovada ? 'SIM' : 'NAO'}`, { indent: 20, size: 8 });
        }
        if (meta.tipo_documento) {
          drawText(`Tipo doc identificacao: ${meta.tipo_documento}`, { indent: 20, size: 8 });
        }
      }
      yPos -= 6;
    }
    drawLine();

    // ── Declaração de Integridade ──
    checkPageBreak(100);
    const declSection = sectionNum + 1;
    drawText(`${declSection}. DECLARACAO DE INTEGRIDADE`, { bold: true, size: 13, color: rgb(0.1, 0.2, 0.5) });
    yPos -= 4;
    drawText('Este dossie atesta que todas as assinaturas e validacoes foram', { indent: 10, size: 9 });
    drawText('realizadas eletronicamente atraves da plataforma SignProof.', { indent: 10, size: 9 });
    drawText('As evidencias coletadas incluem:', { indent: 10, size: 9 });
    yPos -= 4;
    drawText('- Endereco IP de cada participante', { indent: 20, size: 9 });
    drawText('- User Agent do navegador utilizado', { indent: 20, size: 9 });
    drawText('- Geolocalizacao GPS (quando autorizada)', { indent: 20, size: 9 });
    drawText('- Hash SHA-256 do documento original', { indent: 20, size: 9 });
    drawText('- Fotos de KYC (selfie e documento oficial)', { indent: 20, size: 9 });
    drawText('- Timestamps de cada acao registrada', { indent: 20, size: 9 });
    yPos -= 8;
    drawText(`Hash SHA-256 do documento original: ${hashHex}`, { indent: 10, size: 8, bold: true });
    drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { indent: 10, size: 8 });

    // Rodapé em todas as páginas do dossiê
    const dossiePages = dossiePdf.getPages();
    for (let i = 0; i < dossiePages.length; i++) {
      const p = dossiePages[i];
      p.drawText(`SignProof — Dossie de Auditoria — Pagina ${i + 1} de ${dossiePages.length}`, {
        x: MARGIN,
        y: 20,
        size: 7,
        font: dossieFont,
        color: rgb(0.5, 0.5, 0.5),
      });
      p.drawText(`Documento: ${doc.id}`, {
        x: PAGE_W - 200,
        y: 20,
        size: 7,
        font: dossieFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const dossiePdfBytes = await dossiePdf.save();

    // ═══════════════════════════════════════════════════════════
    // Upload dos PDFs para o Storage
    // ═══════════════════════════════════════════════════════════
    const basePath = doc.caminho_arquivo
      ? doc.caminho_arquivo.substring(0, doc.caminho_arquivo.lastIndexOf('/'))
      : doc.usuario_id;
    const timestamp = Date.now();

    const finalPath = `${basePath}/final_${timestamp}.pdf`;
    const dossiePath = `${basePath}/dossie_${timestamp}.pdf`;

    const [uploadFinal, uploadDossie] = await Promise.all([
      supabase.storage.from('documents').upload(finalPath, finalPdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      }),
      supabase.storage.from('documents').upload(dossiePath, dossiePdfBytes, {
        contentType: 'application/pdf',
        upsert: false,
      }),
    ]);

    if (uploadFinal.error) console.error('Erro upload PDF final:', uploadFinal.error);
    if (uploadDossie.error) console.error('Erro upload dossiê:', uploadDossie.error);

    // Atualizar documento com os caminhos
    await supabase
      .from('documentos')
      .update({
        caminho_pdf_final: uploadFinal.error ? null : finalPath,
        caminho_pdf_dossie: uploadDossie.error ? null : dossiePath,
        status: 'signed',
      })
      .eq('id', documentoId);

    // Registrar na trilha de auditoria
    await supabase.from('trilha_auditoria').insert({
      documento_id: documentoId,
      acao: 'completed',
      ator: 'Sistema',
      detalhes: `PDFs finais gerados. Hash SHA-256: ${hashHex.substring(0, 16)}...`,
    });

    console.log(`✅ PDFs gerados para documento ${documentoId}`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        caminhoFinal: finalPath,
        caminhoDossie: dossiePath,
        hashSha256: hashHex,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao gerar PDFs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
