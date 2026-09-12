import type { SaveGame } from '../domain/types';
import { ensureVipState, grantCollection, grantModeVip, hasModeVip } from '../game/vip';
import { currentSupabaseSession, getSupabaseClient } from './supabaseClient';

interface Archive {
  version: 1;
  owned: boolean;
  source?: string;
  collections: string[];
}
const queues = new Map<string, Promise<unknown>>();
const remoteQueues = new Map<string, Promise<void>>();

async function localWork(key: string, action: () => Promise<void>): Promise<void> {
  const work = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
  queues.set(key, work);
  try {
    await work;
  } finally {
    if (queues.get(key) === work) queues.delete(key);
  }
}

/** Account + mode, never device-global across signed-in customers. */
async function accountKey(): Promise<string | null> {
  const session = await currentSupabaseSession();
  if (session && !session.isAnonymous) return session.userId;
  return typeof __DEV__ !== 'undefined' && __DEV__ ? 'local-development' : null;
}

export async function syncVipArchive(
  save: SaveGame,
  verified?: { accountId: string; owned: boolean; source?: string },
  refreshRemote = false,
): Promise<void> {
  const accountId = await accountKey();
  if (!accountId) return;
  const key = `cricket.vip.v1.${accountId}.${save.mode}`;
  let remote: Promise<void> | undefined;
  await localWork(key, async () => {
    // Native secure storage is the offline cache, not receipt verification.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const secure: typeof import('expo-secure-store') = require('expo-secure-store');
    const raw = await secure.getItemAsync(key);
    const stored: Archive = raw
      ? (JSON.parse(raw) as Archive)
      : { version: 1, owned: false, collections: [] };
    if (stored.version !== 1 || !Array.isArray(stored.collections))
      throw new Error('VIP collection archive needs recovery.');
    if ((await accountKey()) !== accountId) return;
    ensureVipState(save);
    const entitlement = save.entitlements.modeVip;
    if (entitlement?.accountId && entitlement.accountId !== accountId) {
      // Do not import ownership or cosmetic claims from another customer.
      save.entitlements.modeVip!.owned = false;
      save.entitlements.removeAds = false;
      save.vipEnergyBonusActive = false;
      return;
    }
    if (verified?.accountId === accountId) {
      stored.owned = verified.owned;
      stored.source = verified.source;
      if (!verified.owned && save.entitlements.modeVip?.source !== 'legacy') {
        if (save.entitlements.modeVip) save.entitlements.modeVip.owned = false;
        save.entitlements.removeAds = false;
        save.vipEnergyBonusActive = false;
      }
    }
    if (stored.owned) grantModeVip(save, stored.source ?? 'archive', accountId);
    if (hasModeVip(save)) {
      save.entitlements.modeVip!.accountId = accountId;
      for (const id of stored.collections) grantCollection(save, id);
    }
    const collections = [...new Set([...stored.collections, ...save.vipCollections!.owned])];
    const encoded = JSON.stringify({
      version: 1,
      owned: stored.owned || hasModeVip(save),
      source: save.entitlements.modeVip?.source ?? stored.source,
      collections,
    } satisfies Archive);
    if (encoded !== raw) await secure.setItemAsync(key, encoded);
    // Cosmetics only: the server record never authorizes VIP or restores currency.
    // Missing deployment/offline service leaves the secure local archive intact.
    const client = accountId === 'local-development' ? null : getSupabaseClient();
    if (
      client &&
      hasModeVip(save) &&
      (verified ||
        refreshRemote ||
        !stored.owned ||
        collections.some((id) => !stored.collections.includes(id)))
    ) {
      // Network waits never hold the local save/archive queue. Serialize remote
      // unions separately so new claims cannot be lost behind an in-flight request.
      remote = (remoteQueues.get(key) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          if ((await accountKey()) !== accountId) return;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            const { data, error } = await client
              .rpc('merge_vip_collections', { p_mode: save.mode, p_collections: collections })
              .abortSignal(controller.signal);
            if (!error && Array.isArray(data) && (await accountKey()) === accountId) {
              await localWork(key, async () => {
                if ((await accountKey()) !== accountId) return;
                const latestRaw = await secure.getItemAsync(key);
                if (!latestRaw) return;
                const latest = JSON.parse(latestRaw) as Archive;
                // A late response must never resurrect revoked ownership or overwrite
                // newer local claims. Do not mutate an active career in the background.
                if (latest.version !== 1 || !latest.owned || !Array.isArray(latest.collections))
                  return;
                latest.collections = [
                  ...new Set([
                    ...latest.collections,
                    ...data.filter((id): id is string => typeof id === 'string'),
                  ]),
                ];
                const merged = JSON.stringify(latest);
                if (merged !== latestRaw) await secure.setItemAsync(key, merged);
              });
            }
          } catch {
            /* Retry on the next ownership refresh or explicit restore; gameplay works offline. */
          } finally {
            clearTimeout(timeout);
          }
        });
      remoteQueues.set(key, remote);
      const pending = remote;
      void pending
        .finally(() => {
          if (remoteQueues.get(key) === pending) remoteQueues.delete(key);
        })
        .catch(() => undefined);
    }
  });
  // Explicit restoration can wait for cloud cosmetics. Ordinary save/load only
  // commits the durable local archive, even while a remote refresh is running.
  if (refreshRemote && remote) {
    await remote;
    await syncVipArchive(save);
  }
}
