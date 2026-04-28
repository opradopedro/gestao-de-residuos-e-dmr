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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coleta_itens: {
        Row: {
          coleta_id: string
          criado_em: string
          id: string
          peso_kg: number
          tipo_residuo_id: string | null
          tipo_residuo_nome: string
          tratamento: string
        }
        Insert: {
          coleta_id: string
          criado_em?: string
          id?: string
          peso_kg: number
          tipo_residuo_id?: string | null
          tipo_residuo_nome: string
          tratamento: string
        }
        Update: {
          coleta_id?: string
          criado_em?: string
          id?: string
          peso_kg?: number
          tipo_residuo_id?: string | null
          tipo_residuo_nome?: string
          tratamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "coleta_itens_coleta_id_fkey"
            columns: ["coleta_id"]
            isOneToOne: false
            referencedRelation: "coletas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coleta_itens_tipo_residuo_id_fkey"
            columns: ["tipo_residuo_id"]
            isOneToOne: false
            referencedRelation: "tipos_residuo"
            referencedColumns: ["id"]
          },
        ]
      }
      coletas: {
        Row: {
          atualizado_em: string
          criado_em: string
          data: string
          destinador: string | null
          id: string
          mtr: string | null
          observacoes: string | null
          peso_estimado: boolean
          transportador: string | null
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          destinador?: string | null
          id?: string
          mtr?: string | null
          observacoes?: string | null
          peso_estimado?: boolean
          transportador?: string | null
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          destinador?: string | null
          id?: string
          mtr?: string | null
          observacoes?: string | null
          peso_estimado?: boolean
          transportador?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coletas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      dmr_linhas: {
        Row: {
          criado_em: string
          data: string | null
          destinador: string | null
          id: string
          mtr: string | null
          peso_kg: number | null
          residuo: string | null
          upload_id: string
        }
        Insert: {
          criado_em?: string
          data?: string | null
          destinador?: string | null
          id?: string
          mtr?: string | null
          peso_kg?: number | null
          residuo?: string | null
          upload_id: string
        }
        Update: {
          criado_em?: string
          data?: string | null
          destinador?: string | null
          id?: string
          mtr?: string | null
          peso_kg?: number | null
          residuo?: string | null
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dmr_linhas_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "dmr_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      dmr_uploads: {
        Row: {
          ano: number
          arquivo_nome: string
          criado_em: string
          id: string
          mapeamento: Json
          trimestre: number
          unidade_id: string
        }
        Insert: {
          ano: number
          arquivo_nome: string
          criado_em?: string
          id?: string
          mapeamento?: Json
          trimestre: number
          unidade_id: string
        }
        Update: {
          ano?: number
          arquivo_nome?: string
          criado_em?: string
          id?: string
          mapeamento?: Json
          trimestre?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dmr_uploads_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_residuo: {
        Row: {
          criado_em: string
          id: string
          nome: string
          tratamento_padrao: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          tratamento_padrao: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          tratamento_padrao?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
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
