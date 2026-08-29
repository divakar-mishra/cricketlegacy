export const SHIRT_NAME_MAX_LENGTH = 14;

export function defaultShirtName(playerName?: string): string {
  const words = (playerName ?? '').trim().split(/\s+/).filter(Boolean);
  return (words.at(-1) ?? 'PLAYER').toUpperCase().slice(0, SHIRT_NAME_MAX_LENGTH);
}

export function normalizeShirtName(value: unknown, playerName?: string): string {
  if (typeof value !== 'string') return defaultShirtName(playerName);
  const compact = value.trim().replace(/\s+/g, ' ').toUpperCase();
  return (compact || defaultShirtName(playerName)).slice(0, SHIRT_NAME_MAX_LENGTH);
}

export function defaultShirtNumber(playerId?: string): number {
  let hash = 2166136261;
  for (const char of playerId ?? 'player') {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 99) + 1;
}

export function normalizeShirtNumber(value: unknown, playerId?: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return defaultShirtNumber(playerId);
  return Math.max(1, Math.min(99, Math.round(number)));
}
