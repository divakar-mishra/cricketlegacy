import { seasonEndingReminderDelaySeconds } from '../notifications';

describe('Season Pass ending reminder timing', () => {
  const periodEndsAt = Date.UTC(2026, 8, 1, 0, 0, 0, 0);

  it('targets exactly three days before the persisted UTC month boundary', () => {
    const now = Date.UTC(2026, 7, 20, 12, 0, 0, 0);

    expect(seasonEndingReminderDelaySeconds(periodEndsAt, now)).toBe(
      (periodEndsAt - now) / 1000 - 3 * 24 * 60 * 60,
    );
  });

  it.each([
    ['inside the final three days', periodEndsAt - 2 * 24 * 60 * 60],
    ['at the warning point', periodEndsAt - 3 * 24 * 60 * 60],
    ['after the period', periodEndsAt + 1],
  ])('does not schedule a stale or immediate reminder %s', (_label, now) => {
    expect(seasonEndingReminderDelaySeconds(periodEndsAt, now)).toBeNull();
  });

  it('rejects invalid timestamps', () => {
    expect(seasonEndingReminderDelaySeconds(Number.NaN, Date.now())).toBeNull();
    expect(seasonEndingReminderDelaySeconds(periodEndsAt, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
