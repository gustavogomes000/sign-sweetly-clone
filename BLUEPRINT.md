# Valeris Sign — Blueprint Técnico Completo para Go + Flutter + PostgreSQL

> Documento de referência para recriar o sistema **SignProof by Valeris** com backend em **Go**, frontend em **Flutter** e banco **PostgreSQL**.

---

## 1. VISÃO GERAL

**Objetivo:** Plataforma SaaS multi-tenant de assinatura eletrônica de documentos com validação biométrica (KYC), API REST para integrações externas e webhooks.

**Marca:** SignProof by Valeris (DNA do Software)

---

## 2. ARQUITETURA GERAL

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Flutter App │────▶│   Go API     │────▶│  PostgreSQL  │
│  (Web/Mobile)│     │  (REST/WS)   │     │              │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────┴───────┐
                    │ Microsserviços│
                    │  BlueTech /   │
                    │  Valeris      │
                    └──────────────┘
```

### Componentes:
1. **Flutter** — UI (Web + Mobile)
2. **Go** — API REST, autenticação, lógica de negócio, envio de emails, webhooks
3. **PostgreSQL** — Persistência com RLS (ou equivalente em Go middleware)
4. **Object Storage** — Armazenamento de PDFs (S3/MinIO)
5. **Microsserviços Externos** — BlueTech/Valeris para assinatura biométrica e KYC

---

## 3. SCHEMA DO BANCO DE DADOS (PostgreSQL)

### 3.1 Tipos/Enums

```sql
-- Hierarquia de usuários dentro de uma empresa
-- (não usar enum do PG, usar TEXT com validação no Go se preferir)
-- Valores: 'owner', 'gestor', 'user'

-- Status de documento: 'draft', 'pending', 'signed', 'cancelled', 'expired'
-- Status de signatário: 'pending', 'signed', 'refused'
-- Tipo de assinatura: 'electronic', 'digital', 'microservice'
-- Tipo de campo: 'signature', 'initials', 'date', 'text', 'checkbox', 'dropdown', 'image', 'stamp'
-- Tipo de validação: 'selfie', 'document', 'selfie_document'
-- Origem do documento: 'manual', 'api'
```

### 3.2 Tabelas

```sql
-- ═══════════════════════════════════════════
-- PROFILES (criado automaticamente via trigger no signup)
-- ═══════════════════════════════════════════
CREATE TABLE profiles (
    id UUID PRIMARY KEY,            -- mesmo ID do auth.users
    full_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    hierarchy TEXT NOT NULL DEFAULT 'user',  -- 'owner' | 'gestor' | 'user'
    department_id UUID REFERENCES departments(id),
    active BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: ao criar usuário no auth, inserir profile
-- Se não existir nenhum profile, hierarchy = 'owner', senão 'user'

-- ═══════════════════════════════════════════
-- DEPARTMENTS
-- ═══════════════════════════════════════════
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6366f1',
    owner_id UUID NOT NULL,  -- quem criou
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- USER_PERMISSIONS (19 permissões granulares)
-- ═══════════════════════════════════════════
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    permission TEXT NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, permission)
);

-- ═══════════════════════════════════════════
-- DOCUMENTS
-- ═══════════════════════════════════════════
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,          -- dono do documento
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    signature_type TEXT NOT NULL DEFAULT 'electronic',
    file_path TEXT,                  -- caminho no storage
    deadline TIMESTAMPTZ,
    origin TEXT NOT NULL DEFAULT 'manual',    -- 'manual' | 'api'
    source_system TEXT,              -- nome do sistema externo (quando via API)
    external_ref TEXT,               -- referência externa (quando via API)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- SIGNERS
-- ═══════════════════════════════════════════
CREATE TABLE signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'signer',      -- ex: 'Signatário', 'Testemunha', 'Contratante'
    sign_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'signed' | 'refused'
    signed_at TIMESTAMPTZ,
    sign_token TEXT DEFAULT gen_random_uuid()::text,  -- token único para link de assinatura
    bluetech_document_id TEXT,       -- ID no microsserviço externo
    bluetech_signatory_id TEXT,      -- ID no microsserviço externo
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- DOCUMENT_FIELDS (campos posicionados no PDF)
-- ═══════════════════════════════════════════
CREATE TABLE document_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    signer_id UUID REFERENCES signers(id),
    field_type TEXT NOT NULL DEFAULT 'signature',
    label TEXT,
    x DOUBLE PRECISION NOT NULL DEFAULT 0,
    y DOUBLE PRECISION NOT NULL DEFAULT 0,
    width DOUBLE PRECISION NOT NULL DEFAULT 200,
    height DOUBLE PRECISION NOT NULL DEFAULT 60,
    page INTEGER NOT NULL DEFAULT 1,
    required BOOLEAN NOT NULL DEFAULT true,
    value TEXT,                      -- preenchido quando assinado
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- SIGNATURES (registro da assinatura realizada)
-- ═══════════════════════════════════════════
CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signer_id UUID NOT NULL REFERENCES signers(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    field_id UUID REFERENCES document_fields(id),
    signature_type TEXT NOT NULL,    -- 'drawn' | 'typed'
    image_base64 TEXT,               -- imagem da assinatura desenhada
    typed_text TEXT,                  -- texto da assinatura tipográfica
    ip_address TEXT,
    user_agent TEXT,
    bluetech_response JSONB,         -- resposta do microsserviço
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- VALIDATION_STEPS (KYC pós-assinatura)
-- ═══════════════════════════════════════════
CREATE TABLE validation_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES signers(id),
    step_type TEXT NOT NULL,         -- 'selfie' | 'document' | 'selfie_document'
    step_order INTEGER NOT NULL DEFAULT 1,
    required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed'
    completed_at TIMESTAMPTZ,
    bluetech_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- AUDIT_TRAIL
-- ═══════════════════════════════════════════
CREATE TABLE audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    signer_id UUID REFERENCES signers(id),
    action TEXT NOT NULL,            -- 'created','sent','viewed','signature','refused','cancelled','completed','reminder'
    actor TEXT NOT NULL,             -- nome/ID de quem realizou
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- API_KEYS (autenticação da API REST)
-- ═══════════════════════════════════════════
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,          -- SHA-256 da chave
    key_prefix TEXT NOT NULL,        -- primeiros 10 chars (para exibir)
    scopes TEXT[] NOT NULL DEFAULT ARRAY['documents:read', 'documents:write'],
    active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- WEBHOOKS
-- ═══════════════════════════════════════════
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY['document.signed', 'document.completed'],
    secret TEXT,                     -- para validação X-Webhook-Secret
    active BOOLEAN NOT NULL DEFAULT true,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- WEBHOOK_DELIVERIES (log de entregas)
-- ═══════════════════════════════════════════
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id),
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    response_body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- TEMPLATES
-- ═══════════════════════════════════════════
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL DEFAULT '',
    category TEXT,
    file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.3 Functions

```sql
-- Verificar hierarquia do usuário
CREATE FUNCTION get_user_hierarchy(p_user_id UUID) RETURNS TEXT AS $$
  SELECT hierarchy FROM profiles WHERE id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Verificar permissão granular
CREATE FUNCTION has_permission(p_user_id UUID, p_permission TEXT) RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT granted FROM user_permissions WHERE user_id = p_user_id AND permission = p_permission),
    (SELECT CASE
      WHEN hierarchy IN ('owner', 'gestor') THEN true
      ELSE p_permission IN ('documents:read', 'contacts:read', 'templates:read')
    END FROM profiles WHERE id = p_user_id)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Validar API key
CREATE FUNCTION validate_api_key(p_key_hash TEXT) RETURNS TABLE(user_id UUID, scopes TEXT[]) AS $$
  SELECT ak.user_id, ak.scopes
  FROM api_keys ak
  WHERE ak.key_hash = p_key_hash
    AND ak.active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now());
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Auto-update updated_at
CREATE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers de updated_at para todas as tabelas relevantes:
-- CREATE TRIGGER ... ON documents, signers, profiles, departments, templates
```

### 3.4 Lista Completa de Permissões (19)

| Chave | Label | Grupo |
|-------|-------|-------|
| `documents:read` | Ver documentos | Documentos |
| `documents:write` | Criar/editar documentos | Documentos |
| `documents:delete` | Excluir documentos | Documentos |
| `documents:send` | Enviar para assinatura | Documentos |
| `contacts:read` | Ver contatos | Contatos |
| `contacts:write` | Criar/editar contatos | Contatos |
| `templates:read` | Ver modelos | Modelos |
| `templates:write` | Criar/editar modelos | Modelos |
| `folders:read` | Ver pastas | Pastas |
| `folders:write` | Criar/editar pastas | Pastas |
| `analytics:read` | Ver relatórios | Relatórios |
| `integrations:read` | Ver integrações | Integrações |
| `integrations:write` | Gerenciar integrações | Integrações |
| `team:read` | Ver equipe | Equipe |
| `team:write` | Gerenciar equipe | Equipe |
| `departments:read` | Ver departamentos | Departamentos |
| `departments:write` | Gerenciar departamentos | Departamentos |
| `settings:read` | Ver configurações | Configurações |
| `settings:write` | Alterar configurações | Configurações |

**Regras padrão:** Owner e Gestor têm TODAS as permissões. User básico tem apenas `documents:read`, `contacts:read`, `templates:read`.

---

## 4. AUTENTICAÇÃO E AUTORIZAÇÃO

### 4.1 Auth Flow
- **Signup:** email + senha + nome → cria registro em `auth` + trigger cria `profiles`
- **Login:** email + senha → retorna JWT
- **Super Admin:** login separado (hardcoded admin@valeris.com / admin123 — **MUDAR para produção**)
- **Sessão:** JWT token com refresh

### 4.2 Hierarquias
| Hierarquia | Descrição |
|------------|-----------|
| `owner` | Proprietário da conta. Acesso total. Primeiro usuário cadastrado. |
| `gestor` | Gerente. Acesso total exceto não pode ser removido por outro gestor. |
| `user` | Usuário comum. Acesso limitado pelas permissões configuradas. |

### 4.3 Super Admin (Plataforma)
- Rota separada `/admin`
- Gerencia empresas (tenants), planos, limites
- **Atualmente usa dados mock** — precisa ser implementado com tabela real de `companies`

---

## 5. TELAS E FUNCIONALIDADES

### 5.1 Telas Públicas

#### `/sign/:token` — Página de Assinatura (NÃO requer login)
- **Fluxo:**
  1. Carrega dados via `sign_token` (signer + document + fields + validation_steps)
  2. Exibe PDF com campos posicionados
  3. Signatário clica no campo → modal de assinatura (desenho ou digitação)
  4. Cada campo é assinado individualmente e sequencialmente
  5. Após todos os campos: fluxo de validação KYC (se configurado)
  6. Tela de conclusão
- **Componentes de KYC:** VLSelfie, VLDocumento, VLSelfieDoc (chamam microsserviço BlueTech)
- **Coordenadas:** Campos posicionados em coordenadas absolutas (x, y, width, height) sobre página PDF de 595×842 pontos
- **Paginação:** Navegação entre páginas do PDF com campos sobrepostos

#### `/login` — Login
- Dois modos: login empresa (Supabase Auth) e login admin (hardcoded)
- Tabs: "Empresa" e "Administrador"
- Cadastro (signup) com email + senha + nome

### 5.2 Telas da Empresa (requer login)

#### `/dashboard` — Painel Inicial
- 6 cards de stats: Total docs, Aguardando, Assinados, Expirados, Cancelados, Rascunhos
- 2 KPIs: Taxa de conclusão (% signed/total), Tempo médio de assinatura
- Gráfico de barras: Documentos por mês (últimos 7 meses — enviados vs assinados)
- Ações rápidas: Novo documento, Pendentes, Contatos
- Documentos recentes (últimos 5)
- **Dados reais** do banco

#### `/documents` — Lista de Documentos
- Busca por nome ou signatário
- Filtros por status: Todos, Rascunho, Aguardando, Assinados, Cancelados, Expirados
- Ordenação por data ou nome
- Modos de visualização: Lista e Grid
- Seleção múltipla com ações em lote (Reenviar, Cancelar)
- Menu de contexto: Visualizar, Reenviar, Baixar, Cancelar
- Avatares de signatários com contagem (X/Y assinaturas)

#### `/documents/new` — Novo Documento (5 etapas)

**Etapa 1 — Upload:**
- Upload de arquivo (PDF, PNG, DOC, DOCX)
- Ou seleção de template existente
- Editor de template com formatação básica
- Validação de formato e preview

**Etapa 2 — Signatários:**
- Adicionar N signatários com: Nome, Email, Telefone (opcional), Papel/Role
- Para cada signatário: configurar validações pós-assinatura (KYC)
  - Selfie
  - Foto do documento (RG/CNH)
  - Selfie com documento
- Cada validação pode ser reordenada (drag)
- Opção de ordem de assinatura

**Etapa 3 — Campos (Editor Visual):**
- Preview do PDF com pdfjs-dist
- Barra lateral com tipos de campo: Assinatura, Rubrica, Data, Texto, Checkbox, Dropdown, Imagem, Carimbo
- Cada tipo tem dimensões padrão específicas
- Drag-and-drop para posicionar campos sobre o PDF
- Cada campo é mapeado a um signatário (cores diferentes)
- Navegação entre páginas
- Campos são resize-able e movíveis
- Total de campos exibido

**Etapa 4 — Configurações:**
- Prazo de expiração (deadline)
- Mensagem personalizada para o email
- Lembretes automáticos (a cada N dias)
- Ordem de assinatura importa? (switch)
- Idioma

**Etapa 5 — Revisão:**
- Resumo completo: documento, signatários, campos, configurações
- Contagem de campos por signatário
- Validações configuradas por signatário
- Botão "Enviar para assinatura"

**Ao enviar:**
1. Upload do arquivo para Storage
2. Cria registro em `documents`
3. Cria registros em `signers` (com sign_token gerado automaticamente)
4. Cria registros em `document_fields`
5. Cria registros em `validation_steps`
6. Envia email para cada signatário via edge function/API de email
7. Redireciona para lista de documentos

#### `/documents/:id` — Detalhe do Documento
- Informações: nome, datas, tipo assinatura, status
- Preview do PDF com campos sobrepostos (colorido por status: verde=assinado, azul=pendente)
- Lista de signatários com status individual, email, telefone, papel
- Trilha de auditoria (timeline vertical)
- Ações: Copiar link, Baixar, Reenviar (se pendente), Cancelar

#### `/contacts` — Contatos
- Lista extraída automaticamente dos signatários dos documentos (agrupados por email)
- Busca por nome/email
- Exibe: nome, email, telefone, quantidade de documentos
- **Não tem CRUD próprio** — é uma view derivada

#### `/templates` — Modelos
- CRUD de templates
- Campos: nome, descrição, conteúdo (texto), categoria, arquivo PDF
- Usados na etapa 1 de criação de documento

#### `/folders` — Pastas
- Organização visual de documentos (mock atualmente)

#### `/bulk-send` — Envio em Massa
- Interface para enviar mesmo documento para múltiplos signatários

#### `/analytics` — Relatórios
- Gráficos e métricas de uso

#### `/team` — Equipe
- Lista de usuários com hierarquia, departamento, status
- Criar novo usuário (signup + definir hierarquia/departamento)
- Cards de contagem por hierarquia
- Menu de ações: Permissões, Promover/Rebaixar, Ativar/Desativar
- **Dialog de Permissões:** 19 switches organizados por grupo

#### `/departments` — Departamentos
- CRUD de departamentos (nome, descrição, cor)
- Apenas owner/gestor podem gerenciar

#### `/integrations` — Integrações
- Lista documentos recebidos via API (origin='api')
- Filtros por status
- Stats: Total recebidos, Aguardando config, Em assinatura, Concluídos
- Para cada doc via API: adicionar signatários, enviar para assinatura
- Detalhamento lateral com gestão de signatários

#### `/api-docs` — API & Webhooks
- Documentação interativa da API REST
- Gestão de chaves de API (criar, revogar)
- Gestão de webhooks (criar, ativar/desativar, remover)
- Exemplos cURL completos
- **Tabs:** Documentação, Chaves de API, Webhooks

#### `/settings` — Configurações
- Tabs: Perfil, Conta, Notificações, API
- Perfil: nome, sobrenome, email, telefone, foto
- Conta: nome da empresa, CNPJ
- Notificações: 5 toggles de preferência
- API: chave de acesso, webhook URL

### 5.3 Telas do Super Admin

#### `/admin` — Dashboard Admin
- Stats: Empresas ativas, Total usuários, Documentos (mês), Receita
- Gráfico: Uso por empresa (documentos usados vs limite)
- Lista de empresas com progress bar de uso
- Alertas: empresas suspensas, empresas próximas do limite

#### `/admin/companies` — Lista de Empresas
- CRUD de empresas (tenants)
- Campos: nome, CNPJ, email, telefone, plano, status, limites

#### `/admin/companies/:id` — Detalhe da Empresa
- Informações completas
- Lista de usuários da empresa
- Métricas de uso

#### `/admin/settings` — Configurações Admin
- Configurações globais da plataforma

---

## 6. API REST (Go Backend)

### 6.1 Autenticação
- Header: `x-api-key: sk_xxxxxxxx`
- Chave hasheada com SHA-256 e validada contra tabela `api_keys`
- Scopes: `documents:read`, `documents:write`, `*`
- Atualiza `last_used_at` a cada uso

### 6.2 Endpoints

| Método | Rota | Descrição | Scope |
|--------|------|-----------|-------|
| `POST` | `/documents` | Criar documento + signatários + enviar emails | `documents:write` |
| `GET` | `/documents` | Listar documentos (?status=&limit=&offset=) | `documents:read` |
| `GET` | `/documents/:id` | Detalhes com signatários, campos, audit trail | `documents:read` |
| `GET` | `/documents/:id/status` | Status resumido com progresso | `documents:read` |
| `POST` | `/documents/:id/cancel` | Cancelar documento | `documents:write` |
| `POST` | `/documents/:id/resend` | Reenviar emails pendentes | `documents:write` |
| `GET` | `/webhooks` | Listar webhooks | `*` |
| `POST` | `/webhooks` | Registrar webhook | `*` |
| `DELETE` | `/webhooks/:id` | Remover webhook | `*` |

### 6.3 POST /documents — Request

```json
{
  "name": "Contrato de Prestação de Serviços",
  "signature_type": "electronic",
  "deadline": "2026-03-20T23:59:59Z",
  "file_url": "https://...",
  "external_ref": "REF-001",
  "source_system": "ERP-Acme",
  "auto_send": true,
  "callback_url": "https://meusite.com/webhook",
  "signers": [
    { "name": "João Silva", "email": "joao@email.com", "role": "Contratante", "order": 1 },
    { "name": "Maria Santos", "email": "maria@email.com", "role": "Contratada", "order": 2 }
  ],
  "fields": [
    { "signer_index": 0, "type": "signature", "page": 1, "x": 100, "y": 700, "width": 200, "height": 60 }
  ]
}
```

### 6.4 POST /documents — Response (201)

```json
{
  "id": "uuid",
  "name": "Contrato...",
  "status": "pending",
  "created_at": "...",
  "signers": [
    {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@email.com",
      "sign_token": "token-unico",
      "sign_url": "https://app.com/sign/token-unico",
      "status": "pending"
    }
  ],
  "fields": [{ "id": "uuid", "type": "signature", "page": 1, "x": 100, "y": 700 }],
  "emails": [{ "email": "joao@email.com", "success": true }]
}
```

### 6.5 Fluxo Automático
1. Sistema externo → `POST /documents`
2. Go cria documento + signatários + campos
3. Emails enviados automaticamente (se `auto_send !== false`)
4. Se `callback_url` fornecida, registra como webhook
5. Signatário assina via `/sign/:token`
6. Webhook disparado em eventos

---

## 7. WEBHOOKS

### 7.1 Eventos Disponíveis
- `document.signed` — Documento totalmente assinado
- `document.completed` — Todas assinaturas + validações concluídas
- `document.cancelled` — Documento cancelado
- `signer.signed` — Um signatário assinou
- `signer.refused` — Um signatário recusou
- `*` — Todos os eventos

### 7.2 Payload do Webhook

```json
{
  "event": "document.completed",
  "document_id": "uuid",
  "document_name": "Contrato...",
  "document_status": "signed",
  "signer_id": "uuid | null",
  "data": { "total_signers": 2, "signature_type": "drawn" },
  "timestamp": "2026-03-08T14:30:00Z"
}
```

### 7.3 Headers do Webhook
```
Content-Type: application/json
X-Webhook-Secret: <secret>
X-Webhook-Event: <event_name>
```

### 7.4 Registro de Entregas
Cada tentativa de entrega é salva em `webhook_deliveries` com status_code, success, response_body.
Se falha, incrementa `failure_count` no webhook.

---

## 8. ENVIO DE EMAILS

### 8.1 Serviço
- Usa **Resend** como provedor de email
- Email formatado em HTML com branding SignProof/Valeris
- Reply-to configurável (GMAIL_USER)

### 8.2 Template do Email
- Header com gradiente verde-escuro/dourado
- Saudação personalizada
- Nome do documento em destaque
- Mensagem personalizada (se fornecida)
- Botão CTA "✍️ Assinar documento" com link `/sign/:token`
- Link alternativo em texto
- Footer com aviso automático

### 8.3 Quando Emails São Enviados
1. Ao criar documento (etapa 5 / API POST)
2. Ao reenviar lembretes (manual ou API POST /resend)

---

## 9. MICROSSERVIÇOS EXTERNOS (BlueTech/Valeris)

### 9.1 URLs dos Serviços
| Serviço | Variável | Endpoint |
|---------|----------|----------|
| Gateway | `BLUETECH_GATEWAY_URL` | `/api/v1/dev/bootstrap`, `/api/v1/tokens` |
| Assinatura | `BLUETECH_ASSINATURA_URL` | `/api/v1/assinatura/desenho`, `/api/v1/assinatura/tipografica` |
| Documento KYC | `BLUETECH_DOCUMENTO_URL` | `/api/v1/documento/upload` |
| Selfie+Doc | `BLUETECH_SELFIE_DOC_URL` | `/api/v1/selfie-documento/capturar` |
| Validador WS | `BLUETECH_VALIDATOR_WS_URL` | WebSocket para validação em tempo real |

### 9.2 Autenticação
- Header: `x-service-key: <BLUETECH_SERVICE_KEY>`

### 9.3 Endpoints de Assinatura

**Assinatura Desenhada:**
```
POST /api/v1/assinatura/desenho
Body: { signatoryId, documentId, imageBase64, userAgent }
```

**Assinatura Tipográfica:**
```
POST /api/v1/assinatura/tipografica
Body: { signatoryId, documentId, text, userAgent }
```

### 9.4 Endpoints de KYC

**Upload de Documento:**
```
POST /api/v1/documento/upload
Body: { signatoryId, documentId, type: 'rg'|'cnh'|'cnh_digital'|'passport', side: 'front'|'back'|'single', imageBase64, userAgent }
```

**Selfie com Documento:**
```
POST /api/v1/selfie-documento/capturar
Body: { signatoryId, documentId, imageBase64, userAgent }
```

### 9.5 Componentes Flutter equivalentes
- `VLAssinatura` → Captura de assinatura (desenho/digitação)
- `VLSelfie` → Captura de selfie para reconhecimento facial
- `VLDocumento` → Captura de foto de documento (RG/CNH)
- `VLSelfieDoc` → Captura de selfie segurando documento

---

## 10. STORAGE DE ARQUIVOS

### 10.1 Bucket
- Nome: `documents`
- Público: Sim (URLs acessíveis sem auth)
- Caminho: `{user_id}/{uuid}.{ext}`

### 10.2 Formatos Aceitos
- PDF, PNG, DOC, DOCX

### 10.3 URL Pública
```
{STORAGE_URL}/storage/v1/object/public/documents/{file_path}
```

---

## 11. REGRAS DE NEGÓCIO

### 11.1 Criação de Documento
- Validar formato do arquivo
- Nome do documento obrigatório
- Pelo menos 1 signatário com nome e email
- Campos são opcionais (documento pode ser assinado sem campos posicionados)

### 11.2 Fluxo de Assinatura
1. Signatário acessa `/sign/:token`
2. Token validado contra tabela `signers.sign_token`
3. Se signer.status === 'signed' → tela de conclusão
4. Exibe PDF com campos posicionados para este signatário
5. Signatário clica no campo → modal de assinatura
6. Pode desenhar (canvas) ou digitar (mínimo 3 caracteres)
7. Assinatura salva em `signatures` + atualiza `signers.status` + atualiza `document_fields.value`
8. Navega automaticamente para próximo campo pendente
9. Após todos os campos:
   - Se tem validation_steps pendentes → fluxo KYC
   - Se não → tela de conclusão
10. Verifica se TODOS os signers do documento assinaram → atualiza `documents.status = 'signed'`
11. Dispara webhook `signer.signed` e (se todos) `document.completed`

### 11.3 Validação KYC Pós-Assinatura
- Configurável por signatário individualmente
- 3 tipos: selfie, document_photo, selfie_with_document
- Ordem personalizável
- Cada etapa chama microsserviço externo
- Resultado salvo em `validation_steps.bluetech_response`

### 11.4 Cancelamento
- Apenas documentos com status `pending` ou `draft`
- Registra na audit trail
- Dispara webhook `document.cancelled`

### 11.5 Reenvio
- Reenvia email apenas para signatários com status `pending`
- Registra na audit trail como `reminder`

### 11.6 Contatos
- Derivados automaticamente da tabela `signers`
- Agrupados por email
- Contagem de documentos por contato

### 11.7 Dashboard Stats
- Calculados em tempo real a partir da tabela `documents`
- Taxa de conclusão: (signed / total) × 100
- Dados mensais: últimos 7 meses

---

## 12. SEGURANÇA

### 12.1 API Keys
- Geradas no client com 32 bytes random → prefixo `sk_`
- Armazenadas como SHA-256 hash no banco
- Prefix exibido para identificação (primeiros 10 chars)
- Suportam expiração
- Escopos: `documents:read`, `documents:write`, `*`

### 12.2 Isolamento de Dados
- Cada query filtra por `user_id`
- Documentos de assinatura acessíveis via `sign_token` (sem auth)
- Audit trail insert público (para registrar ações de signatários)

### 12.3 Permissões
- Verificadas via `has_permission(user_id, permission)` no backend
- Owner/Gestor: acesso total por padrão
- User: permissões básicas por padrão, customizáveis

---

## 13. VARIÁVEIS DE AMBIENTE / SECRETS

| Secret | Descrição |
|--------|-----------|
| `BLUETECH_GATEWAY_URL` | URL do gateway BlueTech |
| `BLUETECH_ASSINATURA_URL` | URL do serviço de assinatura |
| `BLUETECH_DOCUMENTO_URL` | URL do serviço de documento KYC |
| `BLUETECH_SELFIE_DOC_URL` | URL do serviço selfie+documento |
| `BLUETECH_VALIDATOR_WS_URL` | WebSocket do validador |
| `BLUETECH_SERVICE_KEY` | Chave de autenticação dos microsserviços |
| `RESEND_API_KEY` | API key do Resend (envio de email) |
| `GMAIL_USER` | Email para reply-to nos emails |
| `GMAIL_APP_PASSWORD` | Senha de app do Gmail (não usado atualmente) |
| `VITE_VALERIS_API_KEY` | API key do Valeris para componentes frontend |
| `DATABASE_URL` | URL de conexão PostgreSQL |

---

## 14. LAYOUT E NAVEGAÇÃO

### 14.1 Sidebar (Empresa)
- Logo SignProof
- Links: Dashboard, Documentos, Contatos, Modelos, Pastas, Envio em massa, Relatórios, Equipe, Departamentos, Integrações, API & Docs, Configurações
- Botão de logout
- Collapsible

### 14.2 Sidebar (Admin)
- Logo SignProof + badge "Admin"
- Links: Dashboard, Empresas, Configurações
- Botão de logout

### 14.3 Header
- Título da página + subtítulo
- Ações contextuais (botões à direita)

---

## 15. DESIGN SYSTEM

### 15.1 Cores (HSL)
- Primary: verde-escuro (163° 40% 25%)
- Accent: dourado/âmbar
- Success: verde
- Warning: amarelo/laranja
- Destructive: vermelho
- Info: azul
- Background: verde muito claro
- Card: branco com bordas sutis

### 15.2 Tipografia
- Display/Títulos: Rajdhani (font-game)
- Body: Nunito Sans (font-body)
- Mono: JetBrains Mono

### 15.3 Componentes
- Cards com hover elevation
- Badges coloridos por status
- Modais para formulários
- Toasts para feedback
- Progress bars
- Tabelas com ordenação
- Dropdowns com ações
- Switches para permissões
- Stepper visual (5 etapas)

### 15.4 Status Badges
| Status | Cor | Label |
|--------|-----|-------|
| draft | cinza | Rascunho |
| pending | amarelo | Aguardando |
| signed | verde | Assinado |
| cancelled | vermelho | Cancelado |
| expired | laranja | Expirado |

---

## 16. FLUXO DE DADOS VISUAL (Editor de Campos)

### Coordenadas
- Base PDF: 595×842 pontos (A4)
- Campos posicionados com coordenadas absolutas (x, y, width, height)
- Renderização: percentual relativo ao container
  - `left: (x / 595) × 100%`
  - `top: (y / 842) × 100%`
  - `width: (width / 595) × 100%`
  - `height: (height / 842) × 100%`

### Tipos de Campo com Dimensões Padrão
| Tipo | Largura | Altura |
|------|---------|--------|
| signature | 200 | 60 |
| initials | 80 | 40 |
| date | 140 | 30 |
| text | 180 | 30 |
| checkbox | 24 | 24 |
| dropdown | 180 | 30 |
| image | 100 | 100 |
| stamp | 120 | 120 |

### Cores dos Signatários (Editor)
```
Signatário 1: Azul (#3B82F6)
Signatário 2: Verde (#10B981)
Signatário 3: Roxo (#8B5CF6)
Signatário 4: Laranja (#F59E0B)
Signatário 5: Rosa (#EC4899)
Signatário 6+: Cinza (#6B7280)
```

---

## 17. CANVAS DE ASSINATURA (SignPage)

### Implementação
- Canvas HTML com resolução 2× (retina)
- Stroke: cor escura, lineWidth 2, lineCap/lineJoin round
- Exporta como PNG base64 via `canvas.toDataURL('image/png')`
- Assinatura tipográfica: mínimo 3 caracteres
- Modal com tabs: Desenhar / Digitar

---

## 18. MULTI-TENANCY (Super Admin)

### Modelo Atual (Mock)
- Empresas hardcoded no AuthContext
- Campos: id, name, cnpj, email, phone, plan, status, maxUsers, maxDocumentsMonth, documentsUsed, usersCount

### Para Produção (Go)
Criar tabela `companies`:
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    email TEXT NOT NULL,
    phone TEXT,
    logo TEXT,
    plan TEXT NOT NULL DEFAULT 'starter',  -- 'starter' | 'professional' | 'enterprise'
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'suspended'
    max_users INTEGER NOT NULL DEFAULT 5,
    max_documents_month INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar company_id ao profiles:
ALTER TABLE profiles ADD COLUMN company_id UUID REFERENCES companies(id);

-- Adicionar company_id ao documents:
ALTER TABLE documents ADD COLUMN company_id UUID REFERENCES companies(id);
```

Planos:
| Plano | Max Usuários | Max Docs/Mês |
|-------|-------------|--------------|
| starter | 5 | 100 |
| professional | 15-20 | 300-500 |
| enterprise | 50+ | 1000+ |

---

## 19. CHECKLIST DE IMPLEMENTAÇÃO

### Backend (Go)
- [ ] Auth: signup, login, JWT, refresh tokens
- [ ] Middleware: auth, permissions, rate limiting
- [ ] CRUD: documents, signers, fields, validation_steps, audit_trail
- [ ] Storage: upload/download de arquivos (S3/MinIO)
- [ ] API REST: todos os endpoints da seção 6
- [ ] Webhook dispatcher: fila de entrega com retry
- [ ] Email sender: integração Resend ou SMTP
- [ ] API key management: geração, hash, validação
- [ ] Microsserviço proxy: chamadas ao BlueTech/Valeris
- [ ] Super Admin: CRUD de companies + usuários
- [ ] Trigger auto-profile: ao signup, criar profile

### Frontend (Flutter)
- [ ] Auth: login, signup, logout, session management
- [ ] Router: rotas protegidas por role
- [ ] Dashboard com gráficos
- [ ] Lista de documentos com filtros e busca
- [ ] Criação de documento (5 etapas com stepper)
- [ ] Editor visual de campos (drag-and-drop sobre PDF)
- [ ] Visualizador de PDF com campos sobrepostos
- [ ] Página pública de assinatura (`/sign/:token`)
- [ ] Canvas de assinatura (desenho + digitação)
- [ ] Fluxo de validação KYC (câmera)
- [ ] Gestão de equipe com permissões
- [ ] API docs viewer
- [ ] Webhooks management
- [ ] Super Admin screens

---

*Gerado em 2026-03-09 como referência completa para recriação do sistema.*
