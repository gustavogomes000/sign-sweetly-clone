import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, FileText, Pen, Type, Download, Camera, FileImage, UserCheck, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

type PostSignStep = 'signature' | 'selfie' | 'document_photo' | 'selfie_with_document' | 'complete';

const mockValidationSteps: PostSignStep[] = ['selfie', 'document_photo'];

export default function SignPage() {
  const [currentStep, setCurrentStep] = useState<PostSignStep>('signature');
  const [signMethod, setSignMethod] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const allSteps: PostSignStep[] = ['signature', ...mockValidationSteps, 'complete'];
  const currentIndex = allSteps.indexOf(currentStep);
  const progressPercent = (currentIndex / (allSteps.length - 1)) * 100;

  useEffect(() => {
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

  const handleSign = () => {
    setProcessing(true);
    // Mock: call microservice API
    setTimeout(() => {
      setProcessing(false);
      toast({ title: 'Assinatura registrada! ✅' });
      if (mockValidationSteps.length > 0) {
        setCurrentStep(mockValidationSteps[0]);
      } else {
        setCurrentStep('complete');
      }
    }, 1500);
  };

  const handleValidationStep = () => {
    setProcessing(true);
    // Mock: call respective microservice
    setTimeout(() => {
      setProcessing(false);
      const nextIndex = currentIndex + 1;
      if (nextIndex < allSteps.length) {
        setCurrentStep(allSteps[nextIndex]);
        toast({ title: 'Etapa concluída! ✅' });
      }
    }, 2000);
  };

  const canSign = signMethod === 'draw' ? hasDrawn : typedName.trim().length >= 3;

  const stepLabels: Record<PostSignStep, string> = {
    signature: 'Assinatura',
    selfie: 'Selfie',
    document_photo: 'Foto do documento',
    selfie_with_document: 'Selfie com documento',
    complete: 'Concluído',
  };

  const stepIcons: Record<PostSignStep, React.ElementType> = {
    signature: Pen,
    selfie: Camera,
    document_photo: FileImage,
    selfie_with_document: UserCheck,
    complete: CheckCircle2,
  };

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center animate-fade-in">
          <CardContent className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Processo concluído!</h1>
            <p className="text-muted-foreground">Seu documento foi assinado e todas as validações foram realizadas com sucesso.</p>
            <Button variant="outline"><Download className="w-4 h-4 mr-1" />Baixar documento assinado</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">SignFlow</span>
        </div>
        <span className="text-xs text-muted-foreground">Assinatura segura</span>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {allSteps.filter(s => s !== 'complete').map((step, i) => {
              const StepIcon = stepIcons[step];
              const isDone = i < currentIndex;
              const isCurrent = step === currentStep;
              return (
                <div key={step} className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                    isDone ? 'bg-success text-success-foreground' :
                    isCurrent ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' :
                    'bg-secondary text-muted-foreground'
                  )}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <span className={cn('text-xs font-medium hidden sm:inline', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                    {stepLabels[step]}
                  </span>
                  {i < allSteps.length - 2 && <div className={cn('w-8 h-px mx-1', isDone ? 'bg-success' : 'bg-border')} />}
                </div>
              );
            })}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">Contrato de Prestação de Serviços - TechCorp</h1>
          <p className="text-sm text-muted-foreground mt-1">Enviado por Usuário Silva · usuario@empresa.com</p>
        </div>

        {/* Signature step */}
        {currentStep === 'signature' && (
          <>
            <Card>
              <CardContent className="p-0">
                <div className="aspect-[3/4] bg-secondary/30 rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Conteúdo do documento</p>
                    <p className="text-xs mt-1">Leia atentamente antes de assinar</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-base font-semibold">Sua assinatura</h2>
                <Tabs value={signMethod} onValueChange={(v) => setSignMethod(v as 'draw' | 'type')}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="draw" className="gap-1.5"><Pen className="w-4 h-4" />Desenhar</TabsTrigger>
                    <TabsTrigger value="type" className="gap-1.5"><Type className="w-4 h-4" />Digitar</TabsTrigger>
                  </TabsList>
                  <TabsContent value="draw" className="mt-4">
                    <div className="relative border-2 border-dashed border-border rounded-xl bg-card">
                      <canvas ref={canvasRef} className="w-full h-40 cursor-crosshair rounded-xl" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} />
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                        <div className="w-3/4 h-px bg-muted-foreground/30" />
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button variant="ghost" size="sm" onClick={clearCanvas} className="text-xs">Limpar</Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="type" className="mt-4 space-y-3">
                    <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Digite seu nome completo" className="text-center text-lg" />
                    {typedName && (
                      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-card">
                        <p className="text-3xl font-serif italic text-foreground" style={{ fontFamily: 'Georgia, serif' }}>{typedName}</p>
                        <div className="w-3/4 h-px bg-muted-foreground/30 mx-auto mt-3" />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">Ao assinar, você concorda com os termos do documento.</p>
                  <Button onClick={handleSign} disabled={!canSign || processing} className="shadow-lg shadow-primary/20">
                    {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    {processing ? 'Processando...' : 'Assinar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Validation steps */}
        {(currentStep === 'selfie' || currentStep === 'document_photo' || currentStep === 'selfie_with_document') && (
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-center space-y-2">
                {currentStep === 'selfie' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Camera className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Tire uma selfie</h2>
                    <p className="text-sm text-muted-foreground">Posicione seu rosto na câmera para validação de identidade.</p>
                  </>
                )}
                {currentStep === 'document_photo' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <FileImage className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Fotografe seu documento</h2>
                    <p className="text-sm text-muted-foreground">Tire uma foto do seu RG, CNH ou CPF para verificação.</p>
                  </>
                )}
                {currentStep === 'selfie_with_document' && (
                  <>
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <UserCheck className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Selfie com documento</h2>
                    <p className="text-sm text-muted-foreground">Tire uma foto segurando seu documento ao lado do rosto.</p>
                  </>
                )}
              </div>

              {/* Mock camera area */}
              <div className="aspect-[4/3] bg-secondary/50 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Camera className="w-16 h-16 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Área da câmera</p>
                  <p className="text-xs mt-1">Este componente será integrado com o microsserviço</p>
                  <p className="text-[10px] mt-2 font-mono bg-secondary px-2 py-1 rounded inline-block">
                    POST /api/v1/{currentStep === 'selfie' ? 'selfie' : currentStep === 'document_photo' ? 'document-collection' : 'selfie-document'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Etapa {currentIndex} de {allSteps.length - 1}
                </p>
                <Button onClick={handleValidationStep} disabled={processing} className="shadow-lg shadow-primary/20">
                  {processing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                  {processing ? 'Enviando...' : 'Capturar e continuar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
