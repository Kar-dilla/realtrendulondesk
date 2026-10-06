import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next 16 name for what used to be middleware.ts.
 * Refreshes the Supabase session on every request, then:
 *  - signed out + page      -> redirect to /login
 *  - signed out + /api/*    -> 401 JSON
 *  - signed in + /login     -> redirect to /dashboard
 * /auth/* is left alone (sign out lives there).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/auth/')) return NextResponse.next();

  let response = NextResponse.next({ request });
  let signedIn = false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      const { data } = await supabase.auth.getUser();
      signedIn = Boolean(data.user);
    } catch {
      signedIn = false;
    }
  }

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    // Keep any refreshed session cookies on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (pathname === '/login') return signedIn ? redirectTo('/dashboard') : response;
  if (signedIn) return response;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Not signed in. Sign in at /login, then try again.' },
      { status: 401 },
    );
  }
  return redirectTo('/login');
}

export const config = {
  // Skip Next internals, brand files and static assets.
  matcher: [
    '/((?!_next/|brand/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)',
  ],
};
