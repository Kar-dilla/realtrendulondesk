import type { PriorityLevel } from '../../lib/contracts/newsroom';

const LABEL: Record<PriorityLevel, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

/** Rendered uppercase by CSS; the DOM text stays in sentence case. */
export function PriorityBadge({ level }: { level: PriorityLevel }) {
  return (
    <span className="tl-priority" data-level={level}>
      {LABEL[level]}
    </span>
  );
}
