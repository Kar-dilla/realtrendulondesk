import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { toDisplayName } from './display-name';

export interface CurrentUser {
  email: string;
  displayName: string;
}

/** Supabase client for server components and route handlers. Uses the public anon key only. */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which cannot set cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/**
 * The signed-in editor, or null when signed out (or Supabase is not configured).
 * `displayName` = user_metadata.name, else the part of the email before "@", capitalised.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    return {
      email: data.user.email,
      displayName: toDisplayName(data.user.email, data.user.user_metadata?.name),
    };
  } catch {
    return null;
  }
}
