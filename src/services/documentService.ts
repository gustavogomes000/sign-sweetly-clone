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
    .from('documents')
    .insert({
      user_id: data.userId,
      name: data.name,
      file_path: data.filePath,
      signature_type: data.signatureType,
      status: 'pending',
      deadline: data.deadline || null,
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
  role: string;
  order: number;
}>) {
  const { data, error } = await supabase
    .from('signers')
    .insert(
      signers.map((s) => ({
        document_id: documentId,
        name: s.name,
        email: s.email,
        phone: s.phone || null,
        role: s.role,
        sign_order: s.order,
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
    .from('document_fields')
    .insert(
      fields.map((f) => ({
        document_id: documentId,
        signer_id: f.signerId,
        field_type: f.fieldType,
        label: f.label || null,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        page: f.page,
        required: f.required,
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
    .from('validation_steps')
    .insert(
      steps.map((s) => ({
        document_id: documentId,
        signer_id: signerId,
        step_type: s.type,
        step_order: s.order,
        required: s.required,
        status: 'pending' as const,
      }))
    )
    .select();
  
  if (error) throw error;
  return data;
}

// Load signing data by token (public - no auth needed)
export async function loadSigningData(token: string) {
  // Get signer by token
  const { data: signer, error: signerError } = await supabase
    .from('signers')
    .select('*')
    .eq('sign_token', token)
    .single();
  
  if (signerError || !signer) throw new Error('Link de assinatura inválido ou expirado');
  
  // Get document
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', signer.document_id)
    .single();
  
  if (docError || !doc) throw new Error('Documento não encontrado');
  
  // Get fields for this signer
  const { data: fields } = await supabase
    .from('document_fields')
    .select('*')
    .eq('document_id', doc.id)
    .eq('signer_id', signer.id);
  
  // Get validation steps
  const { data: validationSteps } = await supabase
    .from('validation_steps')
    .select('*')
    .eq('signer_id', signer.id)
    .order('step_order', { ascending: true });
  
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
    .from('signatures')
    .insert([{
      signer_id: data.signerId,
      document_id: data.documentId,
      field_id: data.fieldId || null,
      signature_type: data.signatureType,
      image_base64: data.imageBase64 || null,
      typed_text: data.typedText || null,
      user_agent: data.userAgent || null,
      bluetech_response: (data.bluetechResponse as unknown as import('@/integrations/supabase/types').Json) || null,
    }]);
  
  if (sigError) throw sigError;
  
  // Update signer status
  await supabase
    .from('signers')
    .update({ status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', data.signerId);
  
  // Update field value
  if (data.fieldId) {
    await supabase
      .from('document_fields')
      .update({ value: data.signatureType === 'drawn' ? '[assinatura]' : data.typedText })
      .eq('id', data.fieldId);
  }
  
  // Check if all signers signed → mark document as signed
  const { data: allSigners } = await supabase
    .from('signers')
    .select('status')
    .eq('document_id', data.documentId);
  
  const allSigned = allSigners?.every((s) => s.status === 'signed');
  if (allSigned) {
    await supabase
      .from('documents')
      .update({ status: 'signed' })
      .eq('id', data.documentId);
  }
  
  // Add audit entry
  await supabase.from('audit_trail').insert({
    document_id: data.documentId,
    signer_id: data.signerId,
    action: 'signature',
    actor: data.signerId,
    details: `Assinatura ${data.signatureType === 'drawn' ? 'desenhada' : 'tipográfica'} realizada`,
  });

  // Trigger webhooks for signer.signed event
  try {
    await supabase.functions.invoke('dispatch-webhook', {
      body: {
        event: 'signer.signed',
        document_id: data.documentId,
        signer_id: data.signerId,
        payload: {
          signature_type: data.signatureType,
        },
      },
    });

    // If all signed, also trigger document.completed
    if (allSigned) {
      await supabase.functions.invoke('dispatch-webhook', {
        body: {
          event: 'document.completed',
          document_id: data.documentId,
          payload: { total_signers: allSigners?.length },
        },
      });
    }
  } catch (whErr) {
    console.warn('Webhook dispatch failed:', whErr);
  }
}

// Complete a validation step (KYC step after signing)
export async function completeValidationStep(stepId: string, result?: Record<string, unknown>) {
  const { error } = await supabase
    .from('validation_steps')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      bluetech_response: (result as unknown as import('@/integrations/supabase/types').Json) || null,
    })
    .eq('id', stepId);
  
  if (error) throw error;
}
