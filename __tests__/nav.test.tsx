import { render, screen } from '@testing-library/react';
import Nav from '@/components/ui/Nav';
import { NAV_SECTIONS } from '@/lib/modules';

jest.mock('next/navigation', () => ({ usePathname: () => '/discovery' }));

describe('nav', () => {
  it('links to every sidebar route', () => {
    render(<Nav />);
    for (const section of NAV_SECTIONS) {
      for (const item of section.items) {
        expect(screen.getByRole('link', { name: item.label })).toHaveAttribute('href', item.route);
      }
    }
  });
  it('lists the three groups with their links', () => {
    render(<Nav />);
    for (const section of NAV_SECTIONS) {
      expect(screen.getByRole('list', { name: section.group })).toBeInTheDocument();
    }
    expect(NAV_SECTIONS.map((s) => s.group)).toEqual(['NEWSROOM', 'RESULTS', 'CONFIGURE']);
  });
  it('marks the current route', () => {
    render(<Nav />);
    expect(screen.getByRole('link', { name: "Today's News" })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
  it('keeps /verification and /selection out of the sidebar', () => {
    render(<Nav />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/verification');
    expect(hrefs).not.toContain('/selection');
  });
});
