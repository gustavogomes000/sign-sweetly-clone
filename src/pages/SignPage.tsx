import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, FileText, Pen, Type, Download, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function SignPage() {
  const [signed, setSigned] = useState(false);
  const [signMethod, setSignMethod] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const { toast } = useToast();

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
    setSigned(true);
    toast({ title: 'Documento assinado com sucesso! ✅', description: 'Todos os participantes serão notificados.' });
  };

  const canSign = signMethod === 'draw' ? hasDrawn : typedName.trim().length >= 3;

  if (signed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center animate-fade-in">
          <CardContent className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Assinatura concluída!</h1>
            <p className="text-muted-foreground">Seu documento foi assinado com sucesso. Todos os participantes foram notificados.</p>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-1" />Baixar documento assinado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        <div>
          <h1 className="text-xl font-bold text-foreground">Contrato de Prestação de Serviços - TechCorp</h1>
          <p className="text-sm text-muted-foreground mt-1">Enviado por Usuário Silva · usuario@empresa.com</p>
        </div>

        {/* Document preview */}
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

        {/* Signature area */}
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
              <p className="text-xs text-muted-foreground">
                Ao assinar, você concorda com os termos do documento e confirma sua identidade.
              </p>
              <Button onClick={handleSign} disabled={!canSign} className="shadow-lg shadow-primary/20">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Assinar documento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
