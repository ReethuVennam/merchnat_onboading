// src/lib/supabase.ts - Supabase Client Configuration

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Your Supabase project credentials (from Vite env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Runtime checks to surface misconfiguration early during development
const placeholderAnon = 'REPLACE_WITH_PROJECT_ANON_KEY';
if (import.meta.env.DEV) {
    if (!supabaseUrl) {
        console.error('Missing VITE_SUPABASE_URL in .env.local');
    }
    if (!supabaseAnonKey || supabaseAnonKey === placeholderAnon) {
        console.error(
            'Missing or placeholder VITE_SUPABASE_ANON_KEY in .env.local — do NOT use the service role key'
        );
        // fail fast in dev so you can't accidentally run with a bogus key
        throw new Error(
            'Supabase anon key is not configured correctly. Update VITE_SUPABASE_ANON_KEY in .env.local.'
        );
    }
}

// guard against missing/invalid config at runtime (will crash earlier than weird React errors)
if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === placeholderAnon) {
    throw new Error(
        `Supabase configuration incomplete or invalid. Please set VITE_SUPABASE_URL and a real VITE_SUPABASE_ANON_KEY in your environment (not the placeholder).`
    );
}

// Create the Supabase client with TypeScript types
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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