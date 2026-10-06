import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  icon?: ReactNode;
  /** When set, renders a Next.js Link styled as a button. */
  href?: string;
  className?: string;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, href, className, children, ...rest }: ButtonProps) {
  const cls = cx('tl-btn', `tl-btn--${variant}`, size === 'sm' && 'tl-btn--sm', className);
  const inner = (
    <>
      {icon ? (
        <span className="tl-btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  );
}
