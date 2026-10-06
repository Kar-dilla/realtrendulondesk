'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeft, X } from 'lucide-react';
import Brand from './Brand';
import SidebarPanel, { type ShellUser } from './SidebarPanel';

/** Pages that render on their own, without the sidebar. */
function isBare(pathname: string | null) {
  return pathname === '/login' || (pathname?.startsWith('/login/') ?? false);
}

export default function Shell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const pathname = usePathname();
  if (isBare(pathname)) return <>{children}</>;
  return <AppShell user={user}>{children}</AppShell>;
}

function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While the drawer is open: lock page scroll, close on Escape, close if the screen grows to desktop width.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)') : null;
    const onChange = () => {
      if (mq?.matches) setOpen(false);
    };
    mq?.addEventListener('change', onChange);

    const menuButton = menuRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      mq?.removeEventListener('change', onChange);
      menuButton?.focus();
    };
  }, [open]);

  // Keep Tab inside the drawer while it is open.
  function trapTab(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const items = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    if (!items || items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="tl-shell">
      {/* Desktop (1024px and wider) */}
      <div className="tl-sidebar">
        <SidebarPanel user={user} />
      </div>

      {/* Mobile (under 1024px) */}
      <header className="tl-topbar">
        <button
          ref={menuRef}
          type="button"
          className="tl-icon-btn"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="tl-drawer"
          onClick={() => setOpen(true)}
        >
          <PanelLeft size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <Brand />
      </header>

      {open ? (
        <>
          <div className="tl-overlay" data-testid="drawer-overlay" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            id="tl-drawer"
            ref={drawerRef}
            className="tl-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            onKeyDown={trapTab}
          >
            <button
              ref={closeRef}
              type="button"
              className="tl-icon-btn tl-drawer__close"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <SidebarPanel user={user} onNavigate={() => setOpen(false)} />
          </div>
        </>
      ) : null}

      {/* Pages render their own <main>; do not add another one here. */}
      <div className="tl-content">{children}</div>
    </div>
  );
}
