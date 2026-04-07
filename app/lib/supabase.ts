import { createClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          daily_rate: number;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          daily_rate: number;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          daily_rate?: number;
          archived?: boolean;
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
          status: 'working' | 'day-off' | 'sick' | 'no-show';
          rate_snapshot: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employee_id: string;
          work_date: string;
          status: 'working' | 'day-off' | 'sick' | 'no-show';
          rate_snapshot: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          employee_id?: string;
          work_date?: string;
          status?: 'working' | 'day-off' | 'sick' | 'no-show';
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
          created_at?: string;
          updated_at?: string;
        };
      };
    };
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
