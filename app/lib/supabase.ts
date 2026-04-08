import { createClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          user_id: string;
          auth_user_id: string | null;
          is_owner: boolean;
          hired_at: string | null;
          name: string;
          daily_rate: number;
          archived: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          auth_user_id?: string | null;
          is_owner?: boolean;
          hired_at?: string | null;
          name: string;
          daily_rate: number;
          archived?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          auth_user_id?: string | null;
          is_owner?: boolean;
          hired_at?: string | null;
          name?: string;
          daily_rate?: number;
          archived?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shifts: {
        Row: {
          id: string;
          user_id: string;
          employee_id: string;
          work_date: string;
          status: 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
          rate_snapshot: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employee_id: string;
          work_date: string;
          status: 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
          rate_snapshot: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          employee_id?: string;
          work_date?: string;
          status?: 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
          rate_snapshot?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          employee_id: string;
          amount: number;
          payment_date: string;
          comment: string;
          status: 'entered' | 'confirmed';
          created_by_auth_user_id: string | null;
          confirmed_by_auth_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employee_id: string;
          amount: number;
          payment_date: string;
          comment?: string;
          status?: 'entered' | 'confirmed';
          created_by_auth_user_id?: string | null;
          confirmed_by_auth_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          employee_id?: string;
          amount?: number;
          payment_date?: string;
          comment?: string;
          status?: 'entered' | 'confirmed';
          created_by_auth_user_id?: string | null;
          confirmed_by_auth_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: Record<string, never>;
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
