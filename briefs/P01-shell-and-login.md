# P01: App shell, sidebar and login

**Read `CONTRACT.md` first.** You own the shell every other page lives inside. Others cannot start screens until you merge, so ship a working version fast, then polish.

## Goal
A signed-in editor sees a sidebar app shell around every page. A signed-out visitor sees only the login page. Match the look of the Hercules screenshots in the brand colours (black, white, orange `#fe6d05`).

## Read before you write
`components/ui/Nav.tsx`, `lib/modules.ts`, `app/layout.tsx`, `app/globals.css`, `app/ui.css`, `__tests__/nav.test.tsx`, `__tests__/placeholders.test.tsx`. The logo is `/public/brand/trendulon-mark.png`; use it as is (the existing comment says never recolour or redraw it).

## Build

**1. Sidebar (desktop, 1024px and wider).** Fixed, `var(--sidebar-w)` wide. Logo + wordmark "TRENDUL" white + "ON" orange, "NEWSROOM" small and letter-spaced under it. Three groups:
- NEWSROOM: Dashboard `/dashboard`, Today's News `/discovery`, Top Stories `/ranking`, Deep Research `/research`, Script Studio `/scripts`, Media Assets `/visuals`
- RESULTS: Published Stories `/published`, Performance `/analytics`
- CONFIGURE: Editorial Standards `/standards`, Settings `/settings`

Active item: `var(--accent-soft)` background, white text. Others: `var(--muted)`. Bottom of sidebar: the signed-in email and a "Sign out" button.

**2. Mobile (under 1024px).** Top bar with a menu button, the logo and wordmark. The button opens the same menu as a left drawer with a dark overlay. It closes on route change, Escape and overlay tap. Lock page scroll while open. Use 44px minimum touch targets. This is what the Lead tests on, so make it excellent.

**3. Icons.** Ask the Lead to approve `lucide-react` (state it in `DONE.md`; the Lead installs it). Suggested: LayoutDashboard, Newspaper, TrendingUp, FlaskConical, Clapperboard, Image, Send, Gauge, Scale, Settings, LogOut.

**4. Nav data.** In `lib/modules.ts`, keep the existing `MODULES` export untouched and add a new `NAV_SECTIONS` export (group, label, route, icon name). The shell reads `NAV_SECTIONS`. Do not move or rename any page folder.

**5. Layout.** `app/layout.tsx` wraps children in a client `Shell` component. `Shell` renders children bare on `/login`. Do not nest a second `<main>`; pages already render their own. Load the UI font with `next/font` (Inter is fine) and keep a system fallback.

**6. Login (`/login`).** Full-screen `tl-orbit-glow` background, centred logo, heading "Private newsroom", line "Trendulon's editorial intelligence platform. Sign in to continue.", email + password fields, orange button "Enter the newsroom", footnote "Internal tool. The editor approves everything before it goes out." Wrong password shows a plain error: say what happened and what to try. No sign-up link; accounts are created by the Lead in Supabase.

**7. Auth plumbing.**
- Supabase Auth with `@supabase/ssr` and `@supabase/supabase-js` (ask the Lead to install). Email + password.
- `lib/supabase/server.ts`, `lib/supabase/client.ts`, and `getCurrentUser()` returning `{ email, displayName }`. `displayName` = `user_metadata.name`, else the part of the email before `@`, capitalised. P02 uses it for the greeting.
- `proxy.ts` at the project root refreshes the session and redirects signed-out requests to `/login`. Next 16 renamed `middleware.ts` to `proxy.ts`; check the installed Next version's docs and use whichever it expects. Skip `/login`, `/auth/*`, `/_next/*`, `/brand/*` and static files. For `/api/*` return `401` JSON instead of a redirect.
- `POST /auth/signout` clears the session and redirects to `/login`.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never use the service-role key here.

## Out of scope
Page contents (other packages), sign-up, password reset, roles.

## Acceptance (all must be true)
- At 390px and 1280px: sidebar or drawer works, active item highlights, no horizontal scroll.
- Signed out: every page redirects to `/login`; `/api/stories`-style calls return 401.
- Signed in: login redirects to `/dashboard`; Sign out returns to `/login`.
- Keyboard: tab order is sensible, focus ring visible, Escape closes the drawer.
- `npm run typecheck && npm test && npm run build` pass. `nav.test.tsx` and `placeholders.test.tsx` still pass, or each change is listed under "Tests changed" with the reason.
- `bash scripts/check-owner.sh p01` says Clean.
- Hand back `DONE.md` (format in `CONTRACT.md` §9) with screenshots at both widths.
