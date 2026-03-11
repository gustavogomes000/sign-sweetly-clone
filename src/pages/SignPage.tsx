/**
 * SignPage — Fluxo de assinatura estilo DocuSeal
 * 
 * Características replicadas do DocuSeal:
 * 1. Painel flutuante na parte inferior (bottom panel)
 * 2. Campos destacados no PDF com borda vermelha (field areas)
 * 3. Navegação sequencial campo a campo (step-by-step)
 * 4. Painel minimizável com botão "Assinar agora" / "Próximo"
 * 5. Progresso via dots na parte inferior
 * 6. Auto-scroll do PDF para o campo ativo
 * 7. Após todos os campos → validações KYC → conclusão
 * 
 * Mantém todas as regras de negócio do SignProof:
 * - Validações KYC (selfie, documento, selfie com documento)
 * - Salvamento via documentService + processar-assinatura
 * - Geração automática de 2 PDFs (assinado + dossiê)
 * - Trilha de auditoria completa
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2, FileText, Pen, Download, Loader2, AlertCircle,
  ChevronUp, ChevronDown, ShieldCheck, X, Type, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { loadSigningData, saveSignature, completeValidationStep } from '@/services/documentService';
import { supabase } from '@/integrations/supabase/client';
import PdfPagePreview from '@/components/documents/PdfPagePreview';
import { VLAssinatura, VLSelfie, VLDocumento, VLSelfieDoc } from '@/components/valeris';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface SignField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  field_type: string;
  label: string | null;
  value: string | null;
  required: boolean;
}

interface ValidationStepData {
  id: string;
  step_type: string;
  step_order: number;
  status: string;
  required: boolean;
}

type PageStep = 'loading' | 'document' | 'validation' | 'complete' | 'error';

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const { toast } = useToast();

  // DocuSeal-style state
  const [currentStep, setCurrentStep] = useState(0);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationStepIdx, setValidationStepIdx] = useState(0);

  // Field values
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signedFieldIds, setSignedFieldIds] = useState<Set<string>>(new Set());
  // Store signature images (base64) and typed texts per field for inline rendering
  const [signatureImages, setSignatureImages] = useState<Record<string, string>>({});
  const [signatureTexts, setSignatureTexts] = useState<Record<string, string>>({});

  // PDF download URLs
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [dossiePdfUrl, setDossiePdfUrl] = useState<string | null>(null);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fieldAreaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const formPanelRef = useRef<HTMLDivElement>(null);

  const [signerData, setSignerData] = useState<{
    signer: Record<string, unknown>;
    document: Record<string, unknown>;
    fields: SignField[];
    validationSteps: ValidationStepData[];
  } | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // LOAD DATA
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!token) {
      setPageStep('error');
      setErrorMsg('Token de assinatura não fornecido');
      return;
    }
    loadSigningData(token)
      .then((data) => {
        const rawFields = (data.fields || []) as any[];
        const mappedFields: SignField[] = rawFields.map((f: any) => ({
          id: f.id,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          page: f.pagina || 1,
          field_type: f.tipo_campo,
          label: f.rotulo,
          value: f.valor,
          required: f.obrigatorio,
        }));
        const rawSteps = (data.validationSteps || []) as any[];
        const mappedSteps: ValidationStepData[] = rawSteps.map((s: any) => ({
          id: s.id,
          step_type: s.tipo_etapa,
          step_order: s.ordem_etapa,
          status: s.status,
          required: s.obrigatorio,
        }));

        const mappedData = {
          signer: data.signer as Record<string, unknown>,
          document: data.document as Record<string, unknown>,
          fields: mappedFields,
          validationSteps: mappedSteps,
        };
        setSignerData(mappedData);

        const initialValues: Record<string, string> = {};
        const alreadySigned = new Set<string>();
        mappedFields.forEach((f) => {
          if (f.value) {
            initialValues[f.id] = f.value;
            if (f.field_type === 'signature' || f.field_type === 'initials') {
              alreadySigned.add(f.id);
            }
          }
        });
        setFieldValues(initialValues);
        setSignedFieldIds(alreadySigned);

        if ((data.signer as { status: string }).status === 'signed') {
          setPageStep('complete');
        } else {
          setPageStep('document');
        }
      })
      .catch((err) => {
        setPageStep('error');
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar documento');
      });
  }, [token]);

  // ═══════════════════════════════════════════════════════════════
  // COMPUTED — DocuSeal-style step fields (each field = one step)
  // ═══════════════════════════════════════════════════════════════

  const stepFields = useMemo(() => {
    if (!signerData) return [];
    return [...signerData.fields].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      return a.y - b.y;
    });
  }, [signerData]);

  const currentField = stepFields[currentStep] || null;
  const totalSteps = stepFields.length;
  const totalPages = Math.max(1, ...stepFields.map((f) => f.page || 1));

  // Current page is determined by the active field (DocuSeal behavior)
  const currentPage = currentField?.page || 1;

  const isFieldFilled = useCallback((field: SignField) => {
    const isSig = field.field_type === 'signature' || field.field_type === 'initials';
    if (isSig) return signedFieldIds.has(field.id);
    return !!(fieldValues[field.id] || '').trim();
  }, [fieldValues, signedFieldIds]);

  const filledCount = stepFields.filter(isFieldFilled).length;
  const allRequiredFilled = stepFields.filter(f => f.required && !isFieldFilled(f)).length === 0;

  const isCurrentSigType = currentField?.field_type === 'signature' || currentField?.field_type === 'initials';
  const isCurrentFilled = currentField ? isFieldFilled(currentField) : false;

  // Find first empty required field (DocuSeal behavior)
  const emptyRequiredStepIdx = stepFields.findIndex(f => f.required && !isFieldFilled(f));

  // ═══════════════════════════════════════════════════════════════
  // SCROLL INTO FIELD — DocuSeal behavior
  // ═══════════════════════════════════════════════════════════════

  const scrollIntoField = useCallback((field: SignField) => {
    const el = fieldAreaRefs.current[field.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Auto-scroll when step changes
  useEffect(() => {
    if (currentField && pageStep === 'document') {
      setTimeout(() => scrollIntoField(currentField), 150);
    }
  }, [currentStep, currentField, scrollIntoField, pageStep]);

  // ═══════════════════════════════════════════════════════════════
  // STEP NAVIGATION — DocuSeal behavior
  // ═══════════════════════════════════════════════════════════════

  const goToStep = useCallback((idx: number) => {
    if (idx >= 0 && idx < totalSteps) {
      setCurrentStep(idx);
      setIsFormVisible(true);
    }
  }, [totalSteps]);

  const goToNextStep = useCallback(() => {
    if (currentStep + 1 < totalSteps) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, totalSteps, goToStep]);

  // ═══════════════════════════════════════════════════════════════
  // FIELD VALUE UPDATE
  // ═══════════════════════════════════════════════════════════════

  const saveFieldToDb = useCallback(async (fieldId: string, value: string) => {
    try {
      await supabase.from('campos_documento').update({ valor: value }).eq('id', fieldId);
    } catch (e) {
      console.warn('Erro ao salvar campo:', e);
    }
  }, []);

  const updateFieldValue = useCallback((fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  // Debounced save: persist to DB when user stops typing
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedSaveField = useCallback((fieldId: string, value: string) => {
    if (saveTimerRef.current[fieldId]) clearTimeout(saveTimerRef.current[fieldId]);
    saveTimerRef.current[fieldId] = setTimeout(() => {
      saveFieldToDb(fieldId, value);
    }, 500);
  }, [saveFieldToDb]);

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    updateFieldValue(fieldId, value);
    debouncedSaveField(fieldId, value);
  }, [updateFieldValue, debouncedSaveField]);

  // ═══════════════════════════════════════════════════════════════
  // SIGNATURE HANDLING
  // ═══════════════════════════════════════════════════════════════

  const handleSignatureComplete = async (result: {
    signatureType: 'drawn' | 'typed';
    imageBase64?: string;
    typedText?: string;
  }) => {
    if (!signerData || !currentField) return;
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };
    try {
      await saveSignature({
        signerId: signer.id,
        documentId: doc.id,
        fieldId: currentField.id,
        signatureType: result.signatureType,
        imageBase64: result.imageBase64,
        typedText: result.typedText,
        userAgent: navigator.userAgent,
      });
      const newSigned = new Set(signedFieldIds);
      newSigned.add(currentField.id);
      setSignedFieldIds(newSigned);
      const displayValue = result.signatureType === 'drawn' ? '[assinatura]' : result.typedText || '[assinatura]';
      setFieldValues(prev => ({ ...prev, [currentField.id]: displayValue }));

      // Store signature visual data for inline rendering on the document
      if (result.signatureType === 'drawn' && result.imageBase64) {
        setSignatureImages(prev => ({ ...prev, [currentField.id]: result.imageBase64! }));
      } else if (result.signatureType === 'typed' && result.typedText) {
        setSignatureTexts(prev => ({ ...prev, [currentField.id]: result.typedText! }));
      }

      toast({ title: 'Assinatura registrada! ✅' });

      // Auto-advance to next step (DocuSeal behavior)
      setTimeout(goToNextStep, 400);
    } catch (err) {
      toast({ title: 'Erro ao assinar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // FINALIZATION — marks signer signed + triggers PDF generation
  // ═══════════════════════════════════════════════════════════════

  const finalizarAssinatura = async () => {
    if (!signerData) return;
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };

    // 1. Save all field values to DB
    for (const field of signerData.fields) {
      const currentValue = fieldValues[field.id];
      if (currentValue !== undefined && currentValue !== field.value) {
        await supabase.from('campos_documento').update({ valor: currentValue }).eq('id', field.id);
      }
    }

    // 2. Mark signer as signed
    await supabase.from('signatarios').update({ status: 'signed', assinado_em: new Date().toISOString() }).eq('id', signer.id);

    // 3. Register audit trail event
    await supabase.from('trilha_auditoria').insert({
      documento_id: doc.id,
      signatario_id: signer.id,
      acao: 'signed',
      ator: String((signerData.signer as { nome: string }).nome),
      detalhes: 'Assinou o documento eletronicamente',
    });

    // 4. Check if ALL signers are done
    const { data: allSigners } = await supabase.from('signatarios').select('status').eq('documento_id', doc.id);
    const allSigned = allSigners?.every(s => s.status === 'signed');

    if (allSigned) {
      await supabase.from('documentos').update({ status: 'signed' }).eq('id', doc.id);
      toast({ title: 'Todas as assinaturas concluídas! Gerando PDFs...' });
      try {
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('gerar-documento-final', {
          body: { documentoId: doc.id },
        });
        if (pdfError) {
          console.error('PDF generation error:', pdfError);
          toast({ title: 'Documento assinado! ✅', description: 'A geração do PDF pode levar alguns instantes.' });
        } else {
          console.log('PDF generation result:', pdfResult);
          toast({ title: 'Documento assinado e PDFs gerados! ✅' });
        }
      } catch (e) {
        console.warn('gerar-documento-final error:', e);
        toast({ title: 'Documento assinado! ✅', description: 'Os PDFs serão gerados em breve.' });
      }
    } else {
      toast({ title: 'Assinatura registrada! ✅', description: 'Aguardando demais signatários.' });
    }

    setTimeout(() => setPageStep('complete'), 800);
  };

  // ═══════════════════════════════════════════════════════════════
  // SUBMIT STEP — DocuSeal-style (next or complete)
  // ═══════════════════════════════════════════════════════════════

  const submitStep = async (forceComplete = false) => {
    if (!signerData || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const isLastStep = currentStep === totalSteps - 1;

      if (forceComplete || isLastStep) {
        // Check for required empty fields
        if (!allRequiredFilled) {
          if (emptyRequiredStepIdx >= 0) {
            goToStep(emptyRequiredStepIdx);
            toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
          }
          return;
        }

        // Check for pending validation steps
        const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
        if (pendingSteps.length > 0) {
          // Save field values first
          for (const field of signerData.fields) {
            const currentValue = fieldValues[field.id];
            if (currentValue !== undefined && currentValue !== field.value) {
              await supabase.from('campos_documento').update({ valor: currentValue }).eq('id', field.id);
            }
          }
          setValidationStepIdx(0);
          toast({ title: 'Campos salvos! Prosseguindo para verificação...' });
          setTimeout(() => setPageStep('validation'), 600);
        } else {
          await finalizarAssinatura();
        }
      } else {
        // Just go to next step
        goToNextStep();
      }
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION STEP COMPLETE
  // ═══════════════════════════════════════════════════════════════

  const handleValidationComplete = async (result: unknown) => {
    if (!signerData) return;
    const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
    const step = pendingSteps[validationStepIdx];
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };

    if (step) {
      try {
        await completeValidationStep(step.id, result as Record<string, unknown>);

        const evidenceData: Record<string, unknown> = {
          documentoId: doc.id,
          participanteId: signer.id,
          tipoEvento: `KYC_${step.step_type.toUpperCase()}`,
          agenteUsuario: navigator.userAgent,
        };

        const res = result as Record<string, unknown>;
        if (res?.imageBase64) evidenceData.selfieBase64 = res.imageBase64;
        if (res?.type) evidenceData.tipoDocumento = res.type;

        if ((step.step_type === 'document' || step.step_type === 'document_photo') && res?.imageBase64) {
          evidenceData.documentoBase64 = res.imageBase64;
          delete evidenceData.selfieBase64;
        }

        await supabase.functions.invoke('processar-assinatura', { body: evidenceData });
        toast({ title: 'Verificação concluída! ✅' });
      } catch (err) {
        console.warn('Could not save validation step:', err);
        toast({ title: 'Verificação registrada ✅' });
      }
    }

    if (validationStepIdx + 1 < pendingSteps.length) {
      setValidationStepIdx((prev) => prev + 1);
    } else {
      setIsSubmitting(true);
      try {
        await finalizarAssinatura();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // COMPUTED URLs
  // ═══════════════════════════════════════════════════════════════

  const docName = signerData ? String((signerData.document as { nome: string }).nome) : '';
  const signerName = signerData ? String((signerData.signer as { nome: string }).nome) : '';
  const docFilePath = signerData ? String((signerData.document as { caminho_arquivo: string }).caminho_arquivo) : '';
  const publicUrl = docFilePath
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${docFilePath}`
    : '';

  // PDF polling on complete
  const docIdForPdf = (signerData?.document as { id: string })?.id;
  useEffect(() => {
    if (pageStep !== 'complete' || !docIdForPdf) return;
    const checkPdfs = async () => {
      const { data } = await supabase.from('documentos').select('caminho_pdf_final, caminho_pdf_dossie').eq('id', docIdForPdf).single();
      if (data?.caminho_pdf_final) {
        setSignedPdfUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${data.caminho_pdf_final}`);
      }
      if (data?.caminho_pdf_dossie) {
        setDossiePdfUrl(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${data.caminho_pdf_dossie}`);
      }
    };
    checkPdfs();
    const t1 = setTimeout(checkPdfs, 5000);
    const t2 = setTimeout(checkPdfs, 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pageStep, docIdForPdf]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Loading
  // ═══════════════════════════════════════════════════════════════

  if (pageStep === 'loading') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando documento...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Error
  // ═══════════════════════════════════════════════════════════════

  if (pageStep === 'error') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Link inválido</h1>
            <p className="text-muted-foreground">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Complete (DocuSeal-style)
  // ═══════════════════════════════════════════════════════════════

  if (pageStep === 'complete') {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="max-w-md w-full mx-auto flex flex-col items-center">
          <div className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <span>Documento assinado!</span>
          </div>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            Sua assinatura foi registrada com sucesso. Todas as evidências de segurança foram coletadas.
          </p>
          <div className="space-y-3 mt-6 w-full">
            {signedPdfUrl && (
              <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full gap-2 h-12 text-sm">
                  <Download className="w-4 h-4" />
                  Baixar PDF Assinado
                </Button>
              </a>
            )}
            {dossiePdfUrl && (
              <a href={dossiePdfUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full gap-2 h-12 text-sm">
                  <Download className="w-4 h-4" />
                  Baixar Dossiê de Auditoria
                </Button>
              </a>
            )}
            {!signedPdfUrl && publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" className="w-full gap-2 h-12 text-sm">
                  <Download className="w-4 h-4" />
                  Baixar documento original
                </Button>
              </a>
            )}
            {!signedPdfUrl && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Gerando PDFs com assinaturas...</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {signedPdfUrl ? 'Os documentos também serão enviados por e-mail.' : 'Os PDFs estão sendo gerados e serão enviados por e-mail.'}
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Validation Steps
  // ═══════════════════════════════════════════════════════════════

  if (pageStep === 'validation' && signerData) {
    const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
    const step = pendingSteps[validationStepIdx];
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };
    const stepTitles: Record<string, string> = {
      selfie: 'Reconhecimento Facial',
      document: 'Foto do Documento',
      document_photo: 'Foto do Documento',
      selfie_document: 'Selfie com Documento',
      selfie_with_document: 'Selfie com Documento',
    };
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">SignProof</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Verificação {validationStepIdx + 1} de {pendingSteps.length}
          </span>
        </header>
        <div className="max-w-lg mx-auto p-6 space-y-6">
          <h1 className="text-xl font-bold text-foreground">{stepTitles[step?.step_type] || 'Verificação'}</h1>
          <Card>
            <CardContent className="p-4">
              {step?.step_type === 'selfie' && (
                <VLSelfie signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {(step?.step_type === 'document' || step?.step_type === 'document_photo') && (
                <VLDocumento signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {(step?.step_type === 'selfie_document' || step?.step_type === 'selfie_with_document') && (
                <VLSelfieDoc signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER — Main Document View (DocuSeal-style)
  // ═══════════════════════════════════════════════════════════════

  // Fields for current page
  const currentPageFields = stepFields.filter(f => f.page === currentPage);

  // Button text (DocuSeal behavior)
  const getBottomButtonText = () => {
    if (isCurrentSigType) return 'Assinar agora';
    if (currentStep === 0 && !isFormVisible) return 'Iniciar';
    if (currentStep < totalSteps - 1) return 'Próximo';
    return 'Concluir';
  };

  const getSubmitButtonText = () => {
    if (currentStep >= totalSteps - 1) return 'Concluir';
    return 'Próximo';
  };

  return (
    <div className="min-h-screen bg-muted/30 relative flex flex-col">
      {/* ── PDF Document Area ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto pb-48">
        {/* Pages */}
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const pageFields = stepFields.filter(f => f.page === pageNum);
          return (
            <div key={pageNum} className="max-w-[700px] mx-auto px-2 sm:px-4 py-2">
              <div className="relative w-full bg-white shadow-sm" style={{ aspectRatio: '595/842' }}>
                {publicUrl && (
                  <PdfPagePreview documentUrl={publicUrl} page={pageNum} className="absolute inset-0" />
                )}
                
                {/* Field overlay areas — DocuSeal-style red/green highlights */}
                {pageFields.map((field) => {
                  const isSigType = field.field_type === 'signature' || field.field_type === 'initials';
                  const isFilled = isFieldFilled(field);
                  const isActive = stepFields.indexOf(field) === currentStep && isFormVisible;

                  const leftPct = (field.x / 595) * 100;
                  const topPct = (field.y / 842) * 100;
                  const widthPct = (field.width / 595) * 100;
                  const heightPct = (field.height / 842) * 100;

                  return (
                    <div
                      key={field.id}
                      ref={(el) => { fieldAreaRefs.current[field.id] = el; }}
                      onClick={() => {
                        const idx = stepFields.indexOf(field);
                        goToStep(idx);
                      }}
                      className={cn(
                        'absolute transition-all cursor-pointer flex items-center justify-center',
                        // DocuSeal colors: red border for pending, green for filled, dashed outline for active
                        isActive
                          ? 'outline-dashed outline-2 outline-red-500 z-10 bg-red-100/40 border border-red-100'
                          : isFilled
                            ? 'bg-green-50/60 border border-green-200'
                            : 'bg-red-100/80 border border-red-100 hover:bg-red-100'
                      )}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                    >
                      {/* Active label above field — DocuSeal behavior */}
                      {isActive && (
                        <div className="absolute -top-6 left-0 bg-foreground text-background text-[10px] px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-20">
                          {field.label || (isSigType ? (field.field_type === 'initials' ? 'Rubrica' : 'Assinatura') : 'Preencher')}
                        </div>
                      )}

                      {/* Content — render actual signature inline on document */}
                      {isFilled ? (
                        isSigType ? (
                          signatureImages[field.id] ? (
                            // Drawn signature: show the actual image
                            <img
                              src={signatureImages[field.id]}
                              alt="Assinatura"
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          ) : signatureTexts[field.id] ? (
                            // Typed signature: show the name in signature font
                            <span
                              className="text-foreground/90 italic pointer-events-none px-1 truncate w-full text-center"
                              style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(10px, 2.5vw, 20px)' }}
                            >
                              {signatureTexts[field.id]}
                            </span>
                          ) : (
                            // Fallback: checkmark
                            <div className="flex items-center justify-center gap-1 w-full">
                              <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                              <span className="text-[9px] text-green-700 font-medium">Assinado</span>
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-foreground/80 truncate px-1">
                            {fieldValues[field.id]}
                          </span>
                        )
                      ) : (
                        !isActive && (
                          <span className="opacity-50 flex items-center justify-center h-full">
                            {isSigType ? (
                              <Pen className="w-5 h-5 text-foreground/60" />
                            ) : (
                              <Type className="w-4 h-4 text-foreground/60" />
                            )}
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Expand Button (when form is minimized) — DocuSeal behavior ── */}
      {!isFormVisible && (
        <button
          onClick={() => {
            setIsFormVisible(true);
            if (currentField) setTimeout(() => scrollIntoField(currentField), 200);
          }}
          className="fixed bottom-3 left-[2%] right-[2%] z-40 bg-primary text-primary-foreground py-3.5 rounded-lg shadow-lg flex items-center justify-center gap-2 text-base font-medium hover:bg-primary/90 transition-colors"
        >
          {isCurrentSigType && <Pen className="w-5 h-5" />}
          {getBottomButtonText()}
          <ChevronUp className="absolute right-4 w-5 h-5" />
        </button>
      )}

      {/* ── Bottom Form Panel (DocuSeal-style floating panel) ── */}
      {isFormVisible && currentField && (
        <div
          ref={formPanelRef}
          className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.15)] rounded-t-xl overflow-hidden md:bottom-4 md:left-auto md:right-auto md:mx-auto md:max-w-[600px] md:rounded-xl md:border md:w-[96%]"
        >
          {/* Minimize button */}
          <button
            onClick={() => setIsFormVisible(false)}
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground z-10"
            title="Minimizar"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="p-4 md:px-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitStep(false);
              }}
            >
              {/* ── Text / Date / Checkbox fields ── */}
              {!isCurrentSigType && (
                <div className="md:mt-2">
                  <label className="text-lg sm:text-xl font-medium text-foreground block mb-1">
                    {currentField.label || 'Preencher campo'}
                    {!currentField.required && (
                      <span className="text-muted-foreground text-sm ml-2">(opcional)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required={currentField.required}
                    value={fieldValues[currentField.id] || ''}
                    onChange={(e) => updateFieldValue(currentField.id, e.target.value)}
                    placeholder="Digite aqui..."
                    className="w-full text-xl sm:text-2xl border border-border rounded-lg px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    onFocus={() => scrollIntoField(currentField)}
                  />
                </div>
              )}

              {/* ── Signature / Initials fields ── */}
              {isCurrentSigType && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg sm:text-xl font-medium text-foreground">
                      {currentField.field_type === 'initials' ? 'Rubrica' : 'Assinatura'}
                    </span>
                  </div>
                  <VLAssinatura
                    signatoryId={(signerData?.signer as { id: string })?.id || ''}
                    documentId={(signerData?.document as { id: string })?.id || ''}
                    aoCompletar={handleSignatureComplete}
                    onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })}
                  />
                </div>
              )}

              {/* ── Submit button row ── */}
              {!isCurrentSigType && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Ao assinar, você concorda com os termos de uso.
                  </p>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-1.5 px-6"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : currentStep >= totalSteps - 1 ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {getSubmitButtonText()}
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* ── Progress dots — DocuSeal behavior ── */}
          {totalSteps > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-3 border-t border-border/50">
              {stepFields.map((field, idx) => (
                <button
                  key={field.id}
                  onClick={() => goToStep(idx)}
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-all',
                    idx === currentStep
                      ? 'bg-muted-foreground scale-125'
                      : isFieldFilled(field)
                        ? 'bg-foreground'
                        : 'bg-background border border-border'
                  )}
                />
              ))}

              {/* Complete button in progress bar */}
              <div className="ml-3">
                {allRequiredFilled ? (
                  <button
                    onClick={() => submitStep(true)}
                    disabled={isSubmitting}
                    className="bg-primary text-primary-foreground text-xs px-4 py-1.5 rounded font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processando...' : 'Concluir'}
                  </button>
                ) : (
                  <span
                    className="text-xs text-muted-foreground cursor-help"
                    title="Preencha todos os campos obrigatórios"
                  >
                    <button
                      disabled
                      className="bg-muted text-muted-foreground text-xs px-4 py-1.5 rounded font-medium cursor-not-allowed"
                    >
                      Concluir
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
