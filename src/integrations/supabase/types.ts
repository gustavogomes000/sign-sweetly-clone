export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assinaturas: {
        Row: {
          campo_id: string | null
          criado_em: string
          documento_id: string
          endereco_ip: string | null
          id: string
          imagem_base64: string | null
          resposta_externa: Json | null
          signatario_id: string
          texto_digitado: string | null
          tipo_assinatura: string
          user_agent: string | null
        }
        Insert: {
          campo_id?: string | null
          criado_em?: string
          documento_id: string
          endereco_ip?: string | null
          id?: string
          imagem_base64?: string | null
          resposta_externa?: Json | null
          signatario_id: string
          texto_digitado?: string | null
          tipo_assinatura: string
          user_agent?: string | null
        }
        Update: {
          campo_id?: string | null
          criado_em?: string
          documento_id?: string
          endereco_ip?: string | null
          id?: string
          imagem_base64?: string | null
          resposta_externa?: Json | null
          signatario_id?: string
          texto_digitado?: string | null
          tipo_assinatura?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_document_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_field_id_fkey"
            columns: ["campo_id"]
            isOneToOne: false
            referencedRelation: "campos_documento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_signer_id_fkey"
            columns: ["signatario_id"]
            isOneToOne: false
            referencedRelation: "signatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_documento: {
        Row: {
          criado_em: string
          documento_id: string
          height: number
          id: string
          obrigatorio: boolean
          pagina: number
          rotulo: string | null
          signatario_id: string | null
          tipo_campo: string
          valor: string | null
          width: number
          x: number
          y: number
        }
        Insert: {
          criado_em?: string
          documento_id: string
          height?: number
          id?: string
          obrigatorio?: boolean
          pagina?: number
          rotulo?: string | null
          signatario_id?: string | null
          tipo_campo?: string
          valor?: string | null
          width?: number
          x?: number
          y?: number
        }
        Update: {
          criado_em?: string
          documento_id?: string
          height?: number
          id?: string
          obrigatorio?: boolean
          pagina?: number
          rotulo?: string | null
          signatario_id?: string | null
          tipo_campo?: string
          valor?: string | null
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_fields_document_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_fields_signer_id_fkey"
            columns: ["signatario_id"]
            isOneToOne: false
            referencedRelation: "signatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      chaves_api: {
        Row: {
          ativo: boolean
          criado_em: string
          escopos: string[]
          expira_em: string | null
          hash_chave: string
          id: string
          nome: string
          prefixo_chave: string
          ultimo_uso_em: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          escopos?: string[]
          expira_em?: string | null
          hash_chave: string
          id?: string
          nome: string
          prefixo_chave: string
          ultimo_uso_em?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          escopos?: string[]
          expira_em?: string | null
          hash_chave?: string
          id?: string
          nome?: string
          prefixo_chave?: string
          ultimo_uso_em?: string | null
          usuario_id?: string
        }
        Relationships: []
      }
      contatos: {
        Row: {
          atualizado_em: string
          bluepoint_id: number | null
          criado_em: string
          email: string
          empresa: string | null
          funcao: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          usuario_id: string
          validacoes_padrao: string[]
        }
        Insert: {
          atualizado_em?: string
          bluepoint_id?: number | null
          criado_em?: string
          email: string
          empresa?: string | null
          funcao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          usuario_id: string
          validacoes_padrao?: string[]
        }
        Update: {
          atualizado_em?: string
          bluepoint_id?: number | null
          criado_em?: string
          email?: string
          empresa?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          usuario_id?: string
          validacoes_padrao?: string[]
        }
        Relationships: []
      }
      departamentos: {
        Row: {
          atualizado_em: string
          cor: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          proprietario_id: string
        }
        Insert: {
          atualizado_em?: string
          cor?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          proprietario_id: string
        }
        Update: {
          atualizado_em?: string
          cor?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          proprietario_id?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          atualizado_em: string
          caminho_arquivo: string | null
          caminho_pdf_dossie: string | null
          caminho_pdf_final: string | null
          criado_em: string
          hash_pdf_final: string | null
          hash_pdf_original: string | null
          id: string
          nome: string
          origem: string
          prazo: string | null
          referencia_externa: string | null
          sistema_origem: string | null
          status: string
          tipo_assinatura: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          caminho_arquivo?: string | null
          caminho_pdf_dossie?: string | null
          caminho_pdf_final?: string | null
          criado_em?: string
          hash_pdf_final?: string | null
          hash_pdf_original?: string | null
          id?: string
          nome: string
          origem?: string
          prazo?: string | null
          referencia_externa?: string | null
          sistema_origem?: string | null
          status?: string
          tipo_assinatura?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          caminho_arquivo?: string | null
          caminho_pdf_dossie?: string | null
          caminho_pdf_final?: string | null
          criado_em?: string
          hash_pdf_final?: string | null
          hash_pdf_original?: string | null
          id?: string
          nome?: string
          origem?: string
          prazo?: string | null
          referencia_externa?: string | null
          sistema_origem?: string | null
          status?: string
          tipo_assinatura?: string
          usuario_id?: string
        }
        Relationships: []
      }
      entregas_webhook: {
        Row: {
          codigo_status: number | null
          corpo_resposta: string | null
          criado_em: string
          evento: string
          id: string
          payload: Json
          sucesso: boolean
          webhook_id: string
        }
        Insert: {
          codigo_status?: number | null
          corpo_resposta?: string | null
          criado_em?: string
          evento: string
          id?: string
          payload: Json
          sucesso?: boolean
          webhook_id: string
        }
        Update: {
          codigo_status?: number | null
          corpo_resposta?: string | null
          criado_em?: string
          evento?: string
          id?: string
          payload?: Json
          sucesso?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_validacao: {
        Row: {
          concluido_em: string | null
          criado_em: string
          documento_id: string
          id: string
          obrigatorio: boolean
          ordem_etapa: number
          resposta_externa: Json | null
          signatario_id: string
          status: string
          tipo_etapa: string
        }
        Insert: {
          concluido_em?: string | null
          criado_em?: string
          documento_id: string
          id?: string
          obrigatorio?: boolean
          ordem_etapa?: number
          resposta_externa?: Json | null
          signatario_id: string
          status?: string
          tipo_etapa: string
        }
        Update: {
          concluido_em?: string | null
          criado_em?: string
          documento_id?: string
          id?: string
          obrigatorio?: boolean
          ordem_etapa?: number
          resposta_externa?: Json | null
          signatario_id?: string
          status?: string
          tipo_etapa?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_steps_document_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_steps_signer_id_fkey"
            columns: ["signatario_id"]
            isOneToOne: false
            referencedRelation: "signatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos: {
        Row: {
          atualizado_em: string
          caminho_arquivo: string | null
          categoria: string | null
          conteudo: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          caminho_arquivo?: string | null
          categoria?: string | null
          conteudo?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          caminho_arquivo?: string | null
          categoria?: string | null
          conteudo?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          usuario_id?: string
        }
        Relationships: []
      }
      participantes_documento: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_assinatura: string | null
          documento_id: string
          email: string
          id: string
          nome: string
          ordem_assinatura: number
          papel: string
          status: string
          tipo_autenticacao: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_assinatura?: string | null
          documento_id: string
          email: string
          id?: string
          nome: string
          ordem_assinatura?: number
          papel?: string
          status?: string
          tipo_autenticacao?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_assinatura?: string | null
          documento_id?: string
          email?: string
          id?: string
          nome?: string
          ordem_assinatura?: number
          papel?: string
          status?: string
          tipo_autenticacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "participantes_documento_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          atualizado_em: string
          avatar_url: string | null
          bluepoint_id: number | null
          criado_em: string
          departamento_id: string | null
          email: string
          hierarquia: string
          id: string
          nome_completo: string
          trocar_senha: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          bluepoint_id?: number | null
          criado_em?: string
          departamento_id?: string | null
          email?: string
          hierarquia?: string
          id: string
          nome_completo?: string
          trocar_senha?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          bluepoint_id?: number | null
          criado_em?: string
          departamento_id?: string | null
          email?: string
          hierarquia?: string
          id?: string
          nome_completo?: string
          trocar_senha?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_usuario: {
        Row: {
          concedida: boolean
          concedida_por: string | null
          criado_em: string
          id: string
          permissao: string
          usuario_id: string
        }
        Insert: {
          concedida?: boolean
          concedida_por?: string | null
          criado_em?: string
          id?: string
          permissao: string
          usuario_id: string
        }
        Update: {
          concedida?: boolean
          concedida_por?: string | null
          criado_em?: string
          id?: string
          permissao?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      signatarios: {
        Row: {
          assinado_em: string | null
          atualizado_em: string
          bluetech_document_id: string | null
          bluetech_signatory_id: string | null
          criado_em: string
          documento_id: string
          email: string
          funcao: string
          id: string
          nome: string
          ordem_assinatura: number
          status: string
          telefone: string | null
          token_assinatura: string | null
        }
        Insert: {
          assinado_em?: string | null
          atualizado_em?: string
          bluetech_document_id?: string | null
          bluetech_signatory_id?: string | null
          criado_em?: string
          documento_id: string
          email: string
          funcao?: string
          id?: string
          nome: string
          ordem_assinatura?: number
          status?: string
          telefone?: string | null
          token_assinatura?: string | null
        }
        Update: {
          assinado_em?: string | null
          atualizado_em?: string
          bluetech_document_id?: string | null
          bluetech_signatory_id?: string | null
          criado_em?: string
          documento_id?: string
          email?: string
          funcao?: string
          id?: string
          nome?: string
          ordem_assinatura?: number
          status?: string
          telefone?: string | null
          token_assinatura?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signers_document_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_auditoria: {
        Row: {
          acao: string
          ator: string
          criado_em: string
          detalhes: string | null
          documento_id: string
          endereco_ip: string | null
          id: string
          signatario_id: string | null
        }
        Insert: {
          acao: string
          ator: string
          criado_em?: string
          detalhes?: string | null
          documento_id: string
          endereco_ip?: string | null
          id?: string
          signatario_id?: string | null
        }
        Update: {
          acao?: string
          ator?: string
          criado_em?: string
          detalhes?: string | null
          documento_id?: string
          endereco_ip?: string | null
          id?: string
          signatario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_document_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_trail_signer_id_fkey"
            columns: ["signatario_id"]
            isOneToOne: false
            referencedRelation: "signatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_auditoria_documentos: {
        Row: {
          agente_usuario: string | null
          caminho_foto_documento_oficial: string | null
          caminho_foto_selfie: string | null
          criado_em: string
          documento_id: string
          endereco_formatado: string | null
          endereco_ip: string | null
          hash_documento: string | null
          id: string
          latitude: string | null
          longitude: string | null
          metadados: Json | null
          participante_id: string | null
          tipo_evento: string
        }
        Insert: {
          agente_usuario?: string | null
          caminho_foto_documento_oficial?: string | null
          caminho_foto_selfie?: string | null
          criado_em?: string
          documento_id: string
          endereco_formatado?: string | null
          endereco_ip?: string | null
          hash_documento?: string | null
          id?: string
          latitude?: string | null
          longitude?: string | null
          metadados?: Json | null
          participante_id?: string | null
          tipo_evento: string
        }
        Update: {
          agente_usuario?: string | null
          caminho_foto_documento_oficial?: string | null
          caminho_foto_selfie?: string | null
          criado_em?: string
          documento_id?: string
          endereco_formatado?: string | null
          endereco_ip?: string | null
          hash_documento?: string | null
          id?: string
          latitude?: string | null
          longitude?: string | null
          metadados?: Json | null
          participante_id?: string | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "trilha_auditoria_documentos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trilha_auditoria_documentos_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          ativo: boolean
          contagem_falhas: number
          criado_em: string
          eventos: string[]
          id: string
          segredo: string | null
          ultimo_disparo_em: string | null
          url: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          contagem_falhas?: number
          criado_em?: string
          eventos?: string[]
          id?: string
          segredo?: string | null
          ultimo_disparo_em?: string | null
          url: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          contagem_falhas?: number
          criado_em?: string
          eventos?: string[]
          id?: string
          segredo?: string | null
          ultimo_disparo_em?: string | null
          url?: string
          usuario_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      document_belongs_to_user: {
        Args: { p_document_id: string; p_user_id: string }
        Returns: boolean
      }
      document_has_signer_token: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      get_user_hierarchy: { Args: { p_user_id: string }; Returns: string }
      has_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      signer_has_token: { Args: { p_signer_id: string }; Returns: boolean }
      validate_api_key: {
        Args: { p_key_hash: string }
        Returns: {
          scopes: string[]
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
