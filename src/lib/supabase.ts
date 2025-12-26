// src/lib/supabase.ts - Supabase Client Configuration

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Your Supabase project credentials
const supabaseUrl = 'https://cuztcbznvckhubsmcvuj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1enRjYnpudmNraHVic21jdnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTIzODksImV4cCI6MjA3ODYyODM4OX0.XnZeq-_6RvPnQgXXSRrhLJ6tEWGz70H0Vy1te91RNdY';

// Create the Supabase client with TypeScript types
export const supabase = createClient < Database > (supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Optional: Helper functions for common operations
export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

// Export types for use in components
export type { Database } from './database.types';