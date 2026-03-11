/**
 * Hook de geolocalização + conversão para endereço via Nominatim/OSM.
 * Captura também o User Agent para trilha de auditoria.
 */
import { useState, useCallback } from 'react';

export interface DadosGeolocalizacao {
  latitude: number;
  longitude: number;
  enderecoFormatado: string;
  agenteUsuario: string;
  precisao: number;
  coletadoEm: string;
}

export function useGeolocalizacao() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosGeolocalizacao | null>(null);

  const coletar = useCallback(async (): Promise<DadosGeolocalizacao> => {
    setCarregando(true);
    setErro(null);

    try {
      // 1. Solicitar geolocalização
      const posicao = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude, accuracy } = posicao.coords;

      // 2. Converter para endereço via API Nominatim (OSM)
      let enderecoFormatado = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      try {
        const resposta = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        );
        if (resposta.ok) {
          const json = await resposta.json();
          enderecoFormatado = json.display_name || enderecoFormatado;
        }
      } catch {
        // Fallback silencioso — usa coordenadas
        console.warn('[Geolocalização] Falha ao converter endereço via Nominatim');
      }

      const resultado: DadosGeolocalizacao = {
        latitude,
        longitude,
        enderecoFormatado,
        agenteUsuario: navigator.userAgent,
        precisao: accuracy,
        coletadoEm: new Date().toISOString(),
      };

      setDados(resultado);
      return resultado;
    } catch (err) {
      const mensagem = err instanceof GeolocationPositionError
        ? ({
            1: 'Permissão de localização negada. Ative nas configurações do navegador.',
            2: 'Não foi possível determinar a localização.',
            3: 'Tempo esgotado ao obter localização.',
          }[err.code] || 'Erro desconhecido de geolocalização')
        : 'Erro ao acessar geolocalização';
      setErro(mensagem);
      throw new Error(mensagem);
    } finally {
      setCarregando(false);
    }
  }, []);

  return { coletar, dados, carregando, erro };
}
