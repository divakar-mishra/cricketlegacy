import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import {
  canOfferOtherGamesPromotion, claimOtherGamesPromotion, hasOtherGamesCampaignStarted,
  openOtherGamesPage, OTHER_GAMES_GAP_MS, OTHER_GAMES_HISTORY_KEY,
  OTHER_GAMES_MAX_IMPRESSIONS, OTHER_GAMES_PLAY_URL, OTHER_GAMES_START_AT,
} from '../otherGamesPromotion';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openURL: jest.fn() } }));

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(OTHER_GAMES_START_AT);
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (Platform as any).OS = 'android';
  jest.mocked(Linking.openURL).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

const history = async () => JSON.parse((await AsyncStorage.getItem(OTHER_GAMES_HISTORY_KEY))!);

describe('owner-approved, date-gated Sunlight promotion', () => {
  it('fixes the campaign to November15India2026, a48hour gap and at most two appearances', () => {
    expect(new Date(OTHER_GAMES_START_AT).toISOString()).toBe('2026-11-14T18:30:00.000Z');
    expect(OTHER_GAMES_GAP_MS).toBe(48 * 60 * 60_000);
    expect(OTHER_GAMES_MAX_IMPRESSIONS).toBe(2);
    expect(OTHER_GAMES_PLAY_URL).toBe('https://play.google.com/store/apps/developer?id=Sunlight+Pvt');
  });
  it.each([NaN, Infinity, -Infinity, OTHER_GAMES_START_AT - 1, Date.parse('2026-11-01T00:00:00Z')])(
    'cannot read, claim or launch the campaign before its boundary/with invalid clock %s', async now => {
      expect(hasOtherGamesCampaignStarted(now)).toBe(false);
      if (Number.isFinite(now)) {
        jest.setSystemTime(now);
        expect(await canOfferOtherGamesPromotion()).toBe(false);
        expect(await claimOtherGamesPromotion(() => true)).toBe(false);
        expect(await openOtherGamesPage(() => true)).toBe(false);
        expect(AsyncStorage.getItem).not.toHaveBeenCalled();
        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        expect(Linking.openURL).not.toHaveBeenCalled();
      }
    },
  );
  it('shows once onNov15, notNov16, then exactly once onNov17 and never again', async () => {
    expect(await canOfferOtherGamesPromotion()).toBe(true);
    expect(await claimOtherGamesPromotion(() => true)).toBe(true);
    expect(await history()).toMatchObject({ impressions: 1, stopped: false, lastShownAt: OTHER_GAMES_START_AT });
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    jest.setSystemTime(OTHER_GAMES_START_AT + 24 * 60 * 60_000);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS - 1);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS);
    expect(await claimOtherGamesPromotion(() => true)).toBe(true);
    expect((await history()).impressions).toBe(2);
    jest.setSystemTime(OTHER_GAMES_START_AT + 500 * OTHER_GAMES_GAP_MS);
    expect(await canOfferOtherGamesPromotion()).toBe(false);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
  it('uses durable shared history, not career/mode/account/settings/installed-app state', async () => {
    await AsyncStorage.setItem('sg:career:1', 'Player save');
    await AsyncStorage.setItem('sg:manager:2', 'Manager save');
    await AsyncStorage.setItem('cricket:settings', 'settings');
    await claimOtherGamesPromotion(() => true);
    await AsyncStorage.setItem('cricket:settings', 'reset settings');
    expect(await canOfferOtherGamesPromotion()).toBe(false);
    expect(await AsyncStorage.getItem('sg:career:1')).toBe('Player save');
    expect(await AsyncStorage.getItem('sg:manager:2')).toBe('Manager save');
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });
  it('serializes concurrent retained-hub claims to exactly one durable impression', async () => {
    const results = await Promise.all([claimOtherGamesPromotion(() => true), claimOtherGamesPromotion(() => true)]);
    expect(results.sort()).toEqual([false, true]);
    expect((await history()).impressions).toBe(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  });
  it.each(['ios', 'web'])('does nothing on %s, including user-tapped Google Play launch', async platform => {
    (Platform as any).OS = platform;
    expect(await canOfferOtherGamesPromotion()).toBe(false);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    expect(await openOtherGamesPage(() => true)).toBe(false);
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
  it.each(['null', '{}', 'bad-json', JSON.stringify({ version: 1, impressions: 9, lastShownAt: 0, stopped: false }),
    JSON.stringify({ version: 1, impressions: 1, lastShownAt: null, stopped: false })])(
    'fails closed for malformed history %s instead of resetting the cap', async raw => {
      await AsyncStorage.setItem(OTHER_GAMES_HISTORY_KEY, raw);
      expect(await canOfferOtherGamesPromotion()).toBe(false);
      expect(await claimOtherGamesPromotion(() => true)).toBe(false);
      expect(await openOtherGamesPage(() => true)).toBe(false);
      expect(await AsyncStorage.getItem(OTHER_GAMES_HISTORY_KEY)).toBe(raw);
      expect(Linking.openURL).not.toHaveBeenCalled();
    },
  );
  it('suppresses on read/write failures and safely allows a later successful retry', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('unavailable'));
    expect(await canOfferOtherGamesPromotion()).toBe(false);
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    expect(await AsyncStorage.getItem(OTHER_GAMES_HISTORY_KEY)).toBeNull();
    expect(await claimOtherGamesPromotion(() => true)).toBe(true);
  });
  it('revalidates screen eligibility after the async history read', async () => {
    let finish!: (raw: string | null) => void;
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let current = true;
    const pending = claimOtherGamesPromotion(() => current);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    current = false; finish(null);
    expect(await pending).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
  it('counts an uncertain interrupted display conservatively rather than overdelivering', async () => {
    const setItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    let current = true;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, raw) => {
      await setItem(key, raw); current = false;
    });
    expect(await claimOtherGamesPromotion(() => current)).toBe(false);
    expect((await history()).impressions).toBe(1);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
  });
  it('does not shorten the interval after a backward clock change', async () => {
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS);
    await claimOtherGamesPromotion(() => true);
    jest.setSystemTime(OTHER_GAMES_START_AT);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
  });
  it('cannot overwrite a queued permanent stop with a stale claim', async () => {
    let finish!: (raw: string | null) => void;
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const claim = claimOtherGamesPromotion(() => true);
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const open = openOtherGamesPage(() => true);
    finish(null);
    expect(await claim).toBe(true);
    expect(await open).toBe(true);
    expect(await history()).toMatchObject({ impressions: 1, stopped: true });
    jest.setSystemTime(OTHER_GAMES_START_AT + OTHER_GAMES_GAP_MS);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
  });
  it('stops future prompts durably before explicitly opening the exact supplied URL', async () => {
    await claimOtherGamesPromotion(() => true);
    jest.mocked(Linking.openURL).mockImplementationOnce(async url => {
      expect(url).toBe(OTHER_GAMES_PLAY_URL);
      expect((await history()).stopped).toBe(true);
    });
    expect(await openOtherGamesPage(() => true)).toBe(true);
    jest.setSystemTime(OTHER_GAMES_START_AT + 100 * OTHER_GAMES_GAP_MS);
    expect(await claimOtherGamesPromotion(() => true)).toBe(false);
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });
  it('keeps a failed link stopped for future prompts but allows an explicit retry', async () => {
    jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('no handler'));
    expect(await openOtherGamesPage(() => true)).toBe(false);
    expect((await history()).stopped).toBe(true);
    expect(await openOtherGamesPage(() => true)).toBe(true);
    expect(await canOfferOtherGamesPromotion()).toBe(false);
  });
  it('does not open if durable opt-out fails or the invitation is dismissed during its write', async () => {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    expect(await openOtherGamesPage(() => true)).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
    let current = true;
    const setItem = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, raw) => {
      await setItem(key, raw); current = false;
    });
    expect(await openOtherGamesPage(() => current)).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect((await history()).stopped).toBe(true);
  });
});
