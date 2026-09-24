'use client';

export type BadgeTier = 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED' | null;

const TIER_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: 'CONFIRMED', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)' },
  REPORTED: { label: 'REPORTED', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  UNVERIFIED: { label: 'UNVERIFIED', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  DISPUTED: { label: 'DISPUTED', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
};

const baseStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.03em',
};

export function VerificationBadge({ tier }: { tier: BadgeTier }) {
  const style = tier ? TIER_STYLES[tier] : null;

  if (!style) {
    return (
      <span
        style={{
          ...baseStyle,
          color: '#8C8C8C',
          background: 'rgba(140, 140, 140, 0.12)',
          border: '1px solid #2A2A2A',
        }}
      >
        Not yet verified
      </span>
    );
  }

  return (
    <span
      style={{
        ...baseStyle,
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.color}`,
      }}
    >
      {style.label}
    </span>
  );
}
