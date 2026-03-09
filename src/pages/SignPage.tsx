import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, FileText, Pen, Type, Download, Loader2, AlertCircle, ChevronLeft, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { loadSigningData, saveSignature, completeValidationStep } from '@/services/documentService';
import { createBlueTechClient, getBlueTechConfig } from '@/services/bluetechApi';
import PdfPagePreview from '@/components/documents/PdfPagePreview';
import { VLSelfie, VLDocumento, VLSelfieDoc } from '@/components/valeris';
import { useValerisConfig } from '@/components/valeris/useValerisConfig';

type PageStep = 'loading' | 'document' | 'validation' | 'complete' | 'error';

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
  const { apiKey: valerisApiKey } = useValerisConfig();

  // Signature modal state
  const [signingFieldId, setSigningFieldId] = useState<string | null>(null);
  const [signMethod, setSignMethod] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Signed fields tracking (local)
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

        // Check already-signed fields
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

  // Init canvas when modal opens
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = 'hsl(220, 20%, 14%)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (signingFieldId) {
      setTimeout(initCanvas, 150);
    }
  }, [signingFieldId, initCanvas]);

  // Drawing handlers
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getCanvasBase64 = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const openSigningModal = (fieldId: string) => {
    setSigningFieldId(fieldId);
    setSignMethod('draw');
    setTypedName('');
    setHasDrawn(false);
  };

  const closeSigningModal = () => {
    setSigningFieldId(null);
    setSignMethod('draw');
    setTypedName('');
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!signerData || !signingFieldId) return;
    setProcessing(true);

    const signer = signerData.signer as { id: string; bluetech_signatory_id: string; bluetech_document_id: string };
    const doc = signerData.document as { id: string };

    try {
      const config = getBlueTechConfig();
      const client = createBlueTechClient(config);

      let bluetechResponse: Record<string, unknown> | undefined;
      let imageBase64: string | undefined;
      let typedText: string | undefined;

      if (signMethod === 'draw') {
        imageBase64 = getCanvasBase64();
        try {
          bluetechResponse = await client.saveSignatureDrawn({
            signatoryId: signer.bluetech_signatory_id || signer.id,
            documentId: signer.bluetech_document_id || doc.id,
            imageBase64,
            userAgent: navigator.userAgent,
          }) as Record<string, unknown>;
        } catch (apiErr) {
          console.warn('BlueTech API call failed, saving locally:', apiErr);
        }
      } else {
        typedText = typedName;
        try {
          bluetechResponse = await client.saveSignatureTyped({
            signatoryId: signer.bluetech_signatory_id || signer.id,
            documentId: signer.bluetech_document_id || doc.id,
            text: typedText,
            userAgent: navigator.userAgent,
          }) as Record<string, unknown>;
        } catch (apiErr) {
          console.warn('BlueTech API call failed, saving locally:', apiErr);
        }
      }

      await saveSignature({
        signerId: signer.id,
        documentId: doc.id,
        fieldId: signingFieldId,
        signatureType: signMethod === 'draw' ? 'drawn' : 'typed',
        imageBase64,
        typedText,
        userAgent: navigator.userAgent,
        bluetechResponse,
      });

      // Mark field as signed locally
      const newSigned = new Set(signedFieldIds);
      newSigned.add(signingFieldId);
      setSignedFieldIds(newSigned);

      toast({ title: 'Assinatura registrada! ✅' });
      closeSigningModal();

      // Check if ALL fields are now signed
      const allFields = signerData.fields || [];
      const pendingFields = allFields.filter((f) => !newSigned.has(f.id));
      
      if (pendingFields.length === 0) {
        // All fields signed - check validation steps
        const pendingSteps = (signerData.validationSteps || []).filter((s: ValidationStep) => s.status !== 'completed');
        
        if (pendingSteps.length > 0) {
          // Has validation steps - go to validation flow
          setValidationStepIdx(0);
          setTimeout(() => setPageStep('validation'), 600);
        } else {
          // No validation steps - complete
          setTimeout(() => setPageStep('complete'), 600);
        }
      } else {
        // Navigate to next pending field's page
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
    
    // Check if more steps remaining
    if (validationStepIdx + 1 < pendingSteps.length) {
      setValidationStepIdx(prev => prev + 1);
    } else {
      // All validation steps complete
      setTimeout(() => setPageStep('complete'), 600);
    }
  };

  const canSign = signMethod === 'draw' ? hasDrawn : typedName.trim().length >= 3;

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

  // Loading
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

  // Error
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

  // Complete
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

  // Validation steps
  if (pageStep === 'validation' && signerData) {
    const pendingSteps = (signerData.validationSteps || []).filter((s: ValidationStep) => s.status !== 'completed');
    const currentStep = pendingSteps[validationStepIdx];
    const signer = signerData.signer as { id: string; bluetech_signatory_id?: string };
    const doc = signerData.document as { id: string };
    
    const stepTitles: Record<string, string> = {
      'selfie': 'Reconhecimento Facial',
      'document': 'Foto do Documento',
      'selfie_document': 'Selfie com Documento',
    };
    
    const stepSubtitles: Record<string, string> = {
      'selfie': 'Tire uma selfie para verificar sua identidade',
      'document': 'Fotografe seu RG, CNH ou CPF',
      'selfie_document': 'Tire uma selfie segurando seu documento',
    };
    
    const stepTitle = stepTitles[currentStep?.step_type] || 'Verificação';
    const stepSubtitle = stepSubtitles[currentStep?.step_type] || '';
    
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
          {/* Progress indicator */}
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
            <h1 className="text-xl font-bold text-foreground">{stepTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">{stepSubtitle}</p>
          </div>
          
          <Card>
            <CardContent className="p-4">
              {currentStep?.step_type === 'selfie' && (
                <VLSelfie
                  apiKey={valerisApiKey}
                  signatoryId={signer.bluetech_signatory_id || signer.id}
                  documentId={doc.id}
                  aoCompletar={handleValidationComplete}
                  onError={(err) => {
                    toast({ title: 'Erro na verificação', description: String(err), variant: 'destructive' });
                  }}
                />
              )}
              {currentStep?.step_type === 'document' && (
                <VLDocumento
                  apiKey={valerisApiKey}
                  signatoryId={signer.bluetech_signatory_id || signer.id}
                  documentId={doc.id}
                  aoCompletar={handleValidationComplete}
                  onError={(err) => {
                    toast({ title: 'Erro na verificação', description: String(err), variant: 'destructive' });
                  }}
                />
              )}
              {currentStep?.step_type === 'selfie_document' && (
                <VLSelfieDoc
                  apiKey={valerisApiKey}
                  signatoryId={signer.bluetech_signatory_id || signer.id}
                  documentId={doc.id}
                  aoCompletar={handleValidationComplete}
                  onError={(err) => {
                    toast({ title: 'Erro na verificação', description: String(err), variant: 'destructive' });
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Document view with inline signing (only shows fields, no bypass)
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        {/* Info */}
        <div>
          <h1 className="text-xl font-bold text-foreground">{docName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Olá <strong>{signerName}</strong>, clique no campo de assinatura destacado para assinar.
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

        {/* Document canvas with signature fields */}
        <Card>
          <CardContent className="p-4">
            <div className="w-full overflow-x-auto flex justify-center">
              <div
                className="relative bg-white rounded-lg border border-border/30 shadow-sm"
                style={{ width: PDF_PAGE_WIDTH, minWidth: PDF_PAGE_WIDTH, height: PDF_PAGE_HEIGHT }}
              >
                {/* PDF rendering */}
                {publicUrl && (
                  <PdfPagePreview
                    documentUrl={publicUrl}
                    page={currentPage}
                    className="absolute inset-0 rounded-lg"
                  />
                )}

                {/* Signature field overlays */}
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

                {/* No fields on this page */}
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

      {/* Signing modal overlay */}
      {signingFieldId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center" onClick={closeSigningModal}>
          <div
            className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground">Assinar documento</h2>
                <p className="text-xs text-muted-foreground">Desenhe ou digite sua assinatura</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeSigningModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Modal body */}
            <div className="p-4 space-y-4">
              <Tabs value={signMethod} onValueChange={(v) => setSignMethod(v as 'draw' | 'type')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="draw" className="gap-1.5"><Pen className="w-4 h-4" />Desenhar</TabsTrigger>
                  <TabsTrigger value="type" className="gap-1.5"><Type className="w-4 h-4" />Digitar</TabsTrigger>
                </TabsList>
                <TabsContent value="draw" className="mt-4">
                  <div className="relative border-2 border-dashed border-border rounded-xl bg-background">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-40 cursor-crosshair rounded-xl"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                    />
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <div className="w-3/4 h-px bg-muted-foreground/30" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" onClick={clearCanvas} className="text-xs">Limpar</Button>
                  </div>
                </TabsContent>
                <TabsContent value="type" className="mt-4 space-y-3">
                  <Input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="text-center text-lg"
                  />
                  {typedName && (
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-background">
                      <p className="text-3xl font-serif italic text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                        {typedName}
                      </p>
                      <div className="w-3/4 h-px bg-muted-foreground/30 mx-auto mt-3" />
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground max-w-[200px]">Ao assinar, você concorda com os termos de uso.</p>
                <Button onClick={handleSign} disabled={!canSign || processing} className="shadow-lg shadow-primary/20">
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processando...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-1" />Confirmar assinatura</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}