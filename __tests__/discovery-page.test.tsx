/**
 * Requires a jsdom test environment (e.g. `@jest-environment jsdom` docblock,
 * or set globally in jest.config). Not run — see note at top of
 * discovery.test.ts. This mocks fetch; it never touches the real network.
 */

/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiscoveryPage from '../app/discovery/page';

describe('DiscoveryPage error states', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a rate-limit-specific error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ error: true, error_type: 'rate_limit', message: 'Quota hit.' }),
    }) as any;

    render(<DiscoveryPage />);
    fireEvent.click(screen.getByText('Top News — Last 24 Hours'));

    await waitFor(() =>
      expect(screen.getByText(/free-tier quota hit/i)).toBeInTheDocument()
    );
  });

  it('renders a generic error message for other failures', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ error: true, error_type: 'unknown', message: 'Something broke.' }),
    }) as any;

    render(<DiscoveryPage />);
    fireEvent.click(screen.getByText('Top News — Last 24 Hours'));

    await waitFor(() =>
      expect(screen.getByText('Discovery scan failed')).toBeInTheDocument()
    );
    expect(screen.getByText('Something broke.')).toBeInTheDocument();
  });

  it('renders discovered stories on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        error: false,
        stories: [{
          headline: 'Test headline', summary: 'Test summary', category: 'test',
          source_urls: ['https://example.com/a'], event_time: null, merged_from_count: 1,
        }],
        persisted: { inserted: 1, skipped_existing: 0 },
      }),
    }) as any;

    render(<DiscoveryPage />);
    fireEvent.click(screen.getByText('Top News — Last 24 Hours'));

    await waitFor(() => expect(screen.getByText('Test headline')).toBeInTheDocument());
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });
});
