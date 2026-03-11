/**
 * Tela 2: Stepper de Assinatura Segura (Wizard Mobile-First)
 * Passo 1: Leitura do PDF
 * Passo 2: Auditoria e GPS
 * Passo 3: Câmera — Selfie/Biometria
 * Passo 4: Câmera — Documento (apenas externos)
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, MapPin, Camera, CreditCard, CheckCircle2, Loader2,
  ChevronRight, ShieldCheck, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGeolocalizacao, type DadosGeolocalizacao } from '@/hooks/useGeolocalizacao';
import { VLCameraBlindada } from '@/components/valeris/VLCameraBlindada';
import { VLDocumento } from '@/components/valeris/VLDocumento';
import { bluepointService } from '@/services/bluepointService';
import { useToast } from '@/hooks/use-toast';
import PdfPagePreview from '@/components/documents/PdfPagePreview';

type PassoWizard = 'leitura' | 'auditoria' | 'selfie' | 'documento' | 'concluido';

interface StepperAssinaturaProps {
  documentoUrl: string;
  documentoNome: string;
  participanteNome: string;
  participanteId: string;
  documentoId: string;
  tipoAutenticacao: 'EXTERNA_KYC' | 'INTERNA_BLUEPOINT';
  bluepointColaboradorId?: number;
  aoFinalizar: (evidencias: EvidenciasColetadas) => void;
}

export interface EvidenciasColetadas {
  geolocalizacao?: DadosGeolocalizacao;
  selfieBase64?: string;
  documentoBase64?: string;
  tipoDocumento?: string;
  biometriaAprovada?: boolean;
  agenteUsuario: string;
}

const passosConfig = [
  { id: 'leitura' as const, label: 'Leitura', icone: FileText },
  { id: 'auditoria' as const, label: 'Localização', icone: MapPin },
  { id: 'selfie' as const, label: 'Selfie', icone: Camera },
  { id: 'documento' as const, label: 'Documento', icone: CreditCard },
];

export function StepperAssinatura({
  documentoUrl,
  documentoNome,
  participanteNome,
  participanteId,
  documentoId,
  tipoAutenticacao,
  bluepointColaboradorId,
  aoFinalizar,
}: StepperAssinaturaProps) {
  const [passoAtual, setPassoAtual] = useState<PassoWizard>('leitura');
  const [paginaPdf, setPaginaPdf] = useState(1);
  const [evidencias, setEvidencias] = useState<Partial<EvidenciasColetadas>>({
    agenteUsuario: navigator.userAgent,
  });
  const [processandoBiometria, setProcessandoBiometria] = useState(false);

  const { coletar: coletarGeo, carregando: geoCarregando, erro: geoErro, dados: geoDados } = useGeolocalizacao();
  const { toast } = useToast();

  // Determinar passos visíveis
  const passosVisiveis = passosConfig.filter((p) => {
    if (p.id === 'documento' && tipoAutenticacao === 'INTERNA_BLUEPOINT') return false;
    return true;
  });

  const indiceAtual = passosVisiveis.findIndex((p) => p.id === passoAtual);
  const totalPassos = passosVisiveis.length;

  const avancar = () => {
    const proximoIndice = indiceAtual + 1;
    if (proximoIndice < passosVisiveis.length) {
      setPassoAtual(passosVisiveis[proximoIndice].id);
    } else {
      setPassoAtual('concluido');
      aoFinalizar(evidencias as EvidenciasColetadas);
    }
  };

  // ── Passo 2: Coleta de GPS ──
  const handleColetarGPS = async () => {
    try {
      const dados = await coletarGeo();
      setEvidencias((prev) => ({ ...prev, geolocalizacao: dados }));
      toast({ title: '📍 Localização capturada!' });
      setTimeout(avancar, 800);
    } catch {
      toast({ title: 'Erro de localização', description: geoErro || 'Ative o GPS e tente novamente.', variant: 'destructive' });
    }
  };

  // ── Passo 3: Selfie / Biometria via Câmera Blindada ──
  const handleSelfieCapturada = async (dados: {
    imagemBase64: string;
    validacoes: { livenessAprovado?: boolean; gpsValido: boolean; cameraFisica: boolean };
  }) => {
    if (tipoAutenticacao === 'INTERNA_BLUEPOINT' && bluepointColaboradorId) {
      setProcessandoBiometria(true);
      try {
        const bio = await bluepointService.validarBiometriaFacial({
          colaboradorId: bluepointColaboradorId,
          imagemBase64: dados.imagemBase64,
        });
        setEvidencias((prev) => ({
          ...prev,
          selfieBase64: dados.imagemBase64,
          biometriaAprovada: bio.sucesso,
        }));
        if (bio.sucesso) {
          toast({ title: '✅ Biometria confirmada!', description: `Pontuação: ${bio.pontuacao}` });
          setTimeout(avancar, 800);
        } else {
          toast({ title: 'Biometria não reconhecida', description: bio.mensagem, variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Erro na biometria', description: err instanceof Error ? err.message : 'Tente novamente', variant: 'destructive' });
      } finally {
        setProcessandoBiometria(false);
      }
    } else {
      setEvidencias((prev) => ({ ...prev, selfieBase64: dados.imagemBase64 }));
      toast({ title: '📸 Selfie capturada com prova de vida!' });
      setTimeout(avancar, 500);
    }
  };

  // ── Passo 4: Documento (só externos) ──
  const handleDocumentoCapturado = (resultado: { status: string; type: string; imageBase64?: string }) => {
    setEvidencias((prev) => ({
      ...prev,
      documentoBase64: resultado.imageBase64,
      tipoDocumento: resultado.type,
    }));
    toast({ title: '📄 Documento capturado!' });
    setTimeout(avancar, 500);
  };

  // ── Tela de conclusão ──
  if (passoAtual === 'concluido') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Verificação concluída!</h1>
            <p className="text-muted-foreground">
              Todas as evidências foram coletadas com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-sm">SignProof</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Etapa {indiceAtual + 1} de {totalPassos}
        </span>
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-border">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((indiceAtual + 1) / totalPassos) * 100}%` }}
        />
      </div>

      {/* Stepper visual */}
      <div className="flex items-center justify-center gap-2 py-4 px-4">
        {passosVisiveis.map((passo, i) => (
          <div key={passo.id} className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              i === indiceAtual ? 'bg-primary text-primary-foreground' :
              i < indiceAtual ? 'bg-primary/10 text-primary' :
              'bg-secondary text-muted-foreground'
            )}>
              {i < indiceAtual ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <passo.icone className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{passo.label}</span>
            </div>
            {i < passosVisiveis.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Conteúdo dos passos */}
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <p className="text-sm text-muted-foreground text-center">
          Olá <strong className="text-foreground">{participanteNome}</strong>
        </p>

        {/* Passo 1: Leitura do PDF */}
        {passoAtual === 'leitura' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground text-center">📄 {documentoNome}</h2>
            <Card className="overflow-hidden">
              <div className="relative w-full" style={{ aspectRatio: '595/842' }}>
                <PdfPagePreview documentUrl={documentoUrl} page={paginaPdf} className="absolute inset-0" />
              </div>
            </Card>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaginaPdf((p) => Math.max(1, p - 1))}
                disabled={paginaPdf <= 1}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">Página {paginaPdf}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaginaPdf((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
            <Button className="w-full gap-2" onClick={avancar}>
              Li e concordo <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Passo 2: Auditoria e GPS */}
        {passoAtual === 'auditoria' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground text-center">📍 Verificação de Localização</h2>
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                {geoDados ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Localização capturada</p>
                      <p className="text-xs text-muted-foreground">{geoDados.enderecoFormatado}</p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {geoDados.latitude.toFixed(6)}, {geoDados.longitude.toFixed(6)} — Precisão: ±{Math.round(geoDados.precisao)}m
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
                      <MapPin className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Precisamos da sua localização para garantir a validade jurídica da assinatura.
                    </p>
                    {geoErro && (
                      <div className="flex items-center gap-2 text-destructive text-xs">
                        <AlertCircle className="w-4 h-4" />
                        {geoErro}
                      </div>
                    )}
                    <Button onClick={handleColetarGPS} disabled={geoCarregando} className="gap-2">
                      {geoCarregando ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Obtendo localização...</>
                      ) : (
                        <><MapPin className="w-4 h-4" /> Permitir localização</>
                      )}
                    </Button>
                  </>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground">
                    🖥️ {navigator.userAgent.substring(0, 80)}...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Passo 3: Selfie / Biometria */}
        {passoAtual === 'selfie' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground text-center">
              {tipoAutenticacao === 'INTERNA_BLUEPOINT' ? '🔐 Biometria Facial' : '📸 Selfie de Verificação'}
            </h2>
            {tipoAutenticacao === 'INTERNA_BLUEPOINT' && (
              <Badge variant="secondary" className="mx-auto flex w-fit gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Validação via BluePoint
              </Badge>
            )}
            <Card>
              <CardContent className="p-4">
                {processandoBiometria ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Validando biometria...</p>
                  </div>
                ) : (
                  <VLSelfie
                    signatoryId={participanteId}
                    documentId={documentoId}
                    aoCompletar={handleSelfieCapturada}
                    onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Passo 4: Documento (apenas KYC externo) */}
        {passoAtual === 'documento' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground text-center">🪪 Foto do Documento</h2>
            <p className="text-sm text-muted-foreground text-center">
              Fotografe a frente do seu RG, CNH ou CPF para validação de identidade.
            </p>
            <Card>
              <CardContent className="p-4">
                <VLDocumento
                  signatoryId={participanteId}
                  documentId={documentoId}
                  aoCompletar={handleDocumentoCapturado}
                  onError={(err) => toast({ title: 'Erro', description: String(err), variant: 'destructive' })}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
