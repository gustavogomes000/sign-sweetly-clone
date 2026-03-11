/**
 * BluePoint Service — Funções preparadas para consumo da API BluePoint.
 * Usa o proxy edge function existente para autenticação e roteamento.
 */
import { supabase } from '@/integrations/supabase/client';

// ── Tipos ──

export interface ResultadoLoginSSO {
  token: string;
  usuario: {
    id: number;
    nome: string;
    email: string;
    empresa: string;
  };
}

export interface ResultadoBiometria {
  sucesso: boolean;
  pontuacao: number;
  mensagem: string;
  verificadoEm: string;
}

export interface ResultadoGeofence {
  dentroDoPerimetro: boolean;
  localizacao: {
    latitude: number;
    longitude: number;
    endereco: string;
  };
  empresa: {
    id: number;
    nome: string;
    raio: number;
  };
}

export interface ColaboradorDepartamento {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  departamento: { id: number; nome: string } | null;
  cargo: { id: number; nome: string } | null;
  foto: string | null;
  biometria?: { cadastrada: boolean };
}

// ── Chamada genérica via proxy ──

async function chamarBluePoint<T = unknown>(
  endpoint: string,
  metodo = 'GET',
  payload?: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('bluepoint-proxy', {
    body: { endpoint, method: metodo, payload },
  });

  if (error) throw new Error(`Erro no proxy BluePoint: ${error.message}`);
  if (data?.success === false) throw new Error(data.error || 'Erro na API BluePoint');

  // Desembrulhar resposta
  let resultado = data;
  if (resultado?.data !== undefined) {
    resultado = resultado.data;
    if (resultado?.data !== undefined) resultado = resultado.data;
  }

  return resultado as T;
}

// ── Serviço BluePoint ──

export const bluepointService = {
  /**
   * Login SSO — Autentica usuários internos via BluePoint.
   * Consome: /docs/autenticacao
   */
  loginSSO: async (email: string, senha: string): Promise<ResultadoLoginSSO> => {
    return chamarBluePoint<ResultadoLoginSSO>('/api/v1/autenticacao/login', 'POST', {
      email,
      senha,
    });
  },

  /**
   * Validar Biometria Facial — Prova de vida nativa de funcionários.
   * Consome: /docs/biometria
   */
  validarBiometriaFacial: async (dados: {
    colaboradorId: number;
    imagemBase64: string;
  }): Promise<ResultadoBiometria> => {
    return chamarBluePoint<ResultadoBiometria>('/api/v1/biometria/verificar-face', 'POST', {
      colaboradorId: dados.colaboradorId,
      imageBase64: dados.imagemBase64,
    });
  },

  /**
   * Verificar Geofence — Valida se a assinatura ocorreu dentro da empresa.
   * Consome: /docs/localizacoes
   */
  verificarGeofence: async (dados: {
    colaboradorId: number;
    latitude: number;
    longitude: number;
  }): Promise<ResultadoGeofence> => {
    return chamarBluePoint<ResultadoGeofence>('/api/v1/localizacoes/verificar', 'POST', {
      colaboradorId: dados.colaboradorId,
      latitude: dados.latitude,
      longitude: dados.longitude,
    });
  },

  /**
   * Buscar colaboradores por departamento — Para envios em lote.
   * Consome: /docs/departamentos e /docs/colaboradores
   */
  buscarColaboradoresPorDepartamento: async (
    departamentoId: number
  ): Promise<ColaboradorDepartamento[]> => {
    return chamarBluePoint<ColaboradorDepartamento[]>(
      `/api/v1/listar-colaboradores-departamento/${departamentoId}`
    );
  },

  /**
   * Listar todos os departamentos disponíveis
   */
  listarDepartamentos: async () => {
    return chamarBluePoint<Array<{ id: number; nome: string; totalColaboradores: number }>>(
      '/api/v1/listar-departamentos'
    );
  },
};
