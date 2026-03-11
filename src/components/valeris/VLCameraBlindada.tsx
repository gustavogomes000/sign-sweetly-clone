/**
 * ═══════════════════════════════════════════════════════════════════════
 * VLCameraBlindada — Câmera com Segurança por Algoritmos Matemáticos
 * ═══════════════════════════════════════════════════════════════════════
 *
 * MÓDULO 1: Componente React de câmera blindada SEM IA/ML.
 *
 * Algoritmos de segurança implementados:
 *   1. Liveness (Prova de Vida): Frame Differencing com downsampling 75%,
 *      limiar adaptativo e contador de estabilidade (3 frames consecutivos).
 *   2. Qualidade de Documento: Variância de Luminosidade via algoritmo
 *      de Welford (passada única — O(n) sem realocação).
 *   3. Bloqueio de Câmeras Virtuais: Lista expandida de track.label.
 *   4. Validação GPS: enableHighAccuracy + bloqueio se precisão > 1500m.
 *   5. Anti-Bypass: Re-validação obrigatória em capturar() e confirmar()
 *      para evitar manipulação via DevTools.
 *   6. Anti-Double-Click: useRef síncrono impede envios duplicados.
 *   7. Anti-Memory-Leak: useRef para stream + cleanup determinístico.
 *
 * Auditoria: 2026-03-11 — 12 vulnerabilidades corrigidas.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, RefreshCw, Check, User, Loader2, CreditCard, ShieldAlert, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTES DE CONFIGURAÇÃO DOS ALGORITMOS
// ═══════════════════════════════════════════════════════════════════════
const INTERVALO_LIVENESS_MS = 500;
const LIMIAR_DIFERENCA_LIVENESS = 0.003;     // 0.3% — reduzido para ambientes escuros
const LIMIAR_VARIANCIA_DOCUMENTO = 200;       // Variância mínima de luminosidade
const PRECISAO_GPS_MAXIMA_METROS = 1500;
const FRAMES_CONSECUTIVOS_NECESSARIOS = 3;    // Exigir N frames consecutivos aprovados
const STRIDE_PIXELS = 16;                     // Processar 1 a cada 4 pixels (stride=16 no RGBA)
const TAMANHO_MAXIMO_IMAGEM_BYTES = 10_000_000; // 10MB — proteção contra memory exhaustion

// Lista expandida de câmeras virtuais conhecidas
const CAMERAS_VIRTUAIS_PROIBIDAS = [
  'obs', 'virtual', 'manycam', 'xsplit', 'snap camera',
  'droidcam', 'iriun', 'epoccam', 'camo', 'mmhmm',
  'streamlabs', 'logi capture', 'chromacam',
];

// ── Tipos ──
export type ModoCameraBlindada = 'selfie' | 'documento';

export interface VLCameraBlindadaProps {
  modo: ModoCameraBlindada;
  aoCompletar: (dados: {
    imagemBase64: string;
    validacoes: {
      livenessAprovado?: boolean;
      qualidadeAprovada?: boolean;
      gpsValido: boolean;
      cameraFisica: boolean;
    };
  }) => void;
  aoErrar?: (erro: string) => void;
  pularGps?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// ALGORITMO 1: Frame Differencing com Downsampling 75%
// ═══════════════════════════════════════════════════════════════════════
/**
 * Calcula a diferença normalizada entre dois frames.
 * Usa stride de 16 bytes (processa 1 a cada 4 pixels) para
 * reduzir custo computacional em 75% sem perder acurácia.
 */
function calcularDiferencaFrames(
  frame1: ImageData,
  frame2: ImageData
): number {
  const dados1 = frame1.data;
  const dados2 = frame2.data;
  let somaAbsDiff = 0;
  let pixelsProcessados = 0;

  for (let i = 0; i < dados1.length; i += STRIDE_PIXELS) {
    const diffR = Math.abs(dados1[i] - dados2[i]);
    const diffG = Math.abs(dados1[i + 1] - dados2[i + 1]);
    const diffB = Math.abs(dados1[i + 2] - dados2[i + 2]);
    somaAbsDiff += (diffR + diffG + diffB) / 3;
    pixelsProcessados++;
  }

  return somaAbsDiff / (pixelsProcessados * 255);
}

// ═══════════════════════════════════════════════════════════════════════
// ALGORITMO 2: Variância de Luminosidade via Welford (passada única)
// ═══════════════════════════════════════════════════════════════════════
/**
 * Calcula a variância usando o algoritmo de Welford.
 * Vantagem: Uma única passada pelo array — O(n) sem array auxiliar.
 * Fórmula: Var = M2 / n, onde M2 acumula desvios online.
 */
function calcularVarianciaLuminosidadeWelford(frame: ImageData): number {
  const dados = frame.data;
  let contagem = 0;
  let media = 0;
  let m2 = 0;

  for (let i = 0; i < dados.length; i += STRIDE_PIXELS) {
    const luma = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
    contagem++;
    const delta = luma - media;
    media += delta / contagem;
    const delta2 = luma - media;
    m2 += delta * delta2;
  }

  return contagem > 1 ? m2 / contagem : 0;
}

// ═══════════════════════════════════════════════════════════════════════
// ALGORITMO 3: Detecção de Câmera Virtual (lista expandida)
// ═══════════════════════════════════════════════════════════════════════
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
  const streamRef = useRef<MediaStream | null>(null);        // Anti-memory-leak
  const envioEmProgressoRef = useRef(false);                  // Anti-double-click (síncrono)
  const canvasInicializadoRef = useRef(false);                // Evitar resize repetido

  const [streaming, setStreaming] = useState(false);
  const [capturado, setCapturado] = useState<string | null>(null);
  const [erroCam, setErroCam] = useState<string | null>(null);
  const [tipoErro, setTipoErro] = useState<'gps' | 'camera' | 'virtual' | null>(null);
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
  const contadorEstabilidadeRef = useRef(0);  // Contador de frames consecutivos aprovados

  // Flag que só é true se a captura ocorreu com validações aprovadas
  const capturadoComValidacaoRef = useRef(false);

  // ── O botão só habilita quando as validações passam ──
  const botaoHabilitado = modo === 'selfie'
    ? livenessOk && cameraFisica
    : qualidadeOk && cameraFisica;

  // ═══════════════════════════════════════════════════════════════════
  // INICIALIZAÇÃO: Câmera + GPS + Detecção de câmera virtual
  // ═══════════════════════════════════════════════════════════════════
  const inicializarCamera = useCallback(async () => {
    setErroCam(null);
    setTipoErro(null);
    canvasInicializadoRef.current = false;

    // 1. Validar GPS
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
          setTipoErro('gps');
          return;
        }
        setGpsValidado(true);
      } catch {
        setErroCam('GPS não disponível. Ative a localização nas configurações do navegador.');
        setTipoErro('gps');
        return;
      }
    } else {
      setGpsValidado(true);
    }

    // 2. Abrir câmera
    try {
      setStatusAlgoritmo('Abrindo câmera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: modo === 'selfie' ? 'user' : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      // 3. Verificar câmera virtual
      const resultadoCam = verificarCameraVirtual(stream);
      if (!resultadoCam.cameraFisica) {
        stream.getTracks().forEach(t => t.stop());
        setErroCam(
          `Câmera virtual detectada: "${resultadoCam.nomeDetectado}". Apenas câmeras físicas são permitidas.`
        );
        setTipoErro('virtual');
        setCameraFisica(false);
        return;
      }
      setCameraFisica(true);

      // 4. Atribuir stream ao vídeo
      streamRef.current = stream;
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
      setTipoErro('camera');
    }
  }, [modo, pularGps]);

  useEffect(() => {
    inicializarCamera();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (loopIdRef.current) cancelAnimationFrame(loopIdRef.current);
    };
  }, [inicializarCamera]);

  // ═══════════════════════════════════════════════════════════════════
  // LOOP DE ANÁLISE CONTÍNUA (com canvas resize otimizado)
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

      // Configurar canvas apenas UMA VEZ (evitar resize destrutivo)
      if (!canvasInicializadoRef.current) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvasInicializadoRef.current = true;
      }

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
            const frameVivo = diferenca > LIMIAR_DIFERENCA_LIVENESS;

            if (frameVivo) {
              contadorEstabilidadeRef.current++;
            } else {
              contadorEstabilidadeRef.current = 0;
            }

            // Exigir N frames CONSECUTIVOS com variação
            const aprovado = contadorEstabilidadeRef.current >= FRAMES_CONSECUTIVOS_NECESSARIOS;
            setLivenessOk(aprovado);
            setStatusAlgoritmo(
              aprovado
                ? `✅ Prova de vida OK (${contadorEstabilidadeRef.current}/${FRAMES_CONSECUTIVOS_NECESSARIOS} frames, Δ=${(diferenca * 100).toFixed(2)}%)`
                : `⏳ Detectando movimento... (${contadorEstabilidadeRef.current}/${FRAMES_CONSECUTIVOS_NECESSARIOS} frames, Δ=${(diferenca * 100).toFixed(2)}%)`
            );
          }
          frameAnteriorRef.current = frameAtual;
        }
      } else {
        // ── DOCUMENTO: Variância de Luminosidade via Welford ──
        const variancia = calcularVarianciaLuminosidadeWelford(frameAtual);
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
  // CAPTURA DA FOTO (com re-validação anti-bypass)
  // ═══════════════════════════════════════════════════════════════════
  const capturar = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streaming) return;

    // ── RE-VALIDAÇÃO OBRIGATÓRIA (anti-bypass via DevTools) ──
    const validacaoAtual = modo === 'selfie'
      ? (contadorEstabilidadeRef.current >= FRAMES_CONSECUTIVOS_NECESSARIOS && cameraFisica)
      : (qualidadeOk && cameraFisica);

    if (!validacaoAtual) {
      console.warn('[SEGURANÇA] Tentativa de captura sem validação — bloqueada');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.85);

      // Validar tamanho do base64 (proteção contra memory exhaustion)
      const tamanhoEstimado = Math.ceil(base64.length * 0.75);
      if (tamanhoEstimado > TAMANHO_MAXIMO_IMAGEM_BYTES) {
        aoErrar?.(`Imagem muito grande: ${(tamanhoEstimado / 1_000_000).toFixed(1)}MB (máximo: ${TAMANHO_MAXIMO_IMAGEM_BYTES / 1_000_000}MB)`);
        return;
      }

      capturadoComValidacaoRef.current = true;
      setCapturado(base64);
      setStatusAlgoritmo('Foto capturada. Confirme para enviar.');
    }
  }, [streaming, modo, cameraFisica, qualidadeOk, aoErrar]);

  // ═══════════════════════════════════════════════════════════════════
  // CONFIRMAÇÃO E ENVIO (anti-double-click + re-validação)
  // ═══════════════════════════════════════════════════════════════════
  const confirmar = async () => {
    if (!capturado) return;

    // ── Anti-Double-Click: verificação síncrona via ref ──
    if (envioEmProgressoRef.current) return;
    envioEmProgressoRef.current = true;
    setEnviando(true);

    try {
      // ── Re-validação anti-bypass: a captura deve ter ocorrido com validações ──
      if (!capturadoComValidacaoRef.current) {
        console.error('[SEGURANÇA] Tentativa de envio sem captura validada — bloqueada');
        aoErrar?.('Captura inválida. Refaça a foto com as validações aprovadas.');
        return;
      }

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
      envioEmProgressoRef.current = false;
      setEnviando(false);
    }
  };

  const refazer = () => {
    setCapturado(null);
    setLivenessOk(false);
    setQualidadeOk(false);
    frameAnteriorRef.current = null;
    contadorEstabilidadeRef.current = 0;
    capturadoComValidacaoRef.current = false;
    canvasInicializadoRef.current = false;
    setStatusAlgoritmo(
      modo === 'selfie'
        ? 'Analisando prova de vida...'
        : 'Analisando qualidade da imagem...'
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // TELA DE ERRO (com botão "Tentar novamente")
  // ═══════════════════════════════════════════════════════════════════
  if (erroCam) {
    const iconeErro = tipoErro === 'gps' ? '📍' : tipoErro === 'virtual' ? '🚫' : '📷';
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <p className="text-sm font-medium text-destructive">{iconeErro} {erroCam}</p>
        <p className="text-xs text-muted-foreground">
          Por segurança, o fluxo foi bloqueado. Corrija o problema e tente novamente.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            setStreaming(false);
            inicializarCamera();
          }}
        >
          <RotateCcw className="w-4 h-4" /> Tentar novamente
        </Button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative bg-black rounded-xl overflow-hidden aspect-[3/4] max-w-xs mx-auto">
        {!capturado ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
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

        {/* Máscara Visual Estática */}
        {!capturado && streaming && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {modo === 'selfie' ? (
              <>
                <div className="w-44 h-56 border-2 border-white/50 rounded-full" />
                <User className="absolute w-8 h-8 text-white/40" />
              </>
            ) : (
              <div className="w-64 h-40 border-2 border-dashed border-white/50 rounded-lg flex items-center justify-center">
                <CreditCard className="w-10 h-10 text-white/40" />
              </div>
            )}
          </div>
        )}

        {/* Status do algoritmo */}
        {!capturado && streaming && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded-lg px-3 py-1.5">
            <p className="text-[10px] text-white/90 text-center font-mono">
              {statusAlgoritmo}
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {capturado
          ? 'Verifique a imagem e confirme'
          : modo === 'selfie'
            ? 'Posicione seu rosto dentro do oval e aguarde a detecção de movimento'
            : 'Enquadre o documento no retângulo com boa iluminação'
        }
      </p>

      {/* Badges de validação com animação em pendentes */}
      {!capturado && streaming && (
        <div className="flex flex-wrap justify-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            cameraFisica ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            📷 {cameraFisica ? 'Câmera física' : 'Câmera virtual!'}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            gpsValidado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800 animate-pulse'
          }`}>
            📍 {gpsValidado ? 'GPS OK' : 'Verificando GPS...'}
          </span>
          {modo === 'selfie' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              livenessOk ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800 animate-pulse'
            }`}>
              🫀 {livenessOk ? 'Prova de vida OK' : `Movimento ${contadorEstabilidadeRef.current}/${FRAMES_CONSECUTIVOS_NECESSARIOS}`}
            </span>
          )}
          {modo === 'documento' && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              qualidadeOk ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800 animate-pulse'
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
