'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasCloudConfig = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * The browser is the only place that talks to Supabase. All access is gated by
 * RLS on auth.uid(), and the anon key is public by design.
 */
export function getSupabase(): SupabaseClient | null {
  if (!hasCloudConfig) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'jobflow.auth',
      },
      realtime: { params: { eventsPerSecond: 2 } },
    });
  }
  return client;
}
