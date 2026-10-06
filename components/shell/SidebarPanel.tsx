import { LogOut } from 'lucide-react';
import Nav from '@/components/ui/Nav';
import Brand from './Brand';

export interface ShellUser {
  email: string;
  displayName: string;
}

/** Everything inside the sidebar: brand, menu, signed-in email and Sign out. */
export default function SidebarPanel({ user, onNavigate }: { user: ShellUser | null; onNavigate?: () => void }) {
  return (
    <div className="tl-panel">
      <div className="tl-panel__head">
        <Brand onNavigate={onNavigate} />
      </div>
      <div className="tl-panel__scroll">
        <Nav onNavigate={onNavigate} />
      </div>
      <div className="tl-panel__foot">
        {user ? (
          <p className="tl-user" title={user.email}>
            {user.email}
          </p>
        ) : null}
        <form action="/auth/signout" method="post">
          <button type="submit" className="tl-btn tl-btn--secondary tl-signout">
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
