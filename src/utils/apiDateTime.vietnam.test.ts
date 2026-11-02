import { toVietnamInputValue, vietnamInputToIso } from './apiDateTime';

describe('Vietnam time input helpers', () => {
  it('shows an API instant in Vietnam time for datetime-local inputs', () => {
    expect(toVietnamInputValue('2026-11-03T18:00:00+07:00')).toBe('2026-11-03T18:00');
    expect(toVietnamInputValue('2026-11-03T11:00:00.000Z')).toBe('2026-11-03T18:00');
    expect(toVietnamInputValue('')).toBe('');
  });

  it('sends typed Vietnam time with an explicit offset', () => {
    expect(vietnamInputToIso('2026-11-03T18:00')).toBe('2026-11-03T18:00:00+07:00');
  });

  it('round-trips without drift', () => {
    const typed = '2026-11-03T18:00';
    expect(toVietnamInputValue(vietnamInputToIso(typed))).toBe(typed);
  });
});
