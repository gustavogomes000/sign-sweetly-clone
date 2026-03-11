/**
 * Edge Function: reprocessar-pendentes
 * 
 * Encontra documentos stuck em 'signed' (sem PDFs gerados) e 
 * re-aciona gerar-documento-final para cada um.
 * Pode ser chamado manualmente ou via cron.
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

    // Buscar documentos stuck: status='signed' mas sem PDFs
    const { data: docsStuck, error } = await supabase
      .from('documentos')
      .select('id, nome, status, criado_em')
      .eq('status', 'signed')
      .is('caminho_pdf_final', null)
      .order('criado_em', { ascending: true });

    if (error) throw error;

    if (!docsStuck || docsStuck.length === 0) {
      return new Response(JSON.stringify({ sucesso: true, mensagem: 'Nenhum documento pendente', total: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[REPROCESSAR] ${docsStuck.length} documento(s) encontrado(s)`);

    const resultados: Array<{ id: string; nome: string; sucesso: boolean; erro?: string }> = [];

    for (const doc of docsStuck) {
      try {
        console.log(`[REPROCESSAR] Processando ${doc.id} (${doc.nome})...`);

        // Verificar se todos assinantes realmente assinaram
        const { data: signatarios } = await supabase
          .from('signatarios')
          .select('id, papel, funcao, status')
          .eq('documento_id', doc.id);

        const assinantes = (signatarios || []).filter(s => s.papel === 'ASSINANTE' || s.funcao === 'signer');
        const todosConcluidos = assinantes.length > 0 && assinantes.every(a => a.status === 'signed');

        if (!todosConcluidos) {
          console.log(`[SKIP] ${doc.id}: nem todos assinaram ainda`);
          resultados.push({ id: doc.id, nome: doc.nome, sucesso: false, erro: 'Nem todos assinaram' });
          continue;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55000);

        const resp = await fetch(`${supabaseUrl}/functions/v1/gerar-documento-final`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ documentoId: doc.id }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const dados = await resp.json();

        if (resp.ok && dados.sucesso) {
          console.log(`[OK] ${doc.id} finalizado`);
          resultados.push({ id: doc.id, nome: doc.nome, sucesso: true });
        } else {
          console.error(`[ERRO] ${doc.id}:`, dados);
          resultados.push({ id: doc.id, nome: doc.nome, sucesso: false, erro: dados.error || 'Falha desconhecida' });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        console.error(`[ERRO] ${doc.id}:`, msg);
        resultados.push({ id: doc.id, nome: doc.nome, sucesso: false, erro: msg });
      }
    }

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    return new Response(JSON.stringify({
      sucesso: true,
      total: docsStuck.length,
      sucessos,
      falhas,
      resultados,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (erro) {
    console.error('[ERRO FATAL]', erro);
    return new Response(JSON.stringify({ error: erro instanceof Error ? erro.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
