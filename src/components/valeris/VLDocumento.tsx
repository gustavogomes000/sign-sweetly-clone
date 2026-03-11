import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface VLDocumentoProps {
  signatoryId?: string;
  documentId?: string;
  aoCompletar?: (dados: { status: string; type: string; imageBase64?: string }) => void;
  onError?: (erro: unknown) => void;
}

/**
 * Componente de captura de documento 100% interno.
 * Valida qualidade e estabilidade antes de permitir captura.
 * Tolerâncias ajustadas para ambientes reais.
 */
export function VLDocumento({ aoCompletar, onError }: VLDocumentoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [docType, setDocType] = useState<'rg' | 'cnh' | 'cpf'>('rg');
  const [sending, setSending] = useState(false);
  const [quality, setQuality] = useState<'waiting' | 'poor' | 'good'>('waiting');
  const [stabilityCount, setStabilityCount] = useState(0);
  const prevFrameRef = useRef<ImageData | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stabilityRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const REQUIRED_STABLE_FRAMES = 4;

  const startCamera = useCallback(() => {
    canvasRef.current = document.createElement('canvas');
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    })
      .catch(() => navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      }))
      .then(s => {
        if (!s) return;
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setStreaming(true);
          };
        }
      })
      .catch((err) => {
        console.error('[VLDocumento] Camera error:', err);
        setCamError('Câmera não disponível. Verifique as permissões do navegador.');
      });
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [startCamera]);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streaming || captured) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 120;
    canvas.height = 90;
    ctx.drawImage(video, 0, 0, 120, 90);
    const frame = ctx.getImageData(0, 0, 120, 90);

    // Luminosity check (sampled)
    let lumSum = 0;
    const sampleStep = 16;
    let sampleCount = 0;
    for (let i = 0; i < frame.data.length; i += sampleStep) {
      lumSum += 0.299 * frame.data[i] + 0.587 * frame.data[i + 1] + 0.114 * frame.data[i + 2];
      sampleCount++;
    }
    const meanLum = lumSum / sampleCount;

    // Stability check
    let isStable = true;
    if (prevFrameRef.current) {
      let diffSum = 0;
      let diffCount = 0;
      for (let i = 0; i < frame.data.length; i += sampleStep) {
        diffSum += Math.abs(frame.data[i] - prevFrameRef.current.data[i]);
        diffCount++;
      }
      const avgDiff = diffSum / diffCount;
      isStable = avgDiff < 8;
    }

    const goodQuality = meanLum > 25 && meanLum < 235 && isStable;

    if (goodQuality) {
      stabilityRef.current += 1;
      setStabilityCount(stabilityRef.current);
      if (stabilityRef.current >= REQUIRED_STABLE_FRAMES) setQuality('good');
    } else {
      stabilityRef.current = 0;
      setStabilityCount(0);
      setQuality('poor');
    }

    prevFrameRef.current = frame;
    animFrameRef.current = requestAnimationFrame(analyzeFrame);
  }, [streaming, captured]);

  useEffect(() => {
    if (streaming && !captured) {
      animFrameRef.current = requestAnimationFrame(analyzeFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [streaming, captured, analyzeFrame]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      setCaptured(canvas.toDataURL('image/jpeg', 0.9));
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  };

  const confirm = async () => {
    if (!captured) return;
    setSending(true);
    try {
      aoCompletar?.({ status: 'captured', type: docType, imageBase64: captured });
    } catch (err) {
      console.error('[VLDocumento] Error:', err);
      onError?.(err);
    } finally {
      setSending(false);
    }
  };

  const retake = () => {
    setCaptured(null);
    stabilityRef.current = 0;
    setStabilityCount(0);
    setQuality('waiting');
    prevFrameRef.current = null;
    startCamera();
  };

  if (camError) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-sm text-muted-foreground">{camError}</p>
        <Button onClick={() => aoCompletar?.({ status: 'skipped', type: docType })} variant="outline" size="sm">Pular esta etapa</Button>
      </div>
    );
  }

  const qualityProgress = Math.min(100, (stabilityCount / REQUIRED_STABLE_FRAMES) * 100);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Tipo de documento:</label>
        <Select value={docType} onValueChange={(v: 'rg' | 'cnh' | 'cpf') => setDocType(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rg">RG - Registro Geral</SelectItem>
            <SelectItem value="cnh">CNH - Carteira de Motorista</SelectItem>
            <SelectItem value="cpf">CPF - Cadastro de Pessoa Física</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] max-w-sm mx-auto">
        {!captured ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <img src={captured} alt="Documento capturado" className="w-full h-full object-cover" />
        )}
        {!captured && streaming && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-72 h-44 border-2 rounded-lg transition-colors duration-300 ${
                quality === 'good' ? 'border-green-400' :
                quality === 'poor' ? 'border-yellow-400/60' :
                'border-white/60'
              }`} />
              <CreditCard className="absolute w-8 h-8 text-white/60" />
            </div>
            <div className="absolute bottom-3 left-4 right-4">
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    quality === 'good' ? 'bg-green-400' : 'bg-yellow-400'
                  }`}
                  style={{ width: `${qualityProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-white/80 text-center mt-1">
                {quality === 'good' ? '✓ Documento estável — pode fotografar' :
                 quality === 'poor' ? 'Segure firme e melhore a iluminação' :
                 'Posicione o documento...'}
              </p>
            </div>
          </>
        )}
      </div>
      <p className="text-sm text-muted-foreground text-center">
        {!captured
          ? quality === 'good'
            ? `${docType.toUpperCase()} detectado com boa qualidade. Fotografe!`
            : `Posicione seu ${docType.toUpperCase()} dentro do retângulo`
          : 'Documento capturado com sucesso'
        }
      </p>
      <div className="flex justify-center gap-3">
        {!captured ? (
          <Button onClick={capture} disabled={!streaming || quality !== 'good'} size="lg" className="gap-2">
            <Camera className="w-5 h-5" /> Fotografar
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={retake} disabled={sending} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refazer
            </Button>
            <Button onClick={confirm} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {sending ? 'Enviando...' : 'Confirmar'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
