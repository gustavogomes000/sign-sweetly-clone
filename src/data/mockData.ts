import { Document, Contact, Template, DashboardStats } from '@/types/document';

export const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'Contrato de Prestação de Serviços - TechCorp',
    status: 'pending',
    createdAt: '2026-03-04T10:30:00Z',
    updatedAt: '2026-03-04T10:30:00Z',
    deadline: '2026-03-14T23:59:59Z',
    signers: [
      { id: 's1', name: 'João Silva', email: 'joao@techcorp.com', status: 'signed', signedAt: '2026-03-04T14:00:00Z', role: 'Contratante', order: 1 },
      { id: 's2', name: 'Maria Santos', email: 'maria@empresa.com', status: 'pending', role: 'Contratada', order: 2 },
    ],
    signatureType: 'electronic',
    folder: 'Contratos',
    tags: ['urgente'],
  },
  {
    id: '2',
    name: 'Acordo de Confidencialidade - NDA',
    status: 'signed',
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-03T16:45:00Z',
    signers: [
      { id: 's3', name: 'Carlos Oliveira', email: 'carlos@startup.io', status: 'signed', signedAt: '2026-03-02T10:00:00Z', role: 'Parte 1', order: 1 },
      { id: 's4', name: 'Ana Pereira', email: 'ana@startup.io', status: 'signed', signedAt: '2026-03-03T16:45:00Z', role: 'Parte 2', order: 2 },
    ],
    signatureType: 'electronic',
    folder: 'NDAs',
  },
  {
    id: '3',
    name: 'Proposta Comercial - Projeto Alpha',
    status: 'draft',
    createdAt: '2026-03-05T08:00:00Z',
    updatedAt: '2026-03-05T08:00:00Z',
    signers: [],
    signatureType: 'electronic',
  },
  {
    id: '4',
    name: 'Contrato de Trabalho - Dev Senior',
    status: 'pending',
    createdAt: '2026-02-28T14:00:00Z',
    updatedAt: '2026-02-28T14:00:00Z',
    deadline: '2026-03-10T23:59:59Z',
    signers: [
      { id: 's5', name: 'Roberto Lima', email: 'roberto@email.com', status: 'pending', role: 'Colaborador', order: 1 },
      { id: 's6', name: 'Fernanda Costa', email: 'fernanda@rh.com', status: 'pending', role: 'RH', order: 2 },
    ],
    signatureType: 'digital',
    folder: 'RH',
  },
  {
    id: '5',
    name: 'Termo de Adesão - Plano Enterprise',
    status: 'cancelled',
    createdAt: '2026-02-20T11:00:00Z',
    updatedAt: '2026-02-25T09:00:00Z',
    signers: [
      { id: 's7', name: 'Lucas Mendes', email: 'lucas@bigcorp.com', status: 'refused', role: 'Diretor', order: 1 },
    ],
    signatureType: 'electronic',
    folder: 'Comercial',
  },
  {
    id: '6',
    name: 'Aditivo Contratual - Extensão de Prazo',
    status: 'expired',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-15T23:59:59Z',
    deadline: '2026-02-15T23:59:59Z',
    signers: [
      { id: 's8', name: 'Paula Rodrigues', email: 'paula@fornecedor.com', status: 'pending', role: 'Fornecedor', order: 1 },
    ],
    signatureType: 'electronic',
    folder: 'Contratos',
  },
];

export const mockContacts: Contact[] = [
  { id: 'c1', name: 'João Silva', email: 'joao@techcorp.com', phone: '(11) 99999-1234', company: 'TechCorp', createdAt: '2026-01-10T10:00:00Z', documentsCount: 5 },
  { id: 'c2', name: 'Maria Santos', email: 'maria@empresa.com', phone: '(21) 98888-5678', company: 'Empresa SA', createdAt: '2026-01-15T14:00:00Z', documentsCount: 3 },
  { id: 'c3', name: 'Carlos Oliveira', email: 'carlos@startup.io', company: 'Startup.io', createdAt: '2026-02-01T09:00:00Z', documentsCount: 8 },
  { id: 'c4', name: 'Ana Pereira', email: 'ana@startup.io', phone: '(31) 97777-9012', company: 'Startup.io', createdAt: '2026-02-05T11:00:00Z', documentsCount: 2 },
  { id: 'c5', name: 'Roberto Lima', email: 'roberto@email.com', phone: '(41) 96666-3456', createdAt: '2026-02-20T16:00:00Z', documentsCount: 1 },
];

export const mockTemplates: Template[] = [
  { id: 't1', name: 'Contrato de Prestação de Serviços', description: 'Modelo padrão para contratos de prestação de serviços entre empresas.', createdAt: '2026-01-05T10:00:00Z', usageCount: 12 },
  { id: 't2', name: 'NDA - Acordo de Confidencialidade', description: 'Modelo de acordo de confidencialidade bilateral.', createdAt: '2026-01-10T10:00:00Z', usageCount: 8 },
  { id: 't3', name: 'Contrato de Trabalho CLT', description: 'Modelo padrão de contrato de trabalho regime CLT.', createdAt: '2026-01-20T10:00:00Z', usageCount: 15 },
  { id: 't4', name: 'Proposta Comercial', description: 'Modelo de proposta comercial para novos clientes.', createdAt: '2026-02-01T10:00:00Z', usageCount: 6 },
];

export const mockStats: DashboardStats = {
  totalDocuments: 156,
  pendingSignatures: 23,
  signedDocuments: 112,
  expiredDocuments: 5,
};
