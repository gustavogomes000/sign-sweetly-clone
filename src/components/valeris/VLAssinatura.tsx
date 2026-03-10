import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Pen, Type, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface VLAssinaturaProps {
  signatoryId: string;
  documentId: string;
  aoCompletar?: (dados: { signatureType: 'drawn' | 'typed'; imageBase64?: string; typedText?: string }) => void;
  onError?: (erro: unknown) => void;
  onCancel?: () => void;
}

export function VLAssinatura({ aoCompletar, onError, onCancel }: VLAssinaturaProps) {
  const [method, setMethod] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    setTimeout(initCanvas, 150);
  }, [initCanvas]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
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

  const canSign = method === 'draw' ? hasDrawn : typedName.trim().length >= 3;

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      if (method === 'draw') {
        aoCompletar?.({
          signatureType: 'drawn',
          imageBase64: getCanvasBase64(),
        });
      } else {
        aoCompletar?.({
          signatureType: 'typed',
          typedText: typedName,
        });
      }
    } catch (err) {
      onError?.(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={method} onValueChange={(v) => setMethod(v as 'draw' | 'type')}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="draw" className="gap-1.5"><Pen className="w-4 h-4" />Desenhar</TabsTrigger>
          <TabsTrigger value="type" className="gap-1.5"><Type className="w-4 h-4" />Digitar</TabsTrigger>
        </TabsList>
        <TabsContent value="draw" className="mt-4">
          <div className="relative border-2 border-dashed border-border rounded-xl bg-background touch-none">
            <canvas
              ref={canvasRef}
              className="w-full h-40 cursor-crosshair rounded-xl"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
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
        <p className="text-[10px] text-muted-foreground max-w-[200px]">
          Ao assinar, você concorda com os termos de uso.
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          )}
          <Button onClick={handleConfirm} disabled={!canSign || processing} className="shadow-lg shadow-primary/20">
            {processing ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processando...</>
            ) : (
              <><Check className="w-4 h-4 mr-1" />Confirmar assinatura</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
