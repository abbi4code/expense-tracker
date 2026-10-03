export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      budgets: {
        Row: {
          amount_minor: number;
          category_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_minor?: number;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string;
          created_at: string;
          deleted_at: string | null;
          emoji: string;
          id: string;
          is_archived: boolean;
          kind: string;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          emoji?: string;
          id?: string;
          is_archived?: boolean;
          kind?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          emoji?: string;
          id?: string;
          is_archived?: boolean;
          kind?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount_minor: number;
          category_id: string;
          created_at: string;
          currency: string;
          deleted_at: string | null;
          group_expense_id: string | null;
          id: string;
          kind: string;
          note: string | null;
          payment_method_id: string | null;
          receipt_path: string | null;
          recurring_rule_id: string | null;
          reimbursable: boolean;
          reimbursed_at: string | null;
          spent_on: string;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          category_id: string;
          created_at?: string;
          currency: string;
          deleted_at?: string | null;
          group_expense_id?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          payment_method_id?: string | null;
          receipt_path?: string | null;
          recurring_rule_id?: string | null;
          reimbursable?: boolean;
          reimbursed_at?: string | null;
          spent_on?: string;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_minor?: number;
          category_id?: string;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          group_expense_id?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          payment_method_id?: string | null;
          receipt_path?: string | null;
          recurring_rule_id?: string | null;
          reimbursable?: boolean;
          reimbursed_at?: string | null;
          spent_on?: string;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_payment_method_id_user_id_fkey";
            columns: ["payment_method_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "expenses_recurring_rule_id_user_id_fkey";
            columns: ["recurring_rule_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "recurring_rules";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      favourites: {
        Row: {
          amount_minor: number;
          category_id: string;
          created_at: string;
          currency: string;
          deleted_at: string | null;
          id: string;
          note: string | null;
          payment_method_id: string | null;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          category_id: string;
          created_at?: string;
          currency: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          payment_method_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_minor?: number;
          category_id?: string;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          id?: string;
          note?: string | null;
          payment_method_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favourites_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "favourites_payment_method_id_user_id_fkey";
            columns: ["payment_method_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      group_expenses: {
        Row: {
          amount_minor: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          description: string;
          group_id: string;
          id: string;
          paid_by_member_id: string;
          recurring_rule_id: string | null;
          spent_on: string;
          split_mode: string;
          splits: Json;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          deleted_at?: string | null;
          description: string;
          group_id: string;
          id?: string;
          paid_by_member_id: string;
          recurring_rule_id?: string | null;
          spent_on?: string;
          split_mode?: string;
          splits: Json;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string;
          group_id?: string;
          id?: string;
          paid_by_member_id?: string;
          recurring_rule_id?: string | null;
          spent_on?: string;
          split_mode?: string;
          splits?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_expenses_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_expenses_paid_by_member_id_group_id_fkey";
            columns: ["paid_by_member_id", "group_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["id", "group_id"];
          },
          {
            foreignKeyName: "group_expenses_recurring_rule_id_group_id_fkey";
            columns: ["recurring_rule_id", "group_id"];
            isOneToOne: false;
            referencedRelation: "group_recurring_rules";
            referencedColumns: ["id", "group_id"];
          },
        ];
      };
      group_members: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          group_id: string;
          id: string;
          role: string;
          updated_at: string;
          upi_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          group_id: string;
          id?: string;
          role?: string;
          updated_at?: string;
          upi_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          group_id?: string;
          id?: string;
          role?: string;
          updated_at?: string;
          upi_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      group_recurring_rules: {
        Row: {
          amount_minor: number;
          anchor_date: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          description: string;
          frequency: string;
          group_id: string;
          id: string;
          interval: number;
          is_active: boolean;
          next_due_on: string;
          paid_by_member_id: string;
          split_mode: string;
          splits: Json;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          anchor_date: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          deleted_at?: string | null;
          description: string;
          frequency?: string;
          group_id: string;
          id?: string;
          interval?: number;
          is_active?: boolean;
          next_due_on: string;
          paid_by_member_id: string;
          split_mode?: string;
          splits: Json;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          anchor_date?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string;
          frequency?: string;
          group_id?: string;
          id?: string;
          interval?: number;
          is_active?: boolean;
          next_due_on?: string;
          paid_by_member_id?: string;
          split_mode?: string;
          splits?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_recurring_rules_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_recurring_rules_paid_by_member_id_group_id_fkey";
            columns: ["paid_by_member_id", "group_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["id", "group_id"];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          emoji: string;
          id: string;
          invite_code: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency: string;
          deleted_at?: string | null;
          emoji?: string;
          id?: string;
          invite_code?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          emoji?: string;
          id?: string;
          invite_code?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          key: string;
          kind: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          key: string;
          kind: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          key?: string;
          kind?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          icon: string;
          id: string;
          is_archived: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          icon?: string;
          id?: string;
          is_archived?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          icon?: string;
          id?: string;
          is_archived?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          currency: string | null;
          display_name: string | null;
          id: string;
          locale: string | null;
          month_start_day: number;
          notify_bills: boolean;
          notify_budgets: boolean;
          notify_daily: boolean;
          notify_daily_hour: number;
          notify_groups: boolean;
          notify_settle: boolean;
          notify_weekly: boolean;
          onboarded_at: string | null;
          show_payment_method: boolean;
          theme: string;
          timezone: string | null;
          track_income: boolean;
          updated_at: string;
          week_start: number;
        };
        Insert: {
          created_at?: string;
          currency?: string | null;
          display_name?: string | null;
          id: string;
          locale?: string | null;
          month_start_day?: number;
          notify_bills?: boolean;
          notify_budgets?: boolean;
          notify_daily?: boolean;
          notify_daily_hour?: number;
          notify_groups?: boolean;
          notify_settle?: boolean;
          notify_weekly?: boolean;
          onboarded_at?: string | null;
          show_payment_method?: boolean;
          theme?: string;
          timezone?: string | null;
          track_income?: boolean;
          updated_at?: string;
          week_start?: number;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          display_name?: string | null;
          id?: string;
          locale?: string | null;
          month_start_day?: number;
          notify_bills?: boolean;
          notify_budgets?: boolean;
          notify_daily?: boolean;
          notify_daily_hour?: number;
          notify_groups?: boolean;
          notify_settle?: boolean;
          notify_weekly?: boolean;
          onboarded_at?: string | null;
          show_payment_method?: boolean;
          theme?: string;
          timezone?: string | null;
          track_income?: boolean;
          updated_at?: string;
          week_start?: number;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_rules: {
        Row: {
          amount_minor: number;
          anchor_date: string;
          category_id: string;
          created_at: string;
          currency: string;
          deleted_at: string | null;
          frequency: string;
          id: string;
          interval: number;
          is_active: boolean;
          kind: string;
          mode: string;
          next_due_on: string;
          note: string | null;
          payment_method_id: string | null;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          anchor_date: string;
          category_id: string;
          created_at?: string;
          currency: string;
          deleted_at?: string | null;
          frequency: string;
          id?: string;
          interval?: number;
          is_active?: boolean;
          kind?: string;
          mode?: string;
          next_due_on: string;
          note?: string | null;
          payment_method_id?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          amount_minor?: number;
          anchor_date?: string;
          category_id?: string;
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          frequency?: string;
          id?: string;
          interval?: number;
          is_active?: boolean;
          kind?: string;
          mode?: string;
          next_due_on?: string;
          note?: string | null;
          payment_method_id?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_rules_category_id_user_id_fkey";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "recurring_rules_payment_method_id_user_id_fkey";
            columns: ["payment_method_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      settlements: {
        Row: {
          amount_minor: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          from_member_id: string;
          group_id: string;
          id: string;
          note: string | null;
          spent_on: string;
          to_member_id: string;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          deleted_at?: string | null;
          from_member_id: string;
          group_id: string;
          id?: string;
          note?: string | null;
          spent_on?: string;
          to_member_id: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          from_member_id?: string;
          group_id?: string;
          id?: string;
          note?: string | null;
          spent_on?: string;
          to_member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settlements_from_member_id_group_id_fkey";
            columns: ["from_member_id", "group_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["id", "group_id"];
          },
          {
            foreignKeyName: "settlements_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "settlements_to_member_id_group_id_fkey";
            columns: ["to_member_id", "group_id"];
            isOneToOne: false;
            referencedRelation: "group_members";
            referencedColumns: ["id", "group_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_group: {
        Args: {
          p_currency: string;
          p_display_name: string;
          p_emoji: string;
          p_member_names?: string[];
          p_name: string;
        };
        Returns: string;
      };
      delete_account: { Args: never; Returns: undefined };
      group_preview: { Args: { p_code: string }; Returns: Json };
      is_group_member: { Args: { target_group: string }; Returns: boolean };
      is_group_owner: { Args: { target_group: string }; Returns: boolean };
      join_group: {
        Args: { p_code: string; p_display_name?: string; p_member_id?: string };
        Returns: string;
      };
      leave_group: { Args: { p_group: string }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
