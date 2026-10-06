import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** HTML element to render. Default "div". Use "article" for story cards, "li" inside lists. */
  as?: ElementType;
  /** Adds the orange hover glow. Use only when the whole card is clickable or a primary object. */
  interactive?: boolean;
  /** Removes inner padding (for tables or media that run edge to edge). */
  flush?: boolean;
  children?: ReactNode;
}

export function Card({ as: Tag = 'div', interactive = false, flush = false, className, children, ...rest }: CardProps) {
  return (
    <Tag className={cx('tl-card', interactive && 'tl-card--interactive', flush && 'tl-card--flush', className)} {...rest}>
      {children}
    </Tag>
  );
}
