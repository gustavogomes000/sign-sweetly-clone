import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, FileText, Pen, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { loadSigningData, saveSignature, completeValidationStep } from '@/services/documentService';
import { supabase } from '@/integrations/supabase/client';
import PdfPagePreview from '@/components/documents/PdfPagePreview';
import { VLAssinatura, VLSelfie, VLDocumento, VLSelfieDoc } from '@/components/valeris';

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

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [validationStepIdx, setValidationStepIdx] = useState(0);
  const { toast } = useToast();

  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signedFieldIds, setSignedFieldIds] = useState<Set<string>>(new Set());

  // For the complete page - signed PDF URLs
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [dossiePdfUrl, setDossiePdfUrl] = useState<string | null>(null);

  const signaturePanelRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [signerData, setSignerData] = useState<{
    signer: Record<string, unknown>;
    document: Record<string, unknown>;
    fields: SignField[];
    validationSteps: ValidationStepData[];
  } | null>(null);

  // Load signing data
  useEffect(() => {
    if (!token) {
      setPageStep('error');
      setErrorMsg('Token de assinatura não fornecido');
      return;
    }
    loadSigningData(token)
      .then((data) => {
        // Map PT columns to the local interface
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

  const sortedFields = (signerData?.fields || []).slice().sort((a, b) => {
    if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
    return a.y - b.y;
  });

  const totalFields = sortedFields.length;
  const totalPages = Math.max(1, ...sortedFields.map((f) => Math.max(1, f.page || 1)));
  const currentPageFields = sortedFields.filter((f) => (f.page || 1) === currentPage);

  const isFieldFilled = (field: SignField) => {
    const isSig = field.field_type === 'signature' || field.field_type === 'initials';
    if (isSig) return signedFieldIds.has(field.id);
    return !!(fieldValues[field.id] || '').trim();
  };

  const filledCount = sortedFields.filter(isFieldFilled).length;
  const pendingRequired = sortedFields.filter(f => f.required && !isFieldFilled(f)).length;
  const allRequiredFilled = pendingRequired === 0;

  const updateFieldValue = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const openSignaturePanel = useCallback((fieldId: string) => {
    setActiveFieldId(fieldId);
    setTimeout(() => {
      signaturePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleSignatureComplete = async (result: {
    signatureType: 'drawn' | 'typed';
    imageBase64?: string;
    typedText?: string;
  }) => {
    if (!signerData || !activeFieldId) return;
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };
    try {
      await saveSignature({
        signerId: signer.id,
        documentId: doc.id,
        fieldId: activeFieldId,
        signatureType: result.signatureType,
        imageBase64: result.imageBase64,
        typedText: result.typedText,
        userAgent: navigator.userAgent,
      });
      const newSigned = new Set(signedFieldIds);
      newSigned.add(activeFieldId);
      setSignedFieldIds(newSigned);
      const displayValue = result.signatureType === 'drawn' ? '[assinatura]' : result.typedText || '[assinatura]';
      setFieldValues(prev => ({ ...prev, [activeFieldId]: displayValue }));
      setActiveFieldId(null);
      toast({ title: 'Assinatura registrada! ✅' });
    } catch (err) {
      toast({ title: 'Erro ao assinar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    }
  };

  // Shared finalization logic - marks signer as signed and triggers PDF generation if all done
  const finalizarAssinatura = async () => {
    if (!signerData) return;
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };

    // 1. Save all field values to DB first
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
      // 5. Update document status
      await supabase.from('documentos').update({ status: 'signed' }).eq('id', doc.id);

      // 6. Trigger PDF generation DIRECTLY (not via processar-assinatura which uses participantes_documento)
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


    if (!signerData) return;
    setSaving(true);
    try {
      const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
      if (pendingSteps.length > 0) {
        // Save field values before going to validation
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
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleValidationComplete = async (result: unknown) => {
    if (!signerData) return;
    const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
    const currentStep = pendingSteps[validationStepIdx];
    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };

    if (currentStep) {
      try {
        await completeValidationStep(currentStep.id, result as Record<string, unknown>);

        // Save KYC evidence via processar-assinatura
        const evidenceData: Record<string, unknown> = {
          documentoId: doc.id,
          participanteId: signer.id,
          tipoEvento: `KYC_${currentStep.step_type.toUpperCase()}`,
          agenteUsuario: navigator.userAgent,
        };

        const res = result as Record<string, unknown>;
        if (res?.imageBase64) evidenceData.selfieBase64 = res.imageBase64;
        if (res?.type) evidenceData.tipoDocumento = res.type;

        // If it's a document photo, send as documentoBase64
        if ((currentStep.step_type === 'document' || currentStep.step_type === 'document_photo') && res?.imageBase64) {
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
      // All validations complete — finalize using shared logic
      setSaving(true);
      try {
        await finalizarAssinatura();
      } finally {
        setSaving(false);
      }
    }
  };

  // Computed
  const docName = signerData ? String((signerData.document as { nome: string }).nome) : '';
  const signerName = signerData ? String((signerData.signer as { nome: string }).nome) : '';
  const docFilePath = signerData ? String((signerData.document as { caminho_arquivo: string }).caminho_arquivo) : '';
  const publicUrl = docFilePath
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${docFilePath}`
    : '';

  // ── Loading ──
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

  // ── Error ──
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

  // ── Complete ──
  if (pageStep === 'complete') {
    const docId = (signerData?.document as { id: string })?.id;
            </div>
            <h1 className="text-2xl font-bold text-foreground">Documento assinado!</h1>
            <p className="text-muted-foreground">Sua assinatura foi registrada com sucesso. Todas as evidências de segurança foram coletadas.</p>
            <div className="flex flex-col gap-2">
              {signedPdfUrl && (
                <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full"><Download className="w-4 h-4 mr-1" />Baixar PDF Assinado</Button>
                </a>
              )}
              {dossiePdfUrl && (
                <a href={dossiePdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-1" />Baixar Dossiê de Auditoria</Button>
                </a>
              )}
              {!signedPdfUrl && publicUrl && (
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full"><Download className="w-4 h-4 mr-1" />Baixar documento original</Button>
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {signedPdfUrl ? 'Os documentos também serão enviados por e-mail.' : 'Os PDFs com assinaturas estão sendo gerados e serão enviados por e-mail.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Validation steps ──
  if (pageStep === 'validation' && signerData) {
    const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
    const currentStep = pendingSteps[validationStepIdx];
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
          <h1 className="text-xl font-bold text-foreground">{stepTitles[currentStep?.step_type] || 'Verificação'}</h1>
          <Card>
            <CardContent className="p-4">
              {currentStep?.step_type === 'selfie' && (
                <VLSelfie signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {(currentStep?.step_type === 'document' || currentStep?.step_type === 'document_photo') && (
                <VLDocumento signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {(currentStep?.step_type === 'selfie_document' || currentStep?.step_type === 'selfie_with_document') && (
                <VLSelfieDoc signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main Document View ──
  const signer = signerData?.signer as { id: string } | undefined;
  const doc = signerData?.document as { id: string } | undefined;
  const activeField = activeFieldId ? sortedFields.find(f => f.id === activeFieldId) : null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-sm truncate max-w-[200px]">{docName}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
            <span className="text-xs font-medium text-foreground">{filledCount}/{totalFields}</span>
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: totalFields > 0 ? `${(filledCount / totalFields) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <Button
            onClick={handleComplete}
            disabled={saving || !allRequiredFilled}
            size="sm"
            className={cn(
              'gap-1 text-xs',
              allRequiredFilled && 'bg-primary hover:bg-primary/90'
            )}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Concluir
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[680px] mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <p className="text-sm text-muted-foreground text-center">
          Olá <strong className="text-foreground">{signerName}</strong>, clique nos campos destacados para preencher.
        </p>

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* PDF Document Card */}
        <Card className="overflow-hidden shadow-sm">
          <div className="relative w-full" style={{ aspectRatio: '595/842' }}>
            {publicUrl && (
              <PdfPagePreview documentUrl={publicUrl} page={currentPage} className="absolute inset-0" />
            )}

            {/* Field overlays */}
            {currentPageFields.map((field) => {
              const isSigType = field.field_type === 'signature' || field.field_type === 'initials';
              const isSigned = isSigType && signedFieldIds.has(field.id);
              const value = fieldValues[field.id] || '';
              const isActive = activeFieldId === field.id;

              const leftPct = (field.x / 595) * 100;
              const topPct = (field.y / 842) * 100;
              const widthPct = (field.width / 595) * 100;
              const heightPct = (field.height / 842) * 100;

              if (isSigType) {
                return (
                  <div
                    key={field.id}
                    ref={(el) => { fieldRefs.current[field.id] = el; }}
                    onClick={() => {
                      if (!isSigned) openSignaturePanel(field.id);
                    }}
                    className={cn(
                      'absolute border-2 rounded cursor-pointer transition-all flex items-center justify-center',
                      isSigned ? 'border-success/50 bg-success/5' :
                      isActive ? 'border-primary bg-primary/10 ring-2 ring-primary/30' :
                      'border-primary/60 bg-primary/5 hover:bg-primary/10 animate-pulse'
                    )}
                    style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${widthPct}%`, height: `${heightPct}%` }}
                  >
                    {isSigned ? (
                      <span className="text-success text-xs font-medium">✓ Assinado</span>
                    ) : (
                      <div className="flex items-center gap-1 text-primary">
                        <Pen className="w-3 h-3" />
                        <span className="text-[10px] font-medium">{field.label || 'Assinar aqui'}</span>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={field.id}
                  className={cn(
                    'absolute border rounded',
                    value ? 'border-success/30 bg-success/5' : 'border-muted-foreground/30 bg-card/80'
                  )}
                  style={{ left: `${leftPct}%`, top: `${topPct}%`, width: `${widthPct}%`, height: `${heightPct}%` }}
                >
                  <input
                    type="text"
                    placeholder={field.label || 'Preencher'}
                    value={fieldValues[field.id] || ''}
                    onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    className="w-full h-full bg-transparent text-xs px-1.5 text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Signature panel */}
        {activeField && (activeField.field_type === 'signature' || activeField.field_type === 'initials') && (
          <div ref={signaturePanelRef}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {activeField.field_type === 'initials' ? 'Rubrica' : 'Assinatura'}
                  </h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveFieldId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <VLAssinatura
                  signatoryId={signer?.id || ''}
                  documentId={doc?.id || ''}
                  aoCompletar={handleSignatureComplete}
                  onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}