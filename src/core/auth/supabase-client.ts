import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
// In production, these should be environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anonymous Key not provided');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);