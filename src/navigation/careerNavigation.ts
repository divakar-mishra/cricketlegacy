import type { GameMode } from '../domain/types';
import type { PlayerHubPage, PlayerLifeTab, RecordsTab, RootStackParamList } from './index';

export function playerHubPage(value: unknown): PlayerHubPage {
  return value === 'stats' || value === 'progress' || value === 'profile' ? value : 'home';
}

export function recordsTab(value: unknown): RecordsTab {
  return value === 'achievements' || value === 'hof' ? value : 'records';
}

export function playerLifeTab(value: unknown): PlayerLifeTab {
  return value === 'finance' || value === 'media' || value === 'legacy' ? value : 'overview';
}

type SimpleDestination =
  'ManagerHub' | 'Squad' | 'ClubOffice' | 'Academy' | 'Purchase' | 'InternationalCalendar';
export type CareerDestination =
  | { screen: 'CareerHub'; params: { initialTab: PlayerHubPage } }
  | { screen: 'Records'; params: { initialTab: RecordsTab } }
  | { screen: SimpleDestination; params?: undefined };

export type CareerTabKey =
  PlayerHubPage | 'team' | 'club' | 'store' | 'records' | 'calendar' | 'academy';

export type CareerTab = {
  key: CareerTabKey;
  label: string;
  icon:
    | 'home'
    | 'stats-chart'
    | 'trophy'
    | 'ellipsis-horizontal'
    | 'people'
    | 'briefcase'
    | 'cart'
    | 'school'
    | 'calendar';
  destination: CareerDestination;
  active: boolean;
};

const PLAYER_TABS: readonly {
  key: PlayerHubPage;
  label: string;
  icon: CareerTab['icon'];
}[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'stats', label: 'Stats', icon: 'stats-chart' },
  { key: 'progress', label: 'Progress', icon: 'trophy' },
  { key: 'profile', label: 'More', icon: 'ellipsis-horizontal' },
];

/** Shared navigation for ordinary career information screens, never match/checkout decisions. */
export function careerTabs(
  mode: GameMode,
  route: keyof RootStackParamList,
  hubPage: PlayerHubPage = 'home',
  nationalManager = false,
  retiredManager = false,
): CareerTab[] {
  if (mode === 'career') {
    const active =
      route === 'CareerHub'
        ? hubPage
        : route === 'Records' || route === 'InternationalCalendar' || route === 'U19WorldCup'
          ? 'progress'
          : 'profile';
    return PLAYER_TABS.map((tab) => ({
      ...tab,
      destination: { screen: 'CareerHub', params: { initialTab: tab.key } },
      active: active === tab.key,
    }));
  }
  const clubRoutes = [
    'ClubOffice',
    'ClubStadium',
    'WageBreakdown',
    'MedicalCentre',
    'StaffRecruitment',
  ];
  const teamRoutes = ['Squad', 'PlayerProfile', 'Training', 'Transfers', 'ManagerLeadership'];
  const tabs: CareerTab[] = [
    {
      key: 'home',
      label: 'Home',
      icon: 'home',
      destination: { screen: 'ManagerHub' },
      active: route === 'ManagerHub',
    },
    {
      key: 'team',
      label: 'Team',
      icon: 'people',
      destination: { screen: 'Squad' },
      active: teamRoutes.includes(route),
    },
    nationalManager
      ? {
          key: 'calendar',
          label: 'Calendar',
          icon: 'calendar',
          destination: { screen: 'InternationalCalendar' },
          active: route === 'InternationalCalendar',
        }
      : {
          key: 'club',
          label: 'Club',
          icon: 'briefcase',
          destination: { screen: 'ClubOffice' },
          active: clubRoutes.includes(route),
        },
    {
      key: 'store',
      label: 'Store',
      icon: 'cart',
      destination: { screen: 'Purchase' },
      active: route === 'Purchase',
    },
    ...(!nationalManager
      ? [
          {
            key: 'academy' as const,
            label: 'Academy',
            icon: 'school' as const,
            destination: { screen: 'Academy' as const },
            active: route === 'Academy',
          },
        ]
      : []),
    {
      key: 'records',
      label: 'Records',
      icon: 'trophy',
      destination: { screen: 'Records', params: { initialTab: 'records' } },
      active: route === 'Records',
    },
  ];
  // A completed career can be reviewed, but must not reopen live club actions.
  return retiredManager ? tabs.filter((tab) => tab.key === 'home' || tab.key === 'records') : tabs;
}
