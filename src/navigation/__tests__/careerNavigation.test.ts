import { StackActions, StackRouter } from '@react-navigation/routers';
import { careerTabs, playerHubPage, playerLifeTab, recordsTab } from '../careerNavigation';
import type { RootStackParamList } from '../index';

describe('career section navigation', () => {
  it.each([false, true])(
    'keeps a retired Manager read-only, including National duty=%s',
    (national) => {
      expect(
        careerTabs('manager', 'Records', 'home', national, true).map((tab) => tab.key),
      ).toEqual(['home', 'records']);
    },
  );
  it.each(['home', 'stats', 'progress', 'profile'] as const)(
    'makes the Player %s page reachable',
    (page) => {
      const tabs = careerTabs('career', 'CareerHub', page);
      expect(tabs.filter((tab) => tab.active).map((tab) => tab.key)).toEqual([page]);
      expect(tabs.find((tab) => tab.key === page)?.destination).toEqual({
        screen: 'CareerHub',
        params: { initialTab: page },
      });
    },
  );

  it('calls a menu More rather than promising the actual player profile', () => {
    expect(careerTabs('career', 'CareerHub').find((tab) => tab.key === 'profile')?.label).toBe(
      'More',
    );
  });

  it.each([
    'MedicalCentre',
    'ClubStadium',
    'WageBreakdown',
    'Academy',
    'StaffRecruitment',
  ] as const)('provides one-tap Team and Home navigation from %s', (route) => {
    const tabs = careerTabs('manager', route);
    expect(tabs.find((tab) => tab.key === 'team')?.destination).toEqual({ screen: 'Squad' });
    expect(tabs.find((tab) => tab.key === 'home')?.destination).toEqual({ screen: 'ManagerHub' });
    expect(tabs.filter((tab) => tab.active).map((tab) => tab.key)).toEqual([
      route === 'Academy' ? 'academy' : 'club',
    ]);
  });

  it('shows the full Records destination rather than labelling it only Standings', () => {
    expect(careerTabs('manager', 'ManagerHub').find((tab) => tab.key === 'records')).toMatchObject({
      label: 'Records',
      destination: { screen: 'Records', params: { initialTab: 'records' } },
    });
  });

  it('replaces domestic club navigation with Calendar on national duty', () => {
    const tabs = careerTabs('manager', 'InternationalCalendar', 'home', true);
    expect(tabs.map((tab) => tab.destination.screen)).not.toContain('ClubOffice');
    expect(tabs.find((tab) => tab.active)?.destination).toEqual({
      screen: 'InternationalCalendar',
    });
  });

  it.each([undefined, null, '', 'narrative', 'not-a-tab', 0])(
    'normalizes invalid route tabs (%s) safely',
    (value) => {
      expect(playerHubPage(value)).toBe('home');
      expect(recordsTab(value)).toBe('records');
      expect(playerLifeTab(value)).toBe('overview');
    },
  );

  it.each(['achievements', 'hof'] as const)(
    'preserves the explicit %s Records destination',
    (tab) => {
      expect(recordsTab(tab)).toBe(tab);
    },
  );

  it.each(['finance', 'media', 'legacy'] as const)(
    'preserves the explicit %s Player Life destination',
    (tab) => {
      expect(playerLifeTab(tab)).toBe(tab);
    },
  );

  it('uses the installed stack router to switch sections without stacking duplicate hubs', () => {
    const router = StackRouter({ initialRouteName: 'MainMenu' });
    const options = {
      routeNames: [
        'MainMenu',
        'ManagerHub',
        'ClubOffice',
        'MedicalCentre',
        'Squad',
        'Records',
        'CareerHub',
      ],
      routeParamList: {},
      routeGetIdList: {},
    };
    let state = router.getInitialState(options);
    const apply = (
      action: ReturnType<typeof StackActions.push> | ReturnType<typeof StackActions.popTo>,
    ) => {
      const next = router.getStateForAction(state, action, options);
      expect(next).not.toBeNull();
      state = router.getRehydratedState(next!, options);
    };
    apply(StackActions.push('ManagerHub'));
    apply(StackActions.push('ClubOffice'));
    apply(StackActions.push('MedicalCentre'));
    apply(StackActions.popTo('Squad'));
    expect(state.routes.map((route) => route.name)).toEqual([
      'MainMenu',
      'ManagerHub',
      'ClubOffice',
      'Squad',
    ]);
    for (let i = 0; i < 10; i++) {
      apply(StackActions.popTo('ClubOffice'));
      apply(StackActions.popTo('Records', { initialTab: 'records' }));
      apply(StackActions.popTo('ManagerHub'));
    }
    expect(state.routes.map((route) => route.name)).toEqual(['MainMenu', 'ManagerHub']);
  });

  it('can return Home when a deep link has no hub underneath it', () => {
    const router = StackRouter({ initialRouteName: 'MedicalCentre' });
    const options = {
      routeNames: ['MedicalCentre', 'ManagerHub'],
      routeParamList: {},
      routeGetIdList: {},
    };
    const state = router.getInitialState(options);
    const next = router.getStateForAction(state, StackActions.popTo('ManagerHub'), options);
    expect(next?.routes.map((route) => route.name)).toEqual(['ManagerHub']);
  });

  it('replaces old tab parameters when returning to an existing Records screen', () => {
    const router = StackRouter({ initialRouteName: 'Records' });
    const options = {
      routeNames: ['Records', 'CareerHub'],
      routeParamList: {},
      routeGetIdList: {},
    };
    let state = router.getInitialState(options);
    state = router.getRehydratedState(
      router.getStateForAction(
        state,
        StackActions.popTo('Records', { initialTab: 'hof' }),
        options,
      )!,
      options,
    );
    state = router.getRehydratedState(
      router.getStateForAction(
        state,
        StackActions.popTo('Records', { initialTab: 'achievements' }),
        options,
      )!,
      options,
    );
    expect(state.routes).toHaveLength(1);
    expect(state.routes[0].params as RootStackParamList['Records']).toEqual({
      initialTab: 'achievements',
    });
  });
});
