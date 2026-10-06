import { fireEvent, render, screen } from '@testing-library/react';
import Shell from '@/components/shell/Shell';

let mockPath = '/dashboard';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));

const user = { email: 'editor@trendulon.test', displayName: 'Editor' };

describe('Shell', () => {
  beforeEach(() => {
    mockPath = '/dashboard';
    document.body.style.overflow = '';
  });

  it('renders children bare on /login', () => {
    mockPath = '/login';
    render(
      <Shell user={null}>
        <p>login page</p>
      </Shell>,
    );
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the menu, the signed-in email and Sign out', () => {
    render(
      <Shell user={user}>
        <p>page</p>
      </Shell>,
    );
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByText('editor@trendulon.test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('opens the drawer, locks scroll, and closes on Escape', () => {
    render(
      <Shell user={user}>
        <p>page</p>
      </Shell>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Main menu' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the drawer when the overlay is tapped', () => {
    render(
      <Shell user={user}>
        <p>page</p>
      </Shell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer when a menu link is tapped', () => {
    render(
      <Shell user={user}>
        <p>page</p>
      </Shell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog');
    const link = dialog.querySelector('a[href="/ranking"]') as HTMLElement;
    fireEvent.click(link);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
