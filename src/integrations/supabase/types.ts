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
          file_path: string | null
          id: string
          name: string
          signature_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          file_path?: string | null
          id?: string
          name: string
          signature_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          file_path?: string | null
          id?: string
          name?: string
          signature_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
