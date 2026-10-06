import { createBrowserClient } from '@supabase/ssr';

/** Thrown when the two public Supabase env vars are missing. */
export class SupabaseConfigError extends Error {
  constructor() {
    super('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    this.name = 'SupabaseConfigError';
  }
}

/** Supabase client for components. Uses the public anon key only. */
export function createClient() {
  // These two must be written out in full so Next can inline them into the browser bundle.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new SupabaseConfigError();
  return createBrowserClient(url, key);
}
