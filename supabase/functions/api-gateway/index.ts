import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Content-Type': 'application/json',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function error(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authenticate(req: Request): Promise<{ userId: string; scopes: string[] } | null> {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) return null;

  const keyHash = await hashKey(apiKey);
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('validate_api_key', { p_key_hash: keyHash });
  if (error || !data || data.length === 0) return null;

  await supabase.from('chaves_api').update({ ultimo_uso_em: new Date().toISOString() }).eq('hash_chave', keyHash);

  return { userId: data[0].user_id, scopes: data[0].scopes };
}

function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes('*');
}

function parseRoute(url: string): { path: string; segments: string[] } {
  const u = new URL(url);
  const path = u.pathname.replace(/^\/api-gateway\/?/, '/').replace(/\/+/g, '/');
  const segments = path.split('/').filter(Boolean);
  return { path, segments };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) {
      return error('API key inválida ou ausente. Envie o header x-api-key.', 401);
    }

    const { segments } = parseRoute(req.url);
    const method = req.method;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ─── POST /documents ───────────────────────────────
    if (method === 'POST' && segments[0] === 'documents' && segments.length === 1) {
      if (!hasScope(auth.scopes, 'documents:write')) return error('Permissão insuficiente', 403);

      const body = await req.json();
      const { name, file_url, signature_type, deadline, signers, fields, callback_url } = body;

      if (!name || !signers || !Array.isArray(signers) || signers.length === 0) {
        return error('Campos obrigatórios: name, signers (array com name e email)');
      }

      const { data: doc, error: docErr } = await supabase.from('documentos').insert({
        usuario_id: auth.userId,
        nome: name,
        caminho_arquivo: file_url || null,
        tipo_assinatura: signature_type || 'electronic',
        status: body.auto_send === false ? 'draft' : 'pending',
        prazo: deadline || null,
        origem: 'api',
        referencia_externa: body.external_ref || null,
        sistema_origem: body.source_system || null,
      }).select().single();

      if (docErr) return error(`Erro ao criar documento: ${docErr.message}`, 500);

      const signerInserts = signers.map((s: any, i: number) => ({
        documento_id: doc.id,
        nome: s.name,
        email: s.email,
        telefone: s.phone || null,
        funcao: s.role || 'Signatário',
        ordem_assinatura: s.order || i + 1,
        status: 'pending',
      }));

      const { data: dbSigners, error: sigErr } = await supabase.from('signatarios').insert(signerInserts).select();
      if (sigErr) return error(`Erro ao criar signatários: ${sigErr.message}`, 500);

      let dbFields: any[] = [];
      if (fields && Array.isArray(fields) && fields.length > 0) {
        const fieldInserts = fields.map((f: any) => {
          const signerIdx = f.signer_index ?? 0;
          return {
            documento_id: doc.id,
            signatario_id: dbSigners[signerIdx]?.id || dbSigners[0]?.id,
            tipo_campo: f.type || 'signature',
            rotulo: f.label || null,
            x: f.x ?? 100,
            y: f.y ?? 600,
            width: f.width ?? 200,
            height: f.height ?? 60,
            pagina: f.page ?? 1,
            obrigatorio: f.required !== false,
          };
        });

        const { data: fData, error: fErr } = await supabase.from('campos_documento').insert(fieldInserts).select();
        if (!fErr && fData) dbFields = fData;
      }

      if (callback_url) {
        await supabase.from('webhooks').insert({
          usuario_id: auth.userId,
          url: callback_url,
          eventos: ['document.signed', 'document.completed', 'signer.signed', 'signer.refused'],
          ativo: true,
        });
      }

      const emailResults: { email: string; success: boolean }[] = [];
      for (const signer of dbSigners!) {
        try {
          await supabase.functions.invoke('send-signing-email', {
            body: {
              signerName: signer.nome,
              signerEmail: signer.email,
              documentName: name,
              signToken: signer.token_assinatura,
            },
          });
          emailResults.push({ email: signer.email, success: true });
        } catch {
          emailResults.push({ email: signer.email, success: false });
        }
      }

      await supabase.from('trilha_auditoria').insert({
        documento_id: doc.id,
        acao: 'created',
        ator: 'API',
        detalhes: `Documento criado via API com ${dbSigners!.length} signatário(s)`,
      });

      await supabase.from('trilha_auditoria').insert({
        documento_id: doc.id,
        acao: 'sent',
        ator: 'API',
        detalhes: `Enviado para assinatura via API`,
      });

      return json({
        id: doc.id,
        name: doc.nome,
        status: doc.status,
        created_at: doc.criado_em,
        signers: dbSigners!.map((s: any) => ({
          id: s.id,
          name: s.nome,
          email: s.email,
          sign_token: s.token_assinatura,
          sign_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || ''}/sign/${s.token_assinatura}`,
          status: s.status,
        })),
        fields: dbFields.map((f: any) => ({ id: f.id, type: f.tipo_campo, page: f.pagina, x: f.x, y: f.y })),
        emails: emailResults,
      }, 201);
    }

    // ─── GET /documents ────────────────────────────────
    if (method === 'GET' && segments[0] === 'documents' && segments.length === 1) {
      if (!hasScope(auth.scopes, 'documents:read')) return error('Permissão insuficiente', 403);

      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase.from('documentos').select('*', { count: 'exact' })
        .eq('usuario_id', auth.userId)
        .order('criado_em', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);

      const { data: docs, error: qErr, count } = await query;
      if (qErr) return error(qErr.message, 500);

      const docIds = (docs || []).map((d: any) => d.id);
      const { data: allSigners } = docIds.length > 0
        ? await supabase.from('signatarios').select('*').in('documento_id', docIds)
        : { data: [] };

      const signersByDoc = new Map<string, any[]>();
      (allSigners || []).forEach((s: any) => {
        const list = signersByDoc.get(s.documento_id) || [];
        list.push(s);
        signersByDoc.set(s.documento_id, list);
      });

      return json({
        data: (docs || []).map((d: any) => ({
          id: d.id,
          name: d.nome,
          status: d.status,
          signature_type: d.tipo_assinatura,
          created_at: d.criado_em,
          updated_at: d.atualizado_em,
          deadline: d.prazo,
          signers: (signersByDoc.get(d.id) || []).map((s: any) => ({
            id: s.id,
            name: s.nome,
            email: s.email,
            status: s.status,
            signed_at: s.assinado_em,
          })),
        })),
        total: count,
        limit,
        offset,
      });
    }

    // ─── GET /documents/:id ────────────────────────────
    if (method === 'GET' && segments[0] === 'documents' && segments.length === 2) {
      if (!hasScope(auth.scopes, 'documents:read')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documentos').select('*').eq('id', docId).eq('usuario_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);

      const [signersRes, fieldsRes, auditRes] = await Promise.all([
        supabase.from('signatarios').select('*').eq('documento_id', docId).order('ordem_assinatura'),
        supabase.from('campos_documento').select('*').eq('documento_id', docId),
        supabase.from('trilha_auditoria').select('*').eq('documento_id', docId).order('criado_em'),
      ]);

      return json({
        id: doc.id,
        name: doc.nome,
        status: doc.status,
        signature_type: doc.tipo_assinatura,
        file_path: doc.caminho_arquivo,
        created_at: doc.criado_em,
        updated_at: doc.atualizado_em,
        deadline: doc.prazo,
        signers: (signersRes.data || []).map((s: any) => ({
          id: s.id, name: s.nome, email: s.email, phone: s.telefone,
          role: s.funcao, status: s.status, signed_at: s.assinado_em, sign_token: s.token_assinatura,
        })),
        fields: (fieldsRes.data || []).map((f: any) => ({
          id: f.id, type: f.tipo_campo, page: f.pagina, x: f.x, y: f.y, width: f.width, height: f.height, value: f.valor,
        })),
        audit_trail: (auditRes.data || []).map((a: any) => ({
          action: a.acao, actor: a.ator, details: a.detalhes, created_at: a.criado_em,
        })),
      });
    }

    // ─── POST /documents/:id/cancel ────────────────────
    if (method === 'POST' && segments[0] === 'documents' && segments[2] === 'cancel') {
      if (!hasScope(auth.scopes, 'documents:write')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documentos').select('id, status').eq('id', docId).eq('usuario_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);
      if (doc.status !== 'pending' && doc.status !== 'draft') return error('Só é possível cancelar documentos pendentes ou rascunhos');

      await supabase.from('documentos').update({ status: 'cancelled' }).eq('id', docId);
      await supabase.from('trilha_auditoria').insert({
        documento_id: docId, acao: 'cancelled', ator: 'API', detalhes: 'Documento cancelado via API',
      });

      await triggerWebhooks(supabase, auth.userId, 'document.cancelled', { document_id: docId });

      return json({ id: docId, status: 'cancelled' });
    }

    // ─── POST /documents/:id/resend ────────────────────
    if (method === 'POST' && segments[0] === 'documents' && segments[2] === 'resend') {
      if (!hasScope(auth.scopes, 'documents:write')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documentos').select('*').eq('id', docId).eq('usuario_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);

      const { data: pendingSigners } = await supabase.from('signatarios').select('*').eq('documento_id', docId).eq('status', 'pending');
      if (!pendingSigners || pendingSigners.length === 0) return error('Nenhum signatário pendente');

      const results: { email: string; success: boolean }[] = [];
      for (const s of pendingSigners) {
        try {
          await supabase.functions.invoke('send-signing-email', {
            body: { signerName: s.nome, signerEmail: s.email, documentName: doc.nome, signToken: s.token_assinatura },
          });
          results.push({ email: s.email, success: true });
        } catch {
          results.push({ email: s.email, success: false });
        }
      }

      await supabase.from('trilha_auditoria').insert({
        documento_id: docId, acao: 'reminder', ator: 'API',
        detalhes: `Lembrete reenviado para ${pendingSigners.length} signatário(s) via API`,
      });

      return json({ resent_to: results });
    }

    // ─── GET /documents/:id/status ─────────────────────
    if (method === 'GET' && segments[0] === 'documents' && segments[2] === 'status') {
      if (!hasScope(auth.scopes, 'documents:read')) return error('Permissão insuficiente', 403);

      const docId = segments[1];
      const { data: doc } = await supabase.from('documentos').select('id, status, nome').eq('id', docId).eq('usuario_id', auth.userId).single();
      if (!doc) return error('Documento não encontrado', 404);

      const { data: signers } = await supabase.from('signatarios').select('nome, email, status, assinado_em').eq('documento_id', docId).order('ordem_assinatura');

      return json({
        document_id: doc.id,
        document_name: doc.nome,
        status: doc.status,
        signers: (signers || []).map((s: any) => ({ name: s.nome, email: s.email, status: s.status, signed_at: s.assinado_em })),
        progress: {
          total: (signers || []).length,
          signed: (signers || []).filter((s: any) => s.status === 'signed').length,
          pending: (signers || []).filter((s: any) => s.status === 'pending').length,
          refused: (signers || []).filter((s: any) => s.status === 'refused').length,
        },
      });
    }

    // ─── Webhooks CRUD ─────────────────────────────────
    if (segments[0] === 'webhooks') {
      if (method === 'GET' && segments.length === 1) {
        const { data } = await supabase.from('webhooks').select('*').eq('usuario_id', auth.userId).order('criado_em', { ascending: false });
        return json({ data: data || [] });
      }

      if (method === 'POST' && segments.length === 1) {
        const body = await req.json();
        if (!body.url) return error('Campo obrigatório: url');
        const { data, error: wErr } = await supabase.from('webhooks').insert({
          usuario_id: auth.userId,
          url: body.url,
          eventos: body.events || ['document.signed', 'document.completed'],
          segredo: body.secret || crypto.randomUUID(),
          ativo: true,
        }).select().single();
        if (wErr) return error(wErr.message, 500);
        return json(data, 201);
      }

      if (method === 'DELETE' && segments.length === 2) {
        const whId = segments[1];
        await supabase.from('webhooks').delete().eq('id', whId).eq('usuario_id', auth.userId);
        return json({ deleted: true });
      }
    }

    return error(`Rota não encontrada: ${method} /${segments.join('/')}`, 404);

  } catch (err) {
    console.error('API Error:', err);
    return error(err instanceof Error ? err.message : 'Erro interno', 500);
  }
});

// ─── Webhook Dispatcher ──────────────────────────────
async function triggerWebhooks(supabase: any, userId: string, event: string, payload: Record<string, unknown>) {
  try {
    const { data: webhooks } = await supabase.from('webhooks')
      .select('*')
      .eq('usuario_id', userId)
      .eq('ativo', true)
      .contains('eventos', [event]);

    if (!webhooks || webhooks.length === 0) return;

    for (const wh of webhooks) {
      try {
        const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
        const res = await fetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': wh.segredo || '',
            'X-Webhook-Event': event,
          },
          body,
        });

        await supabase.from('entregas_webhook').insert({
          webhook_id: wh.id,
          evento: event,
          payload: { event, payload },
          codigo_status: res.status,
          sucesso: res.ok,
          corpo_resposta: await res.text().catch(() => ''),
        });

        await supabase.from('webhooks').update({
          ultimo_disparo_em: new Date().toISOString(),
          contagem_falhas: res.ok ? 0 : wh.contagem_falhas + 1,
        }).eq('id', wh.id);
      } catch (err) {
        await supabase.from('entregas_webhook').insert({
          webhook_id: wh.id,
          evento: event,
          payload: { event, payload },
          codigo_status: 0,
          sucesso: false,
          corpo_resposta: err instanceof Error ? err.message : 'Connection error',
        });
      }
    }
  } catch (err) {
    console.error('Webhook trigger error:', err);
  }
}