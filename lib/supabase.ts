import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read Supabase environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize client-side Supabase client if configured
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initialize server-side Supabase admin client if configured
export const getSupabaseAdmin = (): SupabaseClient | null => {
  if (!supabaseUrl) return null;
  const key = supabaseServiceKey || supabaseAnonKey;
  if (!key) return null;
  return createClient(supabaseUrl, key);
};

// Generate a guaranteed unique 6-character uppercase alphanumeric share code
// Excludes confusing characters like 0, O, 1, I to ensure clear human readability
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Data Schema for Folder Share Record
export interface SharedFolderRecord {
  id?: string;
  folder_id: string;
  folder_name: string;
  share_code: string;
  is_active: boolean;
  folder_data: {
    folder: {
      id: string;
      name: string;
    };
    items: Array<{
      id: string;
      name: string;
      type: 'file' | 'folder';
      parentId: string | null;
      content?: string;
    }>;
  };
  created_at?: string;
  updated_at?: string;
}
