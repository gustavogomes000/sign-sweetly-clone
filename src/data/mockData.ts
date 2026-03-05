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
      { id: 's1', name: 'João Silva', email: 'joao@techcorp.com', phone: '(11) 99999-1234', status: 'signed', signedAt: '2026-03-04T14:00:00Z', role: 'Contratante', order: 1, authMethod: 'email' },
      { id: 's2', name: 'Maria Santos', email: 'maria@empresa.com', phone: '(21) 98888-5678', status: 'pending', role: 'Contratada', order: 2, authMethod: 'whatsapp' },
    ],
    signatureType: 'electronic',
    folder: 'Contratos',
    tags: ['urgente', 'tech'],
    envelope: 'ENV-2026-001',
    notifyVia: 'email',
    reminderDays: 3,
    auditTrail: [
      { id: 'a1', action: 'created', timestamp: '2026-03-04T10:30:00Z', actor: 'Você', details: 'Documento criado' },
      { id: 'a2', action: 'sent', timestamp: '2026-03-04T10:35:00Z', actor: 'Sistema', details: 'Documento enviado para assinatura' },
      { id: 'a3', action: 'viewed', timestamp: '2026-03-04T13:50:00Z', actor: 'João Silva', details: 'Documento visualizado' },
      { id: 'a4', action: 'signed', timestamp: '2026-03-04T14:00:00Z', actor: 'João Silva', details: 'Documento assinado via email' },
      { id: 'a5', action: 'reminder', timestamp: '2026-03-07T08:00:00Z', actor: 'Sistema', details: 'Lembrete enviado para Maria Santos' },
    ],
  },
  {
    id: '2',
    name: 'Acordo de Confidencialidade - NDA',
    status: 'signed',
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-03T16:45:00Z',
    signers: [
      { id: 's3', name: 'Carlos Oliveira', email: 'carlos@startup.io', status: 'signed', signedAt: '2026-03-02T10:00:00Z', role: 'Parte 1', order: 1, authMethod: 'email' },
      { id: 's4', name: 'Ana Pereira', email: 'ana@startup.io', status: 'signed', signedAt: '2026-03-03T16:45:00Z', role: 'Parte 2', order: 2, authMethod: 'email' },
    ],
    signatureType: 'electronic',
    folder: 'NDAs',
    tags: ['confidencial'],
    envelope: 'ENV-2026-002',
    notifyVia: 'email',
    auditTrail: [
      { id: 'a6', action: 'created', timestamp: '2026-03-01T09:00:00Z', actor: 'Você', details: 'Documento criado' },
      { id: 'a7', action: 'signed', timestamp: '2026-03-02T10:00:00Z', actor: 'Carlos Oliveira', details: 'Documento assinado' },
      { id: 'a8', action: 'signed', timestamp: '2026-03-03T16:45:00Z', actor: 'Ana Pereira', details: 'Documento assinado' },
      { id: 'a9', action: 'completed', timestamp: '2026-03-03T16:45:00Z', actor: 'Sistema', details: 'Todas as assinaturas coletadas' },
    ],
  },
  {
    id: '3',
    name: 'Proposta Comercial - Projeto Alpha',
    status: 'draft',
    createdAt: '2026-03-05T08:00:00Z',
    updatedAt: '2026-03-05T08:00:00Z',
    signers: [],
    signatureType: 'electronic',
    tags: ['comercial'],
    auditTrail: [
      { id: 'a10', action: 'created', timestamp: '2026-03-05T08:00:00Z', actor: 'Você', details: 'Rascunho criado' },
    ],
  },
  {
    id: '4',
    name: 'Contrato de Trabalho - Dev Senior',
    status: 'pending',
    createdAt: '2026-02-28T14:00:00Z',
    updatedAt: '2026-02-28T14:00:00Z',
    deadline: '2026-03-10T23:59:59Z',
    signers: [
      { id: 's5', name: 'Roberto Lima', email: 'roberto@email.com', phone: '(41) 96666-3456', status: 'pending', role: 'Colaborador', order: 1, authMethod: 'whatsapp' },
      { id: 's6', name: 'Fernanda Costa', email: 'fernanda@rh.com', status: 'pending', role: 'RH', order: 2, authMethod: 'email' },
    ],
    signatureType: 'digital',
    folder: 'RH',
    tags: ['contratação'],
    envelope: 'ENV-2026-003',
    notifyVia: 'whatsapp',
    reminderDays: 2,
    auditTrail: [
      { id: 'a11', action: 'created', timestamp: '2026-02-28T14:00:00Z', actor: 'Você', details: 'Documento criado' },
      { id: 'a12', action: 'sent', timestamp: '2026-02-28T14:05:00Z', actor: 'Sistema', details: 'Enviado via WhatsApp' },
    ],
  },
  {
    id: '5',
    name: 'Termo de Adesão - Plano Enterprise',
    status: 'cancelled',
    createdAt: '2026-02-20T11:00:00Z',
    updatedAt: '2026-02-25T09:00:00Z',
    signers: [
      { id: 's7', name: 'Lucas Mendes', email: 'lucas@bigcorp.com', status: 'refused', role: 'Diretor', order: 1, authMethod: 'email' },
    ],
    signatureType: 'electronic',
    folder: 'Comercial',
    auditTrail: [
      { id: 'a13', action: 'created', timestamp: '2026-02-20T11:00:00Z', actor: 'Você', details: 'Documento criado' },
      { id: 'a14', action: 'refused', timestamp: '2026-02-25T09:00:00Z', actor: 'Lucas Mendes', details: 'Assinatura recusada: termos inaceitáveis' },
      { id: 'a15', action: 'cancelled', timestamp: '2026-02-25T09:00:00Z', actor: 'Sistema', details: 'Documento cancelado automaticamente' },
    ],
  },
  {
    id: '6',
    name: 'Aditivo Contratual - Extensão de Prazo',
    status: 'expired',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-15T23:59:59Z',
    deadline: '2026-02-15T23:59:59Z',
    signers: [
      { id: 's8', name: 'Paula Rodrigues', email: 'paula@fornecedor.com', status: 'pending', role: 'Fornecedor', order: 1, authMethod: 'email' },
    ],
    signatureType: 'electronic',
    folder: 'Contratos',
    auditTrail: [
      { id: 'a16', action: 'created', timestamp: '2026-01-15T10:00:00Z', actor: 'Você', details: 'Documento criado' },
      { id: 'a17', action: 'expired', timestamp: '2026-02-15T23:59:59Z', actor: 'Sistema', details: 'Documento expirado - prazo atingido' },
    ],
  },
  {
    id: '7',
    name: 'Contrato de Locação Comercial',
    status: 'pending',
    createdAt: '2026-03-03T16:00:00Z',
    updatedAt: '2026-03-03T16:00:00Z',
    deadline: '2026-03-20T23:59:59Z',
    signers: [
      { id: 's9', name: 'Pedro Almeida', email: 'pedro@imob.com', status: 'signed', signedAt: '2026-03-04T09:00:00Z', role: 'Locador', order: 1, authMethod: 'email' },
      { id: 's10', name: 'Juliana Ferreira', email: 'juliana@empresa.com', status: 'pending', role: 'Locatária', order: 2, authMethod: 'sms' },
      { id: 's11', name: 'André Souza', email: 'andre@cartorio.com', status: 'pending', role: 'Testemunha', order: 3, authMethod: 'email' },
    ],
    signatureType: 'digital',
    folder: 'Imobiliário',
    tags: ['locação', 'comercial'],
    envelope: 'ENV-2026-004',
    notifyVia: 'email',
    auditTrail: [
      { id: 'a18', action: 'created', timestamp: '2026-03-03T16:00:00Z', actor: 'Você', details: 'Documento criado' },
      { id: 'a19', action: 'signed', timestamp: '2026-03-04T09:00:00Z', actor: 'Pedro Almeida', details: 'Documento assinado' },
    ],
  },
  {
    id: '8',
    name: 'Política de Privacidade - LGPD',
    status: 'signed',
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-12T14:30:00Z',
    signers: [
      { id: 's12', name: 'Marcos Vieira', email: 'marcos@legal.com', status: 'signed', signedAt: '2026-02-12T14:30:00Z', role: 'DPO', order: 1, authMethod: 'email' },
    ],
    signatureType: 'electronic',
    folder: 'Legal',
    tags: ['lgpd', 'privacidade'],
    auditTrail: [],
  },
];

export const mockContacts: Contact[] = [
  { id: 'c1', name: 'João Silva', email: 'joao@techcorp.com', phone: '(11) 99999-1234', company: 'TechCorp', createdAt: '2026-01-10T10:00:00Z', documentsCount: 5 },
  { id: 'c2', name: 'Maria Santos', email: 'maria@empresa.com', phone: '(21) 98888-5678', company: 'Empresa SA', createdAt: '2026-01-15T14:00:00Z', documentsCount: 3 },
  { id: 'c3', name: 'Carlos Oliveira', email: 'carlos@startup.io', company: 'Startup.io', createdAt: '2026-02-01T09:00:00Z', documentsCount: 8 },
  { id: 'c4', name: 'Ana Pereira', email: 'ana@startup.io', phone: '(31) 97777-9012', company: 'Startup.io', createdAt: '2026-02-05T11:00:00Z', documentsCount: 2 },
  { id: 'c5', name: 'Roberto Lima', email: 'roberto@email.com', phone: '(41) 96666-3456', createdAt: '2026-02-20T16:00:00Z', documentsCount: 1 },
  { id: 'c6', name: 'Pedro Almeida', email: 'pedro@imob.com', phone: '(51) 95555-7890', company: 'Imobiliária Central', createdAt: '2026-01-20T09:00:00Z', documentsCount: 4 },
  { id: 'c7', name: 'Juliana Ferreira', email: 'juliana@empresa.com', phone: '(61) 94444-1234', company: 'Empresa SA', createdAt: '2026-02-15T11:00:00Z', documentsCount: 2 },
  { id: 'c8', name: 'Fernanda Costa', email: 'fernanda@rh.com', company: 'TechCorp RH', createdAt: '2026-02-25T14:00:00Z', documentsCount: 6 },
];

export const mockTemplates: Template[] = [
  { id: 't1', name: 'Contrato de Prestação de Serviços', description: 'Modelo padrão para contratos de prestação de serviços entre empresas.', createdAt: '2026-01-05T10:00:00Z', usageCount: 12, fields: ['signature', 'date', 'text', 'initials'], category: 'Contratos' },
  { id: 't2', name: 'NDA - Acordo de Confidencialidade', description: 'Modelo de acordo de confidencialidade bilateral.', createdAt: '2026-01-10T10:00:00Z', usageCount: 8, fields: ['signature', 'date', 'checkbox'], category: 'Legal' },
  { id: 't3', name: 'Contrato de Trabalho CLT', description: 'Modelo padrão de contrato de trabalho regime CLT.', createdAt: '2026-01-20T10:00:00Z', usageCount: 15, fields: ['signature', 'date', 'text', 'initials', 'checkbox'], category: 'RH' },
  { id: 't4', name: 'Proposta Comercial', description: 'Modelo de proposta comercial para novos clientes.', createdAt: '2026-02-01T10:00:00Z', usageCount: 6, fields: ['signature', 'date', 'text'], category: 'Comercial' },
  { id: 't5', name: 'Termo de Consentimento LGPD', description: 'Modelo de termo de consentimento para tratamento de dados pessoais conforme LGPD.', createdAt: '2026-02-10T10:00:00Z', usageCount: 20, fields: ['signature', 'date', 'checkbox'], category: 'Legal' },
  { id: 't6', name: 'Distrato de Contrato', description: 'Modelo para rescisão amigável de contratos.', createdAt: '2026-02-15T10:00:00Z', usageCount: 3, fields: ['signature', 'date'], category: 'Contratos' },
];

export const mockStats: DashboardStats = {
  totalDocuments: 156,
  pendingSignatures: 23,
  signedDocuments: 112,
  expiredDocuments: 5,
  cancelledDocuments: 8,
  drafts: 8,
  avgSignTime: '1.4 dias',
  completionRate: 94,
  monthlyData: [
    { month: 'Set', sent: 18, signed: 15 },
    { month: 'Out', sent: 22, signed: 20 },
    { month: 'Nov', sent: 25, signed: 23 },
    { month: 'Dez', sent: 30, signed: 27 },
    { month: 'Jan', sent: 28, signed: 26 },
    { month: 'Fev', sent: 35, signed: 32 },
    { month: 'Mar', sent: 12, signed: 8 },
  ],
};

export const mockFolders = [
  { id: 'f1', name: 'Contratos', count: 45, color: '#22c55e' },
  { id: 'f2', name: 'NDAs', count: 12, color: '#3b82f6' },
  { id: 'f3', name: 'RH', count: 28, color: '#f59e0b' },
  { id: 'f4', name: 'Comercial', count: 18, color: '#8b5cf6' },
  { id: 'f5', name: 'Legal', count: 22, color: '#ef4444' },
  { id: 'f6', name: 'Imobiliário', count: 8, color: '#06b6d4' },
];

export const mockNotifications = [
  { id: 'n1', type: 'signed' as const, title: 'João Silva assinou', description: 'Contrato de Prestação de Serviços - TechCorp', time: '2 horas atrás', read: false },
  { id: 'n2', type: 'viewed' as const, title: 'Maria Santos visualizou', description: 'Contrato de Prestação de Serviços - TechCorp', time: '5 horas atrás', read: false },
  { id: 'n3', type: 'expired' as const, title: 'Documento expirado', description: 'Aditivo Contratual - Extensão de Prazo', time: '1 dia atrás', read: true },
  { id: 'n4', type: 'completed' as const, title: 'Todas assinaturas coletadas', description: 'Acordo de Confidencialidade - NDA', time: '2 dias atrás', read: true },
  { id: 'n5', type: 'refused' as const, title: 'Lucas Mendes recusou', description: 'Termo de Adesão - Plano Enterprise', time: '1 semana atrás', read: true },
];

export const mockApiKeys = [
  { id: 'ak1', name: 'Produção', key: 'sk-live-a1b2c3d4e5f6g7h8i9j0', createdAt: '2026-01-01T10:00:00Z', lastUsed: '2026-03-05T08:00:00Z', active: true },
  { id: 'ak2', name: 'Sandbox', key: 'sk-test-z9y8x7w6v5u4t3s2r1q0', createdAt: '2026-01-01T10:00:00Z', lastUsed: '2026-03-04T15:00:00Z', active: true },
];

export const mockWebhooks = [
  { id: 'wh1', url: 'https://meusite.com/webhook/signatures', events: ['document.signed', 'document.completed'], active: true, createdAt: '2026-01-15T10:00:00Z' },
  { id: 'wh2', url: 'https://meusite.com/webhook/status', events: ['document.refused', 'document.expired'], active: false, createdAt: '2026-02-01T10:00:00Z' },
];
