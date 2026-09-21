'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MODULES } from '@/lib/modules';

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/dashboard" className="brand" aria-label="Trendulon home">
        {/* Logo mark cropped from supplied file at native pixels; not recolored or redrawn. */}
        <Image src="/brand/trendulon-mark.png" alt="Trendulon logo" width={37} height={40} priority />
        <span className="brand-word">
          TRENDUL<span>ON</span>
        </span>
      </Link>
      <div className="nav-links">
        {MODULES.map((m) => (
          <Link key={m.route} href={m.route} aria-current={pathname === m.route ? 'page' : undefined}>
            {m.navLabel}
          </Link>
        ))}
      </div>
    </nav>
  );
}
