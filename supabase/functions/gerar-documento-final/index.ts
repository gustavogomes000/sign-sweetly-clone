/**
 * ═══════════════════════════════════════════════════════════════════════
 * Edge Function: gerar-documento-final
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Gera 2 arquivos PDF:
 *   1. PDF Assinado (original_assinado.pdf): PDF original + campos preenchidos
 *      + assinaturas + rodapé com hash SHA-256. Para download público.
 *   2. PDF Dossiê de Auditoria (dossie_final_auditado.pdf): Tudo do #1 +
 *      páginas de manifesto com evidências KYC, IPs, GPS, hashes, fotos.
 *
 * Tecnologias: pdf-lib (manipulação PDF), Web Crypto API (SHA-256)
 * ═══════════════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

const MAX_TENTATIVAS = 3;
const TAMANHO_MINIMO_PDF_BYTES = 1024;
const PAGINA_LARGURA = 595.28;
const PAGINA_ALTURA = 841.89;
const MARGEM = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════

async function gerarHashSHA256(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function validarIntegridadePdf(
  buffer: Uint8Array,
  paginasMinimas: number
): Promise<{ valido: boolean; motivo?: string }> {
  if (buffer.length < TAMANHO_MINIMO_PDF_BYTES) {
    return { valido: false, motivo: `Buffer muito pequeno: ${buffer.length} bytes` };
  }
  const cabecalho = new TextDecoder().decode(buffer.slice(0, 5));
  if (cabecalho !== '%PDF-') {
    return { valido: false, motivo: `Cabeçalho inválido: '${cabecalho}'` };
  }
  try {
    const pdfTeste = await PDFDocument.load(buffer, { ignoreEncryption: true });
    if (pdfTeste.getPageCount() < paginasMinimas) {
      return { valido: false, motivo: `Páginas insuficientes: ${pdfTeste.getPageCount()} < ${paginasMinimas}` };
    }
    return { valido: true };
  } catch (erro) {
    return { valido: false, motivo: `Falha ao carregar PDF: ${erro instanceof Error ? erro.message : 'erro'}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INSERÇÃO DE CAMPOS E ASSINATURAS NO PDF
// ═══════════════════════════════════════════════════════════════════════

async function inserirCamposEAssinaturas(
  pdfDoc: PDFDocument,
  campos: any[],
  assinaturas: any[],
  signatarios: any[],
  hashOriginal: string,
  fonteNormal: any,
): Promise<void> {
  const paginas = pdfDoc.getPages();

  for (const campo of campos) {
    const indicePagina = (campo.pagina || 1) - 1;
    if (indicePagina >= paginas.length) continue;
    const pagina = paginas[indicePagina];
    const { height: alturaPagina } = pagina.getSize();

    const assinatura = assinaturas.find((a: any) => a.campo_id === campo.id);
    const signatario = signatarios.find((s: any) => s.id === campo.signatario_id);

    if (campo.tipo_campo === 'signature' || campo.tipo_campo === 'initials') {
      if (assinatura?.imagem_base64) {
        try {
          const base64Limpo = assinatura.imagem_base64.includes(',')
            ? assinatura.imagem_base64.split(',')[1]
            : assinatura.imagem_base64;
          const bytesImagem = Uint8Array.from(atob(base64Limpo), c => c.charCodeAt(0));
          const imagemPng = await pdfDoc.embedPng(bytesImagem);
          pagina.drawImage(imagemPng, {
            x: campo.x,
            y: alturaPagina - campo.y - campo.height,
            width: campo.width,
            height: campo.height,
          });
        } catch (erroImagem) {
          console.warn(`[WARN] Fallback texto para assinatura: ${erroImagem}`);
          pagina.drawText(assinatura.texto_digitado || signatario?.nome || 'Assinado', {
            x: campo.x + 4,
            y: alturaPagina - campo.y - campo.height + 10,
            size: 12,
            font: fonteNormal,
            color: rgb(0.1, 0.1, 0.4),
          });
        }
      } else if (assinatura?.texto_digitado || campo.valor) {
        const texto = assinatura?.texto_digitado || campo.valor || '';
        pagina.drawText(texto, {
          x: campo.x + 4,
          y: alturaPagina - campo.y - campo.height / 2 - 6,
          size: 14,
          font: fonteNormal,
          color: rgb(0.1, 0.1, 0.4),
        });
      }

      // Nome e data abaixo do campo
      if (signatario) {
        const dataAssinatura = signatario.assinado_em
          ? new Date(signatario.assinado_em).toISOString()
          : new Date().toISOString();
        pagina.drawText(`${signatario.nome} — ${dataAssinatura}`, {
          x: campo.x + 2,
          y: alturaPagina - campo.y - campo.height - 10,
          size: 6,
          font: fonteNormal,
          color: rgb(0.4, 0.4, 0.4),
        });
      }
    } else if (campo.valor) {
      // Campos de texto, data, checkbox
      pagina.drawText(campo.valor, {
        x: campo.x + 3,
        y: alturaPagina - campo.y - campo.height / 2 - 4,
        size: 10,
        font: fonteNormal,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
  }

  // Rodapé com hash em todas as páginas originais
  for (const pagina of paginas) {
    const { width: largura } = pagina.getSize();
    pagina.drawText(`Hash SHA-256 Original: ${hashOriginal}`, {
      x: 40, y: 12, size: 5.5, font: fonteNormal, color: rgb(0.5, 0.5, 0.5),
    });
    pagina.drawText('Documento assinado eletronicamente via SignProof', {
      x: largura - 220, y: 12, size: 5.5, font: fonteNormal, color: rgb(0.5, 0.5, 0.5),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MANIFESTO / DOSSIÊ
// ═══════════════════════════════════════════════════════════════════════

interface DadosManifesto {
  hashOriginal: string;
  hashPdfAssinado: string;
  nomeDocumento: string;
  documentoId: string;
  dataCriacao: string;
  trilhaAuditoria: any[];
  signatarios: any[];
  assinaturas: any[];
}

async function adicionarPaginaManifesto(
  pdfDoc: PDFDocument,
  fonteNormal: any,
  fonteNegrito: any,
  dados: DadosManifesto,
  supabase: any,
): Promise<void> {
  let pagina = pdfDoc.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
  let yPos = PAGINA_ALTURA - MARGEM;
  let numeroPagManifesto = 1;

  const verificarQuebraPagina = (espacoNecessario: number) => {
    if (yPos - espacoNecessario < MARGEM + 30) {
      adicionarRodapeManifesto(pagina, fonteNormal, dados.documentoId, numeroPagManifesto);
      pagina = pdfDoc.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
      yPos = PAGINA_ALTURA - MARGEM;
      numeroPagManifesto++;
    }
  };

  const escreverTexto = (
    texto: string,
    opcoes: { negrito?: boolean; tamanho?: number; cor?: { r: number; g: number; b: number }; recuo?: number } = {}
  ) => {
    const tamanho = opcoes.tamanho || 9;
    const fonte = opcoes.negrito ? fonteNegrito : fonteNormal;
    const cor = opcoes.cor || { r: 0.1, g: 0.1, b: 0.1 };
    const recuo = opcoes.recuo || 0;
    verificarQuebraPagina(tamanho + 6);
    const larguraMaxima = PAGINA_LARGURA - (2 * MARGEM) - recuo;
    let textoTruncado = texto;
    while (fonte.widthOfTextAtSize(textoTruncado, tamanho) > larguraMaxima && textoTruncado.length > 10) {
      textoTruncado = textoTruncado.substring(0, textoTruncado.length - 4) + '...';
    }
    pagina.drawText(textoTruncado, {
      x: MARGEM + recuo, y: yPos, size: tamanho, font: fonte, color: rgb(cor.r, cor.g, cor.b),
    });
    yPos -= tamanho + 4;
  };

  const desenharLinha = () => {
    verificarQuebraPagina(12);
    pagina.drawLine({ start: { x: MARGEM, y: yPos }, end: { x: PAGINA_LARGURA - MARGEM, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    yPos -= 12;
  };

  const espacamento = (px: number) => { yPos -= px; };

  // ── Cabeçalho ──
  escreverTexto('MANIFESTO DE AUDITORIA E INTEGRIDADE', { negrito: true, tamanho: 16, cor: { r: 0.08, g: 0.15, b: 0.45 } });
  escreverTexto('Documento de Evidencias para Validacao Juridica — Padrao ICP-Brasil', { tamanho: 9, cor: { r: 0.4, g: 0.4, b: 0.4 } });
  espacamento(6);
  desenharLinha();

  // ── 1. Informações do Documento ──
  escreverTexto('1. INFORMACOES DO DOCUMENTO', { negrito: true, tamanho: 12, cor: { r: 0.08, g: 0.15, b: 0.45 } });
  espacamento(4);
  escreverTexto(`Nome: ${dados.nomeDocumento}`, { recuo: 10 });
  escreverTexto(`UUID: ${dados.documentoId}`, { recuo: 10, tamanho: 8 });
  escreverTexto(`Data de Criacao: ${dados.dataCriacao}`, { recuo: 10 });
  escreverTexto(`Data de Finalizacao: ${new Date().toISOString()}`, { recuo: 10 });
  espacamento(4);
  escreverTexto('HASH SHA-256 DO DOCUMENTO ORIGINAL:', { negrito: true, tamanho: 9, cor: { r: 0.6, g: 0.1, b: 0.1 }, recuo: 10 });
  escreverTexto(dados.hashOriginal, { tamanho: 7, cor: { r: 0.2, g: 0.2, b: 0.2 }, recuo: 10 });
  escreverTexto('HASH SHA-256 DO PDF ASSINADO:', { negrito: true, tamanho: 9, cor: { r: 0.6, g: 0.1, b: 0.1 }, recuo: 10 });
  escreverTexto(dados.hashPdfAssinado, { tamanho: 7, cor: { r: 0.2, g: 0.2, b: 0.2 }, recuo: 10 });
  espacamento(6);
  desenharLinha();

  // ── 2. Signatários ──
  escreverTexto('2. SIGNATARIOS E STATUS', { negrito: true, tamanho: 12, cor: { r: 0.08, g: 0.15, b: 0.45 } });
  espacamento(4);
  for (const sig of dados.signatarios) {
    verificarQuebraPagina(70);
    escreverTexto(`Signatario #${sig.ordem_assinatura}: ${sig.nome}`, { negrito: true, recuo: 10 });
    escreverTexto(`E-mail: ${sig.email}`, { recuo: 20, tamanho: 8 });
    if (sig.cpf) escreverTexto(`CPF: ${sig.cpf}`, { recuo: 20, tamanho: 8 });
    escreverTexto(`Funcao: ${sig.funcao} | Status: ${sig.status}`, { recuo: 20, tamanho: 8 });
    if (sig.assinado_em) {
      escreverTexto(`Data/Hora UTC: ${new Date(sig.assinado_em).toISOString()}`, { recuo: 20, tamanho: 8 });
    }
    const assinatura = dados.assinaturas.find((a: any) => a.signatario_id === sig.id);
    if (assinatura) {
      escreverTexto(`Tipo: ${assinatura.tipo_assinatura === 'drawn' ? 'Desenho Manual' : 'Tipografica'}`, { recuo: 20, tamanho: 8 });
      if (assinatura.endereco_ip) escreverTexto(`IP: ${assinatura.endereco_ip}`, { recuo: 20, tamanho: 8 });
      if (assinatura.user_agent) escreverTexto(`UA: ${String(assinatura.user_agent).substring(0, 100)}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
    }
    espacamento(6);
  }
  desenharLinha();

  // ── 3. Participantes ──
  if (dados.participantes.length > 0) {
    escreverTexto('3. PARTICIPANTES', { negrito: true, tamanho: 12, cor: { r: 0.08, g: 0.15, b: 0.45 } });
    espacamento(4);
    for (const p of dados.participantes) {
      verificarQuebraPagina(50);
      escreverTexto(`${p.nome} (${p.email})`, { negrito: true, recuo: 10, tamanho: 9 });
      escreverTexto(`Papel: ${p.papel} | Auth: ${p.tipo_autenticacao} | Status: ${p.status}`, { recuo: 20, tamanho: 8 });
      if (p.data_assinatura) escreverTexto(`Assinado em: ${new Date(p.data_assinatura).toISOString()}`, { recuo: 20, tamanho: 8 });
      espacamento(4);
    }
    desenharLinha();
  }

  // ── 4. Trilha de Auditoria com Evidências ──
  const numSecao = dados.participantes.length > 0 ? 4 : 3;
  escreverTexto(`${numSecao}. TRILHA DE AUDITORIA — COFRE DE EVIDENCIAS`, { negrito: true, tamanho: 12, cor: { r: 0.08, g: 0.15, b: 0.45 } });
  espacamento(4);

  if (dados.trilhaAuditoria.length === 0) {
    escreverTexto('Nenhum registro de auditoria encontrado.', { recuo: 10, cor: { r: 0.5, g: 0.5, b: 0.5 } });
  }

  for (const evento of dados.trilhaAuditoria) {
    verificarQuebraPagina(100);
    escreverTexto(`Evento: ${evento.tipo_evento}`, { negrito: true, recuo: 10, tamanho: 9, cor: { r: 0.15, g: 0.3, b: 0.15 } });
    escreverTexto(`Data/Hora UTC: ${new Date(evento.criado_em).toISOString()}`, { recuo: 20, tamanho: 8 });
    if (evento.endereco_ip) escreverTexto(`IP: ${evento.endereco_ip}`, { recuo: 20, tamanho: 8 });
    if (evento.agente_usuario) escreverTexto(`UA: ${String(evento.agente_usuario).substring(0, 100)}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
    if (evento.latitude && evento.longitude) escreverTexto(`GPS: ${evento.latitude}, ${evento.longitude}`, { recuo: 20, tamanho: 8 });
    if (evento.endereco_formatado) escreverTexto(`Endereco: ${evento.endereco_formatado}`, { recuo: 20, tamanho: 8 });
    if (evento.hash_documento) escreverTexto(`Hash no Momento: ${evento.hash_documento}`, { recuo: 20, tamanho: 7, cor: { r: 0.3, g: 0.3, b: 0.3 } });

    // Embutir foto selfie
    if (evento.caminho_foto_selfie) {
      escreverTexto(`Selfie KYC: ${evento.caminho_foto_selfie}`, { recuo: 20, tamanho: 7, cor: { r: 0.1, g: 0.4, b: 0.1 } });
      try {
        const { data: selfieData } = await supabase.storage.from('evidencias_kyc').download(evento.caminho_foto_selfie);
        if (selfieData) {
          const selfieBytes = new Uint8Array(await selfieData.arrayBuffer());
          let img;
          if (selfieBytes[0] === 0x89 && selfieBytes[1] === 0x50) {
            img = await pdfDoc.embedPng(selfieBytes);
          } else {
            img = await pdfDoc.embedJpg(selfieBytes);
          }
          verificarQuebraPagina(110);
          pagina.drawImage(img, { x: MARGEM + 20, y: yPos - 90, width: 80, height: 90 });
          yPos -= 95;
        }
      } catch (e) { console.warn('[AVISO] Falha ao embutir selfie:', e); }
    }

    // Embutir foto documento
    if (evento.caminho_foto_documento_oficial) {
      escreverTexto(`Documento: ${evento.caminho_foto_documento_oficial}`, { recuo: 20, tamanho: 7, cor: { r: 0.1, g: 0.4, b: 0.1 } });
      try {
        const { data: docImgData } = await supabase.storage.from('evidencias_kyc').download(evento.caminho_foto_documento_oficial);
        if (docImgData) {
          const docImgBytes = new Uint8Array(await docImgData.arrayBuffer());
          let img;
          if (docImgBytes[0] === 0x89 && docImgBytes[1] === 0x50) {
            img = await pdfDoc.embedPng(docImgBytes);
          } else {
            img = await pdfDoc.embedJpg(docImgBytes);
          }
          verificarQuebraPagina(80);
          pagina.drawImage(img, { x: MARGEM + 20, y: yPos - 60, width: 100, height: 60 });
          yPos -= 65;
        }
      } catch (e) { console.warn('[AVISO] Falha ao embutir doc:', e); }
    }

    if (evento.metadados && typeof evento.metadados === 'object') {
      const meta = evento.metadados as Record<string, any>;
      if (meta.biometria_aprovada !== undefined) escreverTexto(`Biometria: ${meta.biometria_aprovada ? 'SIM' : 'NAO'}`, { recuo: 20, tamanho: 8 });
      if (meta.tipo_documento) escreverTexto(`Tipo Doc ID: ${meta.tipo_documento}`, { recuo: 20, tamanho: 8 });
      if (meta.ip_headers) {
        const ipH = meta.ip_headers;
        if (ipH['x-forwarded-for']) escreverTexto(`X-Forwarded-For: ${ipH['x-forwarded-for']}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
        if (ipH['cf-connecting-ip']) escreverTexto(`CF-IP: ${ipH['cf-connecting-ip']}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
      }
    }
    espacamento(8);
  }
  desenharLinha();

  // ── Declaração de Integridade ──
  const numDecl = numSecao + 1;
  verificarQuebraPagina(120);
  escreverTexto(`${numDecl}. DECLARACAO DE INTEGRIDADE E VALIDADE JURIDICA`, { negrito: true, tamanho: 12, cor: { r: 0.08, g: 0.15, b: 0.45 } });
  espacamento(4);
  const decl = [
    'Este manifesto atesta que todas as assinaturas e validacoes foram',
    'realizadas eletronicamente via SignProof, em conformidade com a',
    'MP 2.200-2/2001 e a Lei 14.063/2020 (assinatura eletronica).',
    '',
    'Evidencias coletadas e registradas de forma imutavel:',
  ];
  for (const l of decl) { if (l) escreverTexto(l, { recuo: 10, tamanho: 9 }); else espacamento(4); }
  const evidencias = [
    'Endereco IP real de cada participante',
    'User Agent completo do navegador',
    'Geolocalizacao GPS (quando autorizada)',
    'Hash SHA-256 do documento original',
    'Hash SHA-256 do PDF assinado (sem manifesto)',
    'Fotos KYC: selfie e documento oficial',
    'Prova de Vida (Frame Differencing algoritmico)',
    'Qualidade de imagem (Variancia de Luminosidade)',
    'Timestamps UTC com precisao de milissegundos',
  ];
  for (const item of evidencias) escreverTexto(`  - ${item}`, { recuo: 20, tamanho: 8 });

  espacamento(8);
  escreverTexto(`Hash Original: ${dados.hashOriginal}`, { recuo: 10, tamanho: 8, negrito: true, cor: { r: 0.6, g: 0.1, b: 0.1 } });
  escreverTexto(`Hash Assinado: ${dados.hashPdfAssinado}`, { recuo: 10, tamanho: 8, negrito: true, cor: { r: 0.6, g: 0.1, b: 0.1 } });
  escreverTexto(`Gerado em: ${new Date().toISOString()}`, { recuo: 10, tamanho: 8 });

  adicionarRodapeManifesto(pagina, fonteNormal, dados.documentoId, numeroPagManifesto);
}

function adicionarRodapeManifesto(pagina: PDFPage, fonte: any, documentoId: string, numeroPagina: number): void {
  pagina.drawText(`SignProof — Manifesto de Auditoria — Pagina ${numeroPagina}`, {
    x: MARGEM, y: 18, size: 7, font: fonte, color: rgb(0.5, 0.5, 0.5),
  });
  pagina.drawText(`Doc: ${documentoId}`, {
    x: PAGINA_LARGURA - 200, y: 18, size: 7, font: fonte, color: rgb(0.5, 0.5, 0.5),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

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
      return new Response(JSON.stringify({ error: 'Campo obrigatorio: documentoId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotência
    const { data: docCheck } = await supabase.from('documentos').select('status').eq('id', documentoId).single();
    if (docCheck?.status === 'FINALIZADO_COM_SUCESSO') {
      return new Response(JSON.stringify({ sucesso: true, mensagem: 'Já finalizado (idempotente)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[INICIO] Fechamento: ${documentoId}`);

    // Buscar dados
    const [docRes, signersRes, fieldsRes, sigsRes, auditRes] = await Promise.all([
      supabase.from('documentos').select('*').eq('id', documentoId).single(),
      supabase.from('signatarios').select('*').eq('documento_id', documentoId).order('ordem_assinatura'),
      supabase.from('campos_documento').select('*').eq('documento_id', documentoId),
      supabase.from('assinaturas').select('*').eq('documento_id', documentoId),
      supabase.from('trilha_auditoria').select('*').eq('documento_id', documentoId).order('criado_em'),
    ]);

    if (docRes.error || !docRes.data) {
      return new Response(JSON.stringify({ error: 'Documento nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const doc = docRes.data;
    const signatarios = signersRes.data || [];
    const campos = fieldsRes.data || [];
    const assinaturas = sigsRes.data || [];
    const trilhaAuditoria = auditRes.data || [];
    const participantes = participantsRes.data || [];

    if (!doc.caminho_arquivo) {
      return new Response(JSON.stringify({ error: 'Sem arquivo PDF associado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download PDF original
    console.log(`[DOWNLOAD] ${doc.caminho_arquivo}`);
    const { data: arquivoOriginal, error: erroBaixar } = await supabase.storage.from('documents').download(doc.caminho_arquivo);
    if (erroBaixar || !arquivoOriginal) {
      return new Response(JSON.stringify({ error: 'Falha ao baixar PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const bytesOriginal = new Uint8Array(await arquivoOriginal.arrayBuffer());
    console.log(`[OK] Original: ${bytesOriginal.length} bytes`);

    const hashOriginal = await gerarHashSHA256(bytesOriginal);
    console.log(`[HASH] Original: ${hashOriginal}`);

    const pdfOriginal = await PDFDocument.load(bytesOriginal, { ignoreEncryption: true });
    const totalPaginasOriginal = pdfOriginal.getPageCount();
    console.log(`[INFO] Paginas: ${totalPaginasOriginal}`);

    // ═══════════════════════════════════════════════════════════════════
    // ARQUIVO 1: PDF ASSINADO (original + campos + assinaturas)
    // ═══════════════════════════════════════════════════════════════════
    let bufferAssinado: Uint8Array | null = null;
    let hashAssinado = '';

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`[ASSINADO ${tentativa}/${MAX_TENTATIVAS}] Montando...`);
      try {
        const pdfAssinado = await PDFDocument.load(bytesOriginal, { ignoreEncryption: true });
        const fonteNormal = await pdfAssinado.embedFont(StandardFonts.Helvetica);
        await inserirCamposEAssinaturas(pdfAssinado, campos, assinaturas, signatarios, hashOriginal, fonteNormal);
        const buffer = await pdfAssinado.save();
        const val = await validarIntegridadePdf(buffer, totalPaginasOriginal);
        if (!val.valido) { console.error(`[FALHA] ${val.motivo}`); continue; }
        hashAssinado = await gerarHashSHA256(buffer);
        bufferAssinado = buffer;
        console.log(`[OK] PDF Assinado: ${buffer.length} bytes, hash: ${hashAssinado}`);
        break;
      } catch (e) {
        console.error(`[ERRO] Tentativa ${tentativa}:`, e);
        if (tentativa >= MAX_TENTATIVAS) throw e;
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, tentativa - 1)));
      }
    }

    if (!bufferAssinado) throw new Error('Falha ao gerar PDF assinado');

    // ═══════════════════════════════════════════════════════════════════
    // ARQUIVO 2: DOSSIÊ (PDF assinado + manifesto de auditoria)
    // ═══════════════════════════════════════════════════════════════════
    let bufferDossie: Uint8Array | null = null;
    let hashDossie = '';

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      console.log(`[DOSSIE ${tentativa}/${MAX_TENTATIVAS}] Montando...`);
      try {
        const pdfDossie = await PDFDocument.load(bufferAssinado!, { ignoreEncryption: true });
        const fonteNormal = await pdfDossie.embedFont(StandardFonts.Helvetica);
        const fonteNegrito = await pdfDossie.embedFont(StandardFonts.HelveticaBold);

        await adicionarPaginaManifesto(pdfDossie, fonteNormal, fonteNegrito, {
          hashOriginal,
          hashPdfAssinado: hashAssinado,
          nomeDocumento: doc.nome,
          documentoId: doc.id,
          dataCriacao: doc.criado_em,
          trilhaAuditoria,
          signatarios,
          participantes,
          assinaturas,
        }, supabase);

        const buffer = await pdfDossie.save();
        const val = await validarIntegridadePdf(buffer, totalPaginasOriginal + 1);
        if (!val.valido) { console.error(`[FALHA] ${val.motivo}`); continue; }
        hashDossie = await gerarHashSHA256(buffer);
        bufferDossie = buffer;
        console.log(`[OK] Dossiê: ${buffer.length} bytes, hash: ${hashDossie}`);
        break;
      } catch (e) {
        console.error(`[ERRO] Tentativa ${tentativa}:`, e);
        if (tentativa >= MAX_TENTATIVAS) throw e;
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, tentativa - 1)));
      }
    }

    if (!bufferDossie) throw new Error('Falha ao gerar dossiê');

    // ═══════════════════════════════════════════════════════════════════
    // UPLOAD DOS 2 ARQUIVOS
    // ═══════════════════════════════════════════════════════════════════
    const caminhoBase = doc.caminho_arquivo.substring(0, doc.caminho_arquivo.lastIndexOf('/'));
    const caminhoAssinado = `${caminhoBase}/original_assinado.pdf`;
    const caminhoDossie = `${caminhoBase}/dossie_final_auditado.pdf`;

    console.log(`[UPLOAD] Assinado: ${caminhoAssinado}`);
    console.log(`[UPLOAD] Dossiê: ${caminhoDossie}`);

    const [uploadAssinado, uploadDossie] = await Promise.all([
      supabase.storage.from('documents').upload(caminhoAssinado, bufferAssinado, { contentType: 'application/pdf', upsert: true }),
      supabase.storage.from('documents').upload(caminhoDossie, bufferDossie, { contentType: 'application/pdf', upsert: true }),
    ]);

    if (uploadAssinado.error) throw new Error(`Upload assinado falhou: ${uploadAssinado.error.message}`);
    if (uploadDossie.error) throw new Error(`Upload dossiê falhou: ${uploadDossie.error.message}`);

    console.log('[OK] Uploads concluidos');

    // ═══════════════════════════════════════════════════════════════════
    // ATUALIZAÇÃO DO BANCO
    // ═══════════════════════════════════════════════════════════════════
    const { error: erroUpdate } = await supabase
      .from('documentos')
      .update({
        status: 'FINALIZADO_COM_SUCESSO',
        hash_pdf_original: hashOriginal,
        hash_pdf_final: hashDossie,
        caminho_pdf_final: caminhoAssinado,
        caminho_pdf_dossie: caminhoDossie,
      })
      .eq('id', documentoId);

    if (erroUpdate) throw new Error(`Falha ao atualizar banco: ${erroUpdate.message}`);

    await supabase.from('trilha_auditoria').insert({
      documento_id: documentoId,
      acao: 'completed',
      ator: 'Sistema',
      detalhes: `Finalizado. Hash Orig: ${hashOriginal.substring(0, 16)}... | Hash Assinado: ${hashAssinado.substring(0, 16)}... | Hash Dossiê: ${hashDossie.substring(0, 16)}...`,
    });

    console.log(`[FINALIZADO] ${documentoId}`);

    return new Response(JSON.stringify({
      sucesso: true,
      hashOriginal,
      hashAssinado,
      hashDossie,
      caminhoAssinado,
      caminhoDossie,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (erro) {
    console.error('[ERRO FATAL]', erro);
    return new Response(JSON.stringify({ error: erro instanceof Error ? erro.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
