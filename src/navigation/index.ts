import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  MainMenu: undefined;
  NewGame: undefined;
  PlayerCreation: { slot?: number; legacy?: number; legacyScore?: number } | undefined;
  TeamSelect: { slot?: number } | undefined;
  SavedGames: undefined;
  Settings: undefined;
  CricketAcademy: undefined;
  Login: undefined;
  Purchase: undefined;
  CareerHub: undefined;
  ManagerHub: undefined;
  Match: { intl?: boolean; daily?: boolean } | undefined;
  Training: undefined;
  ManagerLeadership: undefined;
  Squad: undefined;
  Transfers: undefined;
  PlayerProfile: { playerId: string };
  PlayerLife:
    { initialTab?: 'overview' | 'finance' | 'media' | 'legacy' } | undefined;
  Records: undefined;
  Narrative: undefined;
  ClubOffice: undefined;
  MedicalCentre: undefined;
  ClubStadium: undefined;
  Academy: undefined;
  Press: undefined;
  SeasonPass: undefined;
  PremiumClubhouse: undefined;
  LeagueEditor: undefined;
  StaffRecruitment: undefined;
  AwardsNight: undefined;
  MilestoneCinematic: {
    kind: 'CENTURY' | 'FIVE_WICKETS' | 'NATIONAL_CAP' | 'TITLE';
    playerName: string;
    detail?: string;
  };
  PlayerCosmetics: undefined;
  NotificationInbox: undefined;
  DailyChallenge: undefined;
  BoardMeeting: {
    kind: 'SACKED' | 'PRAISED' | 'WARNING' | 'EXTENDED';
    message: string;
    clubName?: string;
    season?: number;
  };
  HallOfFameCeremony: {
    playerName: string;
    legacyScore: number;
    mode: 'career' | 'manager';
    titles?: number;
    caps?: number;
  };
  InjuryReport: {
    playerName: string;
    weeksOut: number;
    matchesMissed: number;
    nextMatchLabel?: string;
    playerId?: string;
  };
  TransferDeadlineDay: undefined;
  YouthGraduateCeremony: {
    playerName: string;
    role: string;
    overall: number;
    yearsInAcademy: number;
    jerseyNumber?: number;
    teamName: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  // Feature 2
  InvestmentScreen: undefined;
  AcademyManagement: undefined;
  // Finance
  WageBreakdown: undefined;
  ContractNegotiation: undefined;
  // Feature 5
  U19WorldCup: undefined;
  // Feature 8
  InternationalCalendar: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
