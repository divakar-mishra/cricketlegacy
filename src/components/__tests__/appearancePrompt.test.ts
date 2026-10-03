import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { AppearancePrompt } from '../AppearancePrompt';
import { APPEARANCE_PROMPT_MS, useSettings } from '../../state/settingsStore';

let mockChange: (state: string) => void;
const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
beforeAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { delete environment.IS_REACT_ACT_ENVIRONMENT; });
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: (_: string, fn: typeof mockChange) => { mockChange = fn; return { remove: jest.fn() }; } },
  Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View',
}));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../theme', () => ({ useColors: () => ({}) }));
jest.mock('../AppText', () => ({ AppText: 'Text' }));
jest.mock('../Button', () => ({ Button: 'Button' }));

beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  useSettings.getState().reset();
  useSettings.setState({ hasHydrated: true, hasOnboarded: true });
});
afterEach(() => jest.useRealTimers());

test('counts foreground time across backgrounding, defers during gameplay and dismisses once', async () => {
  let tree!: ReactTestRenderer;
  act(() => { tree = create(React.createElement(AppearancePrompt, { eligible: true, route: 'Match' })); });
  act(() => jest.advanceTimersByTime(10 * 60000));
  act(() => { AppState.currentState = 'background'; mockChange('background'); });
  act(() => jest.advanceTimersByTime(60 * 60000));
  expect(useSettings.getState().appearancePlayMs).toBe(10 * 60000);
  act(() => { AppState.currentState = 'active'; mockChange('active'); });
  act(() => jest.advanceTimersByTime(10 * 60000));
  expect(useSettings.getState().appearancePlayMs).toBe(APPEARANCE_PROMPT_MS);
  expect(tree.toJSON()).toBeNull();
  act(() => tree.update(React.createElement(AppearancePrompt, { eligible: true, route: 'CareerHub' })));
  expect(JSON.stringify(tree.toJSON())).toContain('Choose your look');
  await act(async () => { useSettings.getState().dismissAppearancePrompt(); });
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});

test('does not count onboarding or unhydrated time', () => {
  useSettings.setState({ hasHydrated: false, hasOnboarded: false });
  let tree!: ReactTestRenderer;
  act(() => { tree = create(React.createElement(AppearancePrompt, { eligible: true, route: 'MainMenu' })); });
  act(() => jest.advanceTimersByTime(APPEARANCE_PROMPT_MS));
  expect(useSettings.getState().appearancePlayMs).toBe(0);
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});
