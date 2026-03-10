import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, FileText, Pen, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, ShieldCheck, Type, Calendar, Hash, Image } from 'lucide-react';
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
      <div className="flex-1 overflow-auto pb-20" ref={pdfContainerRef}>
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          {/* Signer greeting */}
          <div className="mb-4 text-center">
            <p className="text-sm text-muted-foreground">
              Olá <strong className="text-foreground">{signerName}</strong>, clique nos campos destacados no documento para preenchê-los.
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

              {/* Field overlays on the PDF */}
              {currentPageFields.map((field) => {
                const isSigType = field.field_type === 'signature' || field.field_type === 'initials';
                const isSigned = isSigType && signedFieldIds.has(field.id);
                const value = fieldValues[field.id] || '';
                const isFilled = isSigType ? isSigned : !!value.trim();
                const fieldIndex = sortedFields.findIndex(f => f.id === field.id);

                // Signature fields → click opens modal
                if (isSigType) {
                  return (
                    <div
                      key={field.id}
                      ref={(el) => { fieldRefs.current[field.id] = el; }}
                      onClick={() => {
                        if (!isSigned) {
                          setCurrentFieldIndex(fieldIndex);
                          setSigningFieldId(field.id);
                        }
                      }}
                      className={cn(
                        'absolute z-10 rounded transition-all flex items-center justify-center gap-1.5',
                        isSigned
                          ? 'bg-primary/10 border border-primary/30 cursor-default'
                          : 'bg-destructive/10 border-2 border-dashed border-destructive/40 cursor-pointer hover:bg-destructive/20 hover:border-destructive/60 hover:shadow-md',
                      )}
                      style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                    >
                      {isSigned ? (
                        <span className="flex items-center gap-1 text-xs text-primary font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Assinado
                        </span>
                      ) : (
                        <>
                          <Pen className="w-4 h-4 text-destructive/60" />
                          <span className="text-[11px] text-destructive/70 font-medium">
                            {field.field_type === 'initials' ? 'Rubricar' : 'Assinar aqui'}
                          </span>
                        </>
                      )}
                    </div>
                  );
                }

                // Checkbox fields → inline toggle
                if (field.field_type === 'checkbox') {
                  return (
                    <div
                      key={field.id}
                      className="absolute z-10 flex items-center gap-1.5 bg-white/90 rounded px-1"
                      style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                    >
                      <input
                        type="checkbox"
                        checked={value === 'true'}
                        onChange={(e) => updateFieldValue(field.id, e.target.checked ? 'true' : 'false')}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                      {field.label && <span className="text-[10px] text-foreground truncate">{field.label}</span>}
                    </div>
                  );
                }

                // Date fields → inline input
                if (field.field_type === 'date') {
                  return (
                    <div key={field.id} className="absolute z-10" style={{ left: field.x, top: field.y, width: field.width, height: field.height }}>
                      <input
                        type="date"
                        value={value}
                        onChange={(e) => updateFieldValue(field.id, e.target.value)}
                        className={cn(
                          'w-full h-full rounded border-2 px-2 text-xs bg-white/90 transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
                          value ? 'border-primary/40 text-foreground' : 'border-destructive/30 border-dashed text-muted-foreground'
                        )}
                      />
                    </div>
                  );
                }

                // Text fields → inline input
                return (
                  <div key={field.id} className="absolute z-10" style={{ left: field.x, top: field.y, width: field.width, height: field.height }}>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateFieldValue(field.id, e.target.value)}
                      placeholder={field.label || 'Preencher...'}
                      className={cn(
                        'w-full h-full rounded border-2 px-2 text-xs bg-white/90 transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
                        value ? 'border-primary/40 text-foreground' : 'border-destructive/30 border-dashed text-muted-foreground placeholder:text-muted-foreground/50'
                      )}
                    />
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

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {allRequiredFilled
              ? '✅ Todos os campos preenchidos'
              : `⚠️ ${pendingRequired} campo(s) pendente(s)`}
          </p>
          <Button
            onClick={handleComplete}
            disabled={saving || !allRequiredFilled}
            className={cn(
              'shadow-lg gap-1',
              allRequiredFilled ? 'bg-success hover:bg-success/90 shadow-success/20' : 'shadow-primary/20'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Concluir assinatura
          </Button>
        </div>
      </div>

      {/* ══════ Signature Modal (opens ONLY when clicking signature field) ══════ */}
      {signingFieldId && signer && doc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={() => setSigningFieldId(null)}>
          <div
            className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">Sua assinatura</h2>
                <p className="text-xs text-muted-foreground">Desenhe ou digite sua assinatura</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSigningFieldId(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <VLAssinatura
                signatoryId={signer.id}
                documentId={doc.id}
                aoCompletar={handleSignatureComplete}
                onError={(err) => toast({ title: 'Erro na assinatura', description: String(err), variant: 'destructive' })}
                onCancel={() => setSigningFieldId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
