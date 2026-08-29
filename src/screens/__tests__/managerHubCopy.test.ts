import fs from 'fs';
import path from 'path';

const managerHubScreen = fs.readFileSync(
  path.join(__dirname, '..', 'ManagerHubScreen.tsx'),
  'utf8',
);

describe('manager hub clarity', () => {
  it('removes the duplicate Club Identity band and keeps the next action clear', () => {
    expect(managerHubScreen).not.toContain('CLUB IDENTITY');
    expect(managerHubScreen).not.toContain('clubIdentityBand');
    expect(managerHubScreen).not.toContain('<CareerSpotlight');
    expect(managerHubScreen).toContain('styles.managerMasthead');
    expect(managerHubScreen).toContain('styles.fixtureTicket');
    expect(managerHubScreen).toContain('{managerMeta}');
    expect(managerHubScreen).toContain('numberOfLines={2}');
  });

  it('keeps premium backing copy off the cricket-first home masthead', () => {
    expect(managerHubScreen).not.toContain('manager_legend_backing');
    expect(managerHubScreen).not.toContain('Legend backing');
    expect(managerHubScreen).toContain('<SponsorBrandRow');
  });

  it('explains that multi-format choices stay inside the earned manager level', () => {
    expect(managerHubScreen).toContain('Multi-Format Schedule');
    expect(managerHubScreen).toContain('otherCompetitionOptions.map');
    expect(managerHubScreen).not.toContain('no manager-ladder bypass');
  });

  it('keeps squad recovery out of the home dashboard', () => {
    expect(managerHubScreen).not.toContain('Physio Recovery Pack');
    expect(managerHubScreen).not.toContain('applySquadRecovery');
    expect(managerHubScreen).not.toContain("purchaseProduct('recovery_pack')");
  });

  it('does not duplicate match preparation services on the manager home screen', () => {
    expect(managerHubScreen).not.toContain('<Text style={styles.section}>Match Preparation</Text>');
    expect(managerHubScreen).not.toContain('Review the XI, prepare one opposition report');
  });

  it('keeps the home dashboard factual without repeating explanatory paragraphs', () => {
    expect(managerHubScreen).not.toContain('lastImpact.narrative');
    expect(managerHubScreen).not.toContain('lastImpact.why[0]');
    expect(managerHubScreen).not.toContain('nextStep.detail');
    expect(managerHubScreen).not.toContain('MANAGER_LEVEL_DESC');
    expect(managerHubScreen).not.toContain('status={`SEASON');
    expect(managerHubScreen).not.toContain('Coins: Matchday services.');
    expect(managerHubScreen).toContain('onPress={runNextStep}');
    expect(managerHubScreen).toContain('Target: Top {save.boardObjective.targetPosition}');
    expect(managerHubScreen).not.toContain('Miss the board target and you may be dismissed.');
    expect(managerHubScreen).not.toContain('Use 1 token to restore condition, fitness and morale.');
  });

  it('uses the approved cricket-first materials without changing the shared theme', () => {
    expect(managerHubScreen).toContain("paper: '#F2E5C6'");
    expect(managerHubScreen).toContain("leather: '#9B3328'");
    expect(managerHubScreen).toContain('★  MATCHDAY ACCREDITATION  ★');
    expect(managerHubScreen).toContain('styles.ticketDetails');
    expect(managerHubScreen).toContain('{fixtureDateLabel}');
    expect(managerHubScreen).toContain('{nextFixture.venue}');
    expect(managerHubScreen).toContain('variant="gold" size="lg" onPress={runNextStep}');
    expect(managerHubScreen).toContain('gradient={gradients.pitch}');
  });

  it('keeps every non-match blocker above secondary manager content', () => {
    expect(managerHubScreen).toContain("nextStep.action === 'PLAY_MATCH'");
    expect(managerHubScreen).toContain('★  MANAGER DESK  ★');
    expect(managerHubScreen).toContain('{nextStep.title}');
    expect(managerHubScreen.indexOf('styles.continueAction')).toBeLessThan(
      managerHubScreen.indexOf('styles.navGrid'),
    );
  });

  it('shows board information only for an urgent job-risk state', () => {
    expect(managerHubScreen).toContain('save.boardObjective && confidenceScore < 35');
    expect(managerHubScreen).toContain("label: 'Ultimatum'");
    expect(managerHubScreen).toContain("label: 'Sacking imminent'");
    expect(managerHubScreen).toContain('${confidenceScore} percent');
    expect(managerHubScreen).not.toContain('{confidenceScore}% confidence');
    expect(managerHubScreen).not.toContain("label: 'Secure'");
    expect(managerHubScreen).not.toContain("label: 'Watching'");
    expect(managerHubScreen).not.toContain('styles.boardMeterTrack');
  });

  it('keeps the approved manager home layout compact', () => {
    expect(managerHubScreen).not.toContain('Current Competition');
    expect(managerHubScreen).not.toContain('Squad Readiness');
    expect(managerHubScreen).not.toContain('Last result:');
    expect(managerHubScreen).not.toContain('Objectives &amp; Pass');
    expect(managerHubScreen).not.toContain('<LiveOpsCards />');
    expect(managerHubScreen).toContain('<SeasonPassHomeCard />');
    expect(managerHubScreen).not.toContain('<LeagueTable');
    expect(managerHubScreen).not.toContain('📊 Management Record');
    expect(managerHubScreen).not.toContain('Top of the table');
    expect(managerHubScreen).not.toContain('match win streak!');
    expect(managerHubScreen).not.toContain('xiExpanded');
    expect(managerHubScreen).not.toContain('label="Wage Ledger"');
    expect(managerHubScreen).not.toContain('{/* Manager Career Level card */}');
    expect(managerHubScreen).not.toContain('styles.levelCard');
    expect(managerHubScreen).not.toContain("label: 'Club Office', to: 'ClubOffice'");
    expect(managerHubScreen).not.toContain("label: 'Records', to: 'Records'");
  });

  it('asks the manager to review auto-appointed leaders without exposing club tools on national duty', () => {
    expect(managerHubScreen).toContain('leadershipReviewFlag(save.userTeamId)');
    expect(managerHubScreen).toContain('Review team leadership');
    expect(managerHubScreen).toContain("navigation.navigate('ManagerLeadership')");
    expect(managerHubScreen).toContain('...(!isNationalManager');
  });

  it('preserves the existing destination screens through the bottom tabs', () => {
    expect(managerHubScreen).toContain("navigation.navigate('ClubOffice')");
    expect(managerHubScreen).toContain("navigation.navigate('Records')");
    expect(managerHubScreen).toContain("label: 'Team Sheet'");
    expect(managerHubScreen).toContain("to: 'Squad'");
    expect(managerHubScreen).toContain("key: 'transfers'");
    expect(managerHubScreen).toContain("label: 'Transfers'");
    expect(managerHubScreen).toContain("to: 'Transfers' as const");
  });

  it('keeps reward-claim clutter off Home while exposing the compact Season Pass entry', () => {
    expect(managerHubScreen).not.toContain('Objectives &amp; Pass');
    expect(managerHubScreen).not.toContain('claimDaily');
    expect(managerHubScreen).not.toContain('claimQuestReward');
    expect(managerHubScreen).not.toContain('claimWeeklyReward');
    expect(managerHubScreen).toContain('<SeasonPassHomeCard />');
    expect(managerHubScreen).toContain("navigation.navigate('Purchase')");
  });

  it('uses the saved board confidence instead of deriving a second score from position', () => {
    expect(managerHubScreen).toContain('!isNationalManager && save.boardObjective');
    expect(managerHubScreen).toContain("nextStep.action === 'OPEN_JOB_SEARCH'");
    expect(managerHubScreen).toContain('Choose your next club');
    expect(managerHubScreen).toContain('divisionAppointments.length ? divisionAppointments');
    expect(managerHubScreen).toContain('Math.round(save.boardConfidence ?? 60)');
    expect(managerHubScreen).not.toContain('100 - ((currentPos - 1)');
  });

  it('reports broadcast rights and fixture-paid kit sponsorship separately', () => {
    expect(managerHubScreen).toContain('Broadcast rights:');
    expect(managerHubScreen).toContain('Kit sponsorship:');
    expect(managerHubScreen).not.toContain('Sponsor and broadcast income:');
  });
});
