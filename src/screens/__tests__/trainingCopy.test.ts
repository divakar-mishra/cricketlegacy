import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'TrainingScreen.tsx'), 'utf8');

describe('training clarity copy', () => {
  it('keeps each focus compact and removes the repeated cap explanation box', () => {
    expect(source).toContain('Avg {groupAvg} · {groupLeft} left');
    expect(source).not.toContain('Possible gain:');
    expect(source).not.toContain('Current cap:');
    expect(source).not.toContain('Grade A coaching cap');
    expect(source).not.toContain('can still improve in this focus');
  });

  it('offers the accelerator only while training sessions remain', () => {
    expect(source).toContain('left > 0 ?');
    expect(source).toContain('3 boosted sessions');
    expect(source).not.toContain('Training limits still apply.');
    expect(source).toContain("navigation.navigate('Purchase')");
  });

  it('keeps coaches and equipment inside Training instead of burying them in Player Life', () => {
    expect(source).toContain('Development Centre');
    expect(source).toContain("'Open Development Centre'");
    expect(source).toContain('activeCoachCount');
    expect(source).toContain('ownedEquipmentCount');
    expect(source).toContain('<PlayerDevelopmentPanel />');
    expect(source).toContain('setShowDevelopment((current) => !current)');
    expect(source).not.toContain("initialTab: 'development'");
  });

  it('shows stage limits, direct gains, continuous OVR progress and an actionable analyst focus', () => {
    expect(source).toContain('trainingSessionLimit(save.careerPathLevel)');
    expect(source).toContain('trainingFocusSessionLimit(save.careerPathLevel)');
    expect(source).not.toContain('Costs rise with sessions and');
    expect(source).not.toContain('Every session directly improves up to three attributes.');
    expect(source).toContain('Development {development.toFixed(2)}');
    expect(source).toContain('OVR progress ${popup.oldDevelopment.toFixed(2)}');
    expect(source).toContain('+{popup.gains.reduce');
    expect(source).not.toContain('Possible gain: {possibleGain} · Cost:');
    expect(source).toContain('label={');
    expect(source).toContain('`Train · ${cost}`');
    expect(source).toContain('Analyst focus:');
    expect(source).toContain('Analyst recommendation');
    expect(source).toContain('activeAnalysis?.recommendedTrainingGroup === group.id');
    expect(source).toContain("? 'Stage cap reached'");
    expect(source).toContain("'Season limit reached'");
    expect(source).toContain('disabled={!groupTrainable || blockedByCap');
  });

  it('dismisses a completed-training result from a tap anywhere on its overlay', () => {
    expect(source).toContain('accessibilityLabel="Dismiss training result"');
    expect(source).toContain('style={styles.popupDismissSurface}');
    expect(source).toContain('onPress={() => setPopup(null)}');
    expect(source).toContain('Tap to close');
  });

  it('never traps a player who cannot afford another session', () => {
    expect(source).toContain("resolveNextCareerStep(save).action === 'ADVANCE_CAREER_CALENDAR'");
    expect(source).toContain('label="Continue without training"');
    expect(source).toContain('advanceSeason();');
    expect(source).toContain('navigation.goBack();');
  });
});
