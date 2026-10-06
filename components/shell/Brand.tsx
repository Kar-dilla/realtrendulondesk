import Image from 'next/image';
import Link from 'next/link';

/** Logo mark + wordmark. Links to the dashboard. */
export default function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" className="tl-brand" aria-label="Trendulon Newsroom, go to dashboard" onClick={onNavigate}>
      {/* Logo mark cropped from supplied file at native pixels; not recolored or redrawn. */}
      <Image src="/brand/trendulon-mark.png" alt="" width={37} height={40} />
      <span className="tl-brand__text">
        <span className="tl-brand__word">
          TRENDUL<span>ON</span>
        </span>
        <span className="tl-brand__sub">NEWSROOM</span>
      </span>
    </Link>
  );
}
