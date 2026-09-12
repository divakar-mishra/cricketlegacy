import { cricketerScale, deliveryCaption, visualRunningCount } from '../fieldPresentation';

describe('live field presentation', () => {
  it('uses semantic results, not guesses from a ball position', () => {
    expect(deliveryCaption({ tone: 'four', runs: 4 }).mark).toBe('4');
    expect(deliveryCaption({ tone: 'six', runs: 6 }).title).toBe('Over the rope');
    expect(deliveryCaption({ tone: 'extra', runs: 1 }).title).toBe('Extras');
    expect(deliveryCaption({ tone: 'normal', runs: 0 }).title).toBe('Dot ball');
    expect(deliveryCaption({ tone: 'normal', runs: 1 }).title).toBe('1 run');
    expect(deliveryCaption({ tone: 'normal', runs: 3 }).title).toBe('3 runs');
    expect(deliveryCaption(null).title).toBe('Ready at the crease');
  });

  it('shows only supplied delivery/shot and dismissal details', () => {
    expect(
      deliveryCaption({ tone: 'normal', delivery: 'GOOD_LENGTH', shot: 'COVER_DRIVE' }).detail,
    ).toBe('good length · cover drive');
    expect(deliveryCaption({ tone: 'wicket', dismissalType: 'RUN_OUT' }).detail).toBe('run out');
    expect(deliveryCaption({ tone: 'wicket' }).detail).toBe('');
  });

  it('does not send the batters running three times on a four or six', () => {
    expect(visualRunningCount({ tone: 'four', runs: 4 })).toBe(0);
    expect(visualRunningCount({ tone: 'six', runs: 6 })).toBe(0);
    expect(visualRunningCount({ tone: 'wicket', runs: 1 })).toBe(0);
    expect(visualRunningCount({ tone: 'normal', runs: 2 })).toBe(2);
    expect(visualRunningCount(null)).toBe(0);
  });

  it('keeps equipment inside sprite bounds at every field size', () => {
    for (const role of ['fielder', 'batter', 'bowler', 'keeper'] as const) {
      // The furthest limb/bat is 10 glyph units from the origin in a +/-16 viewbox.
      expect(10 * cricketerScale(role)).toBeLessThan(16);
    }
    expect(cricketerScale('batter')).toBeGreaterThan(cricketerScale('fielder'));
  });
});
