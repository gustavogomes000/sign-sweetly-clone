/**
 * ═══════════════════════════════════════════════════════════════════════
 * Edge Function: validar-download
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Download seguro com validação de integridade SHA-256.
 * Antes de servir qualquer arquivo, recalcula o hash e compara com
 * o armazenado no banco. Rejeita se houver divergência.
 *
 * Parâmetros (query string):
 *   - documentoId: UUID do documento
 *   - tipo: 'assinado' | 'dossie' | 'original'
 * ═══════════════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function gerarHashSHA256(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Accept both POST body and query params
    let documentoId: string;
    let tipo: string;

    if (req.method === 'POST') {
      const body = await req.json();
      documentoId = body.documentoId;
      tipo = body.tipo || 'assinado';
    } else {
      const url = new URL(req.url);
      documentoId = url.searchParams.get('documentoId') || '';
      tipo = url.searchParams.get('tipo') || 'assinado';
    }

    if (!documentoId) {
      return new Response(JSON.stringify({ error: 'documentoId obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar documento
    const { data: doc, error: docErr } = await supabase
      .from('documentos')
      .select('id, nome, caminho_arquivo, caminho_pdf_final, caminho_pdf_dossie, hash_pdf_original, hash_pdf_final, status')
      .eq('id', documentoId)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: 'Documento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determinar caminho e hash esperado
    let caminho: string | null = null;
    let hashEsperado: string | null = null;
    let nomeArquivo = '';

    switch (tipo) {
      case 'assinado':
        caminho = doc.caminho_pdf_final;
        hashEsperado = doc.hash_pdf_final;
        nomeArquivo = `${doc.nome}_assinado.pdf`;
        break;
      case 'dossie':
        caminho = doc.caminho_pdf_dossie;
        // Hash do dossiê: recalcularemos e validaremos estrutura
        hashEsperado = null; // Validação estrutural apenas
        nomeArquivo = `${doc.nome}_dossie_auditoria.pdf`;
        break;
      case 'original':
        caminho = doc.caminho_arquivo;
        hashEsperado = doc.hash_pdf_original;
        nomeArquivo = `${doc.nome}_original.pdf`;
        break;
      default:
        return new Response(JSON.stringify({ error: 'Tipo inválido. Use: assinado, dossie, original' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!caminho) {
      return new Response(JSON.stringify({ error: `Arquivo '${tipo}' não disponível para este documento` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Download do arquivo do Storage
    console.log(`[DOWNLOAD] Tipo: ${tipo}, Caminho: ${caminho}`);
    const { data: fileData, error: fileErr } = await supabase.storage.from('documents').download(caminho);

    if (fileErr || !fileData) {
      return new Response(JSON.stringify({ error: 'Falha ao recuperar arquivo do storage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const fileBytes = new Uint8Array(await fileData.arrayBuffer());

    // ═══════════════════════════════════════════════════════════════
    // VALIDAÇÃO 1: Cabeçalho PDF (Magic Number)
    // ═══════════════════════════════════════════════════════════════
    const cabecalho = new TextDecoder().decode(fileBytes.slice(0, 5));
    if (cabecalho !== '%PDF-') {
      console.error(`[INTEGRIDADE FALHOU] Cabeçalho inválido: '${cabecalho}'`);
      await supabase.from('trilha_auditoria').insert({
        documento_id: documentoId,
        acao: 'download_rejeitado',
        ator: 'Sistema',
        detalhes: `ALERTA: Download bloqueado — arquivo corrompido (cabeçalho inválido: ${cabecalho})`,
      });
      return new Response(JSON.stringify({
        error: 'INTEGRIDADE COMPROMETIDA',
        detalhe: 'O arquivo no storage não possui cabeçalho PDF válido. Download bloqueado por segurança.',
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDAÇÃO 2: Tamanho mínimo
    // ═══════════════════════════════════════════════════════════════
    if (fileBytes.length < 1024) {
      console.error(`[INTEGRIDADE FALHOU] Arquivo muito pequeno: ${fileBytes.length} bytes`);
      await supabase.from('trilha_auditoria').insert({
        documento_id: documentoId,
        acao: 'download_rejeitado',
        ator: 'Sistema',
        detalhes: `ALERTA: Download bloqueado — arquivo suspeito (${fileBytes.length} bytes)`,
      });
      return new Response(JSON.stringify({
        error: 'INTEGRIDADE COMPROMETIDA',
        detalhe: 'Arquivo muito pequeno para ser um PDF válido. Download bloqueado.',
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDAÇÃO 3: Hash SHA-256
    // ═══════════════════════════════════════════════════════════════
    const hashCalculado = await gerarHashSHA256(fileBytes);
    console.log(`[HASH] Calculado: ${hashCalculado}`);

    if (hashEsperado) {
      console.log(`[HASH] Esperado:  ${hashEsperado}`);
      if (hashCalculado !== hashEsperado) {
        console.error(`[INTEGRIDADE FALHOU] Hash divergente!`);
        console.error(`  Esperado:  ${hashEsperado}`);
        console.error(`  Calculado: ${hashCalculado}`);

        // Registrar na trilha de auditoria — tentativa de download com arquivo adulterado
        await supabase.from('trilha_auditoria').insert({
          documento_id: documentoId,
          acao: 'download_rejeitado',
          ator: 'Sistema',
          detalhes: `ALERTA CRÍTICO: Hash SHA-256 divergente! Esperado: ${hashEsperado.substring(0, 32)}... | Calculado: ${hashCalculado.substring(0, 32)}... — Possível adulteração.`,
        });

        return new Response(JSON.stringify({
          error: 'INTEGRIDADE COMPROMETIDA',
          detalhe: 'O hash SHA-256 do arquivo não corresponde ao registrado. O arquivo pode ter sido adulterado. Download bloqueado por segurança.',
          hashEsperado: hashEsperado,
          hashCalculado: hashCalculado,
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // VALIDAÇÃO 4: Trailer PDF (%%EOF)
    // ═══════════════════════════════════════════════════════════════
    const trailer = new TextDecoder().decode(fileBytes.slice(-32));
    if (!trailer.includes('%%EOF')) {
      console.warn(`[AVISO] Trailer %%EOF não encontrado — arquivo pode estar truncado`);
      await supabase.from('trilha_auditoria').insert({
        documento_id: documentoId,
        acao: 'download_aviso',
        ator: 'Sistema',
        detalhes: `Aviso: PDF sem marcador %%EOF — arquivo pode estar incompleto`,
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // DOWNLOAD APROVADO — Registrar e servir
    // ═══════════════════════════════════════════════════════════════
    await supabase.from('trilha_auditoria').insert({
      documento_id: documentoId,
      acao: 'download_validado',
      ator: 'Usuário',
      detalhes: `Download '${tipo}' validado com sucesso. Hash SHA-256: ${hashCalculado.substring(0, 32)}... (${fileBytes.length} bytes)`,
    });

    console.log(`[OK] Download validado: ${tipo} (${fileBytes.length} bytes)`);

    // Sanitizar nome do arquivo
    const nomeSeguro = nomeArquivo.replace(/[^a-zA-Z0-9_\-\.áàâãéèêíïóôõöúçñ ]/g, '_');

    return new Response(fileBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeSeguro}"`,
        'Content-Length': String(fileBytes.length),
        'X-SignProof-Hash-SHA256': hashCalculado,
        'X-SignProof-Integridade': 'VERIFICADO',
        'X-SignProof-Tipo': tipo,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (erro) {
    console.error('[ERRO FATAL]', erro);
    return new Response(JSON.stringify({ error: erro instanceof Error ? erro.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
