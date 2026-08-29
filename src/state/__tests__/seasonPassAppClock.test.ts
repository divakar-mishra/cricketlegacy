import fs from 'node:fs';
import path from 'node:path';

describe('app-wide Season Pass clock', () => {
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../../App.tsx'), 'utf8');
  const liveOpsCardsSource = fs.readFileSync(
    path.resolve(__dirname, '../../components/LiveOpsCards.tsx'),
    'utf8',
  );
  const seasonPassScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../../screens/SeasonPassScreen.tsx'),
    'utf8',
  );
  const careerStoreSource = fs.readFileSync(path.resolve(__dirname, '../careerStore.ts'), 'utf8');

  it('synchronizes on foreground and schedules a bounded root timer', () => {
    expect(appSource).toContain("if (nextState === 'active') {");
    expect(appSource).toContain('synchronizeSeasonPassClock(Date.now())');
    expect(appSource).toContain('if (passPeriodEndsAt == null');
    expect(appSource).toContain('Math.min(passPeriodEndsAt, premiumEntitlementExpiresAt)');
    expect(appSource).toContain('Math.min(remainingMs + 25, 3_600_000)');
    expect(appSource).toContain('if (timer) clearTimeout(timer)');
    expect(appSource).toContain(
      '}, [activeSaveId, passPeriodEndsAt, premiumEntitlementActive, premiumEntitlementExpiresAt]);',
    );
    expect(appSource).not.toContain("if (nextState === 'active') return;");
  });

  it('keeps rollover ownership at the root instead of individual pass cards', () => {
    expect(liveOpsCardsSource).not.toContain('synchronizeAtBoundary');
    expect(seasonPassScreenSource).not.toContain('synchronizeAtBoundary');
  });

  it('schedules the ending warning from the saved UTC boundary', () => {
    expect(careerStoreSource).toContain(
      'notifications.scheduleSeasonEnding(save.pass.periodEndsAt)',
    );
    expect(careerStoreSource).not.toContain('notifications.scheduleSeasonEnding()');
  });

  it('describes only real Season Pass XP sources', () => {
    expect(seasonPassScreenSource).not.toContain('Matches and completed quests earn');
    expect(seasonPassScreenSource).toContain('{pass.xp} / {nextTier.xpRequired} XP');
    expect(seasonPassScreenSource).not.toContain('training and stories earn pass XP');
  });
});
