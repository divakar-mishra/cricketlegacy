const mockSettings = { sound: true, music: true };
const mockCreatePlayer = jest.fn();
const mockSetMode = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: (...args: unknown[]) => mockCreatePlayer(...args),
  setAudioModeAsync: (...args: unknown[]) => mockSetMode(...args),
}));
jest.mock('../../state/settingsStore', () => ({
  useSettings: { getState: () => mockSettings },
}));

function makePlayer() {
  return {
    play: jest.fn(), pause: jest.fn(), seekTo: jest.fn().mockResolvedValue(undefined),
    setPlaybackRate: jest.fn(), volume: 0, loop: false,
  };
}

const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

beforeEach(() => {
  jest.resetModules();
  mockSettings.sound = true;
  mockSettings.music = true;
  mockCreatePlayer.mockReset().mockImplementation(makePlayer);
  mockSetMode.mockReset().mockResolvedValue(undefined);
});

describe('music setting and live-play lifecycle', () => {
  it('pauses live gameplay, stays paused on settings sync, and resumes the same player afterward', async () => {
    const music = jest.requireActual<typeof import('../music')>('../music');
    music.syncMusicWithSettings();
    const player = mockCreatePlayer.mock.results[0].value;
    expect(player.play).toHaveBeenCalledTimes(1);
    music.setMusicScene('MATCH_LIVE');
    expect(player.pause).toHaveBeenCalledTimes(1);
    music.syncMusicWithSettings();
    expect(player.play).toHaveBeenCalledTimes(1);
    music.setMusicScene('VICTORY');
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(player.volume).toBe(0.17);
    expect(mockCreatePlayer).toHaveBeenCalledTimes(1);
  });

  it('does not start music when enabled inside live gameplay or resume when the user disabled it', async () => {
    const music = jest.requireActual<typeof import('../music')>('../music');
    music.setMusicScene('MATCH_LIVE');
    music.setMusicEnabled(true);
    expect(mockCreatePlayer).not.toHaveBeenCalled();
    music.setMusicEnabled(false);
    music.setMusicScene('MENU');
    expect(mockCreatePlayer).not.toHaveBeenCalled();
  });
});

describe('reliable one-shot sound playback', () => {
  it('drops a delivery impact if its clock becomes stale while native rewind is pending', async () => {
    let rewindReady!: () => void;
    let current = true;
    const player = makePlayer();
    player.seekTo.mockImplementation(() => new Promise<void>(resolve => { rewindReady = resolve; }));
    mockCreatePlayer.mockReturnValue(player);
    const sfx = jest.requireActual<typeof import('../sfx')>('../sfx');
    sfx.play('bat', () => current);
    await flush();
    current = false;
    rewindReady();
    await flush();
    expect(player.play).not.toHaveBeenCalled();
  });
  it('waits for both audio mode and rewind before playing, including repeated hits', async () => {
    let modeReady!: () => void;
    let rewindReady!: () => void;
    mockSetMode.mockReturnValue(new Promise<void>(resolve => { modeReady = resolve; }));
    const player = makePlayer();
    player.seekTo.mockImplementation(() => new Promise<void>(resolve => { rewindReady = resolve; }));
    mockCreatePlayer.mockReturnValue(player);
    const sfx = jest.requireActual<typeof import('../sfx')>('../sfx');
    sfx.play('four');
    await flush();
    expect(player.seekTo).not.toHaveBeenCalled();
    modeReady();
    await flush();
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).not.toHaveBeenCalled();
    rewindReady();
    await flush();
    expect(player.play).toHaveBeenCalledTimes(1);
    sfx.play('four');
    await flush();
    expect(player.play).toHaveBeenCalledTimes(1);
    rewindReady();
    await flush();
    expect(player.play).toHaveBeenCalledTimes(2);
    expect(mockCreatePlayer).toHaveBeenCalledTimes(1);
  });

  it('catches a rejected rewind and allows the next hit to play', async () => {
    const player = makePlayer();
    player.seekTo.mockRejectedValueOnce(new Error('native seek failed'));
    mockCreatePlayer.mockReturnValue(player);
    const sfx = jest.requireActual<typeof import('../sfx')>('../sfx');
    sfx.play('bat');
    await flush();
    expect(player.play).not.toHaveBeenCalled();
    sfx.play('bat');
    await flush();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('honours mute even if the preference changes during rewind', async () => {
    let rewindReady!: () => void;
    const player = makePlayer();
    player.seekTo.mockImplementation(() => new Promise<void>(resolve => { rewindReady = resolve; }));
    mockCreatePlayer.mockReturnValue(player);
    const sfx = jest.requireActual<typeof import('../sfx')>('../sfx');
    sfx.play('six');
    await flush();
    mockSettings.sound = false;
    rewindReady();
    await flush();
    sfx.play('four');
    expect(player.play).not.toHaveBeenCalled();
    expect(mockCreatePlayer).toHaveBeenCalledTimes(1);
  });

  it('preloads match effects without playing them and reuses them for the first ball', async () => {
    const sfx = jest.requireActual<typeof import('../sfx')>('../sfx');
    sfx.preloadMatchSounds();
    const loaded = mockCreatePlayer.mock.results.map(result => result.value);
    expect(loaded).toHaveLength(7);
    expect(loaded.every(player => player.play.mock.calls.length === 0)).toBe(true);
    sfx.play('bat');
    await flush();
    expect(mockCreatePlayer).toHaveBeenCalledTimes(7);
    expect(loaded[0].play).toHaveBeenCalledTimes(1);
  });

  it('does not replay stale requests after quick repeated presses', async () => {
    const sfx = jest.requireActual<typeof import('../sfx')>('../sfx');
    sfx.play('tap');
    sfx.play('tap');
    await flush();
    const player = mockCreatePlayer.mock.results[0].value;
    expect(player.play).toHaveBeenCalledTimes(1);
  });
});
