import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, FileText, Pen, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, ShieldCheck, Save, Type, Calendar, Hash, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { loadSigningData, saveSignature, completeValidationStep } from '@/services/documentService';
import { supabase } from '@/integrations/supabase/client';
import PdfPagePreview from '@/components/documents/PdfPagePreview';
import { VLAssinatura, VLSelfie, VLDocumento, VLSelfieDoc } from '@/components/valeris';

type PageStep = 'loading' | 'document' | 'signing' | 'validation' | 'complete' | 'error';

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

const fieldTypeIcon: Record<string, typeof Pen> = {
  signature: Pen,
  initials: Pen,
  text: Type,
  date: Calendar,
  checkbox: Hash,
  image: Image,
};

const fieldTypeLabel: Record<string, string> = {
  signature: 'Assinar aqui',
  initials: 'Rubrica',
  text: 'Preencher',
  date: 'Data',
  checkbox: 'Marcar',
  image: 'Imagem',
};

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [validationStepIdx, setValidationStepIdx] = useState(0);
  const { toast } = useToast();

  const [signingFieldId, setSigningFieldId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Field values (local state for editing)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // Tracks which signature/initials fields have been signed via microservice
  const [signedFieldIds, setSignedFieldIds] = useState<Set<string>>(new Set());
  // Track if any value changed
  const [hasChanges, setHasChanges] = useState(false);

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

        // Initialize field values from existing data
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

        const firstPage = signerFields.length > 0
          ? Math.min(...signerFields.map((f) => Math.max(1, f.page || 1)))
          : 1;
        setCurrentPage(firstPage);

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

  const updateFieldValue = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    setHasChanges(true);
  };

  // Save all field values to database
  const handleSaveAll = async () => {
    if (!signerData) return;
    setSaving(true);
    try {
      // Save each changed field value
      for (const field of signerData.fields) {
        const currentValue = fieldValues[field.id];
        if (currentValue !== undefined && currentValue !== field.value) {
          await supabase
            .from('document_fields')
            .update({ value: currentValue })
            .eq('id', field.id);
        }
      }

      // Check if all required fields are filled
      const allFields = signerData.fields;
      const allFilled = allFields.every(f => {
        if (!f.required) return true;
        if (f.field_type === 'signature' || f.field_type === 'initials') {
          return signedFieldIds.has(f.id);
        }
        return !!fieldValues[f.id]?.trim();
      });

      if (allFilled) {
        // All fields filled - check for validation steps
        const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
        if (pendingSteps.length > 0) {
          setValidationStepIdx(0);
          toast({ title: 'Campos salvos! Prosseguindo para verificação...' });
          setTimeout(() => setPageStep('validation'), 600);
        } else {
          // Mark signer as signed
          await supabase
            .from('signers')
            .update({ status: 'signed', signed_at: new Date().toISOString() })
            .eq('id', (signerData.signer as { id: string }).id);

          // Check if all signers completed
          const docId = (signerData.document as { id: string }).id;
          const { data: allSigners } = await supabase
            .from('signers')
            .select('status')
            .eq('document_id', docId);
          const allDone = allSigners?.every(s => s.status === 'signed');
          if (allDone) {
            await supabase.from('documents').update({ status: 'signed' }).eq('id', docId);
          }

          toast({ title: 'Documento assinado com sucesso! ✅' });
          setTimeout(() => setPageStep('complete'), 600);
        }
      } else {
        setHasChanges(false);
        toast({ title: 'Campos salvos ✅', description: 'Preencha todos os campos obrigatórios para concluir.' });
      }
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Signature field click → open VLAssinatura
  const openSigningModal = (fieldId: string) => {
    setSigningFieldId(fieldId);
    setPageStep('signing');
  };

  const closeSigningModal = () => {
    setSigningFieldId(null);
    setPageStep('document');
  };

  const handleSignatureComplete = async (result: {
    signatureType: 'drawn' | 'typed';
    imageBase64?: string;
    typedText?: string;
    bluetechResponse?: unknown;
  }) => {
    if (!signerData || !signingFieldId) return;
    setProcessing(true);

    const signer = signerData.signer as { id: string };
    const doc = signerData.document as { id: string };

    try {
      await saveSignature({
        signerId: signer.id,
        documentId: doc.id,
        fieldId: signingFieldId,
        signatureType: result.signatureType,
        imageBase64: result.imageBase64,
        typedText: result.typedText,
        userAgent: navigator.userAgent,
        bluetechResponse: result.bluetechResponse as Record<string, unknown>,
      });

      const newSigned = new Set(signedFieldIds);
      newSigned.add(signingFieldId);
      setSignedFieldIds(newSigned);

      // Store display value
      const displayValue = result.signatureType === 'drawn' ? '[assinatura]' : result.typedText || '[assinatura]';
      setFieldValues(prev => ({ ...prev, [signingFieldId!]: displayValue }));

      setSigningFieldId(null);
      setPageStep('document');
      toast({ title: 'Assinatura registrada! ✅' });
    } catch (err) {
      toast({ title: 'Erro ao assinar', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
      setPageStep('document');
    } finally {
      setProcessing(false);
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
      // All validations done - mark as signed
      const signer = signerData.signer as { id: string };
      const doc = signerData.document as { id: string };
      await supabase
        .from('signers')
        .update({ status: 'signed', signed_at: new Date().toISOString() })
        .eq('id', signer.id);

      const { data: allSigners } = await supabase
        .from('signers')
        .select('status')
        .eq('document_id', doc.id);
      if (allSigners?.every(s => s.status === 'signed')) {
        await supabase.from('documents').update({ status: 'signed' }).eq('id', doc.id);
      }

      setTimeout(() => setPageStep('complete'), 600);
    }
  };

  // Computed values
  const docName = signerData ? String((signerData.document as { name: string }).name) : '';
  const signerName = signerData ? String((signerData.signer as { name: string }).name) : '';
  const docFilePath = signerData ? String((signerData.document as { file_path: string }).file_path) : '';
  const publicUrl = docFilePath
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${docFilePath}`
    : '';
  const fields = signerData?.fields || [];
  const totalPages = Math.max(1, ...fields.map((f) => Math.max(1, f.page || 1)));
  const currentPageFields = fields.filter((f) => (f.page || 1) === currentPage);

  // Count pending required fields
  const pendingRequired = fields.filter(f => {
    if (!f.required) return false;
    if (f.field_type === 'signature' || f.field_type === 'initials') return !signedFieldIds.has(f.id);
    return !fieldValues[f.id]?.trim();
  }).length;

  const allRequiredFilled = pendingRequired === 0;

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
            <p className="text-muted-foreground">Sua assinatura foi registrada com sucesso. Todos os envolvidos serão notificados.</p>
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

  // ── Signing modal (VLAssinatura) ──
  if (pageStep === 'signing' && signingFieldId && signerData) {
    const signer = signerData.signer as { id: string; bluetech_signatory_id?: string; bluetech_document_id?: string };
    const doc = signerData.document as { id: string };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={closeSigningModal}>
        <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-foreground">Assinar documento</h2>
              <p className="text-xs text-muted-foreground">Desenhe ou digite sua assinatura</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeSigningModal}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4">
            <VLAssinatura
              signatoryId={signer.bluetech_signatory_id || signer.id}
              documentId={signer.bluetech_document_id || doc.id}
              aoCompletar={handleSignatureComplete}
              onError={(err) => toast({ title: 'Erro na assinatura', description: String(err), variant: 'destructive' })}
              onCancel={closeSigningModal}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Validation steps ──
  if (pageStep === 'validation' && signerData) {
    const pendingSteps = (signerData.validationSteps || []).filter((s) => s.status !== 'completed');
    const currentStep = pendingSteps[validationStepIdx];
    const signer = signerData.signer as { id: string; bluetech_signatory_id?: string };
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
                <VLSelfie signatoryId={signer.bluetech_signatory_id || signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {currentStep?.step_type === 'document' && (
                <VLDocumento signatoryId={signer.bluetech_signatory_id || signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
              {currentStep?.step_type === 'selfie_document' && (
                <VLSelfieDoc signatoryId={signer.bluetech_signatory_id || signer.id} documentId={doc.id} aoCompletar={handleValidationComplete} onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Main Document view ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">SignProof</span>
        </div>
        <div className="flex items-center gap-3">
          {pendingRequired > 0 && (
            <span className="text-xs bg-warning/15 text-warning px-2 py-1 rounded-full font-medium">
              {pendingRequired} campo(s) pendente(s)
            </span>
          )}
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={saving}
            className={cn(
              'shadow-lg',
              allRequiredFilled ? 'bg-success hover:bg-success/90 shadow-success/20' : 'shadow-primary/20'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {allRequiredFilled ? 'Concluir e salvar' : 'Salvar'}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          {/* Document info */}
          <div>
            <h1 className="text-xl font-bold text-foreground">{docName}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Olá <strong>{signerName}</strong>, preencha os campos destacados e clique em <strong>"Assinar aqui"</strong> nos campos de assinatura.
            </p>
          </div>

          {/* Page navigation */}
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[100px] text-center">
              Página {currentPage} de {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* PDF with fields overlay */}
          <Card>
            <CardContent className="p-4">
              <div className="w-full overflow-x-auto flex justify-center">
                <div
                  className="relative bg-white rounded-lg border border-border/30 shadow-sm"
                  style={{ width: PDF_PAGE_WIDTH, minWidth: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT }}
                >
                  {publicUrl && (
                    <PdfPagePreview documentUrl={publicUrl} page={currentPage} className="absolute inset-0 rounded-lg" />
                  )}

                  {/* Render fields by type */}
                  {currentPageFields.map((field) => {
                    const isSignatureType = field.field_type === 'signature' || field.field_type === 'initials';
                    const isSigned = isSignatureType && signedFieldIds.has(field.id);
                    const value = fieldValues[field.id] || '';
                    const FieldIcon = fieldTypeIcon[field.field_type] || Type;

                    // ── Signature / Initials fields ──
                    if (isSignatureType) {
                      return (
                        <div
                          key={field.id}
                          onClick={() => !isSigned && openSigningModal(field.id)}
                          className={cn(
                            'absolute border-2 rounded-lg flex items-center justify-center gap-1.5 transition-all z-10',
                            isSigned
                              ? 'border-success/50 bg-success/10 cursor-default'
                              : 'border-primary border-dashed bg-primary/5 cursor-pointer hover:bg-primary/15 hover:shadow-lg hover:shadow-primary/20'
                          )}
                          style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                        >
                          {isSigned ? (
                            <span className="text-xs text-success font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Assinado
                            </span>
                          ) : (
                            <>
                              <Pen className="w-4 h-4 text-primary" />
                              <span className="text-xs text-primary font-medium">
                                {field.field_type === 'initials' ? 'Rubricar' : 'Assinar aqui'}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    }

                    // ── Checkbox field ──
                    if (field.field_type === 'checkbox') {
                      return (
                        <div
                          key={field.id}
                          className="absolute z-10 flex items-center gap-1.5 bg-white/90 rounded px-1"
                          style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                        >
                          <Checkbox
                            checked={value === 'true'}
                            onCheckedChange={(checked) => updateFieldValue(field.id, checked ? 'true' : 'false')}
                            className="border-primary data-[state=checked]:bg-primary"
                          />
                          {field.label && (
                            <span className="text-[11px] text-foreground truncate">{field.label}</span>
                          )}
                        </div>
                      );
                    }

                    // ── Date field ──
                    if (field.field_type === 'date') {
                      return (
                        <div
                          key={field.id}
                          className="absolute z-10"
                          style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                        >
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => updateFieldValue(field.id, e.target.value)}
                            className={cn(
                              'w-full h-full rounded border-2 px-2 text-xs bg-white/90 transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
                              value ? 'border-success/50 text-foreground' : 'border-accent/50 border-dashed text-muted-foreground'
                            )}
                          />
                        </div>
                      );
                    }

                    // ── Text / Default field ──
                    return (
                      <div
                        key={field.id}
                        className="absolute z-10"
                        style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
                      >
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateFieldValue(field.id, e.target.value)}
                          placeholder={field.label || 'Preencher...'}
                          className={cn(
                            'w-full h-full rounded border-2 px-2 text-xs bg-white/90 transition-colors focus:outline-none focus:ring-1 focus:ring-primary',
                            value ? 'border-success/50 text-foreground' : 'border-accent/50 border-dashed text-muted-foreground placeholder:text-muted-foreground/60'
                          )}
                        />
                      </div>
                    );
                  })}

                  {fields.length > 0 && currentPageFields.length === 0 && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-card/90 border border-border rounded-md px-3 py-1.5 z-10">
                      <p className="text-xs text-muted-foreground">Nenhum campo nesta página.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field summary below document */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Campos atribuídos a você</h3>
              <div className="space-y-2">
                {fields.map((field) => {
                  const isSignatureType = field.field_type === 'signature' || field.field_type === 'initials';
                  const isSigned = isSignatureType && signedFieldIds.has(field.id);
                  const value = fieldValues[field.id] || '';
                  const isFilled = isSignatureType ? isSigned : !!value.trim();
                  const FieldIcon = fieldTypeIcon[field.field_type] || Type;

                  return (
                    <div
                      key={field.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer',
                        isFilled ? 'border-success/30 bg-success/5' : 'border-border hover:bg-muted/50'
                      )}
                      onClick={() => {
                        setCurrentPage(field.page || 1);
                        if (isSignatureType && !isSigned) openSigningModal(field.id);
                      }}
                    >
                      <div className={cn('p-1.5 rounded', isFilled ? 'bg-success/10' : 'bg-muted')}>
                        {isFilled ? <CheckCircle2 className="w-4 h-4 text-success" /> : <FieldIcon className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {field.label || fieldTypeLabel[field.field_type] || field.field_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Página {field.page || 1} {field.required ? '• Obrigatório' : '• Opcional'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {isFilled ? (
                          <span className="text-xs text-success font-medium">✓ Preenchido</span>
                        ) : (
                          <span className="text-xs text-warning font-medium">Pendente</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save button at bottom */}
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {allRequiredFilled
                    ? '✅ Todos os campos obrigatórios foram preenchidos.'
                    : `⚠️ ${pendingRequired} campo(s) obrigatório(s) pendente(s).`
                  }
                </p>
                <Button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className={cn(
                    'shadow-lg',
                    allRequiredFilled ? 'bg-success hover:bg-success/90 shadow-success/20' : 'shadow-primary/20'
                  )}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  {allRequiredFilled ? 'Concluir e salvar' : 'Salvar progresso'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
