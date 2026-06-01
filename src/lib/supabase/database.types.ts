export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: "todo" | "in_progress" | "done";
          priority: "low" | "medium" | "high";
          due_date: string | null;
          cat: "work" | "meet" | "focus" | "life";
          all_day: boolean;
          start_time: number | null;
          duration: number | null;
          end_date: string | null;
          reason: string | null;
          source: string | null;
          phase: string | null;
          is_milestone: boolean;
          is_reminder: boolean;
          depends_on: string[] | null;
          recurrence: Json | null;
          condition: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          title: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "done";
          priority?: "low" | "medium" | "high";
          due_date?: string | null;
          cat?: "work" | "meet" | "focus" | "life";
          all_day?: boolean;
          start_time?: number | null;
          duration?: number | null;
          end_date?: string | null;
          reason?: string | null;
          source?: string | null;
          phase?: string | null;
          is_milestone?: boolean;
          is_reminder?: boolean;
          depends_on?: string[] | null;
          recurrence?: Json | null;
          condition?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          status?: "todo" | "in_progress" | "done";
          priority?: "low" | "medium" | "high";
          due_date?: string | null;
          cat?: "work" | "meet" | "focus" | "life";
          all_day?: boolean;
          start_time?: number | null;
          duration?: number | null;
          end_date?: string | null;
          reason?: string | null;
          source?: string | null;
          phase?: string | null;
          is_milestone?: boolean;
          is_reminder?: boolean;
          depends_on?: string[] | null;
          recurrence?: Json | null;
          condition?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
