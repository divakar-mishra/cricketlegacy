import {
  Fixture,
  Format,
  ManagerClubSponsorshipState,
  ManagerCareerLevel,
  ManagerSponsorStature,
  PlayerSponsorStature,
  SaveGame,
  SponsorshipContract,
  SponsorshipOffer,
  SponsorshipState,
} from '../domain/types';
import { createManagerClubState } from './managerClubState';
import {
  earnedSponsorBrandFor,
  PREMIUM_SPONSOR_BRAND,
  withEarnedSponsorBrand,
} from './sponsorBrands';

export interface SponsorActionResult {
  ok: boolean;
  reason?: string;
  contract?: SponsorshipContract;
  signingBonus?: number;
}

export interface SponsorFixturePayout {
  earned: number;
  premium: number;
  endorsements: number;
  destination: 'WALLET_COINS' | 'CLUB_BALANCE';
}

export interface ActiveSponsorBranding {
  earned?: { brandId?: string; brandName: string };
  premium?: { brandId: typeof PREMIUM_SPONSOR_BRAND.id; brandName: string };
}

const PLAYER_OFFER_BASES = [
  {
    key: 'all',
    label: 'All formats',
    scope: 'ALL_FORMATS' as const,
    fixtureQuota: 16,
    appearancePayout: 110,
  },
  {
    key: 'white',
    label: 'White ball',
    scope: 'WHITE_BALL' as const,
    fixtureQuota: 10,
    appearancePayout: 180,
  },
  {
    key: 'red',
    label: 'Red ball',
    scope: 'RED_BALL' as const,
    fixtureQuota: 6,
    appearancePayout: 300,
  },
] as const;

const MANAGER_OFFERS = {
  CLUB: [
    { key: 'all', label: 'All formats', scope: 'ALL_FORMATS', quota: 14, fee: 22_000, win: 0 },
    { key: 't20', label: 'T20', scope: 'T20_ONLY', quota: 10, fee: 32_000, win: 0 },
    { key: 'results', label: 'Results', scope: 'RESULTS', quota: 14, fee: 14_000, win: 18_000 },
  ],
  STATE: [
    { key: 'all', label: 'All formats', scope: 'ALL_FORMATS', quota: 18, fee: 24_000, win: 0 },
    { key: 'white', label: 'White ball', scope: 'WHITE_BALL', quota: 14, fee: 32_000, win: 0 },
    { key: 'results', label: 'Results', scope: 'RESULTS', quota: 18, fee: 18_000, win: 16_000 },
  ],
  ELITE: [
    { key: 'all', label: 'All formats', scope: 'ALL_FORMATS', quota: 20, fee: 28_000, win: 0 },
    { key: 't20', label: 'T20', scope: 'T20_ONLY', quota: 12, fee: 46_000, win: 0 },
    { key: 'results', label: 'Results', scope: 'RESULTS', quota: 20, fee: 20_000, win: 17_000 },
  ],
} as const;

export const PLAYER_PREMIUM_WEEKLY_STIPEND: Record<PlayerSponsorStature, number> = {
  DOMESTIC: 250,
  FRANCHISE: 350,
  INTERNATIONAL: 500,
  ICON: 650,
};

export const MANAGER_PREMIUM_WEEKLY_STIPEND: Record<ManagerSponsorStature, number> = {
  CLUB: 30_000,
  STATE: 40_000,
  ELITE: 55_000,
};

function currentSeasonId(save: SaveGame): string {
  return save.currentSeasonId ?? `season:${save.currentMonth ?? 0}`;
}

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

export function playerSponsorStature(save: SaveGame): PlayerSponsorStature {
  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  if (save.capped && ((save.userCaps ?? 0) >= 40 || (player?.overall ?? 0) >= 82)) return 'ICON';
  if (save.capped) return 'INTERNATIONAL';
  if ((player?.overall ?? 0) >= 68) return 'FRANCHISE';
  return 'DOMESTIC';
}

function playerStatureMultiplier(stature: PlayerSponsorStature): number {
  if (stature === 'FRANCHISE') return 1.25;
  if (stature === 'INTERNATIONAL') return 1.6;
  if (stature === 'ICON') return 2;
  return 1;
}

export function managerSponsorStature(
  level: ManagerCareerLevel | undefined,
): ManagerSponsorStature | undefined {
  if (level === 'NATIONAL') return undefined;
  return level ?? 'CLUB';
}

export function playerEarnedSponsorUnlocked(save: SaveGame): boolean {
  return (
    save.mode === 'career' &&
    Boolean(save.userPlayerId) &&
    save.careerPathLevel !== 'SCHOOL' &&
    save.careerPathLevel !== 'U19' &&
    Boolean(save.sponsorship?.seniorDomesticDebutFixtureId)
  );
}

export function managerEarnedSponsorUnlocked(save: SaveGame): boolean {
  return save.mode === 'manager' && managerSponsorStature(save.managerCareerLevel) != null;
}

/** The permanent extra slot appears only after ordinary sponsorship unlocks. */
export function premiumSponsorStoreUnlocked(save: SaveGame): boolean {
  if (save.mode === 'manager') return managerEarnedSponsorUnlocked(save);
  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const verifiedDomesticDebut =
    Boolean(save.sponsorship?.seniorDomesticDebutFixtureId) ||
    (player?.domesticStats?.matches ?? 0) > 0;
  return (
    Boolean(save.userPlayerId) &&
    save.careerPathLevel !== 'SCHOOL' &&
    save.careerPathLevel !== 'U19' &&
    verifiedDomesticDebut
  );
}

/**
 * Story-event endorsements are independent, off-shirt campaigns. Older builds
 * temporarily mirrored one of them into the earned kit slot; detach that mirror
 * while carrying its payout ledger back to the original campaign.
 */
export function synchronizeLegacyEndorsementCampaigns(save: SaveGame): void {
  if (save.mode !== 'career') return;
  for (const sponsor of save.sponsors ?? []) {
    sponsor.paidFixtureIds = [...new Set(sponsor.paidFixtureIds ?? [])];
    sponsor.totalPaid = Math.max(0, Math.round(sponsor.totalPaid ?? 0));
  }
  const state = save.sponsorship;
  if (!state) return;
  const mirrored = [
    ...(state.activeEarned?.legacySponsorId ? [state.activeEarned] : []),
    ...state.history.filter((contract) => Boolean(contract.legacySponsorId)),
  ];
  for (const contract of mirrored) {
    const sponsor = (save.sponsors ?? []).find(
      (candidate) => candidate.id === contract.legacySponsorId,
    );
    if (!sponsor) continue;
    sponsor.paidFixtureIds = [
      ...new Set([...(sponsor.paidFixtureIds ?? []), ...(contract.paidFixtureIds ?? [])]),
    ];
    sponsor.totalPaid = Math.max(sponsor.totalPaid ?? 0, contract.totalPaid ?? 0);
  }
  if (state.activeEarned?.legacySponsorId) state.activeEarned = undefined;
  state.history = state.history.filter((contract) => !contract.legacySponsorId);
  state.legacySponsorMigrationComplete = true;
}

export function ensureSponsorshipState(
  save: SaveGame,
  _now: number = Date.now(),
): SponsorshipState {
  if (!save.sponsorship) {
    save.sponsorship = {
      offers: [],
      history: [],
      acceptedOfferSeasonIds: [],
      earnedThisSeason: 0,
      earnedSeasonId: currentSeasonId(save),
      legacySponsorMigrationComplete: true,
    };
  }
  const state = save.sponsorship;
  state.offers = (state.offers ?? []).map(withEarnedSponsorBrand);
  state.history = (state.history ?? []).map(withEarnedSponsorBrand);
  if (state.activeEarned) state.activeEarned = withEarnedSponsorBrand(state.activeEarned);
  state.acceptedOfferSeasonIds ??= [];
  state.earnedThisSeason = Math.max(0, Math.round(state.earnedThisSeason ?? 0));
  state.premiumThisSeason = Math.max(0, Math.round(state.premiumThisSeason ?? 0));
  state.earnedSeasonId ??= currentSeasonId(save);
  if (!state.seniorDomesticDebutFixtureId && save.mode === 'career' && save.userPlayerId) {
    const user = save.players[save.userPlayerId];
    if ((user?.domesticStats?.matches ?? 0) > 0) {
      state.seniorDomesticDebutFixtureId = 'legacy:verified-domestic-stats';
    }
  }
  synchronizeLegacyEndorsementCampaigns(save);
  if (state.premium) {
    state.premium.brandId = PREMIUM_SPONSOR_BRAND.id;
    state.premium.brandName = PREMIUM_SPONSOR_BRAND.name;
  }
  return state;
}

function emptyManagerClubSponsorship(save: SaveGame): ManagerClubSponsorshipState {
  return {
    offers: [],
    history: [],
    acceptedOfferSeasonIds: [],
    earnedThisSeason: 0,
    premiumThisSeason: 0,
    earnedSeasonId: currentSeasonId(save),
  };
}

/** Lazily repairs and returns the canonical sponsor ledger owned by one club. */
export function managerClubSponsorshipState(
  save: SaveGame,
  teamId: string,
): ManagerClubSponsorshipState | undefined {
  if (save.mode !== 'manager' || !save.teams[teamId] || save.teams[teamId].isNationalTeam) {
    return undefined;
  }
  save.managerClubs ??= {};
  save.managerClubs[teamId] ??= createManagerClubState(save, teamId);
  const club = save.managerClubs[teamId];
  club.sponsorship ??= emptyManagerClubSponsorship(save);
  const state = club.sponsorship;
  state.offers = (state.offers ?? []).map(withEarnedSponsorBrand);
  state.history = (state.history ?? []).map(withEarnedSponsorBrand);
  state.acceptedOfferSeasonIds ??= [];
  state.earnedThisSeason = Math.max(0, Math.round(state.earnedThisSeason ?? 0));
  state.premiumThisSeason = Math.max(0, Math.round(state.premiumThisSeason ?? 0));
  state.earnedSeasonId ??= currentSeasonId(save);
  if (state.activeEarned) {
    state.activeEarned = withEarnedSponsorBrand(state.activeEarned);
    state.activeEarned.boundTeamId = teamId;
    state.activeEarned.paidFixtureIds ??= [];
  }
  return state;
}

export function activeManagerClubSponsorshipState(
  save: SaveGame,
): ManagerClubSponsorshipState | undefined {
  return save.userTeamId ? managerClubSponsorshipState(save, save.userTeamId) : undefined;
}

export function activeEarnedSponsorContract(save: SaveGame): SponsorshipContract | undefined {
  if (save.mode === 'manager') return activeManagerClubSponsorshipState(save)?.activeEarned;
  return ensureSponsorshipState(save).activeEarned;
}

/**
 * v36 compatibility: move the former save-owned Manager earned deal into the
 * club it was signed for. The permanent grant deliberately stays on the save.
 */
export function synchronizeManagerClubSponsorshipOwnership(save: SaveGame): void {
  if (save.mode !== 'manager') return;
  const global = ensureSponsorshipState(save);
  const fallbackTeamId = save.userTeamId;
  if (!fallbackTeamId) return;

  const active = global.activeEarned?.mode === 'manager' ? global.activeEarned : undefined;
  const managerHistory = global.history
    .filter((entry) => entry.mode === 'manager')
    .slice()
    .sort((left, right) => right.acceptedAt - left.acceptedAt);
  const contractTeamId = active?.boundTeamId ?? fallbackTeamId;
  const contractState = managerClubSponsorshipState(save, contractTeamId);
  if (active && contractState && !contractState.activeEarned) {
    contractState.activeEarned = {
      ...active,
      boundTeamId: contractTeamId,
      paidFixtureIds: [...(active.paidFixtureIds ?? [])],
    };
  }

  for (const contract of managerHistory) {
    const teamId = contract.boundTeamId ?? fallbackTeamId;
    const target = managerClubSponsorshipState(save, teamId);
    if (!target || target.history.some((entry) => entry.id === contract.id)) continue;
    target.history.push({
      ...contract,
      boundTeamId: teamId,
      paidFixtureIds: [...(contract.paidFixtureIds ?? [])],
    });
  }

  // Persisted offers were generated for the club that was active when the save
  // was written. Accepted seasons and income, however, follow the contract that
  // earned them. A quota-completed deal lives only in history, so routing those
  // fields to today's club would incorrectly block that new club's own offers.
  const offerTarget = managerClubSponsorshipState(save, fallbackTeamId);
  if (offerTarget) {
    if (!offerTarget.offers.length) {
      offerTarget.offers = global.offers
        .filter((offer) => offer.mode === 'manager')
        .map((offer) => ({ ...offer }));
      offerTarget.offerSeasonId = global.offerSeasonId;
    }
  }

  for (const acceptedSeasonId of global.acceptedOfferSeasonIds) {
    const seasonContract =
      (active?.acceptedSeasonId === acceptedSeasonId ? active : undefined) ??
      managerHistory.find((contract) => contract.acceptedSeasonId === acceptedSeasonId);
    const teamId = seasonContract?.boundTeamId ?? fallbackTeamId;
    const target = managerClubSponsorshipState(save, teamId);
    if (target && !target.acceptedOfferSeasonIds.includes(acceptedSeasonId)) {
      target.acceptedOfferSeasonIds.push(acceptedSeasonId);
    }
  }

  const earnedSeasonId = global.earnedSeasonId ?? currentSeasonId(save);
  const earnedContract =
    active ??
    managerHistory.find((contract) => contract.acceptedSeasonId === earnedSeasonId) ??
    managerHistory.find((contract) =>
      global.acceptedOfferSeasonIds.includes(contract.acceptedSeasonId),
    );
  const earnedTarget = managerClubSponsorshipState(
    save,
    earnedContract?.boundTeamId ?? fallbackTeamId,
  );
  if (earnedTarget) {
    earnedTarget.earnedThisSeason += Math.max(0, Math.round(global.earnedThisSeason ?? 0));
    earnedTarget.earnedSeasonId = earnedSeasonId;
  }

  const activeClub = managerClubSponsorshipState(save, fallbackTeamId);
  if (activeClub) {
    activeClub.premiumThisSeason += Math.max(0, Math.round(global.premiumThisSeason ?? 0));
    if (
      global.lastKitSponsorSeasonId &&
      activeClub.lastKitSponsorSeasonId !== global.lastKitSponsorSeasonId
    ) {
      activeClub.lastKitSponsorIncome = Math.max(0, Math.round(global.lastKitSponsorIncome ?? 0));
      activeClub.lastKitSponsorSeasonId = global.lastKitSponsorSeasonId;
    }
  }

  global.offers = global.offers.filter((offer) => offer.mode !== 'manager');
  if (global.activeEarned?.mode === 'manager') global.activeEarned = undefined;
  global.history = global.history.filter((contract) => contract.mode !== 'manager');
  global.acceptedOfferSeasonIds = [];
  global.earnedThisSeason = 0;
  global.premiumThisSeason = 0;
  global.earnedSeasonId = currentSeasonId(save);
}

function buildPlayerOffers(save: SaveGame): SponsorshipOffer[] {
  const stature = playerSponsorStature(save);
  const multiplier = playerStatureMultiplier(stature);
  const season = currentSeasonId(save);
  return PLAYER_OFFER_BASES.map((base) => {
    const brand = earnedSponsorBrandFor(base.scope);
    return {
      id: `player:${season}:${base.key}`,
      mode: 'career' as const,
      brandId: brand.id,
      brandName: brand.name,
      label: base.label,
      scope: base.scope,
      fixtureQuota: base.fixtureQuota,
      appearancePayout: roundToTen(base.appearancePayout * multiplier),
      winBonus: 0,
      signingBonus: roundToTen(250 * multiplier),
      termSeasonRollovers: 2,
      paymentDestination: 'WALLET_COINS' as const,
      signedStature: stature,
    };
  });
}

function buildManagerOffers(save: SaveGame): SponsorshipOffer[] {
  const stature = managerSponsorStature(save.managerCareerLevel);
  if (!stature || !save.userTeamId) return [];
  const season = currentSeasonId(save);
  return MANAGER_OFFERS[stature].map((base) => {
    const brand = earnedSponsorBrandFor(base.scope);
    return {
      id: `manager:${season}:${save.userTeamId}:${base.key}`,
      mode: 'manager' as const,
      brandId: brand.id,
      brandName: brand.name,
      label: base.label,
      scope: base.scope,
      fixtureQuota: base.quota,
      appearancePayout: base.fee,
      winBonus: base.win,
      signingBonus: 0,
      termSeasonRollovers: 1,
      paymentDestination: 'CLUB_BALANCE' as const,
      signedStature: stature,
    };
  });
}

/** Returns the three guaranteed choices once the relevant career has unlocked them. */
export function sponsorshipOffers(save: SaveGame, now: number = Date.now()): SponsorshipOffer[] {
  const state =
    save.mode === 'manager'
      ? activeManagerClubSponsorshipState(save)
      : ensureSponsorshipState(save, now);
  if (!state) return [];
  const season = currentSeasonId(save);
  const unlocked =
    save.mode === 'career' ? playerEarnedSponsorUnlocked(save) : managerEarnedSponsorUnlocked(save);
  if (
    !unlocked ||
    state.activeEarned?.status === 'ACTIVE' ||
    state.acceptedOfferSeasonIds.includes(season)
  ) {
    state.offers = [];
    state.offerSeasonId = season;
    return [];
  }
  if (state.offerSeasonId !== season || state.offers.length !== 3) {
    state.offerSeasonId = season;
    state.offers = save.mode === 'career' ? buildPlayerOffers(save) : buildManagerOffers(save);
  }
  return state.offers;
}

export function acceptSponsorshipOffer(
  save: SaveGame,
  offerId: string,
  now: number = Date.now(),
): SponsorActionResult {
  const state =
    save.mode === 'manager'
      ? activeManagerClubSponsorshipState(save)
      : ensureSponsorshipState(save, now);
  if (!state) return { ok: false, reason: 'No domestic club is available for this sponsor.' };
  if (state.activeEarned?.status === 'ACTIVE') {
    return { ok: false, reason: 'Your earned sponsor slot is already occupied.' };
  }
  const offer = sponsorshipOffers(save, now).find((candidate) => candidate.id === offerId);
  if (!offer) return { ok: false, reason: 'That sponsor offer is no longer available.' };
  const season = currentSeasonId(save);
  const contract: SponsorshipContract = {
    ...offer,
    acceptedSeasonId: season,
    acceptedAt: now,
    paidFixtureIds: [],
    paidFixtures: 0,
    paidWins: 0,
    seasonRollovers: 0,
    totalPaid: 0,
    status: 'ACTIVE',
    boundTeamId: save.mode === 'manager' ? save.userTeamId : undefined,
  };
  state.activeEarned = contract;
  state.offers = [];
  state.acceptedOfferSeasonIds = [...new Set([...state.acceptedOfferSeasonIds, season])];
  if (offer.signingBonus > 0) save.wallet.coins += offer.signingBonus;
  return { ok: true, contract, signingBonus: offer.signingBonus };
}

function isYouthFixture(fixture: Fixture): boolean {
  return (
    fixture.competition === 'U19_WORLDCUP' || fixture.competitionId?.startsWith('youth-') === true
  );
}

function isSeniorInternationalFixture(save: SaveGame, fixture: Fixture): boolean {
  return (
    fixture.competition === 'BILATERAL_SERIES' ||
    fixture.competition === 'INTL_TOURNAMENT' ||
    Boolean(save.teams[fixture.homeTeamId]?.isNationalTeam) ||
    Boolean(save.teams[fixture.awayTeamId]?.isNationalTeam)
  );
}

export function recordPlayerDomesticSponsorDebut(
  save: SaveGame,
  fixture: Fixture | undefined,
  selected: boolean,
  now: number = Date.now(),
): boolean {
  if (
    save.mode !== 'career' ||
    !fixture?.played ||
    !selected ||
    isYouthFixture(fixture) ||
    isSeniorInternationalFixture(save, fixture) ||
    (save.careerPathLevel !== 'DOMESTIC' && save.careerPathLevel !== 'INTERNATIONAL')
  ) {
    return false;
  }
  const state = ensureSponsorshipState(save, now);
  // Stats are applied before sponsorship settlement in the canonical result
  // pipeline. Replace that legacy inference with the exact fixture whenever we
  // have verifiable selected-XI evidence.
  if (
    state.seniorDomesticDebutFixtureId &&
    state.seniorDomesticDebutFixtureId !== 'legacy:verified-domestic-stats'
  ) {
    return false;
  }
  state.seniorDomesticDebutFixtureId = fixture.id;
  return true;
}

function formatMatches(scope: SponsorshipContract['scope'], format: Format): boolean {
  if (scope === 'ALL_FORMATS' || scope === 'RESULTS') return true;
  if (scope === 'T20_ONLY') return format === 'T20';
  if (scope === 'WHITE_BALL') return ['T10', 'T20', 'HUNDRED', 'ODI'].includes(format);
  return format === 'TEST';
}

function closeEarnedContract(
  state: SponsorshipState | ManagerClubSponsorshipState,
  status: SponsorshipContract['status'],
): void {
  const contract = state.activeEarned;
  if (!contract) return;
  contract.status = status;
  state.history.push(contract);
  state.activeEarned = undefined;
}

function utcMondayWeekId(now: number): string {
  const date = new Date(now);
  const weekdayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekdayFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export function premiumSponsorWeeklyRate(save: SaveGame): number {
  if (save.mode === 'career') return PLAYER_PREMIUM_WEEKLY_STIPEND[playerSponsorStature(save)];
  const stature = managerSponsorStature(save.managerCareerLevel);
  return stature ? MANAGER_PREMIUM_WEEKLY_STIPEND[stature] : 0;
}

function eligibleOfficialFixture(
  save: SaveGame,
  fixture: Fixture,
  selected: boolean,
  managedTeamId?: string,
): boolean {
  if (isYouthFixture(fixture)) return false;
  if (save.mode === 'career') return playerEarnedSponsorUnlocked(save) && selected;
  if (!managedTeamId) return false;
  return fixture.homeTeamId === managedTeamId || fixture.awayTeamId === managedTeamId;
}

function creditManagerClub(save: SaveGame, teamId: string, amount: number): void {
  if (amount <= 0 || !save.teams[teamId]) return;
  save.teams[teamId].budget += amount;
  managerClubSponsorshipState(save, teamId);
  const club = save.managerClubs?.[teamId];
  if (club) club.finances.transferBudget = save.teams[teamId].budget;
  if (teamId === save.userTeamId && save.finances) {
    save.finances.transferBudget = save.teams[teamId].budget;
  }
  // The sponsor-state call above deliberately ensures the club record before
  // its finance mirror is updated, including for a former background club.
}

function settleManagerEarnedSponsorForTeam(
  save: SaveGame,
  fixture: Fixture,
  teamId: string,
): number {
  const state = managerClubSponsorshipState(save, teamId);
  const contract = state?.activeEarned;
  if (
    !state ||
    contract?.status !== 'ACTIVE' ||
    contract.mode !== 'manager' ||
    contract.boundTeamId !== teamId ||
    !formatMatches(contract.scope, fixture.format) ||
    contract.paidFixtureIds.includes(fixture.id) ||
    contract.paidFixtures >= contract.fixtureQuota
  ) {
    return 0;
  }

  const won = fixture.winnerTeamId === teamId;
  const amount = contract.appearancePayout + (won ? contract.winBonus : 0);
  contract.paidFixtureIds.push(fixture.id);
  contract.paidFixtures += 1;
  if (won) contract.paidWins += 1;
  contract.totalPaid += amount;
  state.earnedThisSeason += amount;
  state.earnedSeasonId ??= currentSeasonId(save);
  creditManagerClub(save, teamId, amount);
  if (contract.paidFixtures >= contract.fixtureQuota) {
    closeEarnedContract(state, 'QUOTA_REACHED');
  }
  return amount;
}

/**
 * Canonical Manager earned-contract settlement. It intentionally excludes the
 * save-owned premium stipend, whose weekly eligibility needs explicit knowledge
 * of the club the user was managing for that fixture.
 */
export function settleManagerEarnedSponsorshipForFixture(
  save: SaveGame,
  fixture: Fixture | undefined,
): Record<string, number> {
  if (save.mode !== 'manager' || !fixture?.played || isYouthFixture(fixture)) return {};
  const earnedByTeam: Record<string, number> = {};
  for (const teamId of [...new Set([fixture.homeTeamId, fixture.awayTeamId])]) {
    const amount = settleManagerEarnedSponsorForTeam(save, fixture, teamId);
    if (amount > 0) earnedByTeam[teamId] = amount;
  }
  return earnedByTeam;
}

/**
 * Idempotently settles both sponsor slots for one completed official fixture.
 * The caller supplies XI selection / managed-team context from the match result.
 */
export function settleFixtureSponsorship(
  save: SaveGame,
  fixture: Fixture | undefined,
  input: { selected: boolean; userWon: boolean; managedTeamId?: string; now?: number },
): SponsorFixturePayout {
  const destination = save.mode === 'career' ? 'WALLET_COINS' : 'CLUB_BALANCE';
  const empty = { earned: 0, premium: 0, endorsements: 0, destination } as const;
  if (!fixture || !fixture.played) return empty;
  const now = input.now ?? Date.now();
  const state = ensureSponsorshipState(save, now);

  if (save.mode === 'manager') {
    if (isYouthFixture(fixture)) return empty;
    const participantIds = [...new Set([fixture.homeTeamId, fixture.awayTeamId])];
    const earnedByTeam = settleManagerEarnedSponsorshipForFixture(save, fixture);

    let premium = 0;
    const managedTeamId = input.managedTeamId;
    const premiumEligible = Boolean(
      managedTeamId &&
      managedTeamId === save.userTeamId &&
      participantIds.includes(managedTeamId) &&
      save.managerCareerLevel !== 'NATIONAL',
    );
    const grant = state.premium;
    if (
      premiumEligible &&
      grant &&
      grant.boundSaveId === save.id &&
      now >= grant.grantedAt &&
      !grant.paidFixtureIds.includes(fixture.id)
    ) {
      const weekId = utcMondayWeekId(now);
      if (!grant.paidUtcWeekIds.includes(weekId)) {
        premium = premiumSponsorWeeklyRate(save);
        if (premium > 0 && managedTeamId) {
          grant.paidUtcWeekIds.push(weekId);
          grant.paidFixtureIds.push(fixture.id);
          grant.totalPaid += premium;
          state.premiumThisSeason = (state.premiumThisSeason ?? 0) + premium;
          const clubState = managerClubSponsorshipState(save, managedTeamId);
          if (clubState) clubState.premiumThisSeason += premium;
          creditManagerClub(save, managedTeamId, premium);
        }
      }
    }
    return {
      earned: managedTeamId ? (earnedByTeam[managedTeamId] ?? 0) : 0,
      premium,
      endorsements: 0,
      destination,
    };
  }

  const endorsements = settleOffKitEndorsementsForFixture(save, fixture);
  recordPlayerDomesticSponsorDebut(save, fixture, input.selected, now);
  if (!eligibleOfficialFixture(save, fixture, input.selected, input.managedTeamId)) {
    if (endorsements > 0) save.wallet.coins += endorsements;
    return { ...empty, endorsements };
  }

  let earned = 0;
  const contract = state.activeEarned;
  if (
    contract?.status === 'ACTIVE' &&
    contract.mode === save.mode &&
    formatMatches(contract.scope, fixture.format) &&
    !contract.paidFixtureIds.includes(fixture.id) &&
    contract.paidFixtures < contract.fixtureQuota
  ) {
    earned = contract.appearancePayout + (input.userWon ? contract.winBonus : 0);
    contract.paidFixtureIds.push(fixture.id);
    contract.paidFixtures += 1;
    if (input.userWon) contract.paidWins += 1;
    contract.totalPaid += earned;
    state.earnedThisSeason += earned;
    if (contract.paidFixtures >= contract.fixtureQuota) closeEarnedContract(state, 'QUOTA_REACHED');
  }

  let premium = 0;
  const grant = state.premium;
  if (
    grant &&
    grant.boundSaveId === save.id &&
    now >= grant.grantedAt &&
    !grant.paidFixtureIds.includes(fixture.id)
  ) {
    const weekId = utcMondayWeekId(now);
    if (!grant.paidUtcWeekIds.includes(weekId)) {
      premium = premiumSponsorWeeklyRate(save);
      if (premium > 0) {
        grant.paidUtcWeekIds.push(weekId);
        grant.paidFixtureIds.push(fixture.id);
        grant.totalPaid += premium;
        state.premiumThisSeason = (state.premiumThisSeason ?? 0) + premium;
      }
    }
  }
  if (earned + premium + endorsements > 0) {
    save.wallet.coins += earned + premium + endorsements;
  }
  return { earned, premium, endorsements, destination };
}

/** Preserve the original story-campaign rule: every active campaign pays once per played match. */
export function settleOffKitEndorsementsForFixture(
  save: SaveGame,
  fixture: Fixture | undefined,
): number {
  if (save.mode !== 'career' || !save.userPlayerId || !fixture?.played) return 0;
  let total = 0;
  for (const sponsor of save.sponsors ?? []) {
    sponsor.paidFixtureIds ??= [];
    sponsor.totalPaid = Math.max(0, Math.round(sponsor.totalPaid ?? 0));
    if (
      sponsor.seasonsLeft <= 0 ||
      sponsor.perMatchCoins <= 0 ||
      sponsor.paidFixtureIds.includes(fixture.id)
    ) {
      continue;
    }
    const amount = Math.max(0, Math.round(sponsor.perMatchCoins));
    sponsor.paidFixtureIds.push(fixture.id);
    sponsor.totalPaid += amount;
    total += amount;
  }
  return total;
}

/** Ends annual/quota contracts and resets only the season-reporting counter. */
export function rolloverSponsorship(save: SaveGame): void {
  const state = ensureSponsorshipState(save);
  if (save.mode === 'manager') {
    const seasonId = currentSeasonId(save);
    for (const teamId of Object.keys(save.managerClubs ?? {})) {
      const clubState = managerClubSponsorshipState(save, teamId);
      if (!clubState) continue;
      clubState.lastKitSponsorIncome = clubState.earnedThisSeason + clubState.premiumThisSeason;
      clubState.lastKitSponsorSeasonId = clubState.earnedSeasonId ?? seasonId;
      const contract = clubState.activeEarned;
      if (contract) {
        contract.seasonRollovers += 1;
        if (contract.seasonRollovers >= contract.termSeasonRollovers) {
          closeEarnedContract(clubState, 'TERM_ENDED');
        }
      }
      clubState.offers = [];
      clubState.offerSeasonId = undefined;
      clubState.earnedThisSeason = 0;
      clubState.premiumThisSeason = 0;
      clubState.earnedSeasonId = undefined;
    }
    const activeClub = save.userTeamId
      ? save.managerClubs?.[save.userTeamId]?.sponsorship
      : undefined;
    state.lastKitSponsorIncome = activeClub?.lastKitSponsorIncome ?? 0;
    state.lastKitSponsorSeasonId = activeClub?.lastKitSponsorSeasonId ?? seasonId;
    state.offers = [];
    state.offerSeasonId = undefined;
    state.activeEarned = undefined;
    state.history = state.history.filter((contract) => contract.mode !== 'manager');
    state.acceptedOfferSeasonIds = [];
    state.earnedThisSeason = 0;
    state.premiumThisSeason = 0;
    state.earnedSeasonId = undefined;
    return;
  }
  state.lastKitSponsorIncome = state.earnedThisSeason + (state.premiumThisSeason ?? 0);
  state.lastKitSponsorSeasonId = state.earnedSeasonId ?? currentSeasonId(save);
  const contract = state.activeEarned;
  if (contract) {
    contract.seasonRollovers += 1;
    if (contract.seasonRollovers >= contract.termSeasonRollovers) {
      closeEarnedContract(state, 'TERM_ENDED');
    }
  }
  state.offers = [];
  state.offerSeasonId = undefined;
  state.earnedThisSeason = 0;
  state.premiumThisSeason = 0;
  state.earnedSeasonId = undefined;
}

/** Exact fixture-paid kit-partner income credited to one club for a season. */
export function managerClubKitSponsorIncomeForSeason(
  save: SaveGame,
  teamId: string,
  seasonId: string | undefined,
): number {
  if (!seasonId) return 0;
  const state = managerClubSponsorshipState(save, teamId);
  if (!state) return 0;
  if (state.lastKitSponsorSeasonId === seasonId) return state.lastKitSponsorIncome ?? 0;
  if (state.earnedSeasonId === seasonId) {
    return state.earnedThisSeason + state.premiumThisSeason;
  }
  return 0;
}

export function grantPremiumSponsorToCurrentSave(
  save: SaveGame,
  productId: 'player_save_sponsor' | 'manager_save_sponsor',
  purchaseToken: string,
  now: number = Date.now(),
): SponsorActionResult {
  const expectedMode = productId === 'player_save_sponsor' ? 'career' : 'manager';
  if (save.mode !== expectedMode) {
    return { ok: false, reason: `This purchase requires a ${expectedMode} save.` };
  }
  const state = ensureSponsorshipState(save, now);
  if (state.premium) return { ok: false, reason: 'This save already owns its permanent sponsor.' };
  state.premium = {
    productId,
    brandId: PREMIUM_SPONSOR_BRAND.id,
    brandName: PREMIUM_SPONSOR_BRAND.name,
    boundSaveId: save.id,
    grantedAt: now,
    purchaseToken,
    paidUtcWeekIds: [],
    paidFixtureIds: [],
    totalPaid: 0,
  };
  return { ok: true };
}

export function activeSponsorDisplayName(save: SaveGame): string | undefined {
  if (save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL') return undefined;
  const state = ensureSponsorshipState(save);
  const earned = activeEarnedSponsorContract(save);
  return earned?.brandName ?? (state.premium ? PREMIUM_SPONSOR_BRAND.name : undefined);
}

/** Both visible kit slots, kept independent so one never hides the other. */
export function activeSponsorBranding(save: SaveGame): ActiveSponsorBranding {
  // Domestic club partners neither follow nor appear beside a national team.
  // Ownership and payment ledgers remain intact and resume on domestic return.
  if (save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL') return {};
  const state = ensureSponsorshipState(save);
  const earned = activeEarnedSponsorContract(save);
  return {
    earned: earned
      ? {
          brandId: earned.brandId,
          brandName: earned.brandName?.trim() || earned.label,
        }
      : undefined,
    premium: state.premium
      ? {
          brandId: PREMIUM_SPONSOR_BRAND.id,
          brandName: PREMIUM_SPONSOR_BRAND.name,
        }
      : undefined,
  };
}
