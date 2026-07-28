/**
 * XI selection from a squad. Matches are always 11-a-side; this picks a sensible
 * XI (a keeper + enough bowlers, then best of the rest) and a batting order.
 */
import { Player } from '../domain/types';
import { battingMean, bowlingMean, canBowl } from '../engine/rating';
import { isAvailable } from './injuries';

export const XI_SIZE = 11;

export interface XIValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Selection merit: `overall` anchors it, but recent form & confidence swing a
 * place by a few points — so an in-form fringe player can push a slumping star
 * out of the XI (AI sides rotate on form; a career player can be dropped).
 */
export function selectionScore(p: Player): number {
  const formSwing = ((p.meta.form - 50) / 50) * 6 + ((p.meta.confidence - 50) / 50) * 2;
  const conditionSwing = ((p.condition ?? 100) - 100) * 0.16;
  return p.overall + formSwing + conditionSwing;
}

function targetCareerBattingIndex(user: Player, xiLength: number): number {
  const raw =
    user.role === 'BATTER' ? 2 : user.role === 'WK_BATTER' ? 4 : user.role === 'ALLROUNDER' ? 5 : 8;
  return Math.min(Math.max(raw, 0), Math.max(0, xiLength - 1));
}

function moveToIndex<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function orderBatting(xi: Player[], forceId?: string): Player[] {
  const rank = (p: Player): number => {
    const roleBonus =
      p.role === 'BATTER' ? 30 : p.role === 'WK_BATTER' ? 24 : p.role === 'ALLROUNDER' ? 12 : -20;
    return battingMean(p) + roleBonus;
  };
  const ordered = [...xi].sort((a, b) => rank(b) - rank(a));
  if (!forceId) return ordered;
  const userIndex = ordered.findIndex((p) => p.id === forceId);
  if (userIndex < 0) return ordered;
  return moveToIndex(
    ordered,
    userIndex,
    targetCareerBattingIndex(ordered[userIndex], ordered.length),
  );
}

/** Auto-pick the best legal XI, guaranteeing a keeper and some bowling. */
export function autoXI(fullSquad: Player[], forceId?: string): Player[] {
  // Prefer fit players; only fall back to including injured if we can't field 11.
  const fit = fullSquad.filter((p) => isAvailable(p) || p.id === forceId);
  const squad = fit.length >= XI_SIZE ? fit : fullSquad;
  if (squad.length <= XI_SIZE) return orderBatting(squad, forceId);

  const byId = new Map(squad.map((p) => [p.id, p]));
  const chosen = new Set<string>();
  const add = (p?: Player) => {
    if (p && !chosen.has(p.id) && chosen.size < XI_SIZE) chosen.add(p.id);
  };

  if (forceId && byId.has(forceId)) add(byId.get(forceId));

  const keeper =
    [...squad]
      .filter((p) => p.role === 'WK_BATTER')
      .sort((a, b) => selectionScore(b) - selectionScore(a))[0] ??
    [...squad].sort((a, b) => b.fielding.keeping - a.fielding.keeping)[0];
  add(keeper);

  const formBowl = (p: Player): number => bowlingMean(p) + ((p.meta.form - 50) / 50) * 4;
  for (const b of [...squad].filter(canBowl).sort((a, b) => formBowl(b) - formBowl(a))) {
    if (chosen.size >= 6) break; // keeper + ~5 bowlers
    add(b);
  }

  for (const p of [...squad].sort((a, b) => selectionScore(b) - selectionScore(a))) {
    if (chosen.size >= XI_SIZE) break;
    add(p);
  }

  const xi = [...chosen].map((id) => byId.get(id)!);
  return orderBatting(xi, forceId);
}

export function validateXI(squad: Player[], xiIds: string[], forceId?: string): XIValidation {
  if (xiIds.length !== XI_SIZE)
    return { ok: false, reason: 'A playing XI must contain 11 players.' };
  const squadIds = new Set(squad.map((p) => p.id));
  const unique = new Set(xiIds);
  if (unique.size !== xiIds.length)
    return { ok: false, reason: 'A player cannot appear twice in the XI.' };
  if (!xiIds.every((id) => squadIds.has(id)))
    return { ok: false, reason: 'Every XI player must be in your squad.' };
  if (forceId && squadIds.has(forceId) && !unique.has(forceId))
    return { ok: false, reason: 'You cannot drop yourself from the XI.' };
  const players = xiIds.map((id) => squad.find((p) => p.id === id)!);
  if (players.some((player) => !isAvailable(player))) {
    return { ok: false, reason: 'An injured player cannot be selected.' };
  }
  if (!players.some((p) => p.role === 'WK_BATTER' || p.fielding.keeping >= 55)) {
    return { ok: false, reason: 'Pick at least one wicketkeeper.' };
  }
  if (players.filter(canBowl).length < 5) {
    return { ok: false, reason: 'Pick at least five bowling options.' };
  }
  return { ok: true };
}

/** Validate a user-selected XI; fall back to auto when it isn't a legal 11. */
export function resolveXI(squad: Player[], xiIds?: string[], forceId?: string): Player[] {
  if (xiIds && validateXI(squad, xiIds, forceId).ok) {
    const byId = new Map(squad.map((p) => [p.id, p]));
    return xiIds.map((id) => byId.get(id)!);
  }
  return autoXI(squad, forceId);
}
