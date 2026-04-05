import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bfiuypermhgyegnufvfj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmaXV5cGVybWhneWVnbnVmdmZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxOTc0NzUsImV4cCI6MjA5MDc3MzQ3NX0.xTKhzWn5V3F9AZrVTt3-tzNL005QgIXCsxseupDd6x8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'pharma-flow-auth-token'
  }
});
