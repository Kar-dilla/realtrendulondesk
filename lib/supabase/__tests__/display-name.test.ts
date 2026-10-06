import { toDisplayName } from '../display-name';

describe('toDisplayName', () => {
  it('prefers user_metadata.name', () => {
    expect(toDisplayName('charles@example.com', 'Charles Dom')).toBe('Charles Dom');
  });
  it('falls back to the capitalised part of the email before @', () => {
    expect(toDisplayName('charlesdom009@example.com')).toBe('Charlesdom009');
    expect(toDisplayName('charles@example.com', '   ')).toBe('Charles');
    expect(toDisplayName('charles@example.com', 42)).toBe('Charles');
  });
});
