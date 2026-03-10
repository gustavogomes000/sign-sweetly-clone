import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, FileText, Pen, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, ShieldCheck, Type, Calendar, Hash, Image, ArrowRight, ArrowLeft } from 'lucide-react';
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

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;

const fieldTypeLabel: Record<string, string> = {
  signature: 'Assinatura',
  initials: 'Rubrica',
  text: 'Campo de texto',
  date: 'Data',
  checkbox: 'Marcação',
  image: 'Imagem',
};

type PageStep = 'loading' | 'document' | 'validation' | 'complete' | 'error';

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [validationStepIdx, setValidationStepIdx] = useState(0);
  const { toast } = useToast();

  const [signingFieldId, setSigningFieldId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(true);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signedFieldIds, setSignedFieldIds] = useState<Set<string>>(new Set());

  const pdfContainerRef = useRef<HTMLDivElement>(null);
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
        setSignerData(data as typeof signerData);
        const signerFields = (data.fields || []) as SignField[];
        const initialValues: Record<string, string> = {};
        const alreadySigned = new Set<string>();
        signerFields.forEach((f) => {
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

  // Sorted fields by page then y position
  const sortedFields = (signerData?.fields || []).slice().sort((a, b) => {
    if ((a.page || 1) !== (b.page || 1)) return (a.page || 1) - (b.page || 1);
    return a.y - b.y;
  });

  const currentField = sortedFields[currentFieldIndex] || null;
  const totalFields = sortedFields.length;

  // Auto-navigate to field's page and scroll
  useEffect(() => {
    if (!currentField) return;
    const fieldPage = currentField.page || 1;
    if (fieldPage !== currentPage) {
      setCurrentPage(fieldPage);
    }
    // Scroll to field after page change
    setTimeout(() => {
      const el = fieldRefs.current[currentField.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }, [currentFieldIndex, currentField?.id]);

  const goToField = useCallback((index: number) => {
    if (index >= 0 && index < totalFields) {
      setCurrentFieldIndex(index);
      setSigningFieldId(null);
    }
  }, [totalFields]);

  const updateFieldValue = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const isFieldFilled = (field: SignField) => {
    const isSignatureType = field.field_type === 'signature' || field.field_type === 'initials';
    if (isSignatureType) return signedFieldIds.has(field.id);
    return !!(fieldValues[field.id] || '').trim();
  };

  const filledCount = sortedFields.filter(isFieldFilled).length;
  const pendingRequired = sortedFields.filter(f => f.required && !isFieldFilled(f)).length;
  const allRequiredFilled = pendingRequired === 0;

  // Auto-advance to next field after filling
  const advanceToNextEmpty = useCallback(() => {
    const nextEmpty = sortedFields.findIndex((f, i) => i > currentFieldIndex && !isFieldFilled(f));
    if (nextEmpty >= 0) {
      goToField(nextEmpty);
    } else {
      // Try from beginning
      const fromStart = sortedFields.findIndex((f) => !isFieldFilled(f));
      if (fromStart >= 0) {
        goToField(fromStart);
      }
    }
  }, [currentFieldIndex, sortedFields, goToField]);

  const handleSignatureComplete = async (result: {
    signatureType: 'drawn' | 'typed';
    imageBase64?: string;
    typedText?: string;
  }) => {
    if (!signerData || !currentField) return;
    setProcessing(true);
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
      setSigningFieldId(null);
      toast({ title: 'Assinatura registrada! ✅' });
      setTimeout(() => advanceToNextEmpty(), 400);
    } catch (err) {
      toast({ title: 'Erro ao assinar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleComplete = async () => {
    if (!signerData) return;
    setSaving(true);
    try {
      // Save all text field values
      for (const field of signerData.fields) {
        const currentValue = fieldValues[field.id];
        if (currentValue !== undefined && currentValue !== field.value) {
          await supabase.from('document_fields').update({ value: currentValue }).eq('id', field.id);
        }
      }

      const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
      if (pendingSteps.length > 0) {
        setValidationStepIdx(0);
        toast({ title: 'Campos salvos! Prosseguindo para verificação...' });
        setTimeout(() => setPageStep('validation'), 600);
      } else {
        const signer = signerData.signer as { id: string };
        const doc = signerData.document as { id: string };
        await supabase.from('signers').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', signer.id);
        const { data: allSigners } = await supabase.from('signers').select('status').eq('document_id', doc.id);
        if (allSigners?.every(s => s.status === 'signed')) {
          await supabase.from('documents').update({ status: 'signed' }).eq('id', doc.id);
        }
        toast({ title: 'Documento assinado com sucesso! ✅' });
        setTimeout(() => setPageStep('complete'), 600);
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
    if (currentStep) {
      try {
        await completeValidationStep(currentStep.id, result as Record<string, unknown>);
        toast({ title: 'Verificação concluída! ✅' });
      } catch (err) {
        console.warn('Could not update validation step:', err);
      }
    }
    if (validationStepIdx + 1 < pendingSteps.length) {
      setValidationStepIdx((prev) => prev + 1);
    } else {
      const signer = signerData.signer as { id: string };
      const doc = signerData.document as { id: string };
      await supabase.from('signers').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', signer.id);
      const { data: allSigners } = await supabase.from('signers').select('status').eq('document_id', doc.id);
      if (allSigners?.every(s => s.status === 'signed')) {
        await supabase.from('documents').update({ status: 'signed' }).eq('id', doc.id);
      }
      setTimeout(() => setPageStep('complete'), 600);
    }
  };

  // Computed
  const docName = signerData ? String((signerData.document as { name: string }).name) : '';
  const signerName = signerData ? String((signerData.signer as { name: string }).name) : '';
  const docFilePath = signerData ? String((signerData.document as { file_path: string }).file_path) : '';
  const publicUrl = docFilePath
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${docFilePath}`
    : '';
  const totalPages = Math.max(1, ...sortedFields.map((f) => Math.max(1, f.page || 1)));
  const currentPageFields = sortedFields.filter((f) => (f.page || 1) === currentPage);

  // ── Loading ──
  if (pageStep === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center animate-fade-in">
          <CardContent className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Documento assinado!</h1>
            <p className="text-muted-foreground">Sua assinatura foi registrada com sucesso.</p>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><Download className="w-4 h-4 mr-1" />Baixar documento</Button>
              </a>
            )}
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
      selfie_document: 'Selfie com Documento',
    };
    return (
      <div className="min-h-screen bg-background">
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
          <div className="flex gap-2">
            {pendingSteps.map((_, i) => (
              <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < validationStepIdx ? 'bg-success' : i === validationStepIdx ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
          <h1 className="text-xl font-bold text-foreground">{stepTitles[currentStep?.step_type] || 'Verificação'}</h1>
          <Card>
            <CardContent className="p-4">
              {currentStep?.step_type === 'selfie' && (
                <VLSelfie signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {currentStep?.step_type === 'document' && (
                <VLDocumento signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {currentStep?.step_type === 'selfie_document' && (
                <VLSelfieDoc signatoryId={signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main Document view (DocuSeal-inspired step-by-step) ──
  const signer = signerData?.signer as { id: string } | undefined;
  const doc = signerData?.document as { id: string } | undefined;
  const isSignatureType = currentField?.field_type === 'signature' || currentField?.field_type === 'initials';

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-foreground text-sm">{docName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress */}
          <div className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1">
            <span className="text-xs font-medium text-foreground">{filledCount}/{totalFields}</span>
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: totalFields > 0 ? `${(filledCount / totalFields) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* PDF Document Area */}
      <div className="flex-1 overflow-auto pb-64 sm:pb-72" ref={pdfContainerRef}>
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          {/* Signer greeting */}
          <div className="mb-4 text-center">
            <p className="text-sm text-muted-foreground">
              Olá <strong className="text-foreground">{signerName}</strong>, preencha os campos destacados no documento abaixo.
            </p>
          </div>

          {/* Page navigation */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mb-4">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium text-muted-foreground min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* PDF with field overlays */}
          <div className="flex justify-center">
            <div
              className="relative bg-white rounded-lg shadow-lg border border-border/40"
              style={{ width: PDF_PAGE_WIDTH, minWidth: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT }}
            >
              {publicUrl && (
                <PdfPagePreview documentUrl={publicUrl} page={currentPage} className="absolute inset-0 rounded-lg" />
              )}

              {/* Field overlays */}
              {currentPageFields.map((field) => {
                const isActive = currentField?.id === field.id;
                const isSigType = field.field_type === 'signature' || field.field_type === 'initials';
                const isSigned = isSigType && signedFieldIds.has(field.id);
                const value = fieldValues[field.id] || '';
                const isFilled = isSigType ? isSigned : !!value.trim();
                const fieldIndex = sortedFields.findIndex(f => f.id === field.id);

                return (
                  <div
                    key={field.id}
                    ref={(el) => { fieldRefs.current[field.id] = el; }}
                    onClick={() => {
                      setCurrentFieldIndex(fieldIndex);
                      if (isSigType && !isSigned) {
                        setSigningFieldId(field.id);
                      }
                      setIsFormVisible(true);
                    }}
                    className={cn(
                      'absolute z-10 rounded transition-all cursor-pointer',
                      isActive
                        ? 'outline outline-2 outline-dashed outline-primary z-20 shadow-lg shadow-primary/10'
                        : '',
                      isFilled
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-destructive/10 border border-destructive/20 hover:bg-destructive/20',
                    )}
                    style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                  >
                    {/* Active label */}
                    {isActive && (
                      <div className="absolute -top-7 left-0 bg-primary text-primary-foreground text-[11px] font-medium px-2 py-0.5 rounded whitespace-nowrap pointer-events-none">
                        {fieldTypeLabel[field.field_type] || field.label || 'Campo'}
                      </div>
                    )}

                    {/* Field content */}
                    {isSigned ? (
                      <span className="flex items-center justify-center h-full gap-1 text-xs text-primary font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Assinado
                      </span>
                    ) : isFilled && !isSigType ? (
                      <span className="flex items-center h-full px-2 text-xs text-foreground truncate">
                        {value}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center h-full opacity-50">
                        {isSigType ? (
                          <Pen className="w-5 h-5 text-foreground/60" />
                        ) : field.field_type === 'date' ? (
                          <Calendar className="w-5 h-5 text-foreground/60" />
                        ) : field.field_type === 'checkbox' ? (
                          <Hash className="w-5 h-5 text-foreground/60" />
                        ) : (
                          <Type className="w-5 h-5 text-foreground/60" />
                        )}
                      </span>
                    )}
                  </div>
                );
              })}

              {sortedFields.length > 0 && currentPageFields.length === 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-card/90 border border-border rounded-md px-3 py-1.5 z-10">
                  <p className="text-xs text-muted-foreground">Nenhum campo nesta página</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ Bottom Form Panel (DocuSeal-style) ══════ */}
      {isFormVisible && currentField && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border shadow-2xl shadow-black/20 animate-in slide-in-from-bottom-4 duration-300">
          <div className="max-w-3xl mx-auto">
            {/* Step indicator */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                  {currentFieldIndex + 1} de {totalFields}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {fieldTypeLabel[currentField.field_type] || 'Campo'}
                  {currentField.label && ` — ${currentField.label}`}
                </span>
                {currentField.required && (
                  <span className="text-[10px] text-destructive font-medium">obrigatório</span>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFormVisible(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Field input */}
            <div className="px-4 pb-3">
              {isSignatureType ? (
                signingFieldId ? (
                  <VLAssinatura
                    signatoryId={signer?.id || ''}
                    documentId={doc?.id || ''}
                    aoCompletar={handleSignatureComplete}
                    onError={(err) => toast({ title: 'Erro na assinatura', description: String(err), variant: 'destructive' })}
                    onCancel={() => setSigningFieldId(null)}
                  />
                ) : signedFieldIds.has(currentField.id) ? (
                  <div className="flex items-center gap-2 p-4 bg-primary/5 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground font-medium">Assinatura registrada</span>
                  </div>
                ) : (
                  <Button
                    onClick={() => setSigningFieldId(currentField.id)}
                    className="w-full h-14 text-base gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <Pen className="w-5 h-5" />
                    {currentField.field_type === 'initials' ? 'Rubricar aqui' : 'Assinar aqui'}
                  </Button>
                )
              ) : currentField.field_type === 'checkbox' ? (
                <label className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={(fieldValues[currentField.id] || '') === 'true'}
                    onChange={(e) => {
                      updateFieldValue(currentField.id, e.target.checked ? 'true' : 'false');
                      setTimeout(() => advanceToNextEmpty(), 300);
                    }}
                    className="w-5 h-5 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{currentField.label || 'Marcar este campo'}</span>
                </label>
              ) : currentField.field_type === 'date' ? (
                <input
                  type="date"
                  value={fieldValues[currentField.id] || ''}
                  onChange={(e) => updateFieldValue(currentField.id, e.target.value)}
                  className="w-full h-12 rounded-lg border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <input
                  type="text"
                  autoFocus
                  value={fieldValues[currentField.id] || ''}
                  onChange={(e) => updateFieldValue(currentField.id, e.target.value)}
                  placeholder={currentField.label || 'Digite aqui...'}
                  className="w-full h-12 rounded-lg border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') advanceToNextEmpty();
                  }}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-4 pb-4 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToField(currentFieldIndex - 1)}
                disabled={currentFieldIndex <= 0}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Anterior
              </Button>

              {allRequiredFilled && !signingFieldId ? (
                <Button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 h-10 bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/20 gap-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Concluir
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    if (currentFieldIndex < totalFields - 1) {
                      goToField(currentFieldIndex + 1);
                    }
                  }}
                  disabled={currentFieldIndex >= totalFields - 1}
                  className="gap-1"
                >
                  Próximo <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating button to reopen form panel */}
      {!isFormVisible && currentField && (
        <button
          onClick={() => setIsFormVisible(true)}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Pen className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
