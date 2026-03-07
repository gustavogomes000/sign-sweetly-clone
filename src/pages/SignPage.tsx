import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, FileText, Pen, Type, Download, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

import { loadSigningData, saveSignature } from '@/services/documentService';
import { createBlueTechClient, getBlueTechConfig } from '@/services/bluetechApi';

type SigningStep = 'loading' | 'view_document' | 'signing' | 'processing' | 'complete' | 'error';

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

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<SigningStep>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [signMethod, setSignMethod] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Data from DB
  const [signerData, setSignerData] = useState<{
    signer: Record<string, unknown>;
    document: Record<string, unknown>;
    fields: SignField[];
    validationSteps: Record<string, unknown>[];
  } | null>(null);

  // Load signing data
  useEffect(() => {
    if (!token) {
      setStep('error');
      setErrorMsg('Token de assinatura não fornecido');
      return;
    }
    loadSigningData(token)
      .then((data) => {
        setSignerData(data as typeof signerData);
        if ((data.signer as { status: string }).status === 'signed') {
          setStep('complete');
        } else {
          setStep('view_document');
        }
      })
      .catch((err) => {
        setStep('error');
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar documento');
      });
  }, [token]);

  // Init canvas
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
    if (step === 'signing') {
      setTimeout(initCanvas, 100);
    }
  }, [step, initCanvas]);

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

  const handleFieldClick = (fieldId: string) => {
    setActiveFieldId(fieldId);
    setStep('signing');
  };

  const handleSign = async () => {
    if (!signerData || !activeFieldId) return;
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
        // Call BlueTech microservice
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

      // Save to database
      await saveSignature({
        signerId: signer.id,
        documentId: doc.id,
        fieldId: activeFieldId,
        signatureType: signMethod === 'draw' ? 'drawn' : 'typed',
        imageBase64,
        typedText,
        userAgent: navigator.userAgent,
        bluetechResponse,
      });

      toast({ title: 'Assinatura registrada com sucesso! ✅' });
      setStep('complete');
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

  const canSign = signMethod === 'draw' ? hasDrawn : typedName.trim().length >= 3;

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando documento...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
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

  // Complete state
  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center animate-fade-in">
          <CardContent className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Documento assinado!</h1>
            <p className="text-muted-foreground">Sua assinatura foi registrada com sucesso. Todos os envolvidos serão notificados.</p>
            <Button variant="outline"><Download className="w-4 h-4 mr-1" />Baixar documento</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const docName = signerData ? String((signerData.document as { name: string }).name) : '';
  const signerName = signerData ? String((signerData.signer as { name: string }).name) : '';
  const docUrl = signerData ? String((signerData.document as { file_path: string }).file_path) : '';
  const fields = signerData?.fields || [];

  // Document view with signature fields
  if (step === 'view_document') {
    // Build public URL for document
    const publicUrl = docUrl
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${docUrl}`
      : '';

    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Valeris Sign</span>
          </div>
          <span className="text-xs text-muted-foreground">Assinatura segura</span>
        </header>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">{docName}</h1>
            <p className="text-sm text-muted-foreground mt-1">Olá {signerName}, clique no campo de assinatura abaixo para assinar o documento.</p>
          </div>

          {/* Document preview with positioned signature fields */}
          <Card>
            <CardContent className="p-0">
              <div className="relative bg-white rounded-lg" style={{ minHeight: 842 }}>
                {/* PDF embed */}
                {publicUrl && (
                  <iframe
                    src={`${publicUrl}#toolbar=0`}
                    className="w-full rounded-lg"
                    style={{ height: 842 }}
                    title="Documento"
                  />
                )}

                {/* Signature fields overlay */}
                {fields.map((field) => {
                  const isSigned = !!field.value;
                  return (
                    <div
                      key={field.id}
                      onClick={() => !isSigned && handleFieldClick(field.id)}
                      className={cn(
                        'absolute border-2 rounded-lg flex items-center justify-center gap-2 transition-all',
                        isSigned
                          ? 'border-success/50 bg-success/10 cursor-default'
                          : 'border-primary border-dashed bg-primary/5 cursor-pointer hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/20 animate-pulse'
                      )}
                      style={{
                        left: field.x,
                        top: field.y,
                        width: field.width,
                        height: field.height,
                      }}
                    >
                      {isSigned ? (
                        <span className="text-xs text-success font-medium">✓ Assinado</span>
                      ) : (
                        <>
                          <Pen className="w-4 h-4 text-primary" />
                          <span className="text-xs text-primary font-medium">Assinar aqui</span>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* If no fields, show a message */}
                {fields.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6 bg-card/90 rounded-xl border shadow-lg">
                      <Pen className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium">Nenhum campo de assinatura posicionado</p>
                      <Button className="mt-3" onClick={() => handleFieldClick('default')}>
                        Assinar documento
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Signing modal/step
  if (step === 'signing') {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">Valeris Sign</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setStep('view_document')}>
            Voltar ao documento
          </Button>
        </header>

        <div className="max-w-xl mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Assinar: {docName}</h1>
            <p className="text-sm text-muted-foreground mt-1">Desenhe ou digite sua assinatura abaixo</p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <Tabs value={signMethod} onValueChange={(v) => setSignMethod(v as 'draw' | 'type')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="draw" className="gap-1.5"><Pen className="w-4 h-4" />Desenhar</TabsTrigger>
                  <TabsTrigger value="type" className="gap-1.5"><Type className="w-4 h-4" />Digitar</TabsTrigger>
                </TabsList>
                <TabsContent value="draw" className="mt-4">
                  <div className="relative border-2 border-dashed border-border rounded-xl bg-card">
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
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-card">
                      <p className="text-3xl font-serif italic text-foreground" style={{ fontFamily: 'Georgia, serif' }}>
                        {typedName}
                      </p>
                      <div className="w-3/4 h-px bg-muted-foreground/30 mx-auto mt-3" />
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">Ao assinar, você concorda com os termos.</p>
                <Button onClick={handleSign} disabled={!canSign || processing} className="shadow-lg shadow-primary/20">
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processando...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-1" />Assinar</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
