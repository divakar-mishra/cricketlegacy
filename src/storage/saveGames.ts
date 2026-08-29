import { GameMode, SaveGame } from '../domain/types';
import { isSeasonPassActive } from '../game/seasonPass';
import { unwrapSave, wrapSave } from './integrity';
import { runMigrations } from './migrate';
import { getJSON, removeKey, setJSON } from './storage';

export const BASE_MAX_SLOTS = 5;
export const MAX_SLOTS = 6;
const LAST_PLAYED_KEY = 'sg:lastPlayed';
const slotKey = (mode: GameMode, slot: number): string => `sg:${mode}:${slot}`;
const bakKey = (mode: GameMode, slot: number): string => `sg:${mode}:${slot}:bak`;
const slotOperationQueues = new Map<string, Promise<void>>();

function enqueueSlotOperation(key: string, operation: () => Promise<void>): Promise<void> {
  const previous = slotOperationQueues.get(key) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(operation);
  slotOperationQueues.set(key, queued);
  const cleanup = () => {
    if (slotOperationQueues.get(key) === queued) slotOperationQueues.delete(key);
  };
  void queued.then(cleanup, cleanup);
  return queued;
}

export interface SlotView {
  slot: number;
  save: SaveGame | null;
}
export interface LastPlayed {
  mode: GameMode;
  slot: number;
}

export async function loadSave(mode: GameMode, slot: number): Promise<SaveGame | null> {
  // Prefer the primary; if it's missing or fails its checksum, recover from the
  // rolling backup so a corrupt/half-written blob never loses the whole slot.
  const primary = unwrapSave(await getJSON<unknown>(slotKey(mode, slot)));
  if (primary) return runMigrations(primary);
  const backup = unwrapSave(await getJSON<unknown>(bakKey(mode, slot)));
  return backup ? runMigrations(backup) : null;
}

async function writeSaveNow(mode: GameMode, slot: number, save: SaveGame): Promise<void> {
  const key = slotKey(mode, slot);
  save.updatedAt = Date.now();
  // Roll the last-known-good primary into the backup before overwriting it, so a
  // failure mid-write leaves a recoverable previous state.
  const prev = await getJSON<unknown>(key);
  if (prev && unwrapSave(prev)) await setJSON(bakKey(mode, slot), prev);
  // Write inside a checksum envelope (atomic at the AsyncStorage key level).
  await setJSON(key, wrapSave(save));
}

/**
 * Serialize writes per slot. Gameplay can request several saves in quick
 * succession; without a queue, an older AsyncStorage write may finish after a
 * newer one and roll the slot backwards.
 */
export function writeSave(mode: GameMode, slot: number, save: SaveGame): Promise<void> {
  const key = slotKey(mode, slot);
  return enqueueSlotOperation(key, () => writeSaveNow(mode, slot, save));
}

export function deleteSave(mode: GameMode, slot: number): Promise<void> {
  const key = slotKey(mode, slot);
  return enqueueSlotOperation(key, async () => {
    // Wait behind any pending save for this slot so a late write cannot
    // resurrect a career after the player confirms deletion.
    await removeKey(key);
    await removeKey(bakKey(mode, slot));
  });
}

export async function listSlots(mode: GameMode): Promise<SlotView[]> {
  const out: SlotView[] = [];
  for (let slot = 1; slot <= MAX_SLOTS; slot++) {
    out.push({ slot, save: await loadSave(mode, slot) });
  }
  return out;
}

export function firstFreeSlot(slots: SlotView[]): number | null {
  const premiumSlotUnlocked = slots.some((entry) => isSeasonPassActive(entry.save ?? undefined));
  return (
    slots.find((entry) => !entry.save && (entry.slot <= BASE_MAX_SLOTS || premiumSlotUnlocked))
      ?.slot ?? null
  );
}

export async function setLastPlayed(mode: GameMode, slot: number): Promise<void> {
  await setJSON(LAST_PLAYED_KEY, { mode, slot } satisfies LastPlayed);
}

export interface ResolvedSave {
  mode: GameMode;
  slot: number;
  save: SaveGame;
}

export async function getLastPlayed(): Promise<ResolvedSave | null> {
  const ptr = await getJSON<LastPlayed>(LAST_PLAYED_KEY);
  if (!ptr) return null;
  const save = await loadSave(ptr.mode, ptr.slot);
  return save ? { mode: ptr.mode, slot: ptr.slot, save } : null;
}

export async function listAllSaves(): Promise<ResolvedSave[]> {
  const modes: GameMode[] = ['career', 'manager'];
  const out: ResolvedSave[] = [];
  for (const mode of modes) {
    for (const { slot, save } of await listSlots(mode)) {
      if (save) out.push({ mode, slot, save });
    }
  }
  return out.sort((a, b) => b.save.updatedAt - a.save.updatedAt);
}
