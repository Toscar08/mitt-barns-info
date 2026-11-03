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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      account_trials: {
        Row: {
          created_at: string
          ends_at: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          starts_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activation_codes: {
        Row: {
          amount_cents: number | null
          code: string
          created_at: string
          currency: string | null
          email: string | null
          id: string
          provider: string | null
          provider_reference: string | null
          status: string
          used_at: string | null
          used_by: string | null
          workspace_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          code: string
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          status?: string
          used_at?: string | null
          used_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          code?: string
          created_at?: string
          currency?: string | null
          email?: string | null
          id?: string
          provider?: string | null
          provider_reference?: string | null
          status?: string
          used_at?: string | null
          used_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_codes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      child_calendars: {
        Row: {
          child_id: string
          created_at: string
          last_synced_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          last_synced_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          last_synced_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_calendars_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          allergies: string | null
          birth_date: string | null
          blood_type: string | null
          care_contacts: string | null
          clothing_size: string | null
          created_at: string
          id: string
          medications: string | null
          name: string
          notes: string | null
          passport_expiry: string | null
          passport_number: string | null
          personal_number: string | null
          school: string | null
          school_class: string | null
          shoe_size: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          care_contacts?: string | null
          clothing_size?: string | null
          created_at?: string
          id?: string
          medications?: string | null
          name: string
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          personal_number?: string | null
          school?: string | null
          school_class?: string | null
          shoe_size?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          care_contacts?: string | null
          clothing_size?: string | null
          created_at?: string
          id?: string
          medications?: string | null
          name?: string
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          personal_number?: string | null
          school?: string | null
          school_class?: string | null
          shoe_size?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          child_id: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          category: string
          child_id: string
          content: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          category?: string
          child_id: string
          content?: string | null
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string
          child_id?: string
          content?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_campaign: {
        Row: {
          created_at: string
          id: boolean
          started_at: string | null
          started_by: string | null
        }
        Insert: {
          created_at?: string
          id?: boolean
          started_at?: string | null
          started_by?: string | null
        }
        Update: {
          created_at?: string
          id?: boolean
          started_at?: string | null
          started_by?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          child_id: string
          created_at: string
          done: boolean
          due_at: string | null
          external_uid: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          done?: boolean
          due_at?: string | null
          external_uid?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          done?: boolean
          due_at?: string | null
          external_uid?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_claims: {
        Row: {
          claimed_at: string
          claimed_user_id: string
          identity_hash: string
        }
        Insert: {
          claimed_at?: string
          claimed_user_id: string
          identity_hash: string
        }
        Update: {
          claimed_at?: string
          claimed_user_id?: string
          identity_hash?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verified_payments: {
        Row: {
          amount_cents: number
          currency: string
          environment: string
          id: string
          provider: string
          provider_reference: string
          revoked_at: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          amount_cents: number
          currency: string
          environment: string
          id?: string
          provider: string
          provider_reference: string
          revoked_at?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          amount_cents?: number
          currency?: string
          environment?: string
          id?: string
          provider?: string
          provider_reference?: string
          revoked_at?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          activated_at: string
          created_at: string
          display_name: string | null
          id: string
          owner_id: string
          pin_failed_attempts: number
          pin_hash: string | null
          pin_locked_until: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          display_name?: string | null
          id?: string
          owner_id: string
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_until?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          display_name?: string | null
          id?: string
          owner_id?: string
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_locked_until?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      campaign_access_status: {
        Args: {
          at_time: string
          launch_at: string
          trial_end: string
          verified_paid: boolean
        }
        Returns: string
      }
      claim_launch_trial: { Args: { target_user: string }; Returns: undefined }
      get_my_campaign_access: { Args: never; Returns: Json }
      has_account_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      provision_my_workspace: {
        Args: { new_name?: string; new_slug: string }
        Returns: string
      }
      start_launch_campaign: { Args: { launch_at: string }; Returns: string }
      trial_window_eligible: {
        Args: { launch_at: string; registered_at: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
