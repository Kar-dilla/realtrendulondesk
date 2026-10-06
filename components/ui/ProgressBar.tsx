import { clamp, formatScore } from '../../lib/format';

export interface ProgressBarProps {
  label: string;
  /** null = not computed yet: shows an em dash and an empty bar. */
  value: number | null;
  /** Top of the scale. Default 10. */
  max?: number;
}

export function ProgressBar({ label, value, max = 10 }: ProgressBarProps) {
  const hasValue = value !== null && !Number.isNaN(value);
  const pct = hasValue ? clamp(((value as number) / max) * 100, 0, 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={hasValue ? clamp(value as number, 0, max) : undefined}
    >
      <div className="tl-progress__head">
        <span>{label}</span>
        <span className="tl-progress__value">{formatScore(value)}</span>
      </div>
      <div className="tl-progress__track">
        <div className="tl-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
