import { Player, SaveGame, SAVE_SCHEMA_VERSION } from '../domain/types';
import { computeOverall } from '../engine/rating';
import { validateAgeEligibility } from '../game/career';
import { synchronizeSchema14State } from './schema14';
import { synchronizeSchema15State } from './schema15';
import { synchronizeSchema16State } from './schema16';
import { synchronizeSchema17State } from './schema17';
import { synchronizeSchema18State } from './schema18';
import { synchronizeSchema19State } from './schema19';
import { synchronizeSchema20State } from './schema20';
import { synchronizeSchema21State } from './schema21';
import { synchronizeSchema22State } from './schema22';

type AnySave = Record<string, unknown> & { schemaVersion?: number };
type Migration = (save: AnySave) => AnySave;

function hasAttributeGroups(player: unknown): player is Player {
  if (!player || typeof player !== 'object') return false;
  const p = player as Record<string, unknown>;
  return Boolean(p.batting && p.bowling && p.fielding && p.meta && p.role);
}

function recomputePlayerOveralls(save: AnySave): void {
  const players = save.players as Record<string, unknown> | undefined;
  for (const player of Object.values(players ?? {})) {
    if (!hasAttributeGroups(player)) continue;
    try {
      player.overall = computeOverall(player);
    } catch {
      /* Leave corrupt partial player records unchanged; runtime repair handles fallbacks. */
    }
  }
}

/**
 * Upgraders keyed by the schemaVersion they migrate FROM.
 * When bumping SAVE_SCHEMA_VERSION, add MIGRATIONS[oldVersion] here.
 */
const MIGRATIONS: Record<number, Migration> = {
  // v2 → v3: career narrative (story events, relationships, sponsors,
  // brand/integrity/morale, timeline) + manager depth (staff, facilities,
  // academy, scouting, cup, richer finances). Every new field is optional and
  // lazily initialised at load time (ensureCareerDepth / ensureManagerDepth in
  // the store), so the migration only needs to carry the blob forward.
  2: (save) => save,
  // v3 → v4: two-division pyramid (promotion/relegation). A legacy save had a
  // single league; carry its teams as the top flight with an empty second tier
  // so promotion/relegation safely no-ops for old saves (new games get both).
  3: (save) => {
    const leagues = (save.leagues as Record<string, { teamIds?: string[] }> | undefined) ?? {};
    const first = Object.values(leagues)[0];
    const tier1 = Array.isArray(first?.teamIds) ? (first!.teamIds as string[]) : [];
    save.divisions = { tier1, tier2: [] };
    save.userDivision = 1;
    return save;
  },
  // v4 → v5: cross-career Hall of Fame counters (careerSeasons, leagueTitles,
  // promotions, bestLeaguePos). All optional and lazily accumulated, so the
  // migration only needs to carry the blob forward.
  4: (save) => save,
  // v5 → v6: career pathway level, personal finance (stocks, academy),
  // age-triggered retirement counter, career-to-manager eligibility.
  // All new fields are optional and initialised lazily at runtime.
  5: (save) => save,
  // v6 → v7: loan system (loanedFrom/loanEnd on Player), per-player morale
  // cooldown (lastTalkDay), multi-format stats (formatStats), stock history,
  // multi-format season competitions (SeasonCompetition[]), extended Competition
  // type, Fixture.competitionId/calendarMonth, pre-season flag, calendar month,
  // international calendar and ICC rankings. All optional and lazily initialised.
  6: (save) => save,
  // v7 → v8: performance-based progression — accumulated per-level output
  // (careerPathRuns/Wickets/RatingSum), Legend status flag (legendGranted),
  // and manager top-finish tracking (managerTopFinishes). All optional and
  // accumulated lazily at runtime, so the migration only carries the blob forward.
  7: (save) => save,
  // v8 → v9: manager headhunt (managerJobOffer) — a pending job approach from a
  // bigger club. Optional and generated at runtime, so a plain carry-forward.
  8: (save) => save,
  // v9 → v10: equipped player cosmetics (avatar/kit/celebration) + owned cosmetic
  // ids in inventory. Optional and defaulted at runtime, so a plain carry-forward.
  9: (save) => save,
  // v10 -> v11: league tables distinguish ties from no-results.
  10: (save) => {
    const leagues = save.leagues as
      Record<string, { table?: Record<string, unknown>[] }> | undefined;
    for (const league of Object.values(leagues ?? {})) {
      for (const row of league.table ?? []) {
        if (typeof row.tied !== 'number') row.tied = 0;
        if (typeof row.noResult !== 'number') row.noResult = 0;
      }
    }
    return save;
  },
  // v11 -> v12: stored Player.overall is a derived field. Recompute it from
  // canonical attributes so older saves cannot display stale ratings.
  11: (save) => {
    recomputePlayerOveralls(save);
    return save;
  },
  // v12 -> v13: repair invalid age/stage combinations such as a 33-year-old
  // still stored at School/U19 level.
  12: (save) => {
    validateAgeEligibility(save as unknown as SaveGame);
    return save;
  },
  // v13 -> v14: initialize canonical premium inventory/currency, Player Career
  // resources, Manager finance/progression, and auction-assistant state from
  // their established compatibility fields. This is deterministic and keeps
  // every existing balance, token, condition value, and club budget intact.
  13: (save) => {
    const timestamp =
      typeof save.updatedAt === 'number'
        ? save.updatedAt
        : typeof save.createdAt === 'number'
          ? save.createdAt
          : 0;
    synchronizeSchema14State(save as unknown as SaveGame, timestamp);
    return save;
  },
  // v14 -> v15: persistent career identity, club culture and post-match
  // consequence summaries. Defaults are deterministic and do not alter any
  // gameplay balance, ownership, currency or historical result.
  14: (save) => {
    synchronizeSchema15State(save as unknown as SaveGame);
    return save;
  },
  // v15 -> v16: durable archetype journey counters and relationship memories,
  // country competition aliases, premium naming state, and the expanded
  // manager staff structure. Existing names, staff, balances and results are
  // retained; missing roles/candidates are generated deterministically.
  15: (save) => {
    synchronizeSchema16State(save as unknown as SaveGame);
    return save;
  },
  // v16 -> v17: replace the permanent pass boolean with a bounded 30-day
  // entitlement, split pass cycles from career seasons, and initialise the
  // layered illustrated avatar. Existing currency, claimed rewards and names
  // are retained. A legacy premium flag receives one deterministic final
  // 30-day period and does not silently become a lifetime subscription.
  16: (save) => {
    const timestamp =
      typeof save.updatedAt === 'number'
        ? save.updatedAt
        : typeof save.createdAt === 'number'
          ? save.createdAt
          : Date.UTC(2026, 0, 1);
    synchronizeSchema17State(save as unknown as SaveGame, timestamp);
    return save;
  },
  // v17 -> v18: add an explicit monthly-content claim audit, per-cycle
  // scenario/story markers, and Manager wallet transaction history. Existing
  // pass ownership, scenario progress, balances and staff remain unchanged.
  17: (save) => {
    synchronizeSchema18State(save as unknown as SaveGame);
    return save;
  },
  // v18 -> v19: three-tier manager calendar and current-condition workload.
  // Legacy manager careers keep their existing season and adopt the new model
  // only when created on v19, so no in-progress fixture is discarded.
  18: (save) => {
    synchronizeSchema19State(save as unknown as SaveGame);
    return save;
  },
  // v19 -> v20: Player Career format readiness, coach trust, workload and
  // persistent newspaper scrapbook. Defaults do not alter historical results.
  19: (save) => {
    synchronizeSchema20State(save as unknown as SaveGame);
    return save;
  },
  // v20 -> v21: Player Career adopts a country-specific 24-club pyramid,
  // double round-robin T20, literal weekly calendar, residency eligibility and
  // a scheduled June-August international window. Played results are retained.
  20: (save) => {
    synchronizeSchema21State(save as unknown as SaveGame);
    return save;
  },
  // v21 -> v22: snapshot cumulative international caps once so future season
  // rollovers can detect two genuinely cap-less seasons without mistaking
  // lifetime appearances for appearances in the current year.
  21: (save) => {
    synchronizeSchema22State(save as unknown as SaveGame);
    return save;
  },
};

/** Bring a persisted blob up to the current schema, or reject it. */
export function runMigrations(raw: unknown): SaveGame | null {
  if (!raw || typeof raw !== 'object') return null;
  const save = raw as AnySave;
  if (typeof save.schemaVersion !== 'number') return null;
  if (save.schemaVersion > SAVE_SCHEMA_VERSION) return null; // written by a newer build

  let current = save;
  let guard = 0;
  while ((current.schemaVersion ?? 0) < SAVE_SCHEMA_VERSION && guard++ < 100) {
    const from = current.schemaVersion ?? 0;
    const migrate = MIGRATIONS[from];
    if (!migrate) return null;
    current = migrate(current);
    current.schemaVersion = from + 1;
  }
  return current as unknown as SaveGame;
}
