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
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      audit_trail: {
        Row: {
          action: string
          actor: string
          created_at: string
          details: string | null
          document_id: string
          id: string
          ip_address: string | null
          signer_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          details?: string | null
          document_id: string
          id?: string
          ip_address?: string | null
          signer_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          details?: string | null
          document_id?: string
          id?: string
          ip_address?: string | null
          signer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_trail_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signers"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          bluepoint_id: number | null
          company: string | null
          created_at: string
          default_validations: string[]
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bluepoint_id?: number | null
          company?: string | null
          created_at?: string
          default_validations?: string[]
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bluepoint_id?: number | null
          company?: string | null
          created_at?: string
          default_validations?: string[]
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_fields: {
        Row: {
          created_at: string
          document_id: string
          field_type: string
          height: number
          id: string
          label: string | null
          page: number
          required: boolean
          signer_id: string | null
          value: string | null
          width: number
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          document_id: string
          field_type?: string
          height?: number
          id?: string
          label?: string | null
          page?: number
          required?: boolean
          signer_id?: string | null
          value?: string | null
          width?: number
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          document_id?: string
          field_type?: string
          height?: number
          id?: string
          label?: string | null
          page?: number
          required?: boolean
          signer_id?: string | null
          value?: string | null
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_fields_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signers"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deadline: string | null
          external_ref: string | null
          file_path: string | null
          id: string
          name: string
          origin: string
          signature_type: string
          source_system: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          external_ref?: string | null
          file_path?: string | null
          id?: string
          name: string
          origin?: string
          signature_type?: string
          source_system?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          external_ref?: string | null
          file_path?: string | null
          id?: string
          name?: string
          origin?: string
          signature_type?: string
          source_system?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          bluepoint_id: number | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          hierarchy: string
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bluepoint_id?: number | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          hierarchy?: string
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bluepoint_id?: number | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          hierarchy?: string
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          bluetech_response: Json | null
          created_at: string
          document_id: string
          field_id: string | null
          id: string
          image_base64: string | null
          ip_address: string | null
          signature_type: string
          signer_id: string
          typed_text: string | null
          user_agent: string | null
        }
        Insert: {
          bluetech_response?: Json | null
          created_at?: string
          document_id: string
          field_id?: string | null
          id?: string
          image_base64?: string | null
          ip_address?: string | null
          signature_type: string
          signer_id: string
          typed_text?: string | null
          user_agent?: string | null
        }
        Update: {
          bluetech_response?: Json | null
          created_at?: string
          document_id?: string
          field_id?: string | null
          id?: string
          image_base64?: string | null
          ip_address?: string | null
          signature_type?: string
          signer_id?: string
          typed_text?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "document_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signers: {
        Row: {
          bluetech_document_id: string | null
          bluetech_signatory_id: string | null
          created_at: string
          document_id: string
          email: string
          id: string
          name: string
          phone: string | null
          role: string
          sign_order: number
          sign_token: string | null
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bluetech_document_id?: string | null
          bluetech_signatory_id?: string | null
          created_at?: string
          document_id: string
          email: string
          id?: string
          name: string
          phone?: string | null
          role?: string
          sign_order?: number
          sign_token?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bluetech_document_id?: string | null
          bluetech_signatory_id?: string | null
          created_at?: string
          document_id?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string
          sign_order?: number
          sign_token?: string | null
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          description: string | null
          file_path: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          description?: string | null
          file_path?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_steps: {
        Row: {
          bluetech_response: Json | null
          completed_at: string | null
          created_at: string
          document_id: string
          id: string
          required: boolean
          signer_id: string
          status: string
          step_order: number
          step_type: string
        }
        Insert: {
          bluetech_response?: Json | null
          completed_at?: string | null
          created_at?: string
          document_id: string
          id?: string
          required?: boolean
          signer_id: string
          status?: string
          step_order?: number
          step_type: string
        }
        Update: {
          bluetech_response?: Json | null
          completed_at?: string | null
          created_at?: string
          document_id?: string
          id?: string
          required?: boolean
          signer_id?: string
          status?: string
          step_order?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_steps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_steps_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "signers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          response_body: string | null
          status_code: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload: Json
          response_body?: string | null
          status_code?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          status_code?: number | null
          success?: boolean
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
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          failure_count: number
          id: string
          last_triggered_at: string | null
          secret: string | null
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_triggered_at?: string | null
          secret?: string | null
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          last_triggered_at?: string | null
          secret?: string | null
          url?: string
          user_id?: string
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
