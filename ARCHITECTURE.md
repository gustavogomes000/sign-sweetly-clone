# VALERIS — Documentação Técnica Completa para Recriação

> **Plataforma SaaS de Assinatura Eletrônica Multi-tenant**
> Produto: **Valeris** | Empresa: **DNA do Software**
> Versão do blueprint: 2026-03-06

---

## ÍNDICE

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Modelo de Dados Completo](#2-modelo-de-dados-completo)
3. [Sistema de Autenticação e Roles](#3-sistema-de-autenticação-e-roles)
4. [Rotas e Navegação](#4-rotas-e-navegação)
5. [Telas — Descrição Detalhada](#5-telas--descrição-detalhada)
6. [Fluxo de Criação de Documento (Wizard 5 Etapas)](#6-fluxo-de-criação-de-documento-wizard-5-etapas)
7. [Editor Visual de Campos (DocumentFieldEditor)](#7-editor-visual-de-campos-documentfieldeditor)
8. [Página Pública de Assinatura (SignPage)](#8-página-pública-de-assinatura-signpage)
9. [Validação Pós-Assinatura (KYC)](#9-validação-pós-assinatura-kyc)
10. [Integração com Microsserviços](#10-integração-com-microsserviços)
11. [API REST e Webhooks](#11-api-rest-e-webhooks)
12. [Design System](#12-design-system)
13. [Componentes Compartilhados](#13-componentes-compartilhados)
14. [Mock Data — Estrutura Completa](#14-mock-data--estrutura-completa)
15. [Regras de Negócio](#15-regras-de-negócio)

---

## 1. Visão Geral da Arquitetura

### Stack Atual (Frontend-only / Blueprint)
- **Framework**: React 18 + TypeScript + Vite
- **Estilização**: Tailwind CSS + shadcn/ui (Radix UI)
- **Roteamento**: React Router DOM v6
- **State**: React Context (AuthContext) + useState local
- **Gráficos**: Recharts (BarChart, PieChart, AreaChart)
- **Animações**: Framer Motion (disponível), CSS animations
- **Fontes**: Orbitron (headings/game), Rajdhani (body), Inter (fallback)

### Camadas do Sistema
```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (SPA)                     │
├─────────────────────────────────────────────────────┤
│  Super Admin Layer     │    Company/Tenant Layer      │
│  (/admin/*)            │    (/dashboard, /documents)  │
├─────────────────────────────────────────────────────┤
│                   AuthContext                         │
│        (roles: superadmin, company_admin, user)       │
├─────────────────────────────────────────────────────┤
│              API REST Gateway (futuro)                │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Signature│ Selfie   │ Document │ Selfie+Doc          │
│ Service  │ Service  │ Photo    │ Service             │
│ (micro)  │ (micro)  │ (micro)  │ (micro)             │
└──────────┴──────────┴──────────┴─────────────────────┘
```

### Multi-tenancy
- Cada empresa (Company) é um tenant isolado
- Documentos pertencem a uma empresa via `companyId`
- Usuários pertencem a uma empresa via `companyId`
- Super Admin vê e gerencia TODAS as empresas
- Company Admin vê apenas dados da sua empresa

---

## 2. Modelo de Dados Completo

### 2.1 Enums

```typescript
type DocumentStatus = 'draft' | 'pending' | 'signed' | 'cancelled' | 'expired';
type SignerStatus = 'pending' | 'signed' | 'refused';
type SignatureType = 'electronic' | 'digital';  // digital = ICP-Brasil
type AuthMethod = 'email';
type NotifyVia = 'email';
type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'dropdown' | 'image' | 'stamp';
type PostSignatureValidation = 'selfie' | 'document_photo' | 'selfie_with_document';
type UserRole = 'superadmin' | 'company_admin' | 'company_user';
type CompanyPlan = 'starter' | 'professional' | 'enterprise';
type CompanyStatus = 'active' | 'inactive' | 'suspended';
type NotificationType = 'signed' | 'viewed' | 'expired' | 'completed' | 'refused' | 'reminder';
```

### 2.2 Entidades

#### Document
```typescript
interface Document {
  id: string;
  name: string;                    // Nome do documento (ex: "Contrato de Prestação de Serviços")
  status: DocumentStatus;
  createdAt: string;               // ISO 8601
  updatedAt: string;               // ISO 8601
  deadline?: string;               // ISO 8601 - prazo para assinatura
  signers: Signer[];               // Array de signatários
  signatureType: SignatureType;    // 'electronic' ou 'digital'
  folder?: string;                 // Nome da pasta (ex: "Contratos", "RH")
  tags?: string[];                 // Tags livres (ex: ["urgente", "tech"])
  envelope?: string;               // Código de envelope (ex: "ENV-2026-001")
  notifyVia?: NotifyVia;           // Canal de notificação
  reminderDays?: number;           // Intervalo de lembretes em dias
  auditTrail?: AuditEntry[];       // Trilha de auditoria
  fields?: DocumentField[];        // Campos posicionados visualmente
  companyId?: string;              // Empresa dona do documento
}
```

#### Signer
```typescript
interface Signer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: SignerStatus;            // 'pending' | 'signed' | 'refused'
  signedAt?: string;               // ISO 8601 - quando assinou
  role: string;                    // Papel livre: "Signatário", "Contratante", "Contratada", "Testemunha", "Aprovador", "Fiador", "Representante Legal", "Locador", "Locatária", "Colaborador", "RH", "DPO", "Fornecedor", "Diretor"
  order: number;                   // Ordem de assinatura (1-based)
  authMethod: AuthMethod;          // Método de autenticação
  validationSteps?: ValidationStep[]; // Etapas de validação pós-assinatura
}
```

#### ValidationStep (Pós-assinatura KYC)
```typescript
interface ValidationStep {
  id: string;
  type: PostSignatureValidation;   // 'selfie' | 'document_photo' | 'selfie_with_document'
  label: string;                   // "Selfie", "Foto do documento", "Selfie com documento"
  order: number;                   // Ordem de execução (1-based)
  required: boolean;               // Se é obrigatório
}
```

#### DocumentField (Campos posicionados no documento)
```typescript
interface DocumentField {
  id: string;
  type: FieldType;                 // Tipo do campo
  label: string;                   // Rótulo exibido
  x: number;                       // Posição X em pixels (referência: página 595x842px)
  y: number;                       // Posição Y em pixels
  width: number;                   // Largura em pixels
  height: number;                  // Altura em pixels
  page: number;                    // Número da página (1-based)
  signerId?: string;               // ID do signatário atribuído
  required: boolean;               // Se é obrigatório
  value?: string;                  // Valor preenchido
}
```

**Dimensões padrão dos campos (em pixels):**
| Tipo       | Largura | Altura |
|------------|---------|--------|
| signature  | 200     | 60     |
| initials   | 80      | 40     |
| date       | 140     | 32     |
| text       | 180     | 32     |
| checkbox   | 24      | 24     |
| number     | 120     | 32     |
| email      | 180     | 32     |
| image      | 120     | 80     |
| stamp      | 100     | 100    |

**Sistema de coordenadas**: O canvas do documento simula uma página A4 com 595x842 pixels (proporção padrão PDF). Os campos são posicionados absolutamente usando coordenadas X/Y relativas ao canto superior esquerdo da página.

#### AuditEntry
```typescript
interface AuditEntry {
  id: string;
  action: string;    // 'created' | 'sent' | 'viewed' | 'signed' | 'refused' | 'expired' | 'cancelled' | 'completed' | 'reminder'
  timestamp: string; // ISO 8601
  actor: string;     // Nome de quem executou (ou "Sistema", "Você", "API")
  details: string;   // Descrição legível
}
```

#### Contact
```typescript
interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;      // Nome da empresa do contato
  createdAt: string;
  documentsCount: number; // Quantos documentos o contato participou
}
```

#### Template
```typescript
interface Template {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  usageCount: number;      // Quantas vezes foi usado
  fields?: string[];        // Tipos de campo incluídos (ex: ['signature', 'date', 'text'])
  category?: string;        // Categoria: "Contratos", "Legal", "RH", "Comercial"
}
```

#### Folder
```typescript
interface Folder {
  id: string;
  name: string;
  count: number;    // Quantidade de documentos
  color: string;    // Cor hex (ex: "#22c55e")
}
```

#### Company (Tenant)
```typescript
interface Company {
  id: string;
  name: string;                // Razão social
  cnpj: string;                // CNPJ formatado (ex: "12.345.678/0001-90")
  email: string;
  phone?: string;
  logo?: string;
  plan: CompanyPlan;           // 'starter' | 'professional' | 'enterprise'
  status: CompanyStatus;       // 'active' | 'inactive' | 'suspended'
  createdAt: string;
  maxUsers: number;            // Limite de usuários do plano
  maxDocumentsMonth: number;   // Limite de documentos por mês
  documentsUsed: number;       // Documentos usados no mês atual
  usersCount: number;          // Usuários cadastrados
}
```

#### CompanyUser
```typescript
interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: 'company_admin' | 'company_user';
  companyId: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
}
```

#### Notification
```typescript
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;         // Texto relativo: "2 horas atrás", "1 dia atrás"
  read: boolean;
}
```

#### ApiIntegration
```typescript
interface ApiIntegration {
  id: string;
  name: string;        // "Produção", "Sandbox"
  apiKey: string;       // Formato: "sk-live-..." ou "sk-test-..."
  webhookUrl?: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastUsed?: string;
  companyId: string;
  rateLimit: number;
  callsToday: number;
}
```

#### DashboardStats
```typescript
interface DashboardStats {
  totalDocuments: number;
  pendingSignatures: number;
  signedDocuments: number;
  expiredDocuments: number;
  cancelledDocuments?: number;
  drafts?: number;
  avgSignTime?: string;         // "1.4 dias"
  completionRate?: number;      // 0-100 (percentual)
  monthlyData?: { month: string; sent: number; signed: number }[];
}
```

#### MicroserviceConfig
```typescript
interface MicroserviceConfig {
  signatureUrl: string;
  documentCollectionUrl: string;
  selfieUrl: string;
  selfieWithDocumentUrl: string;
}
```

### 2.3 Diagrama ER (Relacional)

```
COMPANIES ──────────────── COMPANY_USERS
  id (PK)                    id (PK)
  name                       name
  cnpj                       email
  email                      role (company_admin | company_user)
  phone                      company_id (FK → COMPANIES)
  plan                       status
  status                     created_at
  max_users                  last_login
  max_documents_month        avatar
  documents_used
  users_count
  created_at
      │
      │ 1:N
      ▼
DOCUMENTS ──────────────── DOCUMENT_FIELDS
  id (PK)                    id (PK)
  name                       type (signature|initials|date|text|checkbox|dropdown|image|stamp)
  status                     label
  signature_type             x, y (coordenadas)
  folder                     width, height
  tags (array)               page (número da página)
  envelope                   signer_id (FK → SIGNERS)
  notify_via                 required
  reminder_days              value
  deadline
  company_id (FK)
  created_at
  updated_at
      │
      │ 1:N
      ▼
SIGNERS ───────────────── VALIDATION_STEPS
  id (PK)                    id (PK)
  name                       type (selfie|document_photo|selfie_with_document)
  email                      label
  phone                      order (sequência)
  status                     required
  signed_at                  signer_id (FK → SIGNERS)
  role
  order (sequência)
  auth_method
  document_id (FK)
      │
      │ (relacionado ao documento)
      ▼
AUDIT_TRAIL
  id (PK)
  action
  timestamp
  actor
  details
  document_id (FK)

CONTACTS                  TEMPLATES
  id (PK)                   id (PK)
  name                      name
  email                     description
  phone                     category
  company                   usage_count
  documents_count           fields (array de tipos)
  created_at                created_at

FOLDERS                   NOTIFICATIONS
  id (PK)                   id (PK)
  name                      type
  count                     title
  color (hex)               description
                            time
                            read

API_KEYS                  WEBHOOKS
  id (PK)                   id (PK)
  name                      url
  key                       events (array)
  active                    active
  created_at                created_at
  last_used
  company_id (FK)
```

---

## 3. Sistema de Autenticação e Roles

### 3.1 Roles
| Role           | Acesso                                                        |
|----------------|---------------------------------------------------------------|
| `superadmin`   | `/admin/*` — Dashboard global, CRUD empresas, config global  |
| `company_admin`| `/dashboard`, `/documents/*`, `/contacts`, etc. — CRUD completo na empresa |
| `company_user` | Mesmas rotas, mas funcionalidades limitadas (sem gerenciar usuários) |

### 3.2 Fluxo de Login
1. Tela única com toggle **"Empresa"** / **"Admin"**
2. **Modo Admin**: `loginAdmin(email, password)` → verifica credenciais fixas do superadmin
3. **Modo Empresa**: `login(email, password)` → busca no array `mockCompanyUsers` por email + status ativo, verifica se a empresa está ativa
4. Após login bem-sucedido, seta `user` e `company` no AuthContext
5. Redireciona:
   - Superadmin → `/admin`
   - Company user → `/dashboard`

### 3.3 Proteção de Rotas
```
ProtectedRoute({ requiredRole })
  - Se não autenticado → redirect /login
  - Se requiredRole='superadmin' e não é superadmin → redirect /dashboard
  - Se requiredRole='company' e é superadmin → redirect /admin
```

### 3.4 Credenciais de Demo (Mock)
**Admin:**
- `admin@valeris.com` / `admin123`

**Empresa (TechCorp):**
- `usuario@techcorp.com` / `123456` (role: company_admin)
- `maria@techcorp.com` / `123456` (role: company_user)

**Empresa (StartupXYZ):**
- `ana@startupxyz.com` / `123456` (role: company_admin)

### 3.5 AuthContext — Estado
```typescript
interface AuthContextType {
  user: AuthUser | null;           // Usuário logado
  company: Company | null;         // Empresa do usuário (null para superadmin)
  login: (email, password) => boolean;
  loginAdmin: (email, password) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
}
```

---

## 4. Rotas e Navegação

### 4.1 Rotas Públicas
| Rota            | Componente | Descrição                              |
|-----------------|------------|----------------------------------------|
| `/login`        | Login      | Tela de login com toggle Admin/Empresa |
| `/sign/:token`  | SignPage   | Página pública de assinatura           |

### 4.2 Rotas Admin (requiredRole: superadmin)
| Rota                      | Componente         | Descrição                    |
|---------------------------|--------------------|------------------------------|
| `/admin`                  | AdminDashboard     | Dashboard global da plataforma |
| `/admin/companies`        | AdminCompanies     | CRUD de empresas             |
| `/admin/companies/:id`    | AdminCompanyDetail | Detalhes de uma empresa      |
| `/admin/settings`         | AdminSettings      | Configurações globais        |

### 4.3 Rotas Empresa (requiredRole: company)
| Rota              | Componente    | Descrição                         |
|-------------------|---------------|-----------------------------------|
| `/dashboard`      | Dashboard     | Dashboard da empresa              |
| `/documents`      | Documents     | Lista de documentos               |
| `/documents/new`  | NewDocument   | Wizard de criação (5 etapas)      |
| `/documents/:id`  | DocumentDetail| Detalhes do documento             |
| `/contacts`       | Contacts      | Lista de contatos                 |
| `/templates`      | Templates     | Modelos de documento              |
| `/folders`        | Folders       | Organização por pastas            |
| `/bulk-send`      | BulkSend      | Envio em massa via CSV            |
| `/analytics`      | Analytics     | Relatórios e gráficos             |
| `/api-docs`       | ApiDocs       | Documentação API + chaves + webhooks |
| `/settings`       | Settings      | Configurações da conta            |

### 4.4 Layouts
- **AppLayout**: Sidebar esquerda (AppSidebar) + `<Outlet />` para rotas empresa
- **AdminLayout**: Sidebar esquerda com menu admin + `<Outlet />` para rotas admin
- Ambos usam `hex-pattern` no background

### 4.5 Sidebar da Empresa (AppSidebar)
**Menu principal:**
1. Início (`/dashboard`) — LayoutDashboard icon
2. Documentos (`/documents`) — FileText icon
3. Pastas (`/folders`) — FolderTree icon
4. Modelos (`/templates`) — Layers icon
5. Contatos (`/contacts`) — Users icon
6. Envio em massa (`/bulk-send`) — Zap icon
7. Relatórios (`/analytics`) — BarChart3 icon

**Menu inferior (separador):**
8. API & Webhooks (`/api-docs`) — Code2 icon
9. Configurações (`/settings`) — Settings icon
10. Sair — LogOut icon

**Elementos extras:**
- Botão "Novo documento" destacado no topo da sidebar
- Card com avatar do usuário + nome da empresa no rodapé
- Botão de colapsar/expandir sidebar (toggle w-[68px] / w-[250px])
- Logo Valeris + "DNA do Software" no cabeçalho

### 4.6 Sidebar Admin (AdminLayout)
1. Dashboard (`/admin`) — LayoutDashboard
2. Empresas (`/admin/companies`) — Building2
3. Configurações (`/admin/settings`) — Settings
4. Sair — LogOut
5. Card do Super Admin no rodapé

---

## 5. Telas — Descrição Detalhada

### 5.1 Login (`/login`)

**Layout**: Centralizado, max-w-md

**Componentes:**
1. Logo Valeris (imagem 80x80) + título "VALERIS" (font Orbitron) + subtítulo
2. Toggle segmentado: "Empresa" | "Admin" (com ícone Shield)
3. Card com formulário:
   - Campo Email (placeholder dinâmico conforme modo)
   - Campo Senha com toggle visibilidade (Eye/EyeOff)
   - Link "Esqueceu a senha?" (não funcional no mock)
   - Botão "Entrar" full width
4. Card inferior com credenciais de demo

**Comportamento:**
- Loading de 500ms simulado no submit
- Toast de erro se credenciais inválidas
- Redirect para `/admin` (superadmin) ou `/dashboard` (empresa) após login
- Se já autenticado, `/login` redireciona automaticamente

---

### 5.2 Dashboard da Empresa (`/dashboard`)

**Header**: AppHeader com título "Início", subtítulo "Visão geral da sua conta"

**Seções:**
1. **Grid de Stats** (6 colunas em lg):
   - Total de documentos (FileText, text-info, bg-info/10) = 156
   - Aguardando assinatura (Clock, text-warning, bg-warning/10) = 23
   - Assinados (CheckCircle2, text-success, bg-success/10) = 112
   - Expirados (AlertTriangle, text-destructive, bg-destructive/10) = 5
   - Cancelados (XCircle, text-muted-foreground, bg-muted) = 8
   - Rascunhos (FileEdit, text-muted-foreground, bg-muted) = 8

2. **KPIs** (2 colunas):
   - Taxa de conclusão: 94% com barra de Progress
   - Tempo médio de assinatura: "1.4 dias"

3. **Grid 3 colunas** (2+1):
   - Gráfico de barras "Documentos por mês" (Recharts BarChart) — dados mensais Set-Mar, barras "Enviados" (info) e "Assinados" (primary)
   - Card "Pastas" — lista de pastas com cor, nome e contagem

4. **Documentos recentes** (5 mais recentes):
   - Ícone FileText + nome + data formatada + "X/Y assinaturas"
   - StatusBadge à direita
   - Clicável → `/documents/:id`

---

### 5.3 Lista de Documentos (`/documents`)

**Header**: "Documentos" + contagem filtrada

**Toolbar:**
1. Campo de busca (por nome ou signatário)
2. Filtro de pasta (Select com todas as pastas)
3. Toggle ordenação (data/nome)
4. Toggle visualização (lista/grid)
5. Botão "Novo documento" → `/documents/new`

**Filtros de status** (pills horizontais):
- Todos, Rascunho, Aguardando, Assinados, Cancelados, Expirados
- Cada pill mostra contagem entre parênteses
- Pill ativo: bg-primary text-primary-foreground

**Seleção em massa:**
- Checkbox global no header + checkbox por documento
- Barra de ações aparece quando há seleção: Reenviar, Baixar, Cancelar

**Modo Lista:**
- Colunas: Checkbox | Documento (nome + folder tag + tags coloridas + envelope) | Status (StatusBadge) | Signatários (avatares sobrepostos com status colorido + "X/Y") | Data | Menu (...)
- Menu dropdown: Visualizar, Reenviar, Duplicar, Baixar, Editar tags, Cancelar

**Modo Grid:**
- Cards com: ícone FileText, StatusBadge, nome, tags, data, contagem assinaturas
- Hover: shadow-md + border-primary/30

---

### 5.4 Detalhes do Documento (`/documents/:id`)

**Header**: AppHeader com nome do documento + botões de ação (Copiar link, Baixar, Reenviar)

**Layout**: Grid 3 colunas (2+1)

**Coluna principal (2/3):**
1. **Card "Informações do documento"**:
   - StatusBadge no header
   - Grid 3 colunas com: Criado em, Atualizado em, Prazo, Tipo de assinatura, Pasta, Envelope, Notificação via, Lembrete automático
   - Tags como Badges

2. **Preview do documento**:
   - Placeholder aspect-[3/4] com ícone FileText
   - Botão "Baixar PDF"

**Sidebar (1/3):**
1. **Card "Signatários"**:
   - Para cada signatário:
     - Avatar circular com número de ordem (cor conforme status: success/warning/destructive)
     - Nome + ícone status (CheckCircle2/Clock/XCircle)
     - Email com ícone Mail
     - Telefone com ícone Phone (se existir)
     - Badges: Role + AuthMethod (com ícone Shield)
     - Texto de status colorido + data de assinatura (se assinou)
   - Botão "Reenviar" se status pending

2. **Card "Trilha de auditoria"**:
   - Timeline vertical com linha central
   - Cada entrada: ícone colorido circular + detalhes + actor + timestamp
   - Ícones por ação:
     - created/sent → FileText/Send (bg-info/20)
     - viewed → Eye (bg-muted)
     - signed/completed → CheckCircle2 (bg-success/20)
     - refused/cancelled → XCircle (bg-destructive/20)
     - expired → Clock (bg-warning/20)
     - reminder → Mail (bg-warning/20)

---

### 5.5 Contatos (`/contacts`)

**Header**: "Contatos" + contagem

**Componentes:**
1. Campo de busca (por nome ou email)
2. Botão "Novo contato"
3. Lista em Card:
   - Avatar com iniciais (bg-primary/10 text-primary)
   - Nome, email (Mail), telefone (Phone), empresa (Building2)
   - Contagem de documentos
   - Menu: Editar, Remover

---

### 5.6 Modelos (`/templates`)

**Header**: "Modelos" + contagem

**Layout**: Grid 3 colunas

**Cada card:**
- Ícone FolderOpen + nome + "Usado X vezes"
- Descrição (line-clamp-2)
- Data de criação + botão "Usar modelo"
- Menu: Editar, Duplicar, Excluir
- Category Badge no select do wizard (ao selecionar template)

---

### 5.7 Pastas (`/folders`)

**Header**: "Pastas" + contagem

**Vista de pastas** (grid 4 colunas):
- Card com ícone FolderOpen colorido (cor da pasta) + nome + contagem
- Hover: shadow + border-primary/30
- Clique → abre conteúdo da pasta

**Vista de conteúdo** (após clicar em pasta):
- Botão "← Todas as pastas"
- Header com nome + contagem
- Lista de documentos na pasta (FileText + nome + status)
- Empty state se pasta vazia

**Dialog "Nova pasta":**
- Campo nome
- Seletor de cor (8 cores pré-definidas em círculos):
  - `#22c55e`, `#3b82f6`, `#f59e0b`, `#8b5cf6`, `#ef4444`, `#06b6d4`, `#ec4899`, `#f97316`
- Cor selecionada: ring-2 ring-primary

---

### 5.8 Envio em Massa (`/bulk-send`)

**Header**: "Envio em massa" + subtítulo

**Wizard de 3 etapas** (max-w-2xl centralizado):

1. **Selecionar modelo**: Área clicável dashed → simula seleção
2. **Importar CSV**: Área clicável dashed → simula upload de "signatarios.csv" (150 signatários)
   - Link "Baixar modelo de CSV"
3. **Confirmar e enviar** (aparece quando etapas 1+2 completas):
   - Resumo: Modelo, Signatários, Documentos a criar, Notificação
   - Campo de mensagem personalizada (opcional)
   - Botão "Enviar 150 documentos"

---

### 5.9 Relatórios (`/analytics`)

**Header**: "Relatórios" + select de período (7d, 30d, 90d, 12m)

**Gráficos** (grid 2 colunas):
1. **Documentos por mês** (BarChart) — mesmos dados do dashboard
2. **Status dos documentos** (PieChart donut):
   - Assinados: 112 (hsl 152 62% 42%)
   - Aguardando: 23 (hsl 38 92% 50%)
   - Expirados: 5 (hsl 220 10% 46%)
   - Cancelados: 8 (hsl 0 84% 60%)
   - Rascunhos: 8 (hsl 220 14% 80%)
3. **Tempo médio de assinatura** (AreaChart, col-span-2):
   - Dados por dia da semana (Seg-Dom) em horas

---

### 5.10 API & Integrações (`/api-docs`)

**Header**: "API & Integrações"

**4 Tabs:**

**Tab "Documentação":**
- Base URL: `https://api.valeris.com/v1`
- Auth: `Authorization: Bearer <api_key>`
- Lista de 16 endpoints com method badge colorido:
  - POST (text-success) | GET (text-info) | DELETE (text-destructive)
- Exemplos cURL: Criar documento, Enviar para assinatura
- Exemplo de response JSON (status com signers e audit_trail)
- Payload de webhook JSON
- Lista de eventos webhook (11 eventos):
  - `document.created`, `document.sent`, `document.viewed`, `document.signed`, `document.completed`, `document.refused`, `document.expired`, `document.cancelled`, `signer.validation.selfie_completed`, `signer.validation.document_completed`, `signer.validation.all_completed`
- Rate limits por plano: Starter 100/min, Professional 500/min, Enterprise 2000/min

**Tab "Chaves de API":**
- Lista de chaves com: nome, key mascarada, toggle visibilidade, botão copiar, badge Ativa/Inativa, último uso, botão deletar
- Botão "Nova chave"

**Tab "Webhooks":**
- Lista de webhooks: URL (code), toggle ativo, badges de eventos, botão deletar
- Botão "Novo webhook"

**Tab "SDKs & Bibliotecas":**
- 5 SDKs: Node.js/TypeScript, Python, PHP, Java, C#/.NET
- Status: stable, beta, coming soon
- Exemplo de código Node.js completo (criar doc + enviar + consultar)

---

### 5.11 Configurações da Empresa (`/settings`)

**4 Tabs:**

**Tab "Perfil":**
- Avatar 64x64 com iniciais + botão "Alterar foto"
- Campos: Nome, Sobrenome, Email, Telefone
- Botão "Salvar alterações"

**Tab "Conta":**
- Campos: Nome da empresa, CNPJ
- Botão "Salvar"

**Tab "Notificações":**
- 5 toggles Switch:
  1. Documento assinado por todos os signatários
  2. Signatário visualizou o documento
  3. Signatário recusou assinar
  4. Documento próximo do prazo
  5. Documento expirado

**Tab "API":**
- Chave de acesso (mascarada) + botão Copiar
- Campo Webhook URL
- Botão "Salvar"

---

### 5.12 Dashboard Admin (`/admin`)

**Header interno**: "Painel Administrativo" + "Visão geral da plataforma Valeris"

**Stats** (4 colunas):
- Empresas ativas (Building2, primary)
- Total de usuários (Users, info)
- Documentos no mês (FileText, success)
- Receita mensal: "R$ 12.400" (DollarSign, warning)

**Grid 2 colunas:**
1. **Uso por empresa** (BarChart): barras "Usados" (primary) vs "Limite" (border)
2. **Lista de empresas**: Avatar Building2 + nome + plano + Badge status + barra de uso (Progress)

**Alertas:**
- Empresas suspensas (bg-destructive/5, border-destructive/20)
- Empresas com >70% do limite (bg-warning/5, border-warning/20)

---

### 5.13 Empresas Admin (`/admin/companies`)

**Header**: "Empresas" + contagem + botão "Nova empresa"

**Filtros:**
- Busca por nome ou CNPJ
- Select de status (Todos, Ativas, Inativas, Suspensas)

**Grid 3 colunas** de cards:
- Avatar Building2 + nome + CNPJ (font-mono)
- Badges: status (default/destructive/secondary) + plano (outline, capitalize)
- Stats: usuários (X/Y) + docs (X/Y)
- Barra de uso do plano (Progress)
- Botão "Ver detalhes"
- Menu: Detalhes, Editar, Desativar

**Dialog "Nova empresa"** (max-w-lg):
- Seção "Dados da empresa": Razão social*, CNPJ*, Telefone, Email*
- Seção "Plano e limites": Plano (select), Máx. usuários (number), Docs/mês (number)
- Seção "Admin principal": Nome*, Email* + texto "Este usuário receberá o login..."
- Botão "Criar empresa" (disabled se campos obrigatórios vazios)

---

### 5.14 Detalhes da Empresa Admin (`/admin/companies/:id`)

**Header**: Building2 icon + nome + CNPJ + Badges status/plano

**Stats** (4 colunas):
- Usuários (+ máx.)
- Documentos mês (+ Progress)
- Limite mensal
- Plano ativo (colorido)

**3 Tabs:**

**Tab "Usuários":**
- Contagem + botão "Novo usuário"
- Lista com: Avatar (Shield para admin / User para user) + nome + email
- Badges: role (Admin/Usuário) + status (Ativo/Inativo)
- Menu: Editar, Resetar senha, Desativar
- **Dialog "Criar usuário"**: Nome*, Email*, Perfil (select: Administrador/Usuário)

**Tab "Configurações":**
- Campos editáveis: Razão social, CNPJ, Email, Telefone
- Plano (select) + Máx. usuários + Docs/mês
- Toggle "Status da empresa" (Switch)
- Botão "Salvar alterações"

**Tab "Integrações API":**
- Lista de chaves API da empresa (nome, key mascarada, badge ativa/inativa)
- Botão "Gerar nova chave"

---

### 5.15 Configurações Admin (`/admin/settings`)

**3 Tabs:**

**Tab "Geral":**
- Nome da plataforma (default: "Valeris")
- URL base da API (default: "https://api.valeris.com/v1")
- Toggle "Modo manutenção"
- Botão "Salvar"

**Tab "Microsserviços":**
- 4 campos de URL:
  1. Microsserviço de Assinatura + descrição
  2. Microsserviço de Coleta de Documento + descrição
  3. Microsserviço de Selfie + descrição
  4. Microsserviço de Selfie com Documento + descrição
- Toggle "Usar mocks (desenvolvimento)" (default: checked)
- Botão "Salvar"

**Tab "Planos":**
- 3 planos listados com detalhes:
  - Starter: 5 usuários, 100 docs/mês, R$ 99/mês
  - Professional: 20 usuários, 500 docs/mês, R$ 299/mês
  - Enterprise: 50 usuários, 1000 docs/mês, R$ 799/mês
- Botão "Editar" por plano

---

## 6. Fluxo de Criação de Documento (Wizard 5 Etapas)

**Rota**: `/documents/new`
**Componente**: `NewDocument.tsx`

### Stepper Visual
- 5 botões horizontais com ícones
- Etapa atual: bg-primary text-primary-foreground shadow
- Etapa concluída: bg-success/10 text-success + CheckCircle2
- Etapa futura: bg-secondary text-muted-foreground (não clicável)
- Linhas conectoras entre etapas (bg-success se concluída)

### Etapa 1: Documento (Upload)
- Select "Usar modelo (opcional)" com lista de templates (nome + category badge)
- Separador "ou faça upload"
- Área de drag/drop:
  - Vazio: Upload icon + "Clique ou arraste" + "PDF, DOCX, XLSX, JPEG, PNG (máx. 20MB)"
  - Com arquivo: CheckCircle2 verde + nome do arquivo + "Clique para trocar"
  - **Mock**: clique seta `fileName = 'contrato-servicos.pdf'`
- Campo "Nome do documento"
- **Validação para avançar**: fileName deve existir

### Etapa 2: Signatários
- Toggle "Ordem importa" (Switch)
- Para cada signatário (dinâmico, começa com 1):
  - Container com borda colorida (cor do signatário, background 8% opacidade)
  - Badge circular com número + "Signatário N"
  - Botão remover (só se >1 signatário)
  - **Campos**:
    - Nome * (obrigatório)
    - Email * (obrigatório)
    - Telefone (opcional)
    - Papel (Select): Signatário, Contratante, Contratada, Testemunha, Aprovador, Fiador, Representante Legal
  - **Validações pós-assinatura** (após Separator):
    - Título "Validações pós-assinatura" + contagem
    - 3 opções com Checkbox:
      1. Selfie (Camera) — "Tirar foto do rosto"
      2. Foto do documento (FileImage) — "Fotografar RG/CNH/CPF"
      3. Selfie com documento (UserCheck) — "Foto segurando o documento"
    - Selecionado: border-primary bg-primary/5
    - **Ordem do fluxo**: Lista reordenável das validações selecionadas
      - GripVertical + número + label + botões ↑/↓
- Botão "Adicionar signatário" (border-dashed)
- **Validação**: todos signatários devem ter nome + email

### Etapa 3: Campos (Editor Visual)
- **Layout fullscreen** (sem scroll geral, editor ocupa flex-1)
- Header com contagem de campos + badge
- Componente `DocumentFieldEditor` (ver seção 7)
- Navegação inferior: Voltar / Próximo
- **Sem validação obrigatória** (pode avançar sem campos)

### Etapa 4: Configurar
- **Tipo de assinatura** (RadioGroup 2 colunas):
  - Eletrônica: "Mais simples e rápida. Validade jurídica pela MP 2.200-2."
  - Digital (ICP-Brasil): "Certificado digital A1/A3. Máxima segurança jurídica."
- Info box: "📧 Notificação via Email"
- **Prazo para assinatura**: Toggle + campo date (condicional)
- **Lembretes automáticos**: Toggle + Select de intervalo (1, 2, 3, 5, 7 dias)
- **Idioma**: Select (pt-BR, en, es)
- **Mensagem personalizada**: Textarea

### Etapa 5: Revisar e Enviar
- **Resumo do documento**:
  - Ícone FileText + nome do doc + nome do arquivo
  - Grid 2 colunas: Tipo, Notificação, Campos, Prazo, Lembretes
- **Lista de signatários**:
  - Avatar colorido + nome + email + contagem de campos + Badge role
  - Se tem validationSteps: linha "Pós-assinatura:" com badges ordenados (ex: "1. Selfie", "2. Foto do documento")
- **Mensagem** (se preenchida)
- Botão "Enviar documento" (com ícone Send + shadow)
- **Ao enviar**: Toast de sucesso + redirect para `/documents`

### Cores dos signatários (ordem fixa):
```typescript
const signerColors = [
  'hsl(152, 62%, 42%)',  // verde
  'hsl(210, 92%, 45%)',  // azul
  'hsl(38, 92%, 50%)',   // âmbar
  'hsl(280, 65%, 55%)',  // roxo
  'hsl(0, 84%, 60%)',    // vermelho
  'hsl(180, 60%, 40%)',  // teal
];
```

---

## 7. Editor Visual de Campos (DocumentFieldEditor)

**Componente**: `src/components/documents/DocumentFieldEditor.tsx`
**Dimensão do canvas**: 595 × 842 pixels (proporção A4)

### Layout 3 painéis:
```
┌──────────────┬────────────────────────────────┬──────────────┐
│  Barra       │        Canvas do                │  Painel de   │
│  Lateral     │        Documento                │  Propriedades│
│  (w-56)      │        (flex-1)                 │  (w-56)      │
│              │                                  │              │
│  - Signatário│    [página simulada com          │  - Tipo      │
│    ativo     │     linhas cinzas como           │  - Rótulo    │
│  - Tipos de  │     texto placeholder]           │  - Signatário│
│    campo     │                                  │  - X, Y      │
│  - Contagem  │    [campos posicionados          │  - W, H      │
│    por signer│     absolutamente]               │  - Página    │
│              │                                  │  - Obrigatório│
│              │                                  │  - Duplicar  │
│              │                                  │  - Remover   │
└──────────────┴────────────────────────────────┴──────────────┘
```

### Painel Esquerdo (w-56):
1. **Seletor de signatário ativo**: Select dropdown com cor do signatário
2. **Botões de tipo de campo**: Clique para adicionar campo ao canvas
   - Cada campo tem ícone + nome + dimensões padrão
3. **Contagem por signatário**: Bolinha colorida + nome + Badge com contagem

### Canvas Central:
- **Toolbar**: Navegação de página (← N de M →) + Zoom (-/+, 50%-150%) + Ações do campo selecionado (Duplicar/Remover)
- **Área do documento**: Background branco com linhas cinza simulando texto
  - Página 1: título + 2 parágrafos + subtítulo + parágrafo
  - Página 2: 2 parágrafos + subtítulo
  - Última página: título + linhas de assinatura simuladas
- **Campos posicionados**: Divs absolutas com:
  - Borda colorida (cor do signatário)
  - Background translúcido (cor 15% opacidade)
  - Ícone do tipo + label (se largura > 60px)
  - Badge do signatário (aparece quando selecionado)
  - Handle de resize (canto inferior direito, cor do signatário)
  - Indicador de obrigatório (bolinha vermelha no canto)
  - Sombra + ring quando selecionado

### Interações:
- **Arrastar campo**: mousedown → mousemove → mouseup (calcula offset com scale do zoom)
- **Redimensionar**: Handle no canto inferior direito, min 24×20px
- **Selecionar**: Click no campo
- **Deselecionar**: Click fora dos campos
- **Zoom**: Escala o container inteiro, coordenadas são convertidas

### Painel Direito (w-56):
**Quando campo selecionado:**
- Tipo (read-only com ícone)
- Rótulo (input editável)
- Signatário (Select — permite reatribuir)
- Coordenadas X, Y (inputs numéricos)
- Dimensões Largura, Altura (inputs numéricos)
- Página (Select — muda a página ao selecionar)
- Toggle Obrigatório (custom switch)
- Botões: Duplicar campo, Remover campo

**Quando nenhum campo selecionado:**
- Ícone MousePointer + texto "Selecione um campo para editar"

**Miniaturas de páginas** (rodapé do painel direito):
- Botões w-10 h-14 com número da página
- Badge com contagem de campos por página
- Página ativa: border-primary

---

## 8. Página Pública de Assinatura (SignPage)

**Rota**: `/sign/:token`
**Componente**: `SignPage.tsx`
**Acesso**: Público (sem autenticação)

### Header
- Logo Valeris (w-8 h-8 bg-primary) + "SignFlow" + "Assinatura segura"
- **Nota**: O header ainda mostra "SignFlow" — deve ser atualizado para "Valeris"

### Progress
- Steps visuais: Assinatura → [Validações configuradas] → Concluído
- Cada step: Ícone circular (concluído=success, atual=primary, futuro=secondary)
- Barra de Progress (h-1)

### Info do documento
- Título: "Contrato de Prestação de Serviços - TechCorp"
- Subtítulo: "Enviado por Usuário Silva · usuario@empresa.com"

### Step 1: Assinatura
1. **Preview do documento**: Área aspect-[3/4] com placeholder
2. **Card de assinatura** com Tabs:
   - **Tab "Desenhar"**: Canvas HTML5 (w-full h-40)
     - Linha de referência (w-3/4 h-px) na base
     - Botão "Limpar"
     - Configuração do canvas: 2x resolução, strokeStyle dark, lineWidth 2, lineCap/lineJoin round
   - **Tab "Digitar"**: Input text-center text-lg + preview com fonte Georgia serif italic (text-3xl)
3. **Ações**: Texto legal + botão "Assinar" (disabled se não desenhou/digitou)
4. **Ao clicar "Assinar"**: Loading 1.5s → Toast → Avança para próxima validação

### Steps 2+: Validações KYC
- Ícone grande (w-20 h-20 bg-primary/10) + título + descrição
- **Área da câmera**: Placeholder aspect-[4/3] com border-dashed
  - Mostra o endpoint da API: `POST /api/v1/{selfie|document-collection|selfie-document}`
- Indicador "Etapa X de Y"
- Botão "Capturar e continuar" → Loading 2s → Toast → Próximo step

### Step final: Concluído
- Ícone CheckCircle2 (w-20 h-20 bg-success/10)
- Título: "Processo concluído!"
- Descrição sobre sucesso
- Botão "Baixar documento assinado"

### Validações mock configuradas:
```typescript
const mockValidationSteps: PostSignStep[] = ['selfie', 'document_photo'];
```

---

## 9. Validação Pós-Assinatura (KYC)

### Tipos de validação disponíveis:

| Tipo                    | Label               | Descrição                               | Ícone     |
|-------------------------|---------------------|-----------------------------------------|-----------|
| `selfie`               | Selfie              | Tirar foto do rosto                     | Camera    |
| `document_photo`       | Foto do documento   | Fotografar RG/CNH/CPF                   | FileImage |
| `selfie_with_document` | Selfie com documento| Foto segurando o documento              | UserCheck |

### Fluxo:
1. Criador do documento seleciona validações por signatário (etapa 2 do wizard)
2. Define a ordem de execução (reordenável via botões ↑/↓)
3. Quando signatário assina (SignPage), após a assinatura as validações são executadas sequencialmente
4. Cada validação chama o microsserviço correspondente
5. Só avança para próxima validação após confirmação do microsserviço

### Integração com microsserviços (detalhes na seção 10)

---

## 10. Integração com Microsserviços

### Configuração
As URLs dos microsserviços são configuradas no painel admin (`/admin/settings` → tab "Microsserviços"):

```typescript
interface MicroserviceConfig {
  signatureUrl: string;              // API de processamento de assinatura
  documentCollectionUrl: string;      // API de captura de foto de documento
  selfieUrl: string;                  // API de captura de selfie
  selfieWithDocumentUrl: string;      // API de captura de selfie com documento
}
```

### Toggle de Mocks
- Switch "Usar mocks (desenvolvimento)" — simula chamadas sem microsserviço real
- Default: ativado

### Contratos de API dos Microsserviços

#### 10.1 Microsserviço de Assinatura
```
POST {signatureUrl}/api/v1/signatures

Request:
{
  "document_id": "doc_abc123",
  "signer_id": "signer_1",
  "signature_data": {
    "type": "draw" | "type",
    "image_base64": "data:image/png;base64,...",  // se draw
    "typed_name": "João Silva",                     // se type
    "font_family": "Georgia, serif"
  },
  "metadata": {
    "ip": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "timestamp": "2026-03-05T14:30:00Z",
    "geolocation": { "lat": -23.5505, "lng": -46.6333 }
  }
}

Response:
{
  "id": "sig_xyz789",
  "status": "completed",
  "hash": "sha256:abc123...",
  "certificate": { ... },
  "signed_document_url": "https://..."
}
```

#### 10.2 Microsserviço de Selfie
```
POST {selfieUrl}/api/v1/selfie

Request:
{
  "signer_id": "signer_1",
  "document_id": "doc_abc123",
  "image_base64": "data:image/jpeg;base64,...",
  "metadata": { "ip": "...", "timestamp": "..." }
}

Response:
{
  "id": "selfie_001",
  "status": "approved" | "rejected",
  "confidence_score": 0.95,
  "liveness_result": {
    "is_live": true,
    "confidence": 0.98
  },
  "face_match": { "matched": true, "score": 0.92 }
}
```

#### 10.3 Microsserviço de Coleta de Documento
```
POST {documentCollectionUrl}/api/v1/document-collection

Request:
{
  "signer_id": "signer_1",
  "document_id": "doc_abc123",
  "document_type": "rg" | "cnh" | "cpf",
  "image_base64": "data:image/jpeg;base64,...",
  "side": "front" | "back"
}

Response:
{
  "id": "doc_photo_001",
  "status": "approved" | "rejected",
  "confidence_score": 0.88,
  "extracted_data": {
    "name": "João Silva",
    "document_number": "123.456.789-00",
    "birth_date": "1990-01-15"
  },
  "quality": { "readable": true, "blur_score": 0.1 }
}
```

#### 10.4 Microsserviço de Selfie com Documento
```
POST {selfieWithDocumentUrl}/api/v1/selfie-document

Request:
{
  "signer_id": "signer_1",
  "document_id": "doc_abc123",
  "image_base64": "data:image/jpeg;base64,...",
  "reference_selfie_id": "selfie_001",
  "reference_document_id": "doc_photo_001"
}

Response:
{
  "id": "selfie_doc_001",
  "status": "approved" | "rejected",
  "confidence_score": 0.90,
  "face_document_match": {
    "matched": true,
    "score": 0.88
  },
  "liveness_result": { "is_live": true, "confidence": 0.96 }
}
```

### Fluxo de Integração na SignPage
```
1. Signatário acessa /sign/:token
2. Visualiza o documento
3. Assina (draw/type) → POST {signatureUrl}/api/v1/signatures
4. Se validationSteps configuradas:
   a. Para cada step em ordem:
      - Exibe UI de captura
      - Captura imagem via câmera/webcam
      - POST para microsserviço correspondente
      - Verifica response.status === 'approved'
      - Se rejeitado, permite retry
      - Se aprovado, avança para próximo step
5. Todas validações concluídas → tela de sucesso
6. Backend emite webhook 'document.signed' e possivelmente 'document.completed'
```

---

## 11. API REST e Webhooks

### Base URL
```
https://api.valeris.com/v1
```

### Autenticação
```
Authorization: Bearer <api_key>
```
- Chaves no formato: `sk-live-*` (produção) ou `sk-test-*` (sandbox)

### Endpoints

| Método  | Endpoint                              | Descrição                                      |
|---------|---------------------------------------|------------------------------------------------|
| POST    | `/v1/documents`                       | Criar documento e enviar para assinatura       |
| POST    | `/v1/documents/upload`                | Upload de arquivo (multipart)                  |
| GET     | `/v1/documents`                       | Listar todos os documentos                     |
| GET     | `/v1/documents/:id`                   | Detalhes do documento com status dos signatários |
| GET     | `/v1/documents/:id/audit`             | Trilha de auditoria completa                   |
| GET     | `/v1/documents/:id/download`          | Download do documento assinado                 |
| POST    | `/v1/documents/:id/send`              | Enviar/reenviar para assinatura                |
| POST    | `/v1/documents/:id/cancel`            | Cancelar documento                             |
| POST    | `/v1/documents/:id/resend/:signer_id` | Reenviar para signatário específico            |
| GET     | `/v1/contacts`                        | Listar contatos                                |
| POST    | `/v1/contacts`                        | Criar contato                                  |
| GET     | `/v1/templates`                       | Listar modelos                                 |
| POST    | `/v1/templates`                       | Criar modelo                                   |
| GET     | `/v1/folders`                         | Listar pastas                                  |
| POST    | `/v1/webhooks`                        | Registrar webhook                              |
| DELETE  | `/v1/webhooks/:id`                    | Remover webhook                                |

### Exemplo: Criar Documento via API
```bash
curl -X POST https://api.valeris.com/v1/documents \
  -H "Authorization: Bearer sk-live-..." \
  -H "Content-Type: multipart/form-data" \
  -F "name=Contrato de Serviço" \
  -F "file=@contrato.pdf" \
  -F 'signers=[{"name":"João","email":"joao@email.com","role":"Signatário","validation_steps":["selfie","document_photo"]}]' \
  -F "signature_type=electronic" \
  -F "notify_via=email" \
  -F "deadline=2026-03-20T23:59:59Z"
```

### Exemplo: Response de Status
```json
{
  "id": "doc_abc123",
  "name": "Contrato de Serviço",
  "status": "pending",
  "created_at": "2026-03-04T10:30:00Z",
  "signers": [
    {
      "name": "João Silva",
      "email": "joao@email.com",
      "status": "signed",
      "signed_at": "2026-03-05T14:30:00Z",
      "validation_steps": [
        {"type": "selfie", "status": "completed"},
        {"type": "document_photo", "status": "completed"}
      ]
    },
    {
      "name": "Maria Santos",
      "email": "maria@email.com",
      "status": "pending",
      "validation_steps": [
        {"type": "selfie", "status": "pending"}
      ]
    }
  ],
  "audit_trail": [
    {"action": "created", "actor": "API", "timestamp": "2026-03-04T10:30:00Z"},
    {"action": "signed", "actor": "João Silva", "timestamp": "2026-03-05T14:30:00Z"}
  ]
}
```

### Webhook Payload
```json
{
  "event": "document.signed",
  "timestamp": "2026-03-05T14:30:00Z",
  "data": {
    "document_id": "doc_abc123",
    "document_name": "Contrato de Serviço",
    "signer": {
      "name": "João Silva",
      "email": "joao@email.com",
      "signed_at": "2026-03-05T14:30:00Z",
      "validation_completed": ["selfie", "document_photo"],
      "ip": "192.168.1.1"
    }
  }
}
```

### Eventos de Webhook
| Evento                                | Descrição                                |
|---------------------------------------|------------------------------------------|
| `document.created`                    | Documento criado                         |
| `document.sent`                       | Documento enviado para assinatura        |
| `document.viewed`                     | Signatário visualizou o documento        |
| `document.signed`                     | Signatário assinou                       |
| `document.completed`                  | Todos assinaram                          |
| `document.refused`                    | Signatário recusou                       |
| `document.expired`                    | Prazo expirou                            |
| `document.cancelled`                  | Documento cancelado                      |
| `signer.validation.selfie_completed`  | Selfie validada com sucesso              |
| `signer.validation.document_completed`| Foto do documento validada               |
| `signer.validation.all_completed`     | Todas as validações do signatário OK     |

### Rate Limits
| Plano        | Limite         |
|--------------|----------------|
| Starter      | 100 req/min    |
| Professional | 500 req/min    |
| Enterprise   | 2000 req/min   |

### SDKs Oficiais
| Linguagem        | Pacote                        | Status       |
|------------------|-------------------------------|--------------|
| Node.js/TypeScript| `npm install @valeris/sdk`   | stable       |
| Python           | `pip install valeris-sdk`      | stable       |
| PHP              | `composer require valeris/sdk` | beta         |
| Java             | `Maven: com.valeris:sdk:1.0.0`| beta         |
| C# / .NET        | `dotnet add package Valeris.SDK`| coming soon |

---

## 12. Design System

### 12.1 Fontes
| Uso       | Fonte     | Família CSS         | Aplicação                      |
|-----------|-----------|---------------------|--------------------------------|
| Headings  | Orbitron  | `.font-game`        | h1-h6, títulos, stats          |
| Body      | Rajdhani  | `.font-body`        | Texto geral, labels, botões    |
| Fallback  | Inter     | —                   | Se Rajdhani não carregar       |

### 12.2 Paleta de Cores (HSL)

**Modo Light:**
| Token                  | HSL                  | Uso                           |
|------------------------|----------------------|-------------------------------|
| `--background`         | 215 30% 96%          | Fundo geral                   |
| `--foreground`         | 215 30% 12%          | Texto principal               |
| `--card`               | 0 0% 100%            | Cards, modais                 |
| `--primary`            | 210 100% 50%         | Botões, links, destaques      |
| `--secondary`          | 215 25% 93%          | Backgrounds sutis             |
| `--muted`              | 215 20% 94%          | Elementos desabilitados       |
| `--muted-foreground`   | 215 15% 46%          | Texto secundário              |
| `--accent`             | 200 100% 50%         | Destaques alternativos        |
| `--destructive`        | 0 84% 60%            | Erros, cancelamentos          |
| `--border`             | 215 20% 88%          | Bordas                        |
| `--ring`               | 210 100% 50%         | Focus rings                   |
| `--warning`            | 38 92% 50%           | Alertas, pendências           |
| `--success`            | 152 62% 42%          | Sucesso, assinados            |
| `--info`               | 200 100% 50%         | Informações                   |
| `--xp`                 | 45 100% 51%          | Token gamificação             |
| `--rank`               | 280 80% 55%          | Token gamificação             |

**Sidebar (dark sempre):**
| Token                        | HSL                |
|------------------------------|---------------------|
| `--sidebar-background`       | 215 35% 10%        |
| `--sidebar-foreground`       | 215 15% 75%        |
| `--sidebar-primary`          | 210 100% 55%       |
| `--sidebar-accent`           | 215 30% 16%        |
| `--sidebar-accent-foreground`| 215 15% 92%        |
| `--sidebar-border`           | 215 30% 15%        |

### 12.3 Utilitários CSS Customizados

```css
/* Glow azul (usado em sidebar ativa, botões destacados) */
.glow-blue {
  box-shadow: 0 0 15px -3px hsl(var(--glow-primary) / 0.4),
              0 0 30px -5px hsl(var(--glow-primary) / 0.15);
}

/* Card gamificado (borda gradiente no topo) */
.game-card {
  background: linear-gradient(135deg, card 0%, card 85%, primary/3% 100%);
  &::before { height: 3px; background: linear-gradient(90deg, primary, accent, primary); }
}

/* Padrão hexagonal no background */
.hex-pattern {
  background-image: SVG hexagonal stroke azul, opacity 3%;
  background-size: 60px 60px;
}

/* Números com gradiente (headings de stats) */
.stat-number {
  font-family: Orbitron;
  background: linear-gradient(135deg, primary, accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Scrollbar customizada (6px thin) */
.scrollbar-thin { scrollbar-width: thin; }
```

### 12.4 Animações
| Nome           | Efeito                                      | Duração |
|----------------|---------------------------------------------|---------|
| `fade-in`      | opacity 0→1 + translateY 8px→0             | 0.3s    |
| `pulse-glow`   | box-shadow pulsante (primary)               | 2s loop |
| `shimmer`      | background-position -200%→200%              | 2s loop |

### 12.5 Breakpoints Tailwind
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1400px (container max)

### 12.6 Border Radius
- `--radius`: 0.75rem (12px)
- `lg`: 0.75rem
- `md`: calc(0.75rem - 2px) = ~10px
- `sm`: calc(0.75rem - 4px) = ~8px

---

## 13. Componentes Compartilhados

### 13.1 AppHeader
```typescript
interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;   // Botões adicionais no header
}
```
**Elementos:**
- H1 título + subtítulo
- Busca global (hidden em mobile)
- Notificações (Bell com badge de contagem não-lidos)
  - Dropdown com lista de notificações (ícone + título + descrição + tempo)
  - Não lida: font-medium + bolinha azul
- Menu do perfil (Avatar dropdown):
  - Nome + email
  - Meu perfil, Minha conta, Planos & faturamento
  - Sair

### 13.2 StatusBadge
```typescript
interface StatusBadgeProps {
  status: DocumentStatus;  // 'draft' | 'pending' | 'signed' | 'cancelled' | 'expired'
}
```
**Mapeamento visual:**
| Status     | Label        | Estilo                         |
|------------|--------------|--------------------------------|
| draft      | Rascunho     | bg-muted text-muted-foreground |
| pending    | Aguardando   | bg-warning/15 text-warning     |
| signed     | Assinado     | bg-success/15 text-success     |
| cancelled  | Cancelado    | bg-destructive/15 text-destructive |
| expired    | Expirado     | bg-muted text-muted-foreground |

### 13.3 Biblioteca de Componentes (shadcn/ui)
Todos os componentes base vêm do shadcn/ui com tema customizado:
- Accordion, Alert, AlertDialog, AspectRatio, Avatar, Badge, Breadcrumb
- Button, Calendar, Card, Carousel, Chart, Checkbox, Collapsible
- Command, ContextMenu, Dialog, Drawer, DropdownMenu, Form
- HoverCard, Input, InputOTP, Label, Menubar, NavigationMenu
- Pagination, Popover, Progress, RadioGroup, Resizable, ScrollArea
- Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Switch
- Table, Tabs, Textarea, Toast, Toggle, ToggleGroup, Tooltip

---

## 14. Mock Data — Estrutura Completa

### 14.1 Documentos Mock (8 documentos)
| ID | Nome                                      | Status    | Signatários | Pasta      | Tags              | Empresa |
|----|-------------------------------------------|-----------|-------------|------------|-------------------|---------|
| 1  | Contrato de Prestação de Serviços - TechCorp | pending   | 2 (1 signed) | Contratos  | urgente, tech     | comp1   |
| 2  | Acordo de Confidencialidade - NDA          | signed    | 2 (2 signed) | NDAs       | confidencial      | comp1   |
| 3  | Proposta Comercial - Projeto Alpha         | draft     | 0           | —          | comercial         | comp1   |
| 4  | Contrato de Trabalho - Dev Senior          | pending   | 2 (0 signed) | RH         | contratação       | comp1   |
| 5  | Termo de Adesão - Plano Enterprise         | cancelled | 1 (refused) | Comercial  | —                 | comp2   |
| 6  | Aditivo Contratual - Extensão de Prazo     | expired   | 1 (pending) | Contratos  | —                 | comp1   |
| 7  | Contrato de Locação Comercial              | pending   | 3 (1 signed) | Imobiliário| locação, comercial| comp2   |
| 8  | Política de Privacidade - LGPD             | signed    | 1 (1 signed) | Legal      | lgpd, privacidade | comp3   |

### 14.2 Contatos Mock (8 contatos)
Nomes: João Silva, Maria Santos, Carlos Oliveira, Ana Pereira, Roberto Lima, Pedro Almeida, Juliana Ferreira, Fernanda Costa

### 14.3 Templates Mock (6 templates)
Categorias: Contratos (2), Legal (2), RH (1), Comercial (1)

### 14.4 Pastas Mock (6 pastas)
Contratos (#22c55e), NDAs (#3b82f6), RH (#f59e0b), Comercial (#8b5cf6), Legal (#ef4444), Imobiliário (#06b6d4)

### 14.5 Empresas Mock (4 empresas)
| ID    | Nome                    | CNPJ               | Plano        | Status    | Usuários | Docs usado/limite |
|-------|-------------------------|---------------------|--------------|-----------|----------|-------------------|
| comp1 | TechCorp Soluções       | 12.345.678/0001-90 | enterprise   | active    | 12/50    | 156/1000          |
| comp2 | StartupXYZ              | 98.765.432/0001-10 | professional | active    | 5/15     | 45/300            |
| comp3 | Jurídico & Associados   | 11.222.333/0001-44 | starter      | active    | 3/5      | 78/100            |
| comp4 | Imobiliária Central     | 55.666.777/0001-88 | professional | suspended | 8/20     | 0/500             |

### 14.6 Notificações Mock (5)
Tipos: signed, viewed, expired, completed, refused

### 14.7 API Keys Mock (2)
- Produção: `sk-live-a1b2c3d4e5f6g7h8i9j0`
- Sandbox: `sk-test-z9y8x7w6v5u4t3s2r1q0`

### 14.8 Webhooks Mock (2)
- `https://meusite.com/webhook/signatures` — events: signed, completed (ativo)
- `https://meusite.com/webhook/status` — events: refused, expired (inativo)

---

## 15. Regras de Negócio

### 15.1 Ciclo de Vida do Documento
```
draft → pending → signed | cancelled | expired
                          ↑
                     (refused por signatário pode levar a cancelled)
```

1. **draft**: Documento criado mas não enviado. Pode ser editado livremente.
2. **pending**: Documento enviado, aguardando assinaturas. Lembretes automáticos ativos.
3. **signed**: Todas as assinaturas coletadas com sucesso (e validações concluídas).
4. **cancelled**: Cancelado manualmente ou após recusa de signatário.
5. **expired**: Prazo de assinatura atingido sem todas as assinaturas.

### 15.2 Ordem de Assinatura
- Se "Ordem importa" está ativado: signatários recebem notificação sequencialmente (1 → 2 → 3...)
- Se desativado: todos recebem simultaneamente

### 15.3 Limites por Plano
| Plano        | Usuários | Docs/mês | Rate Limit | Preço     |
|--------------|----------|----------|------------|-----------|
| Starter      | 5        | 100      | 100/min    | R$ 99/mês |
| Professional | 20       | 500      | 500/min    | R$ 299/mês|
| Enterprise   | 50       | 1000     | 2000/min   | R$ 799/mês|

### 15.4 Alertas do Admin
- Empresa com status `suspended` → alerta vermelho
- Empresa com uso >70% do limite mensal → alerta amarelo

### 15.5 Trilha de Auditoria
Toda ação no documento gera um registro imutável:
- `created`: Criação do documento
- `sent`: Envio para assinatura
- `viewed`: Signatário abriu o documento
- `signed`: Signatário assinou com sucesso
- `refused`: Signatário recusou (com motivo)
- `expired`: Prazo expirou automaticamente
- `cancelled`: Cancelamento manual
- `completed`: Todas assinaturas coletadas
- `reminder`: Lembrete automático enviado

### 15.6 Formatos Aceitos para Upload
PDF, DOCX, XLSX, JPEG, PNG (máximo 20MB)

### 15.7 Métodos de Assinatura
- **Desenhar**: Canvas HTML5, traço livre
- **Digitar**: Nome em fonte cursiva (Georgia serif)

### 15.8 Papéis de Signatário
Valores livres, mas sugeridos:
Signatário, Contratante, Contratada, Testemunha, Aprovador, Fiador, Representante Legal, Locador, Locatária, Colaborador, RH, DPO, Fornecedor, Diretor

### 15.9 Envio em Massa
- Requer template selecionado + CSV com colunas: nome, email, telefone (opcional)
- Cria N documentos independentes (1 por signatário do CSV)
- Mensagem personalizada opcional aplicada a todos

### 15.10 Idiomas Suportados
- Português (Brasil) — pt-BR (padrão)
- English — en
- Español — es

---

## Apêndice: Estrutura de Arquivos

```
src/
├── App.tsx                           # Rotas e providers
├── App.css                           # Estilos adicionais
├── index.css                         # Design system (tokens, utilities)
├── main.tsx                          # Entry point
├── vite-env.d.ts                     # Tipos Vite
│
├── assets/
│   └── valeris-logo.png              # Logo da plataforma
│
├── components/
│   ├── documents/
│   │   ├── DocumentFieldEditor.tsx    # Editor visual de campos (639 linhas)
│   │   └── StatusBadge.tsx            # Badge de status do documento
│   ├── layout/
│   │   ├── AdminLayout.tsx            # Layout do painel admin
│   │   ├── AppHeader.tsx              # Header com busca e notificações
│   │   ├── AppLayout.tsx              # Layout da empresa
│   │   └── AppSidebar.tsx             # Sidebar da empresa
│   ├── ui/                            # ~50 componentes shadcn/ui
│   └── NavLink.tsx                    # Wrapper de NavLink
│
├── contexts/
│   └── AuthContext.tsx                # Autenticação + mock companies/users
│
├── data/
│   └── mockData.ts                   # Dados mock (documents, contacts, etc.)
│
├── hooks/
│   ├── use-mobile.tsx                 # Hook de detecção mobile
│   └── use-toast.ts                   # Hook de toasts
│
├── lib/
│   └── utils.ts                       # cn() utility
│
├── pages/
│   ├── auth/
│   │   └── Login.tsx                  # Tela de login
│   ├── admin/
│   │   ├── AdminDashboard.tsx         # Dashboard admin
│   │   ├── AdminCompanies.tsx         # CRUD empresas
│   │   ├── AdminCompanyDetail.tsx     # Detalhes empresa
│   │   └── AdminSettings.tsx          # Config plataforma
│   ├── Dashboard.tsx                  # Dashboard empresa
│   ├── Documents.tsx                  # Lista de documentos
│   ├── DocumentDetail.tsx             # Detalhes do documento
│   ├── NewDocument.tsx                # Wizard 5 etapas (559 linhas)
│   ├── Contacts.tsx                   # Contatos
│   ├── Templates.tsx                  # Modelos
│   ├── Folders.tsx                    # Pastas
│   ├── BulkSend.tsx                   # Envio em massa
│   ├── Analytics.tsx                  # Relatórios
│   ├── ApiDocs.tsx                    # API docs + chaves + webhooks
│   ├── Settings.tsx                   # Config empresa
│   ├── SignPage.tsx                   # Página pública de assinatura
│   ├── Index.tsx                      # Redirect
│   └── NotFound.tsx                   # 404
│
└── types/
    └── document.ts                    # Todas as interfaces TypeScript
```

---

*Documento gerado automaticamente a partir do código-fonte do Valeris v1.0 — Blueprint para recriação em qualquer linguagem.*
