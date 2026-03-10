import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bluetechProxy } from '@/services/bluetechProxy';

export interface VLSelfieProps {
  signatoryId?: string;
  documentId?: string;
  aoCompletar?: (dados: { status: string; imageBase64?: string; bluetechResponse?: unknown }) => void;
  onError?: (erro: unknown) => void;
}

export function VLSelfie({ signatoryId, documentId, aoCompletar, onError }: VLSelfieProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(s => {
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; setStreaming(true); }
      })
      .catch(() => setCamError('Câmera não disponível. Verifique as permissões.'));
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.drawImage(video, 0, 0); setCaptured(canvas.toDataURL('image/jpeg', 0.85)); }
  };

  const confirm = async () => {
    if (!captured) return;
    setSending(true);
    try {
      // Call BlueTech selfie microservice if we have IDs
      let bluetechResponse: unknown = null;
      if (signatoryId && documentId) {
        bluetechResponse = await bluetechProxy.captureSelfieDocument({
          signatoryId,
          documentId,
          imageBase64: captured,
          userAgent: navigator.userAgent,
        });
      }
      aoCompletar?.({ status: 'captured', imageBase64: captured, bluetechResponse });
    } catch (err) {
      console.error('[VLSelfie] Microservice error:', err);
      onError?.(err);
      // Still complete even if microservice fails — capture was successful
      aoCompletar?.({ status: 'captured', imageBase64: captured });
    } finally {
      setSending(false);
    }
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

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] max-w-xs mx-auto">
        {!captured ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <img src={captured} alt="Selfie capturada" className="w-full h-full object-cover" />
        )}
        {!captured && streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-52 border-2 border-white/60 rounded-full" />
            <User className="absolute w-8 h-8 text-white/60" />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground text-center">{!captured ? 'Posicione seu rosto dentro do círculo' : 'Sua selfie foi capturada'}</p>
      <div className="flex justify-center gap-3">
        {!captured ? (
          <Button onClick={capture} disabled={!streaming} size="lg" className="gap-2"><Camera className="w-5 h-5" /> Tirar selfie</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setCaptured(null)} disabled={sending} className="gap-2"><RefreshCw className="w-4 h-4" /> Refazer</Button>
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
