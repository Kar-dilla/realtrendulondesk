import { render, screen, within } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { MODULES } from '@/lib/modules';

describe('dashboard home', () => {
  it('lists all 9 modules', () => {
    render(<DashboardPage />);
    expect(screen.getAllByTestId(/^module-/)).toHaveLength(9);
  });

  it('marks only Module 01 as Built', () => {
    render(<DashboardPage />);
    const built = screen.getAllByText('Built');
    expect(built).toHaveLength(1);
    expect(within(screen.getByTestId('module-01')).getByText('Built')).toBeInTheDocument();
    expect(screen.getAllByText('Not Built')).toHaveLength(8);
  });

  it('shows an empty state, not fabricated content', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Not yet available')).toBeInTheDocument();
  });

  it('module registry has unique numbers and routes', () => {
    expect(new Set(MODULES.map((m) => m.number)).size).toBe(9);
    expect(new Set(MODULES.map((m) => m.route)).size).toBe(9);
  });
});
