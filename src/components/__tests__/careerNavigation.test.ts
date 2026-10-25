import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { CareerNavigation } from '../CareerNavigation';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';
jest.mock('../CareerGuide', () => require('../../test/coachGuideMock'));

configureReactRenderEnvironment();

let mockMode: 'career' | 'manager' | undefined = 'career';
let mockNational = false;
let mockRetired = false;
let mockSaveId = 'navigation-save';
let mockFocused = true;
let mockRoute: { name: string; params?: object };
const mockNavigation = { navigate: jest.fn(), popTo: jest.fn(), isFocused: () => mockFocused };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('../../state/careerStore', () => {
  const state = () => ({
    save: mockMode
      ? {
          id: mockSaveId,
          mode: mockMode,
          managerCareerLevel: mockNational ? 'NATIONAL' : 'CLUB',
          managerRetired: mockRetired,
        }
      : null,
  });
  return {
    useCareer: Object.assign((selector: (value: unknown) => unknown) => selector(state()), {
      getState: state,
    }),
  };
});
jest.mock('../HubTabBar', () => ({ HubTabBar: 'HubTabBar' }));
jest.mock('../../i18n', () => ({ useT: () => (key: string) => key }));

describe('shared career navigation interactions', () => {
  let tree: ReactTestRenderer;
  const render = () =>
    act(() => {
      tree = create(createElement(CareerNavigation));
    });
  const press = (key: string) =>
    act(() => {
      tree.root
        .findByType('HubTabBar' as any)
        .props.tabs.find((tab: { key: string }) => tab.key === key)
        .onPress();
    });
  beforeEach(() => {
    jest.clearAllMocks();
    mockMode = 'career';
    mockNational = false;
    mockRetired = false;
    mockSaveId = 'navigation-save';
    mockFocused = true;
    mockRoute = { name: 'CareerHub' };
  });
  afterEach(() => act(() => tree?.unmount()));

  it('restricts retired Managers to Home and Records', () => {
    mockMode = 'manager';
    mockRetired = true;
    mockRoute = { name: 'Records' };
    render();
    expect(
      tree.root.findByType('HubTabBar' as any).props.tabs.map((tab: { key: string }) => tab.key),
    ).toEqual(['home', 'records']);
    press('home');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('ManagerHub');
  });
  it.each(['mode', 'identity', 'cleared', 'national', 'retired', 'blurred'] as const)(
    'rejects a queued Manager Club callback after a %s change, even before rerender',
    (change) => {
      mockMode = 'manager';
      mockRoute = { name: 'MedicalCentre' };
      render();
      const oldPress = tree.root
        .findByType('HubTabBar' as any)
        .props.tabs.find((tab: { key: string }) => tab.key === 'club').onPress;
      if (change === 'mode') mockMode = 'career';
      if (change === 'identity') mockSaveId = 'another-manager-save';
      if (change === 'cleared') mockMode = undefined;
      if (change === 'national') mockNational = true;
      if (change === 'retired') mockRetired = true;
      if (change === 'blurred') mockFocused = false;
      act(() => oldPress());
      expect(mockNavigation.popTo).not.toHaveBeenCalled();
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    },
  );

  it('selects Progress directly on an existing hub route', () => {
    render();
    press('progress');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('CareerHub', { initialTab: 'progress' });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
  it('opens Team directly from Medical Centre without two Back actions', () => {
    mockMode = 'manager';
    mockRoute = { name: 'MedicalCentre' };
    render();
    press('team');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('Squad');
  });
  it('pushes destinations from Home so Back still returns Home', () => {
    mockMode = 'manager';
    mockRoute = { name: 'ManagerHub' };
    render();
    press('club');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ClubOffice');
    expect(mockNavigation.popTo).not.toHaveBeenCalled();
  });
  it('opens Records on the requested tab, including on an already mounted screen', () => {
    mockMode = 'manager';
    mockRoute = { name: 'Records', params: { initialTab: 'hof' } };
    render();
    press('records');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('Records', { initialTab: 'records' });
  });
  it('does not navigate when the current Manager section is tapped again', () => {
    mockMode = 'manager';
    mockRoute = { name: 'Squad' };
    render();
    press('team');
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(mockNavigation.popTo).not.toHaveBeenCalled();
  });
  it('does not show career navigation without an active save', () => {
    mockMode = undefined;
    render();
    expect(tree.toJSON()).toBeNull();
  });
  it('uses the current save mode rather than the screen that was opened earlier', () => {
    render();
    mockMode = 'manager';
    mockRoute = { name: 'MedicalCentre' };
    act(() => tree.update(createElement(CareerNavigation)));
    press('home');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('ManagerHub');
  });
  it('makes national Calendar reachable without exposing paused club operations', () => {
    mockMode = 'manager';
    mockNational = true;
    mockRoute = { name: 'Squad' };
    render();
    press('calendar');
    expect(mockNavigation.popTo).toHaveBeenCalledWith('InternationalCalendar');
    expect(
      tree.root.findByType('HubTabBar' as any).props.tabs.map((tab: { key: string }) => tab.key),
    ).not.toContain('club');
  });
});
