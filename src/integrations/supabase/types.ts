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
      ai_agent_runs: {
        Row: {
          campaign_id: string | null
          created_at: string
          goal: string
          id: string
          result: Json | null
          segment_id: string | null
          status: string
          steps: Json
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          goal: string
          id?: string
          result?: Json | null
          segment_id?: string | null
          status?: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          goal?: string
          id?: string
          result?: Json | null
          segment_id?: string | null
          status?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_runs_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          created_at: string
          id: string
          impact_estimate: number | null
          kind: string
          payload: Json
          reasoning: string
          status: string
          summary: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_estimate?: number | null
          kind: string
          payload?: Json
          reasoning: string
          status?: string
          summary: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_estimate?: number | null
          kind?: string
          payload?: Json
          reasoning?: string
          status?: string
          summary?: string
          title?: string
        }
        Relationships: []
      }
      campaign_metrics: {
        Row: {
          campaign_id: string
          clicked: number
          converted: number
          delivered: number
          failed: number
          id: string
          opened: number
          revenue: number
          sent: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          clicked?: number
          converted?: number
          delivered?: number
          failed?: number
          id?: string
          opened?: number
          revenue?: number
          sent?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          clicked?: number
          converted?: number
          delivered?: number
          failed?: number
          id?: string
          opened?: number
          revenue?: number
          sent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          created_at: string
          goal: string | null
          id: string
          message_content: string
          name: string
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          goal?: string | null
          id?: string
          message_content?: string
          name: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          goal?: string | null
          id?: string
          message_content?: string
          name?: string
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_events: {
        Row: {
          communication_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
        }
        Insert: {
          communication_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          communication_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          campaign_id: string | null
          channel: string
          created_at: string
          customer_id: string | null
          id: string
          last_event_at: string | null
          message: string
          recipient: string
          state: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          channel: string
          created_at?: string
          customer_id?: string | null
          id?: string
          last_event_at?: string | null
          message: string
          recipient: string
          state?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          last_event_at?: string | null
          message?: string
          recipient?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          parts: Json
          role: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts: Json
          role: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          parts?: Json
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          age: number | null
          city: string | null
          clv: number
          created_at: string
          email: string
          id: string
          last_purchase_date: string | null
          name: string
          phone: string | null
          status: string
          total_spend: number
          updated_at: string
        }
        Insert: {
          age?: number | null
          city?: string | null
          clv?: number
          created_at?: string
          email: string
          id?: string
          last_purchase_date?: string | null
          name: string
          phone?: string | null
          status?: string
          total_spend?: number
          updated_at?: string
        }
        Update: {
          age?: number | null
          city?: string | null
          clv?: number
          created_at?: string
          email?: string
          id?: string
          last_purchase_date?: string | null
          name?: string
          phone?: string | null
          status?: string
          total_spend?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          category: string
          created_at: string
          customer_id: string
          id: string
          order_date: string
          payment_status: string
          product_name: string
          quantity: number
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          customer_id: string
          id?: string
          order_date?: string
          payment_status?: string
          product_name: string
          quantity?: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          customer_id?: string
          id?: string
          order_date?: string
          payment_status?: string
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          audience_size: number
          created_at: string
          description: string | null
          id: string
          name: string
          rules: Json
          updated_at: string
        }
        Insert: {
          audience_size?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          audience_size?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: []
      }
      simulator_logs: {
        Row: {
          communication_id: string | null
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json
        }
        Insert: {
          communication_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json
        }
        Update: {
          communication_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json
        }
        Relationships: []
      }
      simulator_queue: {
        Row: {
          attempts: number
          callback_url: string | null
          channel: string
          communication_id: string
          created_at: string
          current_state: string
          customer_id: string | null
          id: string
          last_error: string | null
          max_attempts: number
          message: string
          next_event: string | null
          next_run_at: string
          recipient: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          callback_url?: string | null
          channel: string
          communication_id: string
          created_at?: string
          current_state?: string
          customer_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          message: string
          next_event?: string | null
          next_run_at?: string
          recipient: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          callback_url?: string | null
          channel?: string
          communication_id?: string
          created_at?: string
          current_state?: string
          customer_id?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          message?: string
          next_event?: string | null
          next_run_at?: string
          recipient?: string
          updated_at?: string
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
