import { createClient } from '@supabase/supabase-js';

type LegacyShiftStatus = 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
type CanonicalShiftStatus = 'shift' | 'day_off' | 'sick_leave' | 'no_show' | 'replacement' | 'no_shift';
type LegacyPaymentStatus = 'pending_confirmation' | 'confirmed' | 'rejected';
type CanonicalPaymentStatus = 'pending' | 'approved' | 'rejected';

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
          terminated_at: string | null;
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
          terminated_at?: string | null;
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
          terminated_at?: string | null;
          name?: string;
          daily_rate?: number;
          archived?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      employee_rate_history: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          rate: number;
          valid_from: string;
          valid_to: string | null;
          created_by_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          rate: number;
          valid_from: string;
          valid_to?: string | null;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          employee_id?: string;
          rate?: number;
          valid_from?: string;
          valid_to?: string | null;
          created_by_profile_id?: string | null;
          created_at?: string;
        };
      };
      schedule_months: {
        Row: {
          id: string;
          organization_id: string;
          year: number;
          month: number;
          status: 'draft' | 'pending_approval' | 'approved' | 'closed';
          approved_by_profile_id: string | null;
          approved_at: string | null;
          closed_by_profile_id: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          year: number;
          month: number;
          status?: 'draft' | 'pending_approval' | 'approved' | 'closed';
          approved_by_profile_id?: string | null;
          approved_at?: string | null;
          closed_by_profile_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          year?: number;
          month?: number;
          status?: 'draft' | 'pending_approval' | 'approved' | 'closed';
          approved_by_profile_id?: string | null;
          approved_at?: string | null;
          closed_by_profile_id?: string | null;
          closed_at?: string | null;
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
          status: LegacyShiftStatus | CanonicalShiftStatus;
          requested_status: LegacyShiftStatus | CanonicalShiftStatus | null;
          approved_status: LegacyShiftStatus | CanonicalShiftStatus | null;
          actual_status: LegacyShiftStatus | CanonicalShiftStatus | null;
          rate_snapshot: number;
          created_by_profile_id: string | null;
          requested_by_profile_id: string | null;
          approved_by_profile_id: string | null;
          actual_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          employee_id: string;
          work_date: string;
          status: LegacyShiftStatus | CanonicalShiftStatus;
          requested_status?: LegacyShiftStatus | CanonicalShiftStatus | null;
          approved_status?: LegacyShiftStatus | CanonicalShiftStatus | null;
          actual_status?: LegacyShiftStatus | CanonicalShiftStatus | null;
          rate_snapshot: number;
          created_by_profile_id?: string | null;
          requested_by_profile_id?: string | null;
          approved_by_profile_id?: string | null;
          actual_by_profile_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string;
          employee_id?: string;
          work_date?: string;
          status?: LegacyShiftStatus | CanonicalShiftStatus;
          requested_status?: LegacyShiftStatus | CanonicalShiftStatus | null;
          approved_status?: LegacyShiftStatus | CanonicalShiftStatus | null;
          actual_status?: LegacyShiftStatus | CanonicalShiftStatus | null;
          rate_snapshot?: number;
          created_by_profile_id?: string | null;
          requested_by_profile_id?: string | null;
          approved_by_profile_id?: string | null;
          actual_by_profile_id?: string | null;
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
          status: LegacyPaymentStatus | CanonicalPaymentStatus;
          created_by_auth_user_id: string | null;
          confirmed_by_auth_user_id: string | null;
          created_by_profile_id: string | null;
          confirmed_by_profile_id: string | null;
          requested_by_auth_user_id: string | null;
          approved_by_auth_user_id: string | null;
          requested_by_profile_id: string | null;
          approved_by_profile_id: string | null;
          approved_at: string | null;
          edited_by_admin: boolean;
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
          status?: LegacyPaymentStatus | CanonicalPaymentStatus;
          created_by_auth_user_id?: string | null;
          confirmed_by_auth_user_id?: string | null;
          created_by_profile_id?: string | null;
          confirmed_by_profile_id?: string | null;
          requested_by_auth_user_id?: string | null;
          approved_by_auth_user_id?: string | null;
          requested_by_profile_id?: string | null;
          approved_by_profile_id?: string | null;
          approved_at?: string | null;
          edited_by_admin?: boolean;
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
          status?: LegacyPaymentStatus | CanonicalPaymentStatus;
          created_by_auth_user_id?: string | null;
          confirmed_by_auth_user_id?: string | null;
          created_by_profile_id?: string | null;
          confirmed_by_profile_id?: string | null;
          requested_by_auth_user_id?: string | null;
          approved_by_auth_user_id?: string | null;
          requested_by_profile_id?: string | null;
          approved_by_profile_id?: string | null;
          approved_at?: string | null;
          edited_by_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          entity_type: string;
          entity_id: string | null;
          action: string;
          old_value: unknown;
          new_value: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          entity_type: string;
          entity_id?: string | null;
          action: string;
          old_value?: unknown;
          new_value?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          actor_user_id?: string | null;
          entity_type?: string;
          entity_id?: string | null;
          action?: string;
          old_value?: unknown;
          new_value?: unknown;
          created_at?: string;
        };
      };
    };
    Functions: {
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
      ensure_profile_from_auth: {
        Args: {
          desired_role_input?: 'admin' | 'employee' | string | null;
          display_name_input?: string | null;
        };
        Returns: {
          organization_id: string;
          role: 'admin' | 'employee';
        };
      };
      create_employee_record: {
        Args: {
          name_input: string;
          work_email_input: string;
          daily_rate_input: number;
          hired_at_input?: string | null;
        };
        Returns: Database['public']['Tables']['employees']['Row'];
      };
      archive_employee_record: {
        Args: {
          employee_id_input: string;
        };
        Returns: Database['public']['Tables']['employees']['Row'];
      };
      update_employee_rate_record: {
        Args: {
          employee_id_input: string;
          daily_rate_input: number;
          valid_from_input?: string | null;
        };
        Returns: Database['public']['Tables']['employees']['Row'];
      };
      upsert_shift_entry: {
        Args: {
          employee_id_input: string;
          work_date_input: string;
          status_input: string;
        };
        Returns: Database['public']['Tables']['shifts']['Row'];
      };
      delete_shift_entry: {
        Args: {
          employee_id_input: string;
          work_date_input: string;
        };
        Returns: {
          deleted: boolean;
        };
      };
      create_payment_record: {
        Args: {
          employee_id_input: string;
          amount_input: number;
          payment_date_input: string;
          comment_input?: string | null;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      update_payment_record: {
        Args: {
          payment_id_input: string;
          amount_input?: number | null;
          payment_date_input?: string | null;
          comment_input?: string | null;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      approve_payment_record: {
        Args: {
          payment_id_input: string;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      reject_payment_record: {
        Args: {
          payment_id_input: string;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      delete_payment_record: {
        Args: {
          payment_id_input: string;
        };
        Returns: {
          deleted: boolean;
        };
      };
      ensure_schedule_month_record: {
        Args: {
          year_input: number;
          month_input: number;
        };
        Returns: Database['public']['Tables']['schedule_months']['Row'];
      };
      set_schedule_month_status: {
        Args: {
          year_input: number;
          month_input: number;
          status_input: 'draft' | 'pending_approval' | 'approved' | 'closed' | string;
        };
        Returns: Database['public']['Tables']['schedule_months']['Row'];
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
        flowType: 'pkce',
      },
    })
  : null;
