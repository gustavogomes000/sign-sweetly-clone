/**
 * ═══════════════════════════════════════════════════════════════════════
 * VLCameraBlindada — Câmera com Segurança por Algoritmos Matemáticos
 * ═══════════════════════════════════════════════════════════════════════
 *
 * MÓDULO 1: Componente React de câmera blindada SEM IA/ML.
 *
 * Algoritmos de segurança implementados:
 *   1. Liveness (Prova de Vida): Frame Differencing — compara 2 frames
 *      espaçados por 500ms calculando a diferença absoluta de pixels.
 *      Se a diferença for zero = imagem estática injetada = bloqueio.
 *
 *   2. Qualidade de Documento: Variância de Luminosidade — calcula
 *      a variância do brilho (luma Y) dos pixels no Canvas.
 *      Imagem monocromática/borrada = variância baixa = bloqueio.
 *
 *   3. Bloqueio de Câmeras Virtuais: Rejeita MediaStreamTrack cujo
 *      label contenha 'OBS', 'Virtual' ou 'ManyCam'.
 *
 *   4. Validação GPS: Exige enableHighAccuracy e bloqueia se
 *      precisão > 1500m (indicativo de GPS falso).
 *
 *   5. Máscara Visual Estática: Guia CSS de oval (selfie) ou
 *      retângulo (documento) para alinhamento.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, AlertCircle, User, Loader2, CreditCard, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Constantes de Configuração dos Algoritmos ──
const INTERVALO_LIVENESS_MS = 500;
const LIMIAR_DIFERENCA_LIVENESS = 0.005; // 0.5% mínimo de variação entre frames
const LIMIAR_VARIANCIA_DOCUMENTO = 200;   // Variância mínima de luminosidade
const PRECISAO_GPS_MAXIMA_METROS = 1500;  // Acima disso = possível Fake GPS
const CAMERAS_VIRTUAIS_PROIBIDAS = ['obs', 'virtual', 'manycam', 'xsplit', 'snap camera'];

// ── Tipos ──
export type ModoCameraBlindada = 'selfie' | 'documento';

export interface VLCameraBlindadaProps {
  /** Modo da câmera: 'selfie' (frontal) ou 'documento' (traseira) */
  modo: ModoCameraBlindada;
  /** Callback ao completar captura com sucesso */
  aoCompletar: (dados: {
    imagemBase64: string;
    validacoes: {
      livenessAprovado?: boolean;
      qualidadeAprovada?: boolean;
      gpsValido: boolean;
      cameraFisica: boolean;
    };
  }) => void;
  /** Callback de erro */
  aoErrar?: (erro: string) => void;
  /** Pular validação GPS (para testes) */
  pularGps?: boolean;
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ALGORITMO 1: Frame Differencing (Prova de Vida)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Captura 2 frames do vídeo em um canvas invisível com intervalo
 * de 500ms. Calcula a diferença média absoluta normalizada (0 a 1).
 * Se a diferença for ~0 → imagem estática injetada → fraude.
 */
function calcularDiferencaFrames(
  frame1: ImageData,
  frame2: ImageData
): number {
  const dados1 = frame1.data;
  const dados2 = frame2.data;
  const totalPixels = dados1.length / 4; // RGBA = 4 canais
  let somaAbsDiff = 0;

  for (let i = 0; i < dados1.length; i += 4) {
    // Comparar canais R, G, B (ignorar Alpha)
    const diffR = Math.abs(dados1[i] - dados2[i]);
    const diffG = Math.abs(dados1[i + 1] - dados2[i + 1]);
    const diffB = Math.abs(dados1[i + 2] - dados2[i + 2]);
    somaAbsDiff += (diffR + diffG + diffB) / 3;
  }

  // Normalizar: dividir pela quantidade de pixels e pelo valor máximo (255)
  return somaAbsDiff / (totalPixels * 255);
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ALGORITMO 2: Variância de Luminosidade (Qualidade de Documento)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Converte cada pixel para luminância (Y = 0.299R + 0.587G + 0.114B).
 * Calcula a variância estatística. Baixa variância = imagem uniforme,
 * borrada ou monocromática = documento inválido.
 */
function calcularVarianciaLuminosidade(frame: ImageData): number {
  const dados = frame.data;
  const totalPixels = dados.length / 4;
  let somaLuma = 0;

  // Primeira passada: calcular média da luminância
  for (let i = 0; i < dados.length; i += 4) {
    const luma = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
    somaLuma += luma;
  }
  const mediaLuma = somaLuma / totalPixels;

  // Segunda passada: calcular variância
  let somaDesviosQuadrados = 0;
  for (let i = 0; i < dados.length; i += 4) {
    const luma = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
    somaDesviosQuadrados += (luma - mediaLuma) ** 2;
  }

  return somaDesviosQuadrados / totalPixels;
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ALGORITMO 3: Detecção de Câmera Virtual
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Verifica se o track.label do MediaStream contém palavras-chave
 * associadas a câmeras virtuais (OBS, ManyCam, XSplit, etc.).
 */
function verificarCameraVirtual(stream: MediaStream): {
  cameraFisica: boolean;
  nomeDetectado?: string;
} {
  const tracks = stream.getVideoTracks();
  for (const track of tracks) {
    const rotulo = track.label.toLowerCase();
    for (const proibido of CAMERAS_VIRTUAIS_PROIBIDAS) {
      if (rotulo.includes(proibido)) {
        return { cameraFisica: false, nomeDetectado: track.label };
      }
    }
  }
  return { cameraFisica: true };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export function VLCameraBlindada({
  modo,
  aoCompletar,
  aoErrar,
  pularGps = false,
}: VLCameraBlindadaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [streaming, setStreaming] = useState(false);
  const [capturado, setCapturado] = useState<string | null>(null);
  const [erroCam, setErroCam] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // ── Estados de validação algorítmica ──
  const [livenessOk, setLivenessOk] = useState(false);
  const [qualidadeOk, setQualidadeOk] = useState(false);
  const [gpsValidado, setGpsValidado] = useState(false);
  const [cameraFisica, setCameraFisica] = useState(true);
  const [statusAlgoritmo, setStatusAlgoritmo] = useState('Inicializando...');

  // Refs para o loop de liveness
  const frameAnteriorRef = useRef<ImageData | null>(null);
  const loopIdRef = useRef<number | null>(null);

  // ── O botão só habilita quando as validações passam ──
  const botaoHabilitado = modo === 'selfie'
    ? livenessOk && cameraFisica
    : qualidadeOk && cameraFisica;

  // ═══════════════════════════════════════════════════════════════════
  // INICIALIZAÇÃO: Câmera + GPS + Detecção de câmera virtual
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelado = false;

    const inicializar = async () => {
      // 1. Validar GPS (se não pulado)
      if (!pularGps) {
        try {
          setStatusAlgoritmo('Verificando GPS...');
          const posicao = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            });
          });
          if (posicao.coords.accuracy > PRECISAO_GPS_MAXIMA_METROS) {
            setErroCam(
              `Precisão do GPS insuficiente: ±${Math.round(posicao.coords.accuracy)}m (máximo: ±${PRECISAO_GPS_MAXIMA_METROS}m). Possível GPS falso detectado.`
            );
            return;
          }
          setGpsValidado(true);
        } catch {
          setErroCam('GPS não disponível. Ative a localização nas configurações do navegador.');
          return;
        }
      } else {
        setGpsValidado(true);
      }

      // 2. Abrir câmera com constraints de hardware
      try {
        setStatusAlgoritmo('Abrindo câmera...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: modo === 'selfie' ? 'user' : 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelado) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        // 3. Verificar câmera virtual
        const resultadoCam = verificarCameraVirtual(stream);
        if (!resultadoCam.cameraFisica) {
          stream.getTracks().forEach(t => t.stop());
          setErroCam(
            `Câmera virtual detectada: "${resultadoCam.nomeDetectado}". Apenas câmeras físicas são permitidas.`
          );
          setCameraFisica(false);
          return;
        }
        setCameraFisica(true);

        // 4. Atribuir stream ao vídeo
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreaming(true);
          setStatusAlgoritmo(
            modo === 'selfie'
              ? 'Analisando prova de vida...'
              : 'Analisando qualidade da imagem...'
          );
        }
      } catch {
        setErroCam('Câmera não disponível. Verifique as permissões do navegador.');
      }
    };

    inicializar();

    return () => {
      cancelado = true;
      stream?.getTracks().forEach(t => t.stop());
      if (loopIdRef.current) cancelAnimationFrame(loopIdRef.current);
    };
  }, [modo, pularGps]);

  // ═══════════════════════════════════════════════════════════════════
  // LOOP DE ANÁLISE CONTÍNUA (Frame Differencing / Variância)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!streaming || capturado) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let ultimoTimestamp = 0;

    const analisar = (timestamp: number) => {
      if (!video.videoWidth) {
        loopIdRef.current = requestAnimationFrame(analisar);
        return;
      }

      // Configurar canvas invisível
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Capturar frame atual
      ctx.drawImage(video, 0, 0);
      const frameAtual = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (modo === 'selfie') {
        // ── LIVENESS: Frame Differencing a cada ~500ms ──
        if (timestamp - ultimoTimestamp >= INTERVALO_LIVENESS_MS) {
          ultimoTimestamp = timestamp;

          if (frameAnteriorRef.current) {
            const diferenca = calcularDiferencaFrames(
              frameAnteriorRef.current,
              frameAtual
            );
            // Se houver variação natural mínima → prova de vida OK
            const vivo = diferenca > LIMIAR_DIFERENCA_LIVENESS;
            setLivenessOk(vivo);
            setStatusAlgoritmo(
              vivo
                ? `✅ Prova de vida OK (Δ=${(diferenca * 100).toFixed(2)}%)`
                : `⏳ Detectando movimento... (Δ=${(diferenca * 100).toFixed(2)}%)`
            );
          }
          frameAnteriorRef.current = frameAtual;
        }
      } else {
        // ── DOCUMENTO: Variância de Luminosidade contínua ──
        const variancia = calcularVarianciaLuminosidade(frameAtual);
        const qualidade = variancia > LIMIAR_VARIANCIA_DOCUMENTO;
        setQualidadeOk(qualidade);
        setStatusAlgoritmo(
          qualidade
            ? `✅ Qualidade OK (σ²=${variancia.toFixed(0)})`
            : `⏳ Melhore a iluminação (σ²=${variancia.toFixed(0)}, mín: ${LIMIAR_VARIANCIA_DOCUMENTO})`
        );
      }

      loopIdRef.current = requestAnimationFrame(analisar);
    };

    loopIdRef.current = requestAnimationFrame(analisar);

    return () => {
      if (loopIdRef.current) cancelAnimationFrame(loopIdRef.current);
    };
  }, [streaming, capturado, modo]);

  // ═══════════════════════════════════════════════════════════════════
  // CAPTURA DA FOTO
  // ═══════════════════════════════════════════════════════════════════
  const capturar = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streaming) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      setCapturado(canvas.toDataURL('image/jpeg', 0.85));
      setStatusAlgoritmo('Foto capturada. Confirme para enviar.');
    }
  }, [streaming]);

  // ═══════════════════════════════════════════════════════════════════
  // CONFIRMAÇÃO E ENVIO
  // ═══════════════════════════════════════════════════════════════════
  const confirmar = async () => {
    if (!capturado) return;
    setEnviando(true);
    try {
      aoCompletar({
        imagemBase64: capturado,
        validacoes: {
          livenessAprovado: modo === 'selfie' ? livenessOk : undefined,
          qualidadeAprovada: modo === 'documento' ? qualidadeOk : undefined,
          gpsValido: gpsValidado,
          cameraFisica,
        },
      });
    } catch (err) {
      aoErrar?.(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setEnviando(false);
    }
  };

  const refazer = () => {
    setCapturado(null);
    setLivenessOk(false);
    setQualidadeOk(false);
    frameAnteriorRef.current = null;
    setStatusAlgoritmo(
      modo === 'selfie'
        ? 'Analisando prova de vida...'
        : 'Analisando qualidade da imagem...'
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // TELA DE ERRO
  // ═══════════════════════════════════════════════════════════════════
  if (erroCam) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <p className="text-sm font-medium text-destructive">{erroCam}</p>
        <p className="text-xs text-muted-foreground">
          Por segurança, o fluxo foi bloqueado. Corrija o problema e tente novamente.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Canvas invisível para análise algorítmica */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Área da câmera com máscara visual estática */}
      <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] max-w-xs mx-auto">
        {!capturado ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            // Atributo capture para forçar câmera nativa
            {...(modo === 'selfie'
              ? { capture: 'user' as any }
              : { capture: 'environment' as any }
            )}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={capturado}
            alt={modo === 'selfie' ? 'Selfie capturada' : 'Documento capturado'}
            className="w-full h-full object-cover"
          />
        )}

        {/* ── Máscara Visual Estática ── */}
        {!capturado && streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {modo === 'selfie' ? (
              <>
                {/* Guia oval para rosto */}
                <div className="w-44 h-56 border-2 border-white/50 rounded-full" />
                <User className="absolute w-8 h-8 text-white/40" />
              </>
            ) : (
              <>
                {/* Guia retangular para documento */}
                <div className="w-64 h-40 border-2 border-dashed border-white/50 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-10 h-10 text-white/40" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Indicador de status do algoritmo */}
        {!capturado && streaming && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded-lg px-3 py-1.5">
            <p className="text-[10px] text-white/90 text-center font-mono">
              {statusAlgoritmo}
            </p>
          </div>
        )}
      </div>

      {/* Instrução contextual */}
      <p className="text-sm text-muted-foreground text-center">
        {capturado
          ? 'Verifique a imagem e confirme'
          : modo === 'selfie'
            ? 'Posicione seu rosto dentro do oval e aguarde a detecção de movimento'
            : 'Enquadre o documento no retângulo com boa iluminação'
        }
      </p>

      {/* Indicadores de validação */}
      {!capturado && streaming && (
        <div className="flex flex-wrap justify-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            cameraFisica ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            📷 {cameraFisica ? 'Câmera física' : 'Câmera virtual!'}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            gpsValidado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            📍 {gpsValidado ? 'GPS OK' : 'Verificando GPS...'}
          </span>
          {modo === 'selfie' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              livenessOk ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              🫀 {livenessOk ? 'Prova de vida OK' : 'Detectando movimento...'}
            </span>
          )}
          {modo === 'documento' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              qualidadeOk ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              🔍 {qualidadeOk ? 'Qualidade OK' : 'Melhore a iluminação'}
            </span>
          )}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex justify-center gap-3">
        {!capturado ? (
          <Button
            onClick={capturar}
            disabled={!streaming || !botaoHabilitado}
            size="lg"
            className="gap-2"
          >
            <Camera className="w-5 h-5" />
            {botaoHabilitado ? 'Capturar' : 'Aguarde validação...'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={refazer}
              disabled={enviando}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refazer
            </Button>
            <Button onClick={confirmar} disabled={enviando} className="gap-2">
              {enviando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {enviando ? 'Enviando...' : 'Confirmar'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
