

# Plano: Renomear Tabelas e Colunas para Português

## Escopo da mudança

Renomear todas as 13 tabelas e suas colunas para português. Isso envolve:

1. **Migration SQL** — `ALTER TABLE ... RENAME TO` e `ALTER TABLE ... RENAME COLUMN` para cada tabela/coluna
2. **Recriar RLS policies** — precisam ser dropadas e recriadas com os novos nomes
3. **Recriar functions** — `document_belongs_to_user`, `has_permission`, `handle_new_user`, etc.
4. **Atualizar código** — 12+ arquivos no `src/` e 3 edge functions referenciam tabelas/colunas
5. **Types auto-gerado** — `src/integrations/supabase/types.ts` será regenerado automaticamente

## Mapeamento de tabelas

| Atual | Português |
|---|---|
| `documents` | `documentos` |
| `signers` | `signatarios` |
| `signatures` | `assinaturas` |
| `document_fields` | `campos_documento` |
| `validation_steps` | `etapas_validacao` |
| `audit_trail` | `trilha_auditoria` |
| `contacts` | `contatos` |
| `templates` | `modelos` |
| `profiles` | `perfis` |
| `departments` | `departamentos` |
| `api_keys` | `chaves_api` |
| `webhooks` | `webhooks` (manter — termo técnico universal) |
| `webhook_deliveries` | `entregas_webhook` |
| `user_permissions` | `permissoes_usuario` |

## Mapeamento de colunas principais (exemplo `documentos`)

| Atual | Português |
|---|---|
| `user_id` | `usuario_id` |
| `file_path` | `caminho_arquivo` |
| `signature_type` | `tipo_assinatura` |
| `created_at` | `criado_em` |
| `updated_at` | `atualizado_em` |
| `source_system` | `sistema_origem` |
| `external_ref` | `referencia_externa` |
| `name` | `nome` |
| `status` | `status` (manter) |
| `deadline` | `prazo` |
| `origin` | `origem` |

(Mesmo padrão para todas as outras tabelas — cada coluna será traduzida)

## Arquivos que precisam ser atualizados

### Código frontend (12 arquivos)
- `src/services/documentService.ts` — ~20 referências
- `src/hooks/useDocuments.ts` — ~15 referências
- `src/pages/NewDocument.tsx`, `Templates.tsx`, `Contacts.tsx`, `Settings.tsx`, `TeamUsers.tsx`, `Departments.tsx`, `DepartmentDetail.tsx`, `Integrations.tsx`, `SignPage.tsx`
- `src/components/layout/AppHeader.tsx`

### Edge functions (3 arquivos)
- `supabase/functions/api-gateway/index.ts`
- `supabase/functions/dispatch-webhook/index.ts`
- `supabase/functions/invite-user/index.ts`

### Database (1 migration grande)
- Renomear tabelas, colunas, recriar policies, recriar functions, recriar triggers

## Ordem de execução

1. Criar migration SQL com todos os RENAMEs + recriação de policies/functions
2. Atualizar todos os 15+ arquivos de código simultaneamente
3. Storage bucket `documents` permanece igual (não é tabela)

## Risco

Esta é uma mudança de alto impacto — toca praticamente todo o codebase. Mas como é MVP e não há dados em produção, o risco é aceitável. A migration será uma única transação atômica.

