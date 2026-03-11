import { supabase } from '@/integrations/supabase/client';

const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'png', 'doc', 'docx'];

export async function uploadDocumentFile(file: File, userId: string) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    throw new Error('Formato não suportado. Apenas PDF, PNG e DOC/DOCX são aceitos.');
  }
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  
  const { error } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type });
  
  if (error) throw error;
  
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(path);
  
  return { path, publicUrl: urlData.publicUrl };
}

export async function createDocument(data: {
  userId: string;
  name: string;
  filePath: string;
  signatureType: string;
  deadline?: string;
}) {
  const { data: doc, error } = await supabase
    .from('documentos')
    .insert({
      usuario_id: data.userId,
      nome: data.name,
      caminho_arquivo: data.filePath,
      tipo_assinatura: data.signatureType,
      status: 'pending',
      prazo: data.deadline || null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return doc;
}

export async function createSigners(documentId: string, signers: Array<{
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  role: string;
  order: number;
}>) {
  const { data, error } = await supabase
    .from('signatarios')
    .insert(
      signers.map((s) => ({
        documento_id: documentId,
        nome: s.name,
        email: s.email,
        telefone: s.phone || null,
        cpf: s.cpf || null,
        funcao: s.role,
        ordem_assinatura: s.order,
        status: 'pending' as const,
      }))
    )
    .select();
  
  if (error) throw error;
  return data;
}

export async function createDocumentFields(documentId: string, fields: Array<{
  signerId: string;
  fieldType: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
}>) {
  if (fields.length === 0) return [];
  
  const { data, error } = await supabase
    .from('campos_documento')
    .insert(
      fields.map((f) => ({
        documento_id: documentId,
        signatario_id: f.signerId,
        tipo_campo: f.fieldType,
        rotulo: f.label || null,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        pagina: f.page,
        obrigatorio: f.required,
      }))
    )
    .select();
  
  if (error) throw error;
  return data;
}

export async function createValidationSteps(documentId: string, signerId: string, steps: Array<{
  type: string;
  order: number;
  required: boolean;
}>) {
  if (steps.length === 0) return [];
  
  const { data, error } = await supabase
    .from('etapas_validacao')
    .insert(
      steps.map((s) => ({
        documento_id: documentId,
        signatario_id: signerId,
        tipo_etapa: s.type,
        ordem_etapa: s.order,
        obrigatorio: s.required,
        status: 'pending' as const,
      }))
    )
    .select();
  
  if (error) throw error;
  return data;
}

// Load signing data by token (public - no auth needed)
export async function loadSigningData(token: string) {
  const { data: signer, error: signerError } = await supabase
    .from('signatarios')
    .select('*')
    .eq('token_assinatura', token)
    .single();
  
  if (signerError || !signer) throw new Error('Link de assinatura inválido ou expirado');
  
  const { data: doc, error: docError } = await supabase
    .from('documentos')
    .select('*')
    .eq('id', signer.documento_id)
    .single();
  
  if (docError || !doc) throw new Error('Documento não encontrado');
  
  const { data: fields } = await supabase
    .from('campos_documento')
    .select('*')
    .eq('documento_id', doc.id)
    .eq('signatario_id', signer.id);
  
  const { data: validationSteps } = await supabase
    .from('etapas_validacao')
    .select('*')
    .eq('signatario_id', signer.id)
    .order('ordem_etapa', { ascending: true });
  
  return {
    signer,
    document: doc,
    fields: fields || [],
    validationSteps: validationSteps || [],
  };
}

// Save signature result
export async function saveSignature(data: {
  signerId: string;
  documentId: string;
  fieldId?: string;
  signatureType: 'drawn' | 'typed';
  imageBase64?: string;
  typedText?: string;
  userAgent?: string;
  bluetechResponse?: Record<string, unknown>;
}) {
  const { error: sigError } = await supabase
    .from('assinaturas')
    .insert([{
      signatario_id: data.signerId,
      documento_id: data.documentId,
      campo_id: data.fieldId || null,
      tipo_assinatura: data.signatureType,
      imagem_base64: data.imageBase64 || null,
      texto_digitado: data.typedText || null,
      user_agent: data.userAgent || null,
      resposta_externa: (data.bluetechResponse as any) || null,
    }]);
  
  if (sigError) throw sigError;
  
  if (data.fieldId) {
    await supabase
      .from('campos_documento')
      .update({ valor: data.signatureType === 'drawn' ? '[assinatura]' : data.typedText })
      .eq('id', data.fieldId);
  }
  
  await supabase.from('trilha_auditoria').insert({
    documento_id: data.documentId,
    signatario_id: data.signerId,
    acao: 'signature',
    ator: data.signerId,
    detalhes: `Assinatura ${data.signatureType === 'drawn' ? 'desenhada' : 'tipográfica'} realizada`,
  });
}

// Complete a validation step
export async function completeValidationStep(stepId: string, result?: Record<string, unknown>) {
  const { error } = await supabase
    .from('etapas_validacao')
    .update({
      status: 'completed',
      concluido_em: new Date().toISOString(),
      resposta_externa: (result as any) || null,
    })
    .eq('id', stepId);
  
  if (error) throw error;
}
