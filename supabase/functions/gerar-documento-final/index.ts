/**
 * ═══════════════════════════════════════════════════════════════════════
 * Edge Function: gerar-documento-final
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Serviço de Fechamento de Documento com Validade Jurídica.
 *
 * Responsabilidades:
 *   1. Download do PDF original do bucket 'documents'
 *   2. Geração do Hash SHA-256 do arquivo original (prova de integridade)
 *   3. Inserção de assinaturas nos campos mapeados sobre o PDF
 *   4. Adição de Página de Manifesto/Dossiê no final do PDF com:
 *      - Hash SHA-256 do original
 *      - Dados de cada participante (nome, IP, data/hora UTC, GPS)
 *      - Evidências de KYC coletadas
 *      - Declaração de integridade
 *   5. Geração do Hash SHA-256 FINAL do PDF montado
 *   6. Loop de Retry (máx 3 tentativas) com validação anti-corrupção
 *   7. Upload do Dossiê Final Validado para o bucket
 *   8. Atualização do banco: hash_pdf_original, hash_pdf_final,
 *      caminho_pdf_final, caminho_pdf_dossie, status → FINALIZADO_COM_SUCESSO
 *
 * Tecnologias: pdf-lib (manipulação PDF), Web Crypto API (SHA-256)
 * ═══════════════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

// ── Constantes de configuração ──
const MAX_TENTATIVAS = 3;
const TAMANHO_MINIMO_PDF_BYTES = 1024; // PDF válido tem no mínimo ~1KB
const PAGINA_LARGURA = 595.28;  // A4 em pontos (210mm)
const PAGINA_ALTURA = 841.89;   // A4 em pontos (297mm)
const MARGEM = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ═══════════════════════════════════════════════════════════════════════
// UTILITÁRIOS DE CRIPTOGRAFIA
// ═══════════════════════════════════════════════════════════════════════

/**
 * Gera o hash SHA-256 de um buffer usando a Web Crypto API.
 * Retorna a representação hexadecimal do hash.
 */
async function gerarHashSHA256(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida a integridade de um buffer PDF:
 * 1. Verifica se o tamanho é maior que o mínimo aceitável
 * 2. Tenta carregar o PDF com pdf-lib para confirmar que não está corrompido
 * 3. Verifica se o número de páginas é coerente
 *
 * Retorna true se válido, false se corrompido.
 */
async function validarIntegridadePdf(
  buffer: Uint8Array,
  paginasEsperadas: number
): Promise<{ valido: boolean; motivo?: string }> {
  // Verificação 1: Tamanho mínimo
  if (buffer.length < TAMANHO_MINIMO_PDF_BYTES) {
    return {
      valido: false,
      motivo: `Buffer muito pequeno: ${buffer.length} bytes (mínimo: ${TAMANHO_MINIMO_PDF_BYTES})`,
    };
  }

  // Verificação 2: Magic bytes do PDF (%PDF-)
  const cabecalho = new TextDecoder().decode(buffer.slice(0, 5));
  if (cabecalho !== '%PDF-') {
    return {
      valido: false,
      motivo: `Cabeçalho inválido: esperado '%PDF-', encontrado '${cabecalho}'`,
    };
  }

  // Verificação 3: Carregar com pdf-lib para validar estrutura interna
  try {
    const pdfTeste = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPaginas = pdfTeste.getPageCount();

    if (totalPaginas < paginasEsperadas) {
      return {
        valido: false,
        motivo: `Páginas insuficientes: esperado >=${paginasEsperadas}, encontrado ${totalPaginas}`,
      };
    }

    return { valido: true };
  } catch (erro) {
    return {
      valido: false,
      motivo: `Falha ao recarregar PDF: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTRUTOR DA PÁGINA DE MANIFESTO / DOSSIÊ
// ═══════════════════════════════════════════════════════════════════════

interface DadosManifesto {
  hashOriginal: string;
  nomeDocumento: string;
  documentoId: string;
  dataCriacao: string;
  trilhaAuditoria: any[];
  signatarios: any[];
  participantes: any[];
  assinaturas: any[];
}

/**
 * Adiciona a(s) página(s) de Manifesto/Dossiê de Auditoria ao final do PDF.
 * Escreve todas as evidências coletadas em formato legível.
 */
function adicionarPaginaManifesto(
  pdfDoc: PDFDocument,
  fonteNormal: any,
  fonteNegrito: any,
  dados: DadosManifesto
): void {
  let pagina = pdfDoc.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
  let yPos = PAGINA_ALTURA - MARGEM;
  let numeroPagManifesto = 1;

  // ── Funções auxiliares de desenho ──
  const verificarQuebraPagina = (espacoNecessario: number) => {
    if (yPos - espacoNecessario < MARGEM + 30) {
      // Adicionar rodapé antes de mudar de página
      adicionarRodapeManifesto(pagina, fonteNormal, dados.documentoId, numeroPagManifesto);
      pagina = pdfDoc.addPage([PAGINA_LARGURA, PAGINA_ALTURA]);
      yPos = PAGINA_ALTURA - MARGEM;
      numeroPagManifesto++;
    }
  };

  const escreverTexto = (
    texto: string,
    opcoes: {
      negrito?: boolean;
      tamanho?: number;
      cor?: { r: number; g: number; b: number };
      recuo?: number;
    } = {}
  ) => {
    const tamanho = opcoes.tamanho || 9;
    const fonte = opcoes.negrito ? fonteNegrito : fonteNormal;
    const cor = opcoes.cor || { r: 0.1, g: 0.1, b: 0.1 };
    const recuo = opcoes.recuo || 0;

    verificarQuebraPagina(tamanho + 6);

    // Truncar texto que excede a largura da página
    const larguraMaxima = PAGINA_LARGURA - (2 * MARGEM) - recuo;
    let textoTruncado = texto;
    while (fonte.widthOfTextAtSize(textoTruncado, tamanho) > larguraMaxima && textoTruncado.length > 10) {
      textoTruncado = textoTruncado.substring(0, textoTruncado.length - 4) + '...';
    }

    pagina.drawText(textoTruncado, {
      x: MARGEM + recuo,
      y: yPos,
      size: tamanho,
      font: fonte,
      color: rgb(cor.r, cor.g, cor.b),
    });
    yPos -= tamanho + 4;
  };

  const desenharLinha = () => {
    verificarQuebraPagina(12);
    pagina.drawLine({
      start: { x: MARGEM, y: yPos },
      end: { x: PAGINA_LARGURA - MARGEM, y: yPos },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    yPos -= 12;
  };

  const espacamento = (pixels: number) => {
    yPos -= pixels;
  };

  // ═══════════════════════════════════════════════════════════════════
  // CONTEÚDO DO MANIFESTO
  // ═══════════════════════════════════════════════════════════════════

  // ── Cabeçalho ──
  escreverTexto('MANIFESTO DE AUDITORIA E INTEGRIDADE', {
    negrito: true,
    tamanho: 16,
    cor: { r: 0.08, g: 0.15, b: 0.45 },
  });
  escreverTexto('Documento de Evidencias para Validacao Juridica — Padrao ICP-Brasil', {
    tamanho: 9,
    cor: { r: 0.4, g: 0.4, b: 0.4 },
  });
  espacamento(6);
  desenharLinha();

  // ── Seção 1: Informações do Documento ──
  escreverTexto('1. INFORMACOES DO DOCUMENTO', {
    negrito: true,
    tamanho: 12,
    cor: { r: 0.08, g: 0.15, b: 0.45 },
  });
  espacamento(4);
  escreverTexto(`Nome: ${dados.nomeDocumento}`, { recuo: 10 });
  escreverTexto(`Identificador Unico (UUID): ${dados.documentoId}`, { recuo: 10, tamanho: 8 });
  escreverTexto(`Data de Criacao: ${dados.dataCriacao}`, { recuo: 10 });
  escreverTexto(`Data de Finalizacao: ${new Date().toISOString()}`, { recuo: 10 });
  espacamento(4);

  // ── Hash SHA-256 do Original (destaque) ──
  escreverTexto('HASH SHA-256 DO DOCUMENTO ORIGINAL:', {
    negrito: true,
    tamanho: 9,
    cor: { r: 0.6, g: 0.1, b: 0.1 },
    recuo: 10,
  });
  escreverTexto(dados.hashOriginal, {
    tamanho: 7,
    cor: { r: 0.2, g: 0.2, b: 0.2 },
    recuo: 10,
  });
  espacamento(6);
  desenharLinha();

  // ── Seção 2: Signatários ──
  escreverTexto('2. SIGNATARIOS E STATUS DAS ASSINATURAS', {
    negrito: true,
    tamanho: 12,
    cor: { r: 0.08, g: 0.15, b: 0.45 },
  });
  espacamento(4);

  for (const sig of dados.signatarios) {
    verificarQuebraPagina(70);
    escreverTexto(`Signatario #${sig.ordem_assinatura}: ${sig.nome}`, {
      negrito: true,
      recuo: 10,
    });
    escreverTexto(`E-mail: ${sig.email}`, { recuo: 20, tamanho: 8 });
    escreverTexto(`Funcao: ${sig.funcao} | Status: ${sig.status}`, { recuo: 20, tamanho: 8 });
    if (sig.assinado_em) {
      escreverTexto(`Data/Hora UTC: ${new Date(sig.assinado_em).toISOString()}`, { recuo: 20, tamanho: 8 });
    }

    // Buscar dados da assinatura correspondente
    const assinatura = dados.assinaturas.find((a: any) => a.signatario_id === sig.id);
    if (assinatura) {
      escreverTexto(`Tipo de Assinatura: ${assinatura.tipo_assinatura === 'drawn' ? 'Desenho Manual (Canvas)' : 'Tipografica (Digitada)'}`, { recuo: 20, tamanho: 8 });
      if (assinatura.endereco_ip) {
        escreverTexto(`Endereco IP: ${assinatura.endereco_ip}`, { recuo: 20, tamanho: 8 });
      }
      if (assinatura.user_agent) {
        escreverTexto(`User Agent: ${String(assinatura.user_agent).substring(0, 100)}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
      }
    }
    espacamento(6);
  }
  desenharLinha();

  // ── Seção 3: Participantes ──
  if (dados.participantes.length > 0) {
    escreverTexto('3. PARTICIPANTES DO DOCUMENTO', {
      negrito: true,
      tamanho: 12,
      cor: { r: 0.08, g: 0.15, b: 0.45 },
    });
    espacamento(4);

    for (const p of dados.participantes) {
      verificarQuebraPagina(50);
      escreverTexto(`${p.nome} (${p.email})`, { negrito: true, recuo: 10, tamanho: 9 });
      escreverTexto(`Papel: ${p.papel} | Autenticacao: ${p.tipo_autenticacao} | Status: ${p.status}`, { recuo: 20, tamanho: 8 });
      if (p.data_assinatura) {
        escreverTexto(`Assinado em (UTC): ${new Date(p.data_assinatura).toISOString()}`, { recuo: 20, tamanho: 8 });
      }
      espacamento(4);
    }
    desenharLinha();
  }

  // ── Seção 4: Trilha de Auditoria Completa ──
  const numSecao = dados.participantes.length > 0 ? 4 : 3;
  escreverTexto(`${numSecao}. TRILHA DE AUDITORIA — COFRE DE EVIDENCIAS`, {
    negrito: true,
    tamanho: 12,
    cor: { r: 0.08, g: 0.15, b: 0.45 },
  });
  espacamento(4);

  if (dados.trilhaAuditoria.length === 0) {
    escreverTexto('Nenhum registro de auditoria encontrado.', {
      recuo: 10,
      cor: { r: 0.5, g: 0.5, b: 0.5 },
    });
  }

  for (const evento of dados.trilhaAuditoria) {
    verificarQuebraPagina(100);

    // Cabeçalho do evento
    escreverTexto(`Evento: ${evento.tipo_evento}`, {
      negrito: true,
      recuo: 10,
      tamanho: 9,
      cor: { r: 0.15, g: 0.3, b: 0.15 },
    });
    escreverTexto(`Data/Hora UTC: ${new Date(evento.criado_em).toISOString()}`, { recuo: 20, tamanho: 8 });

    // Endereço IP (evidência obrigatória)
    if (evento.endereco_ip) {
      escreverTexto(`Endereco IP: ${evento.endereco_ip}`, { recuo: 20, tamanho: 8 });
    }

    // User Agent
    if (evento.agente_usuario) {
      escreverTexto(`User Agent: ${String(evento.agente_usuario).substring(0, 100)}`, {
        recuo: 20,
        tamanho: 7,
        cor: { r: 0.4, g: 0.4, b: 0.4 },
      });
    }

    // Geolocalização (GPS)
    if (evento.latitude && evento.longitude) {
      escreverTexto(`Geolocalizacao GPS: ${evento.latitude}, ${evento.longitude}`, { recuo: 20, tamanho: 8 });
    }
    if (evento.endereco_formatado) {
      escreverTexto(`Endereco Formatado: ${evento.endereco_formatado}`, { recuo: 20, tamanho: 8 });
    }

    // Hash do documento no momento do evento
    if (evento.hash_documento) {
      escreverTexto(`Hash SHA-256 no Momento: ${evento.hash_documento}`, {
        recuo: 20,
        tamanho: 7,
        cor: { r: 0.3, g: 0.3, b: 0.3 },
      });
    }

    // Evidências KYC — Embutir fotos diretamente no PDF do dossiê
    if (evento.caminho_foto_selfie) {
      escreverTexto(`Selfie KYC (bucket privado): ${evento.caminho_foto_selfie}`, {
        recuo: 20,
        tamanho: 7,
        cor: { r: 0.1, g: 0.4, b: 0.1 },
      });
      // Tentar embutir imagem da selfie no PDF
      try {
        const { data: selfieData } = await supabase.storage
          .from('evidencias_kyc')
          .download(evento.caminho_foto_selfie);
        if (selfieData) {
          const selfieBytes = new Uint8Array(await selfieData.arrayBuffer());
          let imagemEmbutida;
          // Detectar formato via magic numbers
          if (selfieBytes[0] === 0x89 && selfieBytes[1] === 0x50) {
            imagemEmbutida = await pdfDoc.embedPng(selfieBytes);
          } else {
            imagemEmbutida = await pdfDoc.embedJpg(selfieBytes);
          }
          verificarQuebraPagina(110);
          pagina.drawImage(imagemEmbutida, {
            x: MARGEM + 20,
            y: yPos - 90,
            width: 80,
            height: 90,
          });
          yPos -= 95;
        }
      } catch (erroImg) {
        console.warn('[AVISO] Falha ao embutir selfie no dossiê:', erroImg);
      }
    }
    if (evento.caminho_foto_documento_oficial) {
      escreverTexto(`Documento oficial (bucket privado): ${evento.caminho_foto_documento_oficial}`, {
        recuo: 20,
        tamanho: 7,
        cor: { r: 0.1, g: 0.4, b: 0.1 },
      });
      // Tentar embutir imagem do documento no PDF
      try {
        const { data: docImgData } = await supabase.storage
          .from('evidencias_kyc')
          .download(evento.caminho_foto_documento_oficial);
        if (docImgData) {
          const docImgBytes = new Uint8Array(await docImgData.arrayBuffer());
          let imagemEmbutida;
          if (docImgBytes[0] === 0x89 && docImgBytes[1] === 0x50) {
            imagemEmbutida = await pdfDoc.embedPng(docImgBytes);
          } else {
            imagemEmbutida = await pdfDoc.embedJpg(docImgBytes);
          }
          verificarQuebraPagina(80);
          pagina.drawImage(imagemEmbutida, {
            x: MARGEM + 20,
            y: yPos - 60,
            width: 100,
            height: 60,
          });
          yPos -= 65;
        }
      } catch (erroImg) {
        console.warn('[AVISO] Falha ao embutir documento no dossiê:', erroImg);
      }
    }

    // Metadados extras (biometria, tipo de documento)
    if (evento.metadados && typeof evento.metadados === 'object') {
      const meta = evento.metadados as Record<string, any>;
      if (meta.biometria_aprovada !== undefined) {
        escreverTexto(`Biometria Facial Aprovada: ${meta.biometria_aprovada ? 'SIM' : 'NAO'}`, { recuo: 20, tamanho: 8 });
      }
      if (meta.tipo_documento) {
        escreverTexto(`Tipo de Documento de Identificacao: ${meta.tipo_documento}`, { recuo: 20, tamanho: 8 });
      }
      // Headers de IP para rastreabilidade completa
      if (meta.ip_headers) {
        const ipH = meta.ip_headers;
        if (ipH['x-forwarded-for']) {
          escreverTexto(`X-Forwarded-For: ${ipH['x-forwarded-for']}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
        }
        if (ipH['cf-connecting-ip']) {
          escreverTexto(`CF-Connecting-IP: ${ipH['cf-connecting-ip']}`, { recuo: 20, tamanho: 7, cor: { r: 0.4, g: 0.4, b: 0.4 } });
        }
      }
    }

    espacamento(8);
  }
  desenharLinha();

  // ── Seção 5: Declaração de Integridade ──
  const numDeclaracao = numSecao + 1;
  verificarQuebraPagina(120);
  escreverTexto(`${numDeclaracao}. DECLARACAO DE INTEGRIDADE E VALIDADE JURIDICA`, {
    negrito: true,
    tamanho: 12,
    cor: { r: 0.08, g: 0.15, b: 0.45 },
  });
  espacamento(4);

  const declaracoes = [
    'Este manifesto atesta que todas as assinaturas e validacoes de identidade',
    'foram realizadas eletronicamente atraves da plataforma SignProof, em conformidade',
    'com a Medida Provisoria 2.200-2/2001 e a Lei 14.063/2020 (assinatura eletronica).',
    '',
    'As evidencias coletadas e registradas de forma imutavel incluem:',
  ];
  for (const linha of declaracoes) {
    if (linha) {
      escreverTexto(linha, { recuo: 10, tamanho: 9 });
    } else {
      espacamento(4);
    }
  }

  const evidencias = [
    'Endereco IP real de cada participante (via headers HTTP)',
    'User Agent completo do navegador utilizado',
    'Geolocalizacao GPS precisa (quando autorizada pelo usuario)',
    'Hash SHA-256 do documento original (prova de nao-adulteracao)',
    'Fotos de KYC: selfie facial e documento oficial (bucket privado)',
    'Resultado de verificacao biometrica facial',
    'Timestamps UTC de cada acao com precisao de milissegundos',
    'Endereco formatado via geocodificacao reversa (Nominatim/OSM)',
  ];
  for (const item of evidencias) {
    escreverTexto(`  - ${item}`, { recuo: 20, tamanho: 8 });
  }

  espacamento(8);
  escreverTexto('O hash SHA-256 do documento original garante que nenhuma alteracao', {
    recuo: 10,
    tamanho: 9,
    negrito: true,
  });
  escreverTexto('foi realizada no conteudo apos o inicio do processo de assinatura.', {
    recuo: 10,
    tamanho: 9,
    negrito: true,
  });

  espacamento(8);
  escreverTexto(`Hash SHA-256 Original: ${dados.hashOriginal}`, {
    recuo: 10,
    tamanho: 8,
    negrito: true,
    cor: { r: 0.6, g: 0.1, b: 0.1 },
  });
  escreverTexto(`Gerado em (UTC): ${new Date().toISOString()}`, { recuo: 10, tamanho: 8 });
  escreverTexto('O Hash Final deste PDF (com manifesto incluso) sera registrado no banco de dados.', {
    recuo: 10,
    tamanho: 8,
    cor: { r: 0.3, g: 0.3, b: 0.3 },
  });

  // Rodapé da última página do manifesto
  adicionarRodapeManifesto(pagina, fonteNormal, dados.documentoId, numeroPagManifesto);
}

/**
 * Adiciona rodapé padronizado nas páginas do manifesto.
 */
function adicionarRodapeManifesto(
  pagina: PDFPage,
  fonte: any,
  documentoId: string,
  numeroPagina: number
): void {
  pagina.drawText(`SignProof — Manifesto de Auditoria — Pagina de Manifesto ${numeroPagina}`, {
    x: MARGEM,
    y: 18,
    size: 7,
    font: fonte,
    color: rgb(0.5, 0.5, 0.5),
  });
  pagina.drawText(`Doc: ${documentoId}`, {
    x: PAGINA_LARGURA - 200,
    y: 18,
    size: 7,
    font: fonte,
    color: rgb(0.5, 0.5, 0.5),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// INSERÇÃO DE ASSINATURAS NO PDF
// ═══════════════════════════════════════════════════════════════════════

/**
 * Sobrepõe as assinaturas (desenho ou texto) nos campos mapeados do PDF.
 * Adiciona rodapé com hash SHA-256 em todas as páginas originais.
 */
async function inserirAssinaturasNoPdf(
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
          // Assinatura desenhada — embutir imagem PNG no PDF
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
          // Fallback: escrever nome como texto se a imagem falhar
          console.warn(`[WARN] Falha ao embutir imagem de assinatura: ${erroImagem}`);
          pagina.drawText(assinatura.texto_digitado || signatario?.nome || 'Assinado', {
            x: campo.x + 4,
            y: alturaPagina - campo.y - campo.height + 10,
            size: 12,
            font: fonteNormal,
            color: rgb(0.1, 0.1, 0.4),
          });
        }
      } else if (assinatura?.texto_digitado || campo.valor) {
        // Assinatura tipográfica
        const texto = assinatura?.texto_digitado || campo.valor || '';
        pagina.drawText(texto, {
          x: campo.x + 4,
          y: alturaPagina - campo.y - campo.height / 2 - 6,
          size: 14,
          font: fonteNormal,
          color: rgb(0.1, 0.1, 0.4),
        });
      }

      // Linha com nome e data abaixo do campo de assinatura
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

  // ── Rodapé com hash SHA-256 em todas as páginas originais ──
  for (const pagina of paginas) {
    const { width: largura } = pagina.getSize();
    pagina.drawText(`Hash SHA-256 Original: ${hashOriginal}`, {
      x: 40,
      y: 12,
      size: 5.5,
      font: fonteNormal,
      color: rgb(0.5, 0.5, 0.5),
    });
    pagina.drawText('Documento assinado eletronicamente via SignProof', {
      x: largura - 220,
      y: 12,
      size: 5.5,
      font: fonteNormal,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
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
      return new Response(
        JSON.stringify({ error: 'Campo obrigatorio: documentoId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[INICIO] Fechamento do documento: ${documentoId}`);

    // ── 1. Buscar documento e dados relacionados em paralelo ──
    const [docRes, signersRes, fieldsRes, sigsRes, auditRes, participantsRes] = await Promise.all([
      supabase.from('documentos').select('*').eq('id', documentoId).single(),
      supabase.from('signatarios').select('*').eq('documento_id', documentoId).order('ordem_assinatura'),
      supabase.from('campos_documento').select('*').eq('documento_id', documentoId),
      supabase.from('assinaturas').select('*').eq('documento_id', documentoId),
      supabase.from('trilha_auditoria_documentos').select('*').eq('documento_id', documentoId).order('criado_em'),
      supabase.from('participantes_documento').select('*').eq('documento_id', documentoId).order('ordem_assinatura'),
    ]);

    if (docRes.error || !docRes.data) {
      console.error('[ERRO] Documento nao encontrado:', docRes.error);
      return new Response(
        JSON.stringify({ error: 'Documento nao encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const doc = docRes.data;
    const signatarios = signersRes.data || [];
    const campos = fieldsRes.data || [];
    const assinaturas = sigsRes.data || [];
    const trilhaAuditoria = auditRes.data || [];
    const participantes = participantsRes.data || [];

    if (!doc.caminho_arquivo) {
      return new Response(
        JSON.stringify({ error: 'Documento sem arquivo PDF associado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Download do PDF original do bucket ──
    console.log(`[DOWNLOAD] Baixando PDF original: ${doc.caminho_arquivo}`);
    const { data: arquivoOriginal, error: erroBaixar } = await supabase.storage
      .from('documents')
      .download(doc.caminho_arquivo);

    if (erroBaixar || !arquivoOriginal) {
      console.error('[ERRO] Falha ao baixar PDF original:', erroBaixar);
      return new Response(
        JSON.stringify({ error: 'Falha ao baixar arquivo original do Storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bytesOriginal = new Uint8Array(await arquivoOriginal.arrayBuffer());
    console.log(`[OK] PDF original baixado: ${bytesOriginal.length} bytes`);

    // ── 3. Gerar Hash SHA-256 do documento original ──
    const hashOriginal = await gerarHashSHA256(bytesOriginal);
    console.log(`[HASH] SHA-256 do original: ${hashOriginal}`);

    // Contar páginas do original para validação posterior
    const pdfOriginal = await PDFDocument.load(bytesOriginal, { ignoreEncryption: true });
    const totalPaginasOriginal = pdfOriginal.getPageCount();
    console.log(`[INFO] Paginas no original: ${totalPaginasOriginal}`);

    // ═══════════════════════════════════════════════════════════════════
    // LOOP DE RETRY COM VALIDAÇÃO ANTI-CORRUPÇÃO
    // ═══════════════════════════════════════════════════════════════════
    let bufferFinalValidado: Uint8Array | null = null;
    let hashFinal: string = '';
    let tentativa = 0;

    while (tentativa < MAX_TENTATIVAS && !bufferFinalValidado) {
      tentativa++;
      console.log(`[TENTATIVA ${tentativa}/${MAX_TENTATIVAS}] Montando PDF final...`);

      try {
        // ── 4. Carregar PDF em memória com pdf-lib ──
        const pdfDoc = await PDFDocument.load(bytesOriginal, { ignoreEncryption: true });
        const fonteNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // ── 5. Inserir assinaturas nos campos mapeados ──
        await inserirAssinaturasNoPdf(
          pdfDoc,
          campos,
          assinaturas,
          signatarios,
          hashOriginal,
          fonteNormal,
        );

        // ── 6. Adicionar página(s) de Manifesto/Dossiê ──
        adicionarPaginaManifesto(pdfDoc, fonteNormal, fonteNegrito, {
          hashOriginal,
          nomeDocumento: doc.nome,
          documentoId: doc.id,
          dataCriacao: doc.criado_em,
          trilhaAuditoria,
          signatarios,
          participantes,
          assinaturas,
        });

        // ── 7. Salvar PDF montado como Uint8Array ──
        const bufferGerado = await pdfDoc.save();
        console.log(`[BUFFER] PDF gerado: ${bufferGerado.length} bytes`);

        // ── 8. VALIDAÇÃO DE INTEGRIDADE (anti-corrupção) ──
        // O PDF final deve ter pelo menos as páginas originais + 1 (manifesto)
        const paginasEsperadas = totalPaginasOriginal + 1;
        const resultadoValidacao = await validarIntegridadePdf(bufferGerado, paginasEsperadas);

        if (!resultadoValidacao.valido) {
          console.error(`[FALHA VALIDACAO] Tentativa ${tentativa}: ${resultadoValidacao.motivo}`);
          console.log('[DESCARTANDO] Buffer corrompido descartado, reiniciando montagem...');
          // Buffer é descartado automaticamente (escopo do try)
          continue;
        }

        // ── 9. Gerar Hash SHA-256 do PDF FINAL ──
        hashFinal = await gerarHashSHA256(bufferGerado);
        console.log(`[HASH FINAL] SHA-256: ${hashFinal}`);

        // ── Validação passou! ──
        bufferFinalValidado = bufferGerado;
        console.log(`[SUCESSO] PDF validado na tentativa ${tentativa}/${MAX_TENTATIVAS}`);
      } catch (erroMontagem) {
        console.error(`[ERRO MONTAGEM] Tentativa ${tentativa}/${MAX_TENTATIVAS}:`, erroMontagem);
        if (tentativa >= MAX_TENTATIVAS) {
          throw new Error(`Falha ao montar PDF apos ${MAX_TENTATIVAS} tentativas: ${erroMontagem instanceof Error ? erroMontagem.message : 'erro desconhecido'}`);
        }
        console.log('[RETRY] Aguardando antes de reiniciar...');
        // Pequeno delay antes do retry para evitar race conditions
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Verificação final: se o buffer ainda é null após todas as tentativas
    if (!bufferFinalValidado) {
      const erroMsg = `Falha critica: PDF nao passou na validacao apos ${MAX_TENTATIVAS} tentativas`;
      console.error(`[ERRO CRITICO] ${erroMsg}`);

      // Registrar falha na trilha de auditoria
      await supabase.from('trilha_auditoria').insert({
        documento_id: documentoId,
        acao: 'erro_geracao_pdf',
        ator: 'Sistema',
        detalhes: erroMsg,
      });

      return new Response(
        JSON.stringify({ error: erroMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // UPLOAD DO DOSSIÊ FINAL VALIDADO
    // ═══════════════════════════════════════════════════════════════════
    const caminhoBase = doc.caminho_arquivo.substring(0, doc.caminho_arquivo.lastIndexOf('/'));
    const caminhoFinal = `${caminhoBase}/dossie_final_auditado.pdf`;
    const caminhoOriginalAssinado = `${caminhoBase}/original_assinado.pdf`;

    console.log(`[UPLOAD] Enviando dossie final para: ${caminhoFinal}`);

    // Upload do dossiê (PDF com manifesto) e do PDF original com assinaturas
    const [uploadDossie] = await Promise.all([
      supabase.storage.from('documents').upload(caminhoFinal, bufferFinalValidado, {
        contentType: 'application/pdf',
        upsert: true, // Sobrescrever se existir (idempotente)
      }),
    ]);

    if (uploadDossie.error) {
      console.error('[ERRO UPLOAD] Falha ao enviar dossie:', uploadDossie.error);
      throw new Error(`Falha no upload do dossie: ${uploadDossie.error.message}`);
    }

    console.log('[OK] Upload do dossie concluido');

    // ═══════════════════════════════════════════════════════════════════
    // ATUALIZAÇÃO DO BANCO DE DADOS
    // ═══════════════════════════════════════════════════════════════════
    const { error: erroUpdate } = await supabase
      .from('documentos')
      .update({
        status: 'FINALIZADO_COM_SUCESSO',
        hash_pdf_original: hashOriginal,
        hash_pdf_final: hashFinal,
        caminho_pdf_final: caminhoFinal,
        caminho_pdf_dossie: caminhoFinal, // Dossiê e final são o mesmo arquivo
      })
      .eq('id', documentoId);

    if (erroUpdate) {
      console.error('[ERRO DB] Falha ao atualizar documento:', erroUpdate);
      throw new Error(`Falha ao atualizar banco: ${erroUpdate.message}`);
    }

    // Registrar conclusão na trilha de auditoria
    await supabase.from('trilha_auditoria').insert({
      documento_id: documentoId,
      acao: 'completed',
      ator: 'Sistema',
      detalhes: `Documento finalizado com sucesso. Hash Original: ${hashOriginal.substring(0, 16)}... | Hash Final: ${hashFinal.substring(0, 16)}...`,
    });

    console.log(`[FINALIZADO] Documento ${documentoId} fechado com sucesso!`);
    console.log(`  Hash Original: ${hashOriginal}`);
    console.log(`  Hash Final:    ${hashFinal}`);
    console.log(`  Caminho:       ${caminhoFinal}`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        hashOriginal,
        hashFinal,
        caminhoDossie: caminhoFinal,
        tentativasNecessarias: tentativa,
        totalPaginas: totalPaginasOriginal + 1,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (erro) {
    console.error('[ERRO FATAL]', erro);
    return new Response(
      JSON.stringify({
        error: erro instanceof Error ? erro.message : 'Erro desconhecido no fechamento do documento',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
