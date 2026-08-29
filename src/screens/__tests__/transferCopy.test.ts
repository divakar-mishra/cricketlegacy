import fs from 'fs';
import path from 'path';

const transferScreen = fs.readFileSync(path.join(__dirname, '..', 'TransfersScreen.tsx'), 'utf8');
const deadlineScreen = fs.readFileSync(
  path.join(__dirname, '..', 'TransferDeadlineDayScreen.tsx'),
  'utf8',
);
const managerHubScreen = fs.readFileSync(
  path.join(__dirname, '..', 'ManagerHubScreen.tsx'),
  'utf8',
);

describe('manager transfer screen copy', () => {
  it('keeps scout market rows compact and confirms signings before spending budget', () => {
    expect(transferScreen).toContain("'Negotiate transfer'");
    expect(transferScreen).toContain('Fee: ${fmtMoney(value)}');
    expect(transferScreen).toContain('Budget after fee: ${fmtMoney(team.budget - value)}');
    expect(transferScreen).toContain(
      "scoutRevealTokens > 0 ? `Reveal (${scoutRevealTokens})` : 'Scout'",
    );
    expect(transferScreen).toContain('Scout: not scouted yet');
    expect(transferScreen).toContain('Market pressure: ${interest} rival club');
    expect(transferScreen).toContain('<Text style={styles.hotText}>Hot</Text>');
    expect(transferScreen).toContain('style={styles.rowAction}');
    expect(transferScreen).toContain('{ROLE_ABBR[p.role]} · Age {p.age}');
    expect(transferScreen).not.toContain('Unscouted: scout to estimate OVR and potential');
    expect(transferScreen).not.toContain("{isManager && !rep ? ' · Unscouted' : ''}");
  });

  it('lets manager purchases reveal full scouting intelligence in the market', () => {
    expect(transferScreen).toContain('revealFullScout');
    expect(transferScreen).toContain("'Full Scout Intelligence'");
    expect(transferScreen).toContain("revealFullScout(p.id, 'token')");
    expect(transferScreen).toContain('exact overall, fitness, form, injury status and valuation');
    expect(transferScreen).not.toContain('exact overall, potential');
    expect(transferScreen).toContain('full-reveal token');
    expect(transferScreen).toContain('Fast-track: +25 points, once per season.');
    expect(transferScreen).toContain('Normal report: ${fmtMoney(SCOUT_FEE)}');
  });

  it('keeps scouting visible but explains closed-window signing restrictions', () => {
    expect(transferScreen).toContain('Transfer window closed');
    expect(transferScreen).toContain('transferWindowLabel(save)');
    expect(transferScreen).not.toContain('Scouting stays open');
    expect(transferScreen).toContain("? 'Closed'");
    expect(transferScreen).toContain("? 'No funds'");
    expect(transferScreen).toContain("? 'Squad full'");
    expect(transferScreen).toContain('label={loanLabel}');
    expect(transferScreen).toContain('label={contractLabel}');
  });

  it('shows actionable transfer bidding details instead of a passive timer', () => {
    expect(transferScreen).toContain('Minimum next bid:');
    expect(transferScreen).toContain('Wage requirement:');
    expect(transferScreen).toContain('Remaining budget after counter:');
    expect(transferScreen).toContain('Confirm counter:');
    expect(transferScreen).toContain('accessibilityLabel="Withdraw"');
    expect(transferScreen).toContain('onExpire');
    expect(transferScreen).toContain('Outbid: deadline expired');
    expect(transferScreen).toContain('Offer rejected:');
    expect(transferScreen).toContain('Withdrawn: the player joined');
    expect(transferScreen).toContain('styles.bidActionPrimary');
    expect(transferScreen).toContain('detailMaxHeight');
    expect(transferScreen).toContain('maxHeight: detailMaxHeight');
    expect(transferScreen).toContain('Math.min(300');
    expect(transferScreen).toContain("maxHeight: '76%'");
    expect(transferScreen).toContain("justifyContent: 'center'");
  });

  it('guards visible transfer actions against rapid duplicate submissions', () => {
    expect(transferScreen).toContain('actionInFlightRef');
    expect(transferScreen).toContain('runTransferAction');
    expect(transferScreen).toContain('pendingTransferAction');
    expect(transferScreen).toContain('pending={Boolean(pendingTransferAction)}');
    expect(transferScreen).toContain('disabled={!canAfford || actionPending}');
    expect(transferScreen).toContain('disabled={!canLoan || actionPending}');
    expect(transferScreen).toMatch(
      /disabled=\{\s*!transferWindowOpen\s*\|\|\s*team\.playerIds\.length >= squadCap\s*\|\|\s*actionPending\s*\}/,
    );
    expect(transferScreen).toContain('disabled={!canRelease || actionPending}');
    expect(transferScreen).toContain('extraData={[tab, flash, pendingTransferAction]}');
  });

  it('uses the save-specific squad cap for every manager transfer action and label', () => {
    expect(transferScreen).toContain('const squadCap = maxSquadSize(save);');
    expect(transferScreen).toContain('team.playerIds.length < squadCap');
    expect(transferScreen).toContain('team.playerIds.length >= squadCap');
    expect(transferScreen).toContain('{team.playerIds.length} / {squadCap}');
    expect(transferScreen).not.toContain('MAX_SQUAD');
    // The Manager Home no longer duplicates the full squad/cap card. The
    // authoritative count and all transfer guards remain on Transfers.
    expect(managerHubScreen).not.toContain('const squadCap = maxSquadSize(save);');
    expect(managerHubScreen).not.toContain('{squad.length}/18');
  });

  it('keeps Deadline Day as a gated event with shared transfer and currency rules', () => {
    expect(managerHubScreen).toContain('isDeadlineDay(save)');
    expect(deadlineScreen).toContain('isDeadlineDay(save)');
    expect(deadlineScreen).toContain('Deadline Day Unavailable');
    expect(deadlineScreen).toContain('isTransferWindowOpen(save)');
    expect(deadlineScreen).toContain('formatClubCurrency(computeValue(p))');
    expect(deadlineScreen).toContain('label="Scout Market"');
    expect(deadlineScreen).not.toContain('Real signings are made in Scout Market');
  });
});
