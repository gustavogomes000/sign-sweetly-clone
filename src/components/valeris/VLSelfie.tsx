import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface VLSelfieProps {
  signatoryId?: string;
  documentId?: string;
  aoCompletar?: (dados: { status: string; imageBase64?: string }) => void;
  onError?: (erro: unknown) => void;
}

/**
 * Componente de captura de selfie 100% interno.
 * Prova de Vida via Frame Differencing + Variância de Luminosidade.
 * Tolerâncias ajustadas para funcionar em ambientes reais.
 */
export function VLSelfie({ aoCompletar, onError }: VLSelfieProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState<'waiting' | 'detecting' | 'ready'>('waiting');
  const [stabilityCount, setStabilityCount] = useState(0);
  const prevFrameRef = useRef<ImageData | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasAnalysisRef = useRef<HTMLCanvasElement | null>(null);
  const stabilityRef = useRef(0);

  const REQUIRED_STABLE_FRAMES = 5;

  useEffect(() => {
    let stream: MediaStream | null = null;
    canvasAnalysisRef.current = document.createElement('canvas');

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setStreaming(true);
            setLivenessStatus('detecting');
          };
        }
      })
      .catch((err) => {
        console.error('[VLSelfie] Camera error:', err);
        setCamError('Câmera não disponível. Verifique as permissões do navegador.');
      });

    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasAnalysisRef.current;
    if (!video || !canvas || !streaming || captured) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 120;
    canvas.height = 90;
    ctx.drawImage(video, 0, 0, 120, 90);
    const currentFrame = ctx.getImageData(0, 0, 120, 90);

    if (prevFrameRef.current) {
      let diffSum = 0;
      const pixels = currentFrame.data.length / 4;
      for (let i = 0; i < currentFrame.data.length; i += 16) {
        diffSum += Math.abs(currentFrame.data[i] - prevFrameRef.current.data[i]);
      }
      const sampledPixels = Math.ceil(currentFrame.data.length / 16);
      const avgDiff = diffSum / sampledPixels;

      // Relaxed: any movement between 0.3 and 30 counts as alive
      let lumSum = 0;
      for (let i = 0; i < currentFrame.data.length; i += 16) {
        lumSum += 0.299 * currentFrame.data[i] + 0.587 * currentFrame.data[i + 1] + 0.114 * currentFrame.data[i + 2];
      }
      const meanLum = lumSum / sampledPixels;
      const isLive = avgDiff > 0.3 && avgDiff < 30 && meanLum > 20 && meanLum < 240;

      if (isLive) {
        stabilityRef.current += 1;
        setStabilityCount(stabilityRef.current);
        if (stabilityRef.current >= REQUIRED_STABLE_FRAMES) {
          setLivenessStatus('ready');
        }
      } else {
        stabilityRef.current = 0;
        setStabilityCount(0);
        setLivenessStatus('detecting');
      }
    }

    prevFrameRef.current = currentFrame;
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
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCaptured(dataUrl);
      // Stop camera after capture
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    }
  };

  const confirm = async () => {
    if (!captured) return;
    setSending(true);
    try {
      aoCompletar?.({ status: 'captured', imageBase64: captured });
    } catch (err) {
      console.error('[VLSelfie] Error:', err);
      onError?.(err);
    } finally {
      setSending(false);
    }
  };

  const retake = () => {
    setCaptured(null);
    stabilityRef.current = 0;
    setStabilityCount(0);
    setLivenessStatus('detecting');
    prevFrameRef.current = null;
    // Restart camera
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    }).then(s => {
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
        setStreaming(true);
      }
    }).catch(() => {});
  };

  if (camError) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-sm text-muted-foreground">{camError}</p>
        <Button onClick={() => aoCompletar?.({ status: 'skipped' })} variant="outline" size="sm">Pular esta etapa</Button>
      </div>
    );
  }

  const livenessProgress = Math.min(100, (stabilityCount / REQUIRED_STABLE_FRAMES) * 100);

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] max-w-xs mx-auto">
        {!captured ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <img src={captured} alt="Selfie capturada" className="w-full h-full object-cover" />
        )}
        {!captured && streaming && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`w-40 h-52 border-2 rounded-full transition-colors duration-300 ${
                livenessStatus === 'ready' ? 'border-green-400' :
                livenessStatus === 'detecting' ? 'border-yellow-400/60' :
                'border-white/60'
              }`} />
              <User className="absolute w-8 h-8 text-white/60" />
            </div>
            <div className="absolute bottom-3 left-4 right-4">
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    livenessStatus === 'ready' ? 'bg-green-400' : 'bg-yellow-400'
                  }`}
                  style={{ width: `${livenessProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-white/80 text-center mt-1">
                {livenessStatus === 'ready' ? '✓ Prova de vida confirmada' :
                 livenessStatus === 'detecting' ? 'Detectando presença...' :
                 'Iniciando câmera...'}
              </p>
            </div>
          </>
        )}
      </div>
      <p className="text-sm text-muted-foreground text-center">
        {!captured
          ? livenessStatus === 'ready'
            ? 'Prova de vida OK. Tire a selfie agora!'
            : 'Posicione seu rosto dentro do círculo e aguarde a detecção'
          : 'Sua selfie foi capturada com sucesso'
        }
      </p>
      <div className="flex justify-center gap-3">
        {!captured ? (
          <Button onClick={capture} disabled={!streaming || livenessStatus !== 'ready'} size="lg" className="gap-2">
            <Camera className="w-5 h-5" /> Tirar selfie
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
