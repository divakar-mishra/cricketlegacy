import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LoginScreen } from '../LoginScreen';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
let mockUser: { id: string; provider: string; remoteId?: string } | null = null;
const mockGoogle = jest.fn();
const mockApple = jest.fn();
const mockGuest = jest.fn();
const mockEmail = jest.fn();
const mockSignOut = jest.fn();
const mockAlert = jest.fn();
const mockClear = jest.fn();
const mockDelete = jest.fn();
const retryText = 'This Google sign-in expired. Try again to open a fresh sign-in page. Your local saves are unchanged.';
jest.mock('react-native', () => ({ View: 'View', TextInput: 'TextInput', StyleSheet: { create: (s: unknown) => s }, Platform: { OS: 'android' }, Linking: { openURL: jest.fn() } }));
jest.mock('../../components', () => ({ Button: 'Button', Card: 'Card', Emblem: 'Emblem', Screen: 'Screen', ScreenHeader: 'ScreenHeader', AppText: 'Text' }));
jest.mock('../../components/GlassAlertModal', () => ({ GlassAlert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock('../../components/AccountBackupCard', () => ({ AccountBackupCard: 'AccountBackupCard' }));
jest.mock('../../components/AppleAccountButton', () => ({ AppleAccountButton: 'AppleAccountButton' }));
jest.mock('../../services', () => ({
  useAuth: (select: (state: unknown) => unknown) => select({ user: mockUser }),
  auth: {
    signInApple: (...args: unknown[]) => mockApple(...args),
    signInGoogle: (...args: unknown[]) => mockGoogle(...args),
    signInGuest: () => mockGuest(), signInEmail: (...args: unknown[]) => mockEmail(...args),
    signOut: () => mockSignOut(),
    googleSignInRetryMessage: (error: { retry?: boolean; message?: string }) => error.retry ? error.message : null,
  },
  accountDeletion: { deleteCurrentRemoteAccount: () => mockDelete() },
}));
jest.mock('../../state/careerStore', () => ({ useCareer: { getState: () => ({ clear: mockClear }) } }));
jest.mock('../../state/hofStore', () => ({ useHallOfFame: { getState: () => ({ reset: mockClear }) } }));
jest.mock('../../state/settingsStore', () => ({ useSettings: { getState: () => ({ reset: mockClear }) } }));
jest.mock('../../storage/storage', () => ({ clearAllLocalData: () => mockClear() }));
jest.mock('../../theme', () => ({
  fontSize: {}, fontWeight: {}, spacing: {},
  useThemedStyles: (make: (colors: object) => object) => make({ accent: 'gold', text: 'white', textMuted: 'gray' }),
}));

describe('Account Google sign-in retry interactions', () => {
  let tree: ReactTestRenderer;
  const render = () => act(() => { tree = create(createElement(LoginScreen, { navigation: { goBack: jest.fn() } } as any)); });
  const button = (label: string) => tree.root.findAllByType('Button' as any).find(b => b.props.label === label)!;
  const text = () => JSON.stringify(tree.toJSON());
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    mockDelete.mockResolvedValue({ status: 'FAILED', error: 'Deletion not confirmed.' });
    mockGoogle.mockResolvedValue({ id: 'google-id', provider: 'google', displayName: 'QA Player' });
  });
  afterEach(() => act(() => tree?.unmount()));

  it('does not wipe device data or sign out when Apple/Google remote deletion is not confirmed', async () => {
    mockUser = { id: 'apple-id', provider: 'apple', remoteId: 'apple-id' };
    render();
    act(() => button('Delete account & data').props.onPress());
    const actions = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => { actions.find(action => action.text === 'Delete account')!.onPress!(); });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenLastCalledWith('Account not deleted', expect.stringContaining('Nothing on this device was removed'));
  });

  it('clears local data only after the remote deletion service confirms success', async () => {
    mockUser = { id: 'apple-id', provider: 'apple', remoteId: 'apple-id' };
    mockDelete.mockResolvedValueOnce({ status: 'DELETED', requestId: 'a'.repeat(64) });
    render();
    act(() => button('Delete account & data').props.onPress());
    const actions = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => { actions.find(action => action.text === 'Delete account')!.onPress!(); });
    expect(mockClear).toHaveBeenCalledTimes(4);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Account and app data deleted.');
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(mockClear.mock.invocationCallOrder[0]);
  });

  it('shows persistent expired guidance and a fresh retry instead of a silent dismissal', async () => {
    mockGoogle.mockRejectedValueOnce({ retry: true, message: retryText });
    render();
    await act(async () => button('Continue with Google').props.onPress());
    expect(text()).toContain(retryText);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(button('Try Google sign-in again').props.disabled).toBe(false);
    await act(async () => button('Try Google sign-in again').props.onPress());
    expect(mockGoogle.mock.calls).toEqual([[{ existingAccount: true }], [{ existingAccount: true }]]);
    expect(text()).toContain('Signed in with Google as QA Player.');
    expect(text()).not.toContain('Try Google sign-in again');
    expect(mockClear).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it.each([true, false])('retry preserves the explicitly chosen existing-account intent: %s', async existingAccount => {
    mockUser = { id: 'guest-id', provider: 'guest', remoteId: 'guest-id' };
    mockGoogle.mockRejectedValueOnce({ retry: true, message: retryText });
    render();
    await act(async () => button(existingAccount ? 'Sign in to existing Google account' : 'Link Google account').props.onPress());
    await act(async () => button('Try Google sign-in again').props.onPress());
    expect(mockGoogle.mock.calls).toEqual(existingAccount ? [[{ existingAccount: true }], [{ existingAccount: true }]] : [[], []]);
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('blocks repeated callbacks and competing guest actions before React rerenders', async () => {
    let finish!: (user: unknown) => void;
    mockGoogle.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render();
    const googlePress = button('Continue with Google').props.onPress;
    const guestPress = button('Play as Guest').props.onPress;
    act(() => { googlePress(); googlePress(); guestPress(); });
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    expect(mockGuest).not.toHaveBeenCalled();
    expect(text()).toContain('Finish Google sign-in in the browser.');
    await act(async () => finish({ id: 'google-id', provider: 'google' }));
    expect(button('Continue with Google').props.loading).toBe(false);
  });

  it('does not sign out or delete a guest account while a Google handoff is pending', async () => {
    let finish!: (user: unknown) => void;
    mockUser = { id: 'guest-id', provider: 'guest', remoteId: 'guest-id' };
    mockGoogle.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render();
    const signOut = button('Sign out').props.onPress;
    const deleteAccount = button('Delete account & data').props.onPress;
    act(() => { button('Link Google account').props.onPress(); signOut(); deleteAccount(); });
    expect(button('Sign out').props.disabled).toBe(true);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
    await act(async () => finish({ id: 'google-id', provider: 'google' }));
    expect(button('Sign out').props.disabled).toBe(false);
  });

  it('retains ordinary failure alerts and unlocks the existing buttons after failure', async () => {
    mockGoogle.mockRejectedValueOnce(new Error('Connect to the internet to sign in with Google.'));
    render();
    await act(async () => button('Continue with Google').props.onPress());
    expect(mockAlert).toHaveBeenCalledWith('Google sign-in unavailable', 'Connect to the internet to sign in with Google.');
    expect(button('Continue with Google').props.loading).toBe(false);
    expect(text()).not.toContain('Signed in with Google as');
    expect(mockClear).not.toHaveBeenCalled();
  });

  it('keeps offline guest play reachable after abandoning a Google attempt', async () => {
    mockGoogle.mockRejectedValueOnce({ retry: true, message: 'Google sign-in did not finish. Close the Google or Sunlight tab, then try again here. Your local saves are unchanged.' });
    render();
    await act(async () => button('Continue with Google').props.onPress());
    await act(async () => button('Play as Guest').props.onPress());
    expect(mockGuest).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Signed in as guest');
    expect(text()).not.toContain('Try Google sign-in again');
    expect(mockClear).not.toHaveBeenCalled();
  });
  it('offers Apple alongside Google on iOS and preserves the guest on failed Apple configuration', async () => {
    const platform = jest.requireMock('react-native').Platform;
    platform.OS = 'ios';
    try {
      mockUser = { id: 'guest-id', provider: 'guest' };
      mockApple.mockRejectedValueOnce(new Error('Apple sign-in is not configured in this build.'));
      render();
      const apple = tree!.root.findByType('AppleAccountButton' as any);
      await act(async () => apple.props.onPress());
      expect(mockApple).toHaveBeenCalledWith({ existingAccount: true });
      expect(mockAlert).toHaveBeenCalledWith('Apple sign-in unavailable', 'Apple sign-in is not configured in this build.');
      expect(mockClear).not.toHaveBeenCalled();
    } finally { platform.OS = 'android'; }
  });
});
