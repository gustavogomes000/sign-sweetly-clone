import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bluetechProxy } from '@/services/bluetechProxy';

export interface VLSelfieDocProps {
  signatoryId?: string;
  documentId?: string;
  aoCompletar?: (dados: any) => void;
  onError?: (erro: any) => void;
  /** @deprecated Use bluetechProxy instead */
  apiKey?: string;
}

export function VLSelfieDoc({ signatoryId, documentId, aoCompletar, onError }: VLSelfieDocProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' }, 
      audio: false 
    })
    .then(s => {
      stream = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        setStreaming(true);
      }
    })
    .catch(() => setCamError('Câmera não disponível. Verifique as permissões.'));

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !streaming) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      setCaptured(canvas.toDataURL('image/jpeg', 0.85));
    }
  };

  const confirm = async () => {
    if (!captured) return;
    setLoading(true);
    
    try {
      const result = await bluetechProxy.captureSelfieDocument({
        signatoryId: signatoryId || '',
        documentId: documentId || '',
        imageBase64: captured.split(',')[1],
        userAgent: navigator.userAgent,
      });
      aoCompletar?.(result);
    } catch (err) {
      console.warn('[VLSelfieDoc] API call failed:', err);
      aoCompletar?.({ status: 'captured', imageBase64: captured, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  if (camError) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-sm text-muted-foreground">{camError}</p>
        <Button onClick={() => aoCompletar?.({ status: 'skipped' })} variant="outline" size="sm">
          Pular esta etapa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] max-w-xs mx-auto">
        {!captured ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <img src={captured} alt="Selfie com documento" className="w-full h-full object-cover" />
        )}
        
        {!captured && streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-52 border-2 border-white/60 rounded-full" />
            <UserCheck className="absolute w-8 h-8 text-white/60 mt-20" />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          {!captured 
            ? 'Segure seu documento ao lado do rosto' 
            : 'Selfie com documento capturada'}
        </p>
        <p className="text-xs text-muted-foreground">
          Certifique-se de que seu rosto e o documento estejam visíveis
        </p>
      </div>

      <div className="flex justify-center gap-3">
        {!captured ? (
          <Button onClick={capture} disabled={!streaming} size="lg" className="gap-2">
            <Camera className="w-5 h-5" /> Capturar
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setCaptured(null)} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refazer
            </Button>
            <Button onClick={confirm} disabled={loading} className="gap-2">
              <Check className="w-4 h-4" />
              {loading ? 'Enviando...' : 'Confirmar'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
