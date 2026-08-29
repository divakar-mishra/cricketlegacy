/**
 * Local notifications service — dependency-optional wrapper around
 * `expo-notifications` (SDK 57).
 *
 * The native module is loaded lazily via `require()` inside a try/catch, so the
 * JS bundle keeps running when notifications are unavailable (e.g. a stripped
 * Expo Go client, web, or jest). Every method is a safe no-op when the module
 * or the runtime permission is missing.
 *
 * v57 API notes (verified against
 * https://docs.expo.dev/versions/v57.0.0/sdk/notifications):
 *   - scheduleNotificationAsync({ content, trigger, identifier? }) -> Promise<string>
 *   - a time-based trigger uses the typed shape:
 *       { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats? }
 *   - getPermissionsAsync()/requestPermissionsAsync() -> { granted, status, ... }
 *   - cancelScheduledNotificationAsync(id) / cancelAllScheduledNotificationsAsync()
 */

interface ScheduleLocalInput {
  /** Optional stable identifier so a notification can be updated/cancelled. */
  id?: string;
  title: string;
  body: string;
  /** Fire after this many seconds from now (clamped to >= 1). */
  seconds: number;
}

/** Stable notification identifiers for the app's recurring reminders. */
const NOTIF_ID = {
  ENERGY_FULL: 'energy_full',
  DAILY_REMINDER: 'daily_reminder',
  STREAK_RISK: 'streak_risk',
  MATCH_READY: 'match_ready',
  SEASON_ENDING: 'season_ending',
} as const;

/** Subset of `NotificationPermissionsStatus` we depend on. */
interface PermissionStatus {
  granted?: boolean;
  status?: string;
}

/** v57 time-interval trigger shape. */
interface TimeIntervalTrigger {
  type: string;
  seconds: number;
  repeats?: boolean;
}

interface ScheduleRequest {
  identifier?: string;
  content: { title: string; body: string; data?: Record<string, unknown> };
  trigger: TimeIntervalTrigger | null;
}

/** Subset of the `expo-notifications` module surface we rely on. */
interface NotificationsModule {
  getPermissionsAsync: () => Promise<PermissionStatus>;
  requestPermissionsAsync: (permissions?: unknown) => Promise<PermissionStatus>;
  scheduleNotificationAsync: (request: ScheduleRequest) => Promise<string>;
  setNotificationHandler: (handler: unknown) => void;
  SchedulableTriggerInputTypes: { TIME_INTERVAL: string };
}

/** Normalises `module` / `module.default` interop without using `any`. */
function pickModule(required: unknown): Record<string, unknown> | null {
  if (required && typeof required === 'object') {
    const asDefault = (required as { default?: unknown }).default;
    // expo-notifications is a namespace module, but honour a default if present.
    if (
      asDefault &&
      typeof asDefault === 'object' &&
      typeof (asDefault as { scheduleNotificationAsync?: unknown }).scheduleNotificationAsync ===
        'function'
    ) {
      return asDefault as Record<string, unknown>;
    }
    return required as Record<string, unknown>;
  }
  return null;
}

/** Lazily resolves expo-notifications, returning `null` if unavailable. */
function loadNotifications(): NotificationsModule | null {
  try {
    // Literal string is required so Metro can statically resolve the module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = pickModule(require('expo-notifications'));
    if (
      mod &&
      typeof (mod as { scheduleNotificationAsync?: unknown }).scheduleNotificationAsync ===
        'function'
    ) {
      return mod as unknown as NotificationsModule;
    }
    return null;
  } catch {
    return null;
  }
}

function isGranted(status: PermissionStatus | null | undefined): boolean {
  return status?.granted === true || status?.status === 'granted';
}

async function ensurePermission(mod: NotificationsModule): Promise<boolean> {
  try {
    const existing = await mod.getPermissionsAsync();
    if (isGranted(existing)) return true;
    const requested = await mod.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return isGranted(requested);
  } catch {
    return false;
  }
}

/**
 * Schedules a local notification `seconds` from now. Resolves the platform
 * identifier, or `null` if notifications are unavailable or permission was not
 * granted. Never throws.
 */
async function scheduleLocal(input: ScheduleLocalInput): Promise<string | null> {
  const mod = loadNotifications();
  if (!mod) return null;
  try {
    if (!(await ensurePermission(mod))) return null;
    const seconds = Math.max(1, Math.floor(input.seconds));
    const request: ScheduleRequest = {
      content: { title: input.title, body: input.body },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    };
    if (input.id) request.identifier = input.id;
    return await mod.scheduleNotificationAsync(request);
  } catch {
    return null;
  }
}

/**
 * Optional: installs a foreground handler so notifications are shown while the
 * app is open. Guarded — safe no-op when the module is missing. Call once at
 * startup if you want in-foreground banners.
 */
export function configureForegroundHandler(): void {
  const mod = loadNotifications();
  if (!mod || typeof mod.setNotificationHandler !== 'function') return;
  try {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    /* ignore */
  }
}

// Randomized message variants for richer, less repetitive notifications.
const ENERGY_FULL_BODIES = [
  "Captain, you're back at full energy — the squad is ready. Lead them to victory. 🏏",
  'Full energy restored! The dressing room is buzzing. Time to take the field.',
  "⚡ You're back at 100%. The pitch is prepared — get out there and make it count.",
  'Your energy is fully restored. The XI is warmed up and waiting for your call.',
  'Ready to roll! Full energy means no excuses — go win that match. 🏆',
];

const DAILY_REMINDER_BODIES = [
  'Your daily reward is waiting at the pavilion. Claim your coins and keep the streak alive! 🔥',
  "Morning, Captain. Your daily bonus is ready — don't let it expire unused.",
  '🎁 Daily reward available! Collect your coins and get one step closer to legend status.',
  "The treasury is full and waiting for you. Claim today's reward before midnight! 💰",
  "A new day, a new reward. Log in and collect what's yours before the clock runs out.",
];

const STREAK_RISK_BODIES = [
  "🔥 Don't break your streak! Play a match today — every win counts toward your legacy.",
  'Your win streak is on the line. Step up, Captain. The team is counting on you.',
  '⚠️ Streak at risk! Less than a few hours left to play and keep the fire burning.',
  "Don't let your hard-earned streak slip away. Jump in and dominate the opposition!",
  'The streak lives or dies today. Are you going to let it end without a fight? 🏏',
];

const MATCH_READY_BODIES = [
  "🏏 Matchday! Your next fixture is ready. The squad is primed — go show them what you're made of.",
  'The opposition is warming up. Are you? Get in there and take the points.',
  'Captain, the team needs your leadership. Matchday is here — time to deliver.',
  'Your next match awaits. The pitch is set, the crowd is expecting fireworks. 🎆',
  "Fixture alert! A win today could change everything — don't miss it.",
];

const SEASON_ENDING_BODIES = [
  '⏰ Season pass rewards expiring soon! Claim everything before the season resets.',
  "Last chance to grab your battle pass rewards. Don't leave earned rewards unclaimed!",
  'The season is closing. Finish your challenges and claim your final rewards. 🏆',
  'Battle pass ending in 3 days. Are you leaving rewards unclaimed? Log in now!',
  'Season finale incoming! Complete your objectives and collect your hard-earned prizes.',
];

const SEASON_ENDING_WARNING_LEAD_SECONDS = 3 * 24 * 60 * 60;
const MIN_SCHEDULE_DELAY_SECONDS = 60;

function pickLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Reminds the player when their energy will be full again. */
export function scheduleEnergyFull(secondsUntilFull: number): Promise<string | null> {
  return scheduleLocal({
    id: NOTIF_ID.ENERGY_FULL,
    title: '⚡ Energy Restored!',
    body: pickLine(ENERGY_FULL_BODIES),
    seconds: secondsUntilFull,
  });
}

/** Reminds the player to claim their daily reward (defaults to ~24h). */
export function scheduleDailyReminder(secondsUntil = 24 * 60 * 60): Promise<string | null> {
  return scheduleLocal({
    id: NOTIF_ID.DAILY_REMINDER,
    title: '🎁 Daily Reward Waiting',
    body: pickLine(DAILY_REMINDER_BODIES),
    seconds: secondsUntil,
  });
}

/** Warns the player their streak is at risk (defaults to ~20h). */
export function scheduleStreakRisk(secondsUntil = 20 * 60 * 60): Promise<string | null> {
  return scheduleLocal({
    id: NOTIF_ID.STREAK_RISK,
    title: '🔥 Streak Alert — Play Today!',
    body: pickLine(STREAK_RISK_BODIES),
    seconds: secondsUntil,
  });
}

/** Nudges the player that a fixture is waiting (defaults to ~4h). */
export function scheduleMatchReady(secondsUntil = 4 * 60 * 60): Promise<string | null> {
  return scheduleLocal({
    id: NOTIF_ID.MATCH_READY,
    title: '🏏 Matchday — Time to Play!',
    body: pickLine(MATCH_READY_BODIES),
    seconds: secondsUntil,
  });
}

/**
 * Delay until the three-day warning for a real UTC pass boundary. Returning
 * `null` avoids firing an immediate/stale warning when the warning point is
 * already less than a minute away or has passed.
 */
export function seasonEndingReminderDelaySeconds(
  periodEndsAt: number,
  now: number = Date.now(),
): number | null {
  if (!Number.isFinite(periodEndsAt) || !Number.isFinite(now)) return null;
  const secondsUntilWarning =
    Math.floor((periodEndsAt - now) / 1000) - SEASON_ENDING_WARNING_LEAD_SECONDS;
  return secondsUntilWarning >= MIN_SCHEDULE_DELAY_SECONDS ? secondsUntilWarning : null;
}

/** Warn three days before the supplied UTC Season Pass boundary. */
export function scheduleSeasonEnding(
  periodEndsAt: number,
  now: number = Date.now(),
): Promise<string | null> {
  const secondsUntil = seasonEndingReminderDelaySeconds(periodEndsAt, now);
  if (secondsUntil == null) return Promise.resolve(null);
  return scheduleLocal({
    id: NOTIF_ID.SEASON_ENDING,
    title: '⏰ Season Rewards Expiring!',
    body: pickLine(SEASON_ENDING_BODIES),
    seconds: secondsUntil,
  });
}
