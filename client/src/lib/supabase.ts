import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ueoqbwsigpowzbdlqezz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlb3Fid3NpZ3Bvd3piZGxxZXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5MDE2ODcsImV4cCI6MjA2NjQ3NzY4N30.C3BslgmFxUVJ7getJAkPCHPlZTMAda6UENaUahlbKQk';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types based on our schema
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          username: string;
          email: string;
          password: string;
          role: string;
          privileges: string[] | null;
          created_at: string | null;
        };
        Insert: {
          username: string;
          email: string;
          password: string;
          role: string;
          privileges?: string[] | null;
        };
        Update: {
          username?: string;
          email?: string;
          password?: string;
          role?: string;
          privileges?: string[] | null;
        };
      };
      jobs: {
        Row: {
          id: number;
          title_company: string;
          closing_type: string;
          internal_reference: string | null;
          kba_required: boolean | null;
          property_address_one: string;
          property_address_two: string | null;
          property_city: string;
          property_state: string;
          property_zip_code: string;
          notary_option: string | null;
          selected_notary: string | null;
          selected_date: string | null;
          selected_time: string | null;
          uploaded_file: string | null;
          notarized_file: string | null;
          job_status: string;
          user_id: number | null;
          session_token: string | null;
          scheduled_at: string | null;
          created_at: string | null;
        };
        Insert: {
          title_company: string;
          closing_type: string;
          internal_reference?: string | null;
          kba_required?: boolean | null;
          property_address_one: string;
          property_address_two?: string | null;
          property_city: string;
          property_state: string;
          property_zip_code: string;
          notary_option?: string | null;
          selected_notary?: string | null;
          selected_date?: string | null;
          selected_time?: string | null;
          uploaded_file?: string | null;
          notarized_file?: string | null;
          job_status?: string;
          user_id?: number | null;
          session_token?: string | null;
          scheduled_at?: string | null;
        };
        Update: {
          title_company?: string;
          closing_type?: string;
          internal_reference?: string | null;
          kba_required?: boolean | null;
          property_address_one?: string;
          property_address_two?: string | null;
          property_city?: string;
          property_state?: string;
          property_zip_code?: string;
          notary_option?: string | null;
          selected_notary?: string | null;
          selected_date?: string | null;
          selected_time?: string | null;
          uploaded_file?: string | null;
          notarized_file?: string | null;
          job_status?: string;
          user_id?: number | null;
          session_token?: string | null;
          scheduled_at?: string | null;
        };
      };
    };
  };
}; 