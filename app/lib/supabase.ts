import { createClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          role: 'admin' | 'employee';
          display_name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role: 'admin' | 'employee';
          display_name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          role?: 'admin' | 'employee';
          display_name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      registration_requests: {
        Row: {
          email: string;
          desired_role: 'admin' | 'employee';
          display_name: string | null;
          requested_at: string;
          consumed_at: string | null;
          consumed_by: string | null;
        };
        Insert: {
          email: string;
          desired_role: 'admin' | 'employee';
          display_name?: string | null;
          requested_at?: string;
          consumed_at?: string | null;
          consumed_by?: string | null;
        };
        Update: {
          email?: string;
          desired_role?: 'admin' | 'employee';
          display_name?: string | null;
          requested_at?: string;
          consumed_at?: string | null;
          consumed_by?: string | null;
        };
      };
      employees: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          profile_id: string | null;
          auth_user_id: string | null;
          work_email: string | null;
          status: 'pending' | 'active' | 'archived';
          created_by_profile_id: string | null;
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
          organization_id: string;
          profile_id?: string | null;
          auth_user_id?: string | null;
          work_email?: string | null;
          status?: 'pending' | 'active' | 'archived';
          created_by_profile_id?: string | null;
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
          organization_id?: string;
          profile_id?: string | null;
          auth_user_id?: string | null;
          work_email?: string | null;
          status?: 'pending' | 'active' | 'archived';
          created_by_profile_id?: string | null;
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
          organization_id: string;
          employee_id: string;
          work_date: string;
          status: 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
          rate_snapshot: number;
          created_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          employee_id: string;
          work_date: string;
          status: 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
          rate_snapshot: number;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          employee_id?: string;
          work_date?: string;
          status?: 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
          rate_snapshot?: number;
          created_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          employee_id: string;
          amount: number;
          payment_date: string;
          comment: string;
          status: 'pending_confirmation' | 'confirmed' | 'rejected';
          created_by_auth_user_id: string | null;
          confirmed_by_auth_user_id: string | null;
          created_by_profile_id: string | null;
          confirmed_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          employee_id: string;
          amount: number;
          payment_date: string;
          comment?: string;
          status?: 'pending_confirmation' | 'confirmed' | 'rejected';
          created_by_auth_user_id?: string | null;
          confirmed_by_auth_user_id?: string | null;
          created_by_profile_id?: string | null;
          confirmed_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          employee_id?: string;
          amount?: number;
          payment_date?: string;
          comment?: string;
          status?: 'pending_confirmation' | 'confirmed' | 'rejected';
          created_by_auth_user_id?: string | null;
          confirmed_by_auth_user_id?: string | null;
          created_by_profile_id?: string | null;
          confirmed_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      activate_employee_account: {
        Args: Record<string, never>;
        Returns: {
          organization_id: string;
          employee_id: string;
          role: 'employee';
        };
      };
      bootstrap_admin_account: {
        Args: {
          organization_name_input?: string | null;
          display_name_input?: string | null;
        };
        Returns: {
          organization_id: string;
          role: 'admin' | 'employee';
        };
      };
      request_registration: {
        Args: {
          email_input: string;
          desired_role_input: 'admin' | 'employee' | string;
          display_name_input?: string | null;
        };
        Returns: {
          email: string;
          desired_role: 'admin' | 'employee';
        };
      };
      ensure_profile_from_registration: {
        Args: Record<string, never>;
        Returns: {
          organization_id: string;
          role: 'admin' | 'employee';
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
