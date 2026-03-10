import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface VLDocumentoProps {
  signatoryId?: string;
  documentId?: string;
  aoCompletar?: (dados: { status: string; type: string; imageBase64?: string }) => void;
  onError?: (erro: unknown) => void;
}

export function VLDocumento({ aoCompletar }: VLDocumentoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [docType, setDocType] = useState<'rg' | 'cnh' | 'cpf'>('rg');

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }))
      .then(s => {
        stream = s!;
        if (videoRef.current) { videoRef.current.srcObject = s!; setStreaming(true); }
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

  const confirm = () => {
    if (!captured) return;
    aoCompletar?.({ status: 'captured', type: docType, imageBase64: captured });
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
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-44 border-2 border-white/60 rounded-lg" />
            <CreditCard className="absolute w-8 h-8 text-white/60" />
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground text-center">{!captured ? `Posicione seu ${docType.toUpperCase()} dentro do retângulo` : 'Documento capturado com sucesso'}</p>
      <div className="flex justify-center gap-3">
        {!captured ? (
          <Button onClick={capture} disabled={!streaming} size="lg" className="gap-2"><Camera className="w-5 h-5" /> Fotografar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setCaptured(null)} className="gap-2"><RefreshCw className="w-4 h-4" /> Refazer</Button>
            <Button onClick={confirm} className="gap-2"><Check className="w-4 h-4" /> Confirmar</Button>
          </>
        )}
      </div>
    </div>
  );
}
