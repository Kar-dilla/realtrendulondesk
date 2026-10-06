import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Clears the session and sends the editor back to /login. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Nothing to clear (Supabase not configured or already signed out). Still go to /login.
  }
  // 303 turns the POST into a GET on /login.
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
