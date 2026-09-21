import { render, screen } from '@testing-library/react';
import Nav from '@/components/ui/Nav';
import { MODULES } from '@/lib/modules';

jest.mock('next/navigation', () => ({ usePathname: () => '/discovery' }));

describe('nav', () => {
  it('links to every module route', () => {
    render(<Nav />);
    for (const m of MODULES) {
      expect(screen.getByRole('link', { name: m.navLabel })).toHaveAttribute('href', m.route);
    }
  });
  it('marks the current route', () => {
    render(<Nav />);
    expect(screen.getByRole('link', { name: 'Discovery' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});
