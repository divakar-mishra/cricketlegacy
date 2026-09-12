import { createElement } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AgeEligibilityGate } from '../AgeEligibilityGate';
import { AGE_DECLARATION_KEY } from '../../services/ageEligibility';
const GameContent = () => null;

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  Linking: { openURL: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../theme', () => ({ useTheme: () => ({ colors: {} }) }));

describe('age gate persistence and child mounting', () => {
  let tree: ReactTestRenderer;
  const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let oldActEnvironment: boolean | undefined;
  beforeAll(() => {
    oldActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = oldActEnvironment;
  });
  const accepted = jest.fn();
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });
  afterEach(() => {
    if (tree) act(() => tree.unmount());
  });
  const mount = async () => {
    await act(async () => {
      tree = create(
        createElement(AgeEligibilityGate, { onAccepted: accepted }, createElement(GameContent)),
      );
    });
  };
  it('does not mount game/services for a new user', async () => {
    await mount();
    expect(tree.root.findAllByType(GameContent)).toHaveLength(0);
    expect(accepted).not.toHaveBeenCalled();
  });
  it('restores an accepted declaration without asking again', async () => {
    const declaration = {
      version: 1,
      band: 'adult',
      residence: 'india',
      guardianPermission: false,
    };
    await AsyncStorage.setItem(AGE_DECLARATION_KEY, JSON.stringify(declaration));
    await mount();
    expect(accepted).toHaveBeenCalledWith(declaration);
    expect(tree.root.findAllByType(GameContent)).toHaveLength(1);
  });
  it('keeps a denied declaration blocked across launches and preserves saves', async () => {
    await AsyncStorage.setItem('existing-save', 'keep-me');
    await AsyncStorage.setItem(
      AGE_DECLARATION_KEY,
      JSON.stringify({ version: 1, band: '13to17', residence: 'india', guardianPermission: true }),
    );
    await mount();
    expect(accepted).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(GameContent)).toHaveLength(0);
    expect(await AsyncStorage.getItem('existing-save')).toBe('keep-me');
  });
  it('treats corrupt preference data as unverified rather than allowing access', async () => {
    await AsyncStorage.setItem(AGE_DECLARATION_KEY, '{invalid');
    await mount();
    expect(accepted).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(GameContent)).toHaveLength(0);
  });
});
