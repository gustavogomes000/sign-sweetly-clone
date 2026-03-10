/**
 * BluePoint API client — calls our edge function proxy.
 */
import { supabase } from '@/integrations/supabase/client';

async function callBluePoint<T = unknown>(endpoint: string, method = 'GET', payload?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('bluepoint-proxy', {
    body: { endpoint, method, payload },
  });
  if (error) throw new Error(`BluePoint proxy error: ${error.message}`);
  // The API returns { success: true, data: ... }
  if (data?.success === false) throw new Error(data.error || 'BluePoint API error');
  return (data?.data ?? data) as T;
}

// ── Types ──

export interface BPEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  celular?: string;
  endereco?: {
    cep?: string;
    estado?: string;
    cidade?: string;
    bairro?: string;
    rua?: string;
    numero?: string | null;
  };
}

export interface BPDepartamento {
  id: number;
  nome: string;
  descricao: string | null;
  gestor: unknown | null;
  totalColaboradores: number;
  status: string;
}

export interface BPCargo {
  id: number;
  nome: string;
  cbo: string | null;
  descricao: string | null;
}

export interface BPColaborador {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  matricula: string;
  empresa: { id: number; nomeFantasia: string } | null;
  departamento: { id: number; nome: string } | null;
  cargo: { id: number; nome: string } | null;
  tipo: string; // admin | colaborador
  dataAdmissao: string;
  status: string; // ativo | inativo
  foto: string | null;
  biometria?: { cadastrada: boolean; cadastradaEm?: string };
}

// ── API Methods ──

export const bluepointApi = {
  listarEmpresas: () => callBluePoint<BPEmpresa[]>('/api/v1/listar-empresas'),
  obterEmpresa: (id: number) => callBluePoint<BPEmpresa>(`/api/v1/obter-empresa/${id}`),

  listarDepartamentos: () => callBluePoint<BPDepartamento[]>('/api/v1/listar-departamentos'),
  obterDepartamento: (id: number) => callBluePoint<BPDepartamento>(`/api/v1/obter-departamento/${id}`),

  listarCargos: () => callBluePoint<BPCargo[]>('/api/v1/listar-cargos'),

  listarColaboradores: () => callBluePoint<BPColaborador[]>('/api/v1/listar-colaboradores'),
  obterColaborador: (id: number) => callBluePoint<BPColaborador>(`/api/v1/obter-colaborador/${id}`),
  listarColaboradoresDepartamento: (deptId: number) =>
    callBluePoint<BPColaborador[]>(`/api/v1/listar-colaboradores-departamento/${deptId}`),

  verificarFace: (payload: { imageBase64: string; colaboradorId?: number }) =>
    callBluePoint('/api/v1/biometria/verificar-face', 'POST', payload),
};
