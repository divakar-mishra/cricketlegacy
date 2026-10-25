import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SaveGame } from '../../domain/types';
import { createManagerSave } from '../../game/createGame';
import { managerControlledTeamId } from '../../game/managerCalendar';
import { activeManagerClub } from '../../game/managerClubState';
import { PlayerProfileScreen } from '../../screens/PlayerProfileScreen';
import { ManagerTrainingScreen } from '../../screens/ManagerTrainingScreen';
import { configureReactRenderEnvironment } from '../../test/reactRenderEnvironment';

configureReactRenderEnvironment();
let mockSave: SaveGame;
const mockSetPlan = jest.fn();
const mockAlert = jest.fn();
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
jest.mock('../../components', () => ({
  AppText: 'Text',
  Button: 'Button',
  Card: 'Card',
  CountryFlag: 'CountryFlag',
  PlayerAvatar: 'PlayerAvatar',
  ProgressBar: 'ProgressBar',
  Screen: ({ children, footer }: any) =>
    require('react').createElement('Screen', null, children, footer),
  ScreenHeader: 'ScreenHeader',
  SponsorBrandRow: 'SponsorBrandRow',
  Icon: 'Icon',
  MechanicInfoButton: 'MechanicInfoButton',
}));
jest.mock('../../components/AppText', () => ({ AppText: 'Text' }));
jest.mock('../../components/FacilityScene', () => ({ FacilityScene: 'FacilityScene' }));
jest.mock('../../components/GlassAlertModal', () => ({
  GlassAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../state/careerStore', () => ({
  useCareer: (selector: (state: unknown) => unknown) =>
    selector({
      save: mockSave,
      setManagerTrainingPlan: mockSetPlan,
      setManagerTrainingOverride: jest.fn(),
    }),
}));
jest.mock('../../theme', () => ({
  fonts: {},
  fontSize: {},
  fontWeight: {},
  radius: {},
  spacing: {},
  useTheme: () => ({ colors: {}, gradients: { pitch: ['black', 'black'] } }),
  useThemedStyles: (factory: (colors: unknown) => unknown) => factory({}),
}));

describe('player profile ownership and explicit-save behavior', () => {
  let tree: ReactTestRenderer;
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave = createManagerSave({
      teamId: 'manager_india_t3_1',
      country: 'india',
      difficulty: 'NORMAL',
      seed: 351,
    });
  });
  afterEach(() => act(() => tree?.unmount()));

  it('AUDIT: National Manager can see core ratings for a player in the team actually being managed', () => {
    const retainedClub = mockSave.userTeamId!;
    const other = Object.values(mockSave.teams).find(
      (team) => team.id !== retainedClub && team.playerIds.length > 0,
    )!;
    const nationalId = 'audit_national_india';
    mockSave.teams[nationalId] = {
      ...other,
      id: nationalId,
      country: 'india',
      playerIds: [...other.playerIds],
    };
    mockSave.managerCareerLevel = 'NATIONAL';
    mockSave.managerNationalTeamId = nationalId;
    const playerId = other.playerIds[0];
    expect(managerControlledTeamId(mockSave)).toBe(nationalId);
    expect(mockSave.teams[retainedClub].playerIds).not.toContain(playerId);
    act(() => {
      tree = create(
        createElement(PlayerProfileScreen, {
          navigation,
          route: { name: 'PlayerProfile', key: 'profile', params: { playerId } },
        } as any),
      );
    });
    const messages = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
    expect(messages).toContain('Core ratings');
    expect(messages).not.toContain('Private ratings hidden');
  });

  it('CONTROL: domestic manager can see their own club player ratings without a scout report', () => {
    const playerId = mockSave.teams[mockSave.userTeamId!].playerIds[0];
    act(() => {
      tree = create(
        createElement(PlayerProfileScreen, {
          navigation,
          route: { name: 'PlayerProfile', key: 'profile', params: { playerId } },
        } as any),
      );
    });
    expect(tree.root.findAllByType('Text' as any).map((node) => node.props.children)).toContain(
      'Core ratings',
    );
  });

  it.each([false, true])(
    'keeps external-player ratings private unless fully scouted (scouted=%s)',
    (scouted) => {
      const clubId = mockSave.userTeamId!;
      const other = Object.values(mockSave.teams).find(
        (team) => team.id !== clubId && team.playerIds.length > 0,
      )!;
      const playerId = other.playerIds[0];
      if (scouted) mockSave.scoutReports = [{ playerId, uncertainty: 0 } as any];
      act(() => {
        tree = create(
          createElement(PlayerProfileScreen, {
            navigation,
            route: { name: 'PlayerProfile', key: 'profile', params: { playerId } },
          } as any),
        );
      });
      const messages = tree.root.findAllByType('Text' as any).map((node) => node.props.children);
      expect(messages.includes('Core ratings')).toBe(scouted);
      expect(messages.includes('Private ratings hidden')).toBe(!scouted);
    },
  );

  it('OBSERVATION: Back discards an unsaved team-training draft without a save or warning', () => {
    act(() => {
      tree = create(createElement(ManagerTrainingScreen, { navigation } as any));
    });
    const differentFocus =
      activeManagerClub(mockSave)?.trainingPlan.teamFocus === 'BATTING'
        ? 'Bowling training focus'
        : 'Batting training focus';
    act(() =>
      tree.root
        .findAllByType('Pressable' as any)
        .find((node) => node.props.accessibilityLabel === differentFocus)!
        .props.onPress(),
    );
    expect(
      tree.root
        .findAllByType('Button' as any)
        .map((node) => ({ label: node.props.label, disabled: node.props.disabled })),
    ).toContainEqual({ label: 'SAVE TRAINING PLAN', disabled: false });
    act(() => tree.root.findByType('ScreenHeader' as any).props.onBack());
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockSetPlan).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
jest.mock('../../components/CareerGuide', () => require('../../test/coachGuideMock'));
