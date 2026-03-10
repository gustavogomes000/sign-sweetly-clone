import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, FileText, Pen, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { loadSigningData, saveSignature, completeValidationStep } from '@/services/documentService';
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
  value: string | null;
}

interface ValidationStep {
  id: string;
  step_type: string;
  step_order: number;
  status: string;
  required: boolean;
}

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [validationStepIdx, setValidationStepIdx] = useState(0);
  const { toast } = useToast();

  // Which field is being signed (opens VLAssinatura)
  const [signingFieldId, setSigningFieldId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Signed fields tracking
  const [signedFieldIds, setSignedFieldIds] = useState<Set<string>>(new Set());

  // Data from DB
  const [signerData, setSignerData] = useState<{
    signer: Record<string, unknown>;
    document: Record<string, unknown>;
    fields: SignField[];
    validationSteps: ValidationStep[];
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
        const firstPage = signerFields.length > 0
          ? Math.min(...signerFields.map((f) => Math.max(1, f.page || 1)))
          : 1;
        setCurrentPage(firstPage);

        const alreadySigned = new Set<string>();
        signerFields.forEach((f) => { if (f.value) alreadySigned.add(f.id); });
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

  const openSigningModal = (fieldId: string) => {
    setSigningFieldId(fieldId);
    setPageStep('signing');
  };

  const closeSigningModal = () => {
    setSigningFieldId(null);
    setPageStep('document');
  };

  // Called when VLAssinatura completes
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
      setSigningFieldId(null);

      toast({ title: 'Assinatura registrada! ✅' });

      // Check remaining fields
      const allFields = signerData.fields || [];
      const pendingFields = allFields.filter((f) => !newSigned.has(f.id));

      if (pendingFields.length === 0) {
        // All signed → check validation steps
        const pendingSteps = (signerData.validationSteps || []).filter((s: ValidationStep) => s.status !== 'completed');
        if (pendingSteps.length > 0) {
          setValidationStepIdx(0);
          setTimeout(() => setPageStep('validation'), 600);
        } else {
          setTimeout(() => setPageStep('complete'), 600);
        }
      } else {
        // Navigate to next pending field
        setPageStep('document');
        const nextField = pendingFields[0];
        if (nextField && nextField.page !== currentPage) {
          setCurrentPage(nextField.page || 1);
        }
      }
    } catch (err) {
      console.error('Signing error:', err);
      toast({
        title: 'Erro ao assinar',
        description: err instanceof Error ? err.message : 'Tente novamente',
        variant: 'destructive',
      });
      setPageStep('document');
    } finally {
      setProcessing(false);
    }
  };

  // Handle validation step completion
  const handleValidationComplete = async (result: unknown) => {
    if (!signerData) return;

    const pendingSteps = (signerData.validationSteps || []).filter((s: ValidationStep) => s.status !== 'completed');
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
      setTimeout(() => setPageStep('complete'), 600);
    }
  };

  const docName = signerData ? String((signerData.document as { name: string }).name) : '';
  const signerName = signerData ? String((signerData.signer as { name: string }).name) : '';
  const docFilePath = signerData ? String((signerData.document as { file_path: string }).file_path) : '';
  const publicUrl = docFilePath
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${docFilePath}`
    : '';
  const fields = signerData?.fields || [];
  const totalPages = Math.max(1, ...fields.map((f) => Math.max(1, f.page || 1)));
  const currentPageFields = fields.filter((f) => (f.page || 1) === currentPage);
  const pendingCount = fields.filter((f) => !signedFieldIds.has(f.id)).length;

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
        <div
          className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
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
              onError={(err) => {
                toast({ title: 'Erro na assinatura', description: String(err), variant: 'destructive' });
              }}
              onCancel={closeSigningModal}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Validation steps (selfie, document, selfie+doc) ──
  if (pageStep === 'validation' && signerData) {
    const pendingSteps = (signerData.validationSteps || []).filter((s: ValidationStep) => s.status !== 'completed');
    const currentStep = pendingSteps[validationStepIdx];
    const signer = signerData.signer as { id: string; bluetech_signatory_id?: string };
    const doc = signerData.document as { id: string };

    const stepTitles: Record<string, string> = {
      selfie: 'Reconhecimento Facial',
      document: 'Foto do Documento',
      selfie_document: 'Selfie com Documento',
    };
    const stepSubtitles: Record<string, string> = {
      selfie: 'Tire uma selfie para verificar sua identidade',
      document: 'Fotografe seu RG, CNH ou CPF',
      selfie_document: 'Tire uma selfie segurando seu documento',
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
            Etapa {validationStepIdx + 1} de {pendingSteps.length}
          </span>
        </header>

        <div className="max-w-lg mx-auto p-6 space-y-6">
          <div className="flex gap-2">
            {pendingSteps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i < validationStepIdx ? 'bg-success' :
                  i === validationStepIdx ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>

          <div>
            <h1 className="text-xl font-bold text-foreground">
              {stepTitles[currentStep?.step_type] || 'Verificação'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stepSubtitles[currentStep?.step_type] || ''}
            </p>
          </div>

          <Card>
            <CardContent className="p-4">
              {currentStep?.step_type === 'selfie' && (
                <VLSelfie
                  signatoryId={signer.bluetech_signatory_id || signer.id}
                  documentId={doc.id}
                  aoCompletar={handleValidationComplete}
                  onError={(err) => toast({ title: 'Erro na verificação', description: String(err), variant: 'destructive' })}
                />
              )}
              {currentStep?.step_type === 'document' && (
                <VLDocumento
                  signatoryId={signer.bluetech_signatory_id || signer.id}
                  documentId={doc.id}
                  aoCompletar={handleValidationComplete}
                  onError={(err) => toast({ title: 'Erro na verificação', description: String(err), variant: 'destructive' })}
                />
              )}
              {currentStep?.step_type === 'selfie_document' && (
                <VLSelfieDoc
                  signatoryId={signer.bluetech_signatory_id || signer.id}
                  documentId={doc.id}
                  aoCompletar={handleValidationComplete}
                  onError={(err) => toast({ title: 'Erro na verificação', description: String(err), variant: 'destructive' })}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Document view with signature fields ──
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">SignProof</span>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-xs bg-warning/15 text-warning px-2 py-1 rounded-full font-medium">
              {pendingCount} campo(s) pendente(s)
            </span>
          )}
          <span className="text-xs text-muted-foreground">Assinatura segura</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{docName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Olá <strong>{signerName}</strong>, clique no campo de assinatura destacado para assinar.
          </p>
        </div>

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

        <Card>
          <CardContent className="p-4">
            <div className="w-full overflow-x-auto flex justify-center">
              <div
                className="relative bg-white rounded-lg border border-border/30 shadow-sm"
                style={{ width: PDF_PAGE_WIDTH, minWidth: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT }}
              >
                {publicUrl && (
                  <PdfPagePreview
                    documentUrl={publicUrl}
                    page={currentPage}
                    className="absolute inset-0 rounded-lg"
                  />
                )}

                {currentPageFields.map((field) => {
                  const isSigned = signedFieldIds.has(field.id);
                  return (
                    <div
                      key={field.id}
                      onClick={() => !isSigned && openSigningModal(field.id)}
                      className={cn(
                        'absolute border-2 rounded-lg flex items-center justify-center gap-1.5 transition-all z-10',
                        isSigned
                          ? 'border-success/50 bg-success/10 cursor-default'
                          : 'border-primary border-dashed bg-primary/5 cursor-pointer hover:bg-primary/15 hover:shadow-lg hover:shadow-primary/20 animate-pulse'
                      )}
                      style={{
                        left: field.x,
                        top: field.y,
                        width: field.width,
                        height: field.height,
                      }}
                    >
                      {isSigned ? (
                        <span className="text-xs text-success font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Assinado
                        </span>
                      ) : (
                        <>
                          <Pen className="w-4 h-4 text-primary" />
                          <span className="text-xs text-primary font-medium">Assinar aqui</span>
                        </>
                      )}
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
      </div>
    </div>
  );
}
