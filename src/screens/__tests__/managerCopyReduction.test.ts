import fs from 'fs';
import path from 'path';

const readScreen = (name: string) =>
  fs.readFileSync(path.join(__dirname, '..', `${name}Screen.tsx`), 'utf8');

const clubOffice = readScreen('ClubOffice');
const squad = readScreen('Squad');
const press = readScreen('PressConference');
const transfers = readScreen('Transfers');
const academy = readScreen('Academy');

describe('compact manager copy', () => {
  it('keeps Club Office resource limits and costs while removing duplicate explanation', () => {
    expect(clubOffice).toContain('3 stronger candidates this season');
    expect(clubOffice).not.toContain('Hiring still uses club budget and');
    expect(clubOffice).toContain('`${MANAGER_ELITE_STAFF_SEARCH_GEMS} gems`');
    expect(clubOffice).toContain("runManagerResource('ELITE_STAFF_SEARCH')");
    expect(clubOffice).not.toContain('Club budget: transfers, staff, facilities and wages.');
    expect(clubOffice).not.toContain('Matchday handles fixture services.');
    expect(clubOffice).not.toContain('Fixture services:\n          Matchday.');
  });

  it('stacks Club Office finance actions before either label can leave a phone card', () => {
    expect(clubOffice).toContain('const compactActions = useIsCompact(520);');
    expect(clubOffice).toContain(
      'style={[styles.financeActions, compactActions && styles.financeActionsCompact]}',
    );
    expect(clubOffice).toContain('fullWidth={compactActions}');
    expect(clubOffice).toContain("financeActionsCompact: { flexDirection: 'column' }");
    expect(clubOffice).toContain('label="Emergency Funds"');
    expect(clubOffice).toContain("purchaseProduct('transfer_budget_sm')");
  });

  it('states XI autosave and the powerplay field rule once in compact language', () => {
    expect(squad).toContain('Powerplay · max 2 outside');
    expect(squad).not.toContain('Your default returns afterward.');
    expect(squad).not.toContain('XI, order and tactics save automatically.');
    expect(squad).toContain('onPress={() => setTactics({ ...tactics, field: o.value })}');
    expect(squad).toContain('onPress={() => swapBenchIntoSlot(i)}');
    expect(squad).not.toContain('when the circle restriction allows it');
    expect(squad).toContain('Captain & vice-captain');
    expect(squad).not.toContain('Transfer budget');
  });

  it('shortens empty Press copy without changing choice resolution', () => {
    expect(press).toContain('No media duties right now.');
    expect(press).toContain('resolvePress(rendered.id, choiceId)');
    expect(press).toContain('rendered.choices.map((c) =>');
    expect(press).not.toContain('the press and the board will want a word');
  });

  it('hands a completed press duty to the existing resolver without forcing navigation', () => {
    expect(press).toContain('resolveNextCareerStep(save)');
    expect(press).toContain("nextStep.action === 'OPEN_PRESS'");
    expect(press).toContain("nextStep.action === 'PLAY_MATCH'");
    expect(press).toContain("navigation.replace('Match')");
    expect(press).toContain('label="Return to Home"');
  });

  it('keeps transfer warnings and consequences explicit in the shorter copy', () => {
    expect(transfers).toContain('Transfer window closed');
    expect(transfers).toContain('transferWindowLabel(save)');
    expect(transfers).not.toContain('Signings, loans and contracts resume next window.');
    expect(transfers).toContain('Decide now or lose the player.');
    expect(transfers).toContain('Outbid: deadline expired; the player joined');
  });

  it('states each academy intake effect once and accurately', () => {
    expect(academy).toContain('Academy development');
    expect(academy).toContain('Next intake · ${nextIntake');
    expect(academy).not.toContain('Academy levels increase intake size and quality');
    expect(academy).not.toContain('stronger levels improve each annual intake');
  });
});
