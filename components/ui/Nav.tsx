'use client';
import { useId } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clapperboard,
  FlaskConical,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  Newspaper,
  Scale,
  Send,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { NAV_SECTIONS, type NavIconName } from '@/lib/modules';

const ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  Newspaper,
  TrendingUp,
  FlaskConical,
  Clapperboard,
  Image: ImageIcon,
  Send,
  Gauge,
  Scale,
  Settings,
};

function isActive(pathname: string | null, route: string) {
  if (!pathname) return false;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** The sidebar menu: three groups of links. Used by the desktop sidebar and the mobile drawer. */
export default function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const uid = useId();

  return (
    <nav className="tl-nav" aria-label="Main">
      {NAV_SECTIONS.map((section, i) => {
        const headingId = `${uid}-group-${i}`;
        return (
          <div key={section.group} className="tl-nav__group">
            <p className="tl-nav__heading" id={headingId}>
              {section.group}
            </p>
            <ul className="tl-nav__list" aria-labelledby={headingId}>
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.route}>
                    <Link
                      href={item.route}
                      className="tl-nav__link"
                      aria-current={isActive(pathname, item.route) ? 'page' : undefined}
                      onClick={onNavigate}
                    >
                      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
