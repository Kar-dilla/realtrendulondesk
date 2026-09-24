import { render, screen } from '@testing-library/react';
import { VerificationBadge } from '../VerificationBadge';

describe('VerificationBadge', () => {
  it('renders CONFIRMED', () => {
    render(<VerificationBadge tier="CONFIRMED" />);
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('renders REPORTED', () => {
    render(<VerificationBadge tier="REPORTED" />);
    expect(screen.getByText('REPORTED')).toBeInTheDocument();
  });

  it('renders UNVERIFIED', () => {
    render(<VerificationBadge tier="UNVERIFIED" />);
    expect(screen.getByText('UNVERIFIED')).toBeInTheDocument();
  });

  it('renders DISPUTED', () => {
    render(<VerificationBadge tier="DISPUTED" />);
    expect(screen.getByText('DISPUTED')).toBeInTheDocument();
  });

  it('renders "Not yet verified" for a null tier rather than fabricating one', () => {
    render(<VerificationBadge tier={null} />);
    expect(screen.getByText('Not yet verified')).toBeInTheDocument();
  });
});
