
-- ============================================================
-- MIGRATION: Renomear todas as tabelas e colunas para Português
-- ============================================================

-- 1. Drop ALL RLS policies (they reference table/column names)

-- api_keys
DROP POLICY IF EXISTS "Users can manage their own API keys" ON public.api_keys;

-- audit_trail
DROP POLICY IF EXISTS "Document owners can view audit trail" ON public.audit_trail;
DROP POLICY IF EXISTS "Public can insert audit entries" ON public.audit_trail;
DROP POLICY IF EXISTS "Public can view audit trail by signer token" ON public.audit_trail;

-- contacts
DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.contacts;

-- departments
DROP POLICY IF EXISTS "All users can view departments" ON public.departments;
DROP POLICY IF EXISTS "Owners and gestors can manage departments" ON public.departments;

-- document_fields
DROP POLICY IF EXISTS "Document owners can manage fields" ON public.document_fields;
DROP POLICY IF EXISTS "Public can view fields by signer token" ON public.document_fields;
DROP POLICY IF EXISTS "Signers can update fields by token" ON public.document_fields;

-- documents
DROP POLICY IF EXISTS "Public can view documents via signer token" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;

-- profiles
DROP POLICY IF EXISTS "Owners and gestors can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Owners and gestors can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles in their org" ON public.profiles;

-- signatures
DROP POLICY IF EXISTS "Document owners can view signatures" ON public.signatures;
DROP POLICY IF EXISTS "Public can insert signatures" ON public.signatures;
DROP POLICY IF EXISTS "Public can view signatures" ON public.signatures;

-- signers
DROP POLICY IF EXISTS "Document owners can create signers" ON public.signers;
DROP POLICY IF EXISTS "Document owners can delete signers" ON public.signers;
DROP POLICY IF EXISTS "Document owners can update signers" ON public.signers;
DROP POLICY IF EXISTS "Document owners can view signers" ON public.signers;
DROP POLICY IF EXISTS "Signers can update by token" ON public.signers;
DROP POLICY IF EXISTS "Signers can view by token" ON public.signers;

-- templates
DROP POLICY IF EXISTS "Users can manage their own templates" ON public.templates;

-- user_permissions
DROP POLICY IF EXISTS "Owners and gestors can manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

-- validation_steps
DROP POLICY IF EXISTS "Document owners can manage validation steps" ON public.validation_steps;
DROP POLICY IF EXISTS "Public can insert validation steps" ON public.validation_steps;
DROP POLICY IF EXISTS "Public can update validation steps" ON public.validation_steps;
DROP POLICY IF EXISTS "Public can view validation steps" ON public.validation_steps;

-- webhook_deliveries
DROP POLICY IF EXISTS "Users can view their webhook deliveries" ON public.webhook_deliveries;

-- webhooks
DROP POLICY IF EXISTS "Users can manage their own webhooks" ON public.webhooks;

-- 2. Drop functions that reference old table/column names
DROP FUNCTION IF EXISTS public.get_user_hierarchy(uuid);
DROP FUNCTION IF EXISTS public.validate_api_key(text);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.document_has_signer_token(uuid);
DROP FUNCTION IF EXISTS public.document_belongs_to_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.signer_has_token(uuid);

-- 3. Rename tables
ALTER TABLE public.documents RENAME TO documentos;
ALTER TABLE public.signers RENAME TO signatarios;
ALTER TABLE public.signatures RENAME TO assinaturas;
ALTER TABLE public.document_fields RENAME TO campos_documento;
ALTER TABLE public.validation_steps RENAME TO etapas_validacao;
ALTER TABLE public.audit_trail RENAME TO trilha_auditoria;
ALTER TABLE public.contacts RENAME TO contatos;
ALTER TABLE public.templates RENAME TO modelos;
ALTER TABLE public.profiles RENAME TO perfis;
ALTER TABLE public.departments RENAME TO departamentos;
ALTER TABLE public.api_keys RENAME TO chaves_api;
ALTER TABLE public.webhook_deliveries RENAME TO entregas_webhook;
ALTER TABLE public.user_permissions RENAME TO permissoes_usuario;

-- 4. Rename columns

-- documentos
ALTER TABLE public.documentos RENAME COLUMN user_id TO usuario_id;
ALTER TABLE public.documentos RENAME COLUMN name TO nome;
ALTER TABLE public.documentos RENAME COLUMN file_path TO caminho_arquivo;
ALTER TABLE public.documentos RENAME COLUMN signature_type TO tipo_assinatura;
ALTER TABLE public.documentos RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.documentos RENAME COLUMN updated_at TO atualizado_em;
ALTER TABLE public.documentos RENAME COLUMN deadline TO prazo;
ALTER TABLE public.documentos RENAME COLUMN origin TO origem;
ALTER TABLE public.documentos RENAME COLUMN source_system TO sistema_origem;
ALTER TABLE public.documentos RENAME COLUMN external_ref TO referencia_externa;

-- signatarios
ALTER TABLE public.signatarios RENAME COLUMN document_id TO documento_id;
ALTER TABLE public.signatarios RENAME COLUMN name TO nome;
ALTER TABLE public.signatarios RENAME COLUMN phone TO telefone;
ALTER TABLE public.signatarios RENAME COLUMN role TO funcao;
ALTER TABLE public.signatarios RENAME COLUMN sign_order TO ordem_assinatura;
ALTER TABLE public.signatarios RENAME COLUMN signed_at TO assinado_em;
ALTER TABLE public.signatarios RENAME COLUMN sign_token TO token_assinatura;
ALTER TABLE public.signatarios RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.signatarios RENAME COLUMN updated_at TO atualizado_em;

-- assinaturas
ALTER TABLE public.assinaturas RENAME COLUMN signer_id TO signatario_id;
ALTER TABLE public.assinaturas RENAME COLUMN document_id TO documento_id;
ALTER TABLE public.assinaturas RENAME COLUMN field_id TO campo_id;
ALTER TABLE public.assinaturas RENAME COLUMN signature_type TO tipo_assinatura;
ALTER TABLE public.assinaturas RENAME COLUMN image_base64 TO imagem_base64;
ALTER TABLE public.assinaturas RENAME COLUMN typed_text TO texto_digitado;
ALTER TABLE public.assinaturas RENAME COLUMN ip_address TO endereco_ip;
ALTER TABLE public.assinaturas RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.assinaturas RENAME COLUMN bluetech_response TO resposta_externa;

-- campos_documento
ALTER TABLE public.campos_documento RENAME COLUMN document_id TO documento_id;
ALTER TABLE public.campos_documento RENAME COLUMN signer_id TO signatario_id;
ALTER TABLE public.campos_documento RENAME COLUMN field_type TO tipo_campo;
ALTER TABLE public.campos_documento RENAME COLUMN label TO rotulo;
ALTER TABLE public.campos_documento RENAME COLUMN page TO pagina;
ALTER TABLE public.campos_documento RENAME COLUMN required TO obrigatorio;
ALTER TABLE public.campos_documento RENAME COLUMN value TO valor;
ALTER TABLE public.campos_documento RENAME COLUMN created_at TO criado_em;

-- etapas_validacao
ALTER TABLE public.etapas_validacao RENAME COLUMN document_id TO documento_id;
ALTER TABLE public.etapas_validacao RENAME COLUMN signer_id TO signatario_id;
ALTER TABLE public.etapas_validacao RENAME COLUMN step_type TO tipo_etapa;
ALTER TABLE public.etapas_validacao RENAME COLUMN step_order TO ordem_etapa;
ALTER TABLE public.etapas_validacao RENAME COLUMN required TO obrigatorio;
ALTER TABLE public.etapas_validacao RENAME COLUMN completed_at TO concluido_em;
ALTER TABLE public.etapas_validacao RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.etapas_validacao RENAME COLUMN bluetech_response TO resposta_externa;

-- trilha_auditoria
ALTER TABLE public.trilha_auditoria RENAME COLUMN document_id TO documento_id;
ALTER TABLE public.trilha_auditoria RENAME COLUMN signer_id TO signatario_id;
ALTER TABLE public.trilha_auditoria RENAME COLUMN action TO acao;
ALTER TABLE public.trilha_auditoria RENAME COLUMN actor TO ator;
ALTER TABLE public.trilha_auditoria RENAME COLUMN details TO detalhes;
ALTER TABLE public.trilha_auditoria RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.trilha_auditoria RENAME COLUMN ip_address TO endereco_ip;

-- contatos
ALTER TABLE public.contatos RENAME COLUMN user_id TO usuario_id;
ALTER TABLE public.contatos RENAME COLUMN name TO nome;
ALTER TABLE public.contatos RENAME COLUMN phone TO telefone;
ALTER TABLE public.contatos RENAME COLUMN company TO empresa;
ALTER TABLE public.contatos RENAME COLUMN role TO funcao;
ALTER TABLE public.contatos RENAME COLUMN notes TO observacoes;
ALTER TABLE public.contatos RENAME COLUMN default_validations TO validacoes_padrao;
ALTER TABLE public.contatos RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.contatos RENAME COLUMN updated_at TO atualizado_em;

-- modelos
ALTER TABLE public.modelos RENAME COLUMN user_id TO usuario_id;
ALTER TABLE public.modelos RENAME COLUMN name TO nome;
ALTER TABLE public.modelos RENAME COLUMN description TO descricao;
ALTER TABLE public.modelos RENAME COLUMN content TO conteudo;
ALTER TABLE public.modelos RENAME COLUMN category TO categoria;
ALTER TABLE public.modelos RENAME COLUMN file_path TO caminho_arquivo;
ALTER TABLE public.modelos RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.modelos RENAME COLUMN updated_at TO atualizado_em;

-- perfis
ALTER TABLE public.perfis RENAME COLUMN full_name TO nome_completo;
ALTER TABLE public.perfis RENAME COLUMN hierarchy TO hierarquia;
ALTER TABLE public.perfis RENAME COLUMN active TO ativo;
ALTER TABLE public.perfis RENAME COLUMN department_id TO departamento_id;
ALTER TABLE public.perfis RENAME COLUMN must_change_password TO trocar_senha;
ALTER TABLE public.perfis RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.perfis RENAME COLUMN updated_at TO atualizado_em;

-- departamentos
ALTER TABLE public.departamentos RENAME COLUMN name TO nome;
ALTER TABLE public.departamentos RENAME COLUMN description TO descricao;
ALTER TABLE public.departamentos RENAME COLUMN color TO cor;
ALTER TABLE public.departamentos RENAME COLUMN owner_id TO proprietario_id;
ALTER TABLE public.departamentos RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.departamentos RENAME COLUMN updated_at TO atualizado_em;

-- chaves_api
ALTER TABLE public.chaves_api RENAME COLUMN user_id TO usuario_id;
ALTER TABLE public.chaves_api RENAME COLUMN name TO nome;
ALTER TABLE public.chaves_api RENAME COLUMN key_hash TO hash_chave;
ALTER TABLE public.chaves_api RENAME COLUMN key_prefix TO prefixo_chave;
ALTER TABLE public.chaves_api RENAME COLUMN scopes TO escopos;
ALTER TABLE public.chaves_api RENAME COLUMN expires_at TO expira_em;
ALTER TABLE public.chaves_api RENAME COLUMN created_at TO criado_em;
ALTER TABLE public.chaves_api RENAME COLUMN last_used_at TO ultimo_uso_em;
ALTER TABLE public.chaves_api RENAME COLUMN active TO ativo;

-- webhooks (table name stays, rename columns)
ALTER TABLE public.webhooks RENAME COLUMN user_id TO usuario_id;
ALTER TABLE public.webhooks RENAME COLUMN events TO eventos;
ALTER TABLE public.webhooks RENAME COLUMN secret TO segredo;
ALTER TABLE public.webhooks RENAME COLUMN active TO ativo;
ALTER TABLE public.webhooks RENAME COLUMN failure_count TO contagem_falhas;
ALTER TABLE public.webhooks RENAME COLUMN last_triggered_at TO ultimo_disparo_em;
ALTER TABLE public.webhooks RENAME COLUMN created_at TO criado_em;

-- entregas_webhook
ALTER TABLE public.entregas_webhook RENAME COLUMN event TO evento;
ALTER TABLE public.entregas_webhook RENAME COLUMN status_code TO codigo_status;
ALTER TABLE public.entregas_webhook RENAME COLUMN success TO sucesso;
ALTER TABLE public.entregas_webhook RENAME COLUMN response_body TO corpo_resposta;
ALTER TABLE public.entregas_webhook RENAME COLUMN created_at TO criado_em;

-- permissoes_usuario
ALTER TABLE public.permissoes_usuario RENAME COLUMN user_id TO usuario_id;
ALTER TABLE public.permissoes_usuario RENAME COLUMN permission TO permissao;
ALTER TABLE public.permissoes_usuario RENAME COLUMN granted TO concedida;
ALTER TABLE public.permissoes_usuario RENAME COLUMN granted_by TO concedida_por;
ALTER TABLE public.permissoes_usuario RENAME COLUMN created_at TO criado_em;

-- 5. Recreate functions with new table/column names

CREATE OR REPLACE FUNCTION public.get_user_hierarchy(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT hierarquia FROM public.perfis WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text)
RETURNS TABLE(user_id uuid, scopes text[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ak.usuario_id, ak.escopos
  FROM public.chaves_api ak
  WHERE ak.hash_chave = p_key_hash
    AND ak.ativo = true
    AND (ak.expira_em IS NULL OR ak.expira_em > now());
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT concedida FROM public.permissoes_usuario WHERE usuario_id = p_user_id AND permissao = p_permission),
    (SELECT CASE
      WHEN hierarquia IN ('owner', 'gestor') THEN true
      ELSE p_permission IN ('documents:read', 'contacts:read', 'templates:read')
    END FROM public.perfis WHERE id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome_completo, email, hierarquia)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.perfis LIMIT 1) THEN 'owner' ELSE 'user' END
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.document_has_signer_token(p_document_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signatarios
    WHERE documento_id = p_document_id AND token_assinatura IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.document_belongs_to_user(p_document_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documentos
    WHERE id = p_document_id AND usuario_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.signer_has_token(p_signer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.signatarios
    WHERE id = p_signer_id AND token_assinatura IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- 6. Recreate all RLS policies

-- chaves_api
CREATE POLICY "Usuarios gerenciam suas chaves" ON public.chaves_api
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- trilha_auditoria
CREATE POLICY "Donos podem ver trilha" ON public.trilha_auditoria
  FOR SELECT TO authenticated
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Publico pode inserir trilha" ON public.trilha_auditoria
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Publico pode ver trilha por token" ON public.trilha_auditoria
  FOR SELECT TO anon, authenticated
  USING (document_has_signer_token(documento_id));

-- contatos
CREATE POLICY "Usuarios gerenciam contatos" ON public.contatos
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- departamentos
CREATE POLICY "Todos podem ver departamentos" ON public.departamentos
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Owners e gestores gerenciam departamentos" ON public.departamentos
  FOR ALL TO public
  USING (get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text]))
  WITH CHECK (get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text]));

-- campos_documento
CREATE POLICY "Donos gerenciam campos" ON public.campos_documento
  FOR ALL TO authenticated
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Publico ve campos por token" ON public.campos_documento
  FOR SELECT TO anon, authenticated
  USING (signer_has_token(signatario_id));

CREATE POLICY "Signatarios atualizam campos" ON public.campos_documento
  FOR UPDATE TO anon, authenticated
  USING (signer_has_token(signatario_id));

-- documentos
CREATE POLICY "Publico ve documentos por token" ON public.documentos
  FOR SELECT TO anon, authenticated
  USING (document_has_signer_token(id));

CREATE POLICY "Usuarios criam documentos" ON public.documentos
  FOR INSERT TO public
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuarios deletam seus documentos" ON public.documentos
  FOR DELETE TO public
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios atualizam seus documentos" ON public.documentos
  FOR UPDATE TO public
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios veem seus documentos" ON public.documentos
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

-- perfis
CREATE POLICY "Owners e gestores inserem perfis" ON public.perfis
  FOR INSERT TO public
  WITH CHECK ((get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text])) OR (id = auth.uid()));

CREATE POLICY "Owners e gestores atualizam perfis" ON public.perfis
  FOR UPDATE TO public
  USING (get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text]));

CREATE POLICY "Usuarios atualizam seu perfil" ON public.perfis
  FOR UPDATE TO public
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Todos veem perfis" ON public.perfis
  FOR SELECT TO public
  USING (true);

-- assinaturas
CREATE POLICY "Donos veem assinaturas" ON public.assinaturas
  FOR SELECT TO public
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Publico insere assinaturas" ON public.assinaturas
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Publico ve assinaturas" ON public.assinaturas
  FOR SELECT TO public
  USING (true);

-- signatarios
CREATE POLICY "Donos criam signatarios" ON public.signatarios
  FOR INSERT TO public
  WITH CHECK (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Donos deletam signatarios" ON public.signatarios
  FOR DELETE TO public
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Donos atualizam signatarios" ON public.signatarios
  FOR UPDATE TO authenticated
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Donos veem signatarios" ON public.signatarios
  FOR SELECT TO authenticated
  USING (document_belongs_to_user(documento_id, auth.uid()));

CREATE POLICY "Signatarios atualizam por token" ON public.signatarios
  FOR UPDATE TO anon, authenticated
  USING (token_assinatura IS NOT NULL);

CREATE POLICY "Signatarios veem por token" ON public.signatarios
  FOR SELECT TO anon, authenticated
  USING (token_assinatura IS NOT NULL);

-- modelos
CREATE POLICY "Usuarios gerenciam modelos" ON public.modelos
  FOR ALL TO public
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- permissoes_usuario
CREATE POLICY "Owners e gestores gerenciam permissoes" ON public.permissoes_usuario
  FOR ALL TO public
  USING (get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text]))
  WITH CHECK (get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text]));

CREATE POLICY "Usuarios veem suas permissoes" ON public.permissoes_usuario
  FOR SELECT TO public
  USING ((usuario_id = auth.uid()) OR (get_user_hierarchy(auth.uid()) = ANY (ARRAY['owner'::text, 'gestor'::text])));

-- etapas_validacao
CREATE POLICY "Donos gerenciam etapas" ON public.etapas_validacao
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM documentos
    WHERE documentos.id = etapas_validacao.documento_id AND documentos.usuario_id = auth.uid()
  ));

CREATE POLICY "Publico insere etapas" ON public.etapas_validacao
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Publico atualiza etapas" ON public.etapas_validacao
  FOR UPDATE TO public
  USING (true);

CREATE POLICY "Publico ve etapas" ON public.etapas_validacao
  FOR SELECT TO public
  USING (true);

-- entregas_webhook
CREATE POLICY "Usuarios veem entregas webhook" ON public.entregas_webhook
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM webhooks w
    WHERE w.id = entregas_webhook.webhook_id AND w.usuario_id = auth.uid()
  ));

-- webhooks
CREATE POLICY "Usuarios gerenciam webhooks" ON public.webhooks
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
