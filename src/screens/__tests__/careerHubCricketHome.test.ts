import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'CareerHubScreen.tsx'), 'utf8');

describe('Player Career cricket-first home', () => {
  it('uses the approved shared night, paper, gold and leather visual language', () => {
    expect(source).toContain('gradient={gradients.pitch}');
    expect(source).toContain("cream: '#F2E5C6'");
    expect(source).toContain("creamInk: '#281C10'");
    expect(source).toContain("creamMuted: '#6D583B'");
    expect(source).toContain("leather: '#9B3328'");
    expect(source).toContain("leatherDark: '#6F211A'");
    expect(source).toContain('variant="gold"');
  });

  it('presents saved fixture facts as a cricket ticket without invented scheduling data', () => {
    expect(source).toContain('styles.fixtureTicket, !fixture && styles.fixtureTicketCompact');
    expect(source).toContain('fixture.cupRound ?? fixture.format');
    expect(source).toContain('{fixture.venue}');
    expect(source).toContain('ROUND {fixture.round}');
    expect(source).toContain("? 'SELECTED'");
    expect(source).toContain("? 'UNAVAILABLE'");
    expect(source).toContain("? 'RESTED'");
    expect(source).toContain(": 'BENCHED'");
    expect(source).not.toContain('24 MAY');
    expect(source).not.toContain('10:00 AM');
    expect(source).not.toContain('28°C');
  });

  it('keeps every next-action branch and fixture-side action wired to existing handlers', () => {
    expect(source).toContain('onPress={runPrimaryAction}');
    expect(source).toContain("calendarEvent?.kind === 'EXAM'");
    expect(source).toContain("calendarEvent?.kind === 'NCA_CAMP'");
    expect(source).toContain("calendarEvent?.kind === 'SELECTION'");
    expect(source).toContain("'Attend Selection Meeting'");
    expect(source).toContain("calendarEvent?.kind === 'RECOVERY'");
    expect(source).toContain("'Complete Recovery Week'");
    expect(source).toContain('onPress={() => resolveCalendar()}');
    expect(source).toContain('setCareerRestNext(!restRequested)');
    expect(source).toContain("navigation.navigate('Squad')");
    expect(source).not.toContain('<CupCard');
    expect(source).toContain('const outcome = advanceWhileBenched()');
    expect(source).toContain('newSeason();');
    expect(source).toContain("case 'ADVANCE_CAREER_CALENDAR':");
    expect(source).toContain('advanceSeason();');
    expect(source).toContain('label="Train first"');
  });

  it('keeps every non-fixture next chapter action inside the top ticket', () => {
    expect(source).toContain('primaryCalendarNeedsChoice');
    expect(source).toContain('primaryCalendarAdvancesDirectly');
    expect(source).toContain('{!fixture && !primaryIsCalendar ? (');
    expect(source).toContain('style={styles.ticketPrimaryAction}');
    expect(source).toContain('{fixture && !primaryIsCalendar ? (');
    expect(source).toContain("? 'Continue season'");
  });

  it('derives Current Form only from appearances and surfaces one timely off-field action', () => {
    expect(source).toContain('save.playerLife?.recentMatches?.slice(0, 5)');
    expect(source).toContain('RECENT SCORES');
    expect(source).toContain('NO APPEARANCES YET');
    expect(source).toContain('OFF-FIELD OPPORTUNITY');
    expect(source).toContain('Kit sponsor offers ready');
    expect(source).toContain('Portfolio is now available');
    expect(source).toContain('Your academy is ready');
    expect(source.indexOf('styles.fixtureTicketWrap')).toBeLessThan(
      source.indexOf('styles.offFieldOpportunity'),
    );
    expect(source.indexOf('styles.offFieldOpportunity')).toBeLessThan(
      source.indexOf('styles.formScoreboard'),
    );
    expect(source).not.toContain('styles.offFieldBoard');
    expect(source).toContain('<SeasonPassHomeCard />');
    expect(source.indexOf('styles.fixtureTicketWrap')).toBeLessThan(
      source.indexOf('<SeasonPassHomeCard />'),
    );
    expect(source).not.toContain('<LiveOpsCards compact />');
    expect(source).not.toContain('styles.homePrimaryAction');
    expect(source).not.toContain('match win streak!');
    expect(source).not.toContain('<OfferBanner');
    expect(source).not.toContain('<ContextualOffer');
  });

  it('keeps identity, readiness, wallet and profile access on the redesigned home', () => {
    expect(source).toContain('styles.playerMasthead');
    expect(source).toContain('compact && styles.playerMastheadCompact');
    expect(source).toContain('styles.mastheadProfileLink');
    expect(source).toContain('styles.mastheadLifeAction');
    expect(source).toContain('PLAYER LIFE');
    expect(source).toContain("navigation.navigate('PlayerLife')");
    expect(source).toContain('earnedSponsor={sponsorBranding.earned}');
    expect(source).toContain('premiumSponsor={sponsorBranding.premium}');
    expect(source).toContain("user.injury ? 'IN RECOVERY' : 'AVAILABLE'");
    expect(source).not.toContain('AVAILABLE · LOW CONDITION');
    expect(source).toContain('IN RECOVERY');
    expect(source).toContain('coachTrust');
    expect(source).toContain('<WalletBar wallet={save.wallet} />');
    expect(source).toContain("navigation.navigate('PlayerProfile', { playerId: user.id })");
  });

  it('makes annual age progression explicit at the season boundary', () => {
    expect(source).toContain('const careerSeasonNumber = (save.careerSeasons ?? 0) + 1;');
    expect(source).toContain('`Start Season ${careerSeasonNumber + 1}`');
    expect(source).toContain('Season ${careerSeasonNumber}');
  });
});
