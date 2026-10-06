import { fail, kindFromStatus, ok } from '../contracts/providers';

describe('kindFromStatus', () => {
  it('maps the statuses the fallback chains care about', () => {
    expect(kindFromStatus(429)).toBe('rate_limit');
    expect(kindFromStatus(503)).toBe('overloaded');
    expect(kindFromStatus(404)).toBe('not_found');
    expect(kindFromStatus(401)).toBe('auth');
    expect(kindFromStatus(402)).toBe('quota');
    expect(kindFromStatus(500)).toBe('unknown');
  });
});

describe('ok / fail', () => {
  it('build tagged results', () => {
    const good = ok('groq', 42);
    expect(good.ok).toBe(true);
    const bad = fail('gemini', { kind: 'not_found', message: 'model gone', status: 404 });
    expect(bad.ok).toBe(false);
  });
});
