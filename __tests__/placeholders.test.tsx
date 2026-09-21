import { render, screen } from '@testing-library/react';
import Discovery from '@/app/discovery/page';
import Verification from '@/app/verification/page';
import Ranking from '@/app/ranking/page';
import Selection from '@/app/selection/page';
import Research from '@/app/research/page';
import Scripts from '@/app/scripts/page';
import Visuals from '@/app/visuals/page';
import Analytics from '@/app/analytics/page';

const pages: [string, () => JSX.Element][] = [
  ['discovery', Discovery], ['verification', Verification], ['ranking', Ranking],
  ['selection', Selection], ['research', Research], ['scripts', Scripts],
  ['visuals', Visuals], ['analytics', Analytics],
];

describe('placeholder routes', () => {
  it.each(pages)('%s renders "Coming soon"', (_name, Page) => {
    render(<Page />);
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
