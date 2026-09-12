import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PlayerContractMoment } from './src/components/ContractMomentModal';
import { useCallback, useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncMusicWithSettings } from './src/audio';
import { ErrorBoundary, GlassAlertHost, GlassBlurProvider, Onboarding } from './src/components';
import { AppIntegrityGate } from './src/components/AppIntegrityGate';
import { AGE_DECLARATION_KEY, canUseAds, isAgeDeclaration } from './src/services/ageEligibility';
import { getJSON } from './src/storage/storage';
import { MONETIZATION } from './src/config/monetization';
import { ModalQueueProvider } from './src/context/ModalQueueContext';
import { RootStackParamList } from './src/navigation';
import {
  AcademyManagementScreen,
  AcademyScreen,
  CareerHubScreen,
  ClubOfficeScreen,
  ClubStadiumScreen,
  ContractNegotiationScreen,
  CricketAcademyScreen,
  DailyChallengeScreen,
  InternationalCalendarScreen,
  InvestmentScreen,
  LeagueEditorScreen,
  LoginScreen,
  MainMenuScreen,
  MedicalCentreScreen,
  ManagerLeadershipScreen,
  ManagerHubScreen,
  MatchScreen,
  NarrativeScreen,
  NewGameScreen,
  NotificationInboxScreen,
  PlayerCreationScreen,
  PlayerLifeScreen,
  PlayerProfileScreen,
  PremiumClubhouseScreen,
  PressConferenceScreen,
  PurchaseScreen,
  RecordsScreen,
  SavedGamesScreen,
  SeasonPassScreen,
  SettingsScreen,
  SplashScreen,
  SquadScreen,
  StaffRecruitmentScreen,
  TeamSelectScreen,
  TrainingScreen,
  TransfersScreen,
  U19WorldCupScreen,
  WageBreakdownScreen,
} from './src/screens';
import { AwardsNightScreen } from './src/screens/AwardsNightScreen';
import { BoardMeetingScreen } from './src/screens/BoardMeetingScreen';
import { HallOfFameCeremonyScreen } from './src/screens/HallOfFameCeremonyScreen';
import { InjuryReportScreen } from './src/screens/InjuryReportScreen';
import { MilestoneCinematicScreen } from './src/screens/MilestoneCinematicScreen';
import { PlayerCosmeticsScreen } from './src/screens/PlayerCosmeticsScreen';
import { TransferDeadlineDayScreen } from './src/screens/TransferDeadlineDayScreen';
import { YouthGraduateCeremonyScreen } from './src/screens/YouthGraduateCeremonyScreen';
import { ads, analytics, auth, crash, notifications, purchases } from './src/services';
import { useCareer } from './src/state/careerStore';
import { useAppFonts, useTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const fontsReady = useAppFonts();
  const { colors, isDark } = useTheme();
  const activeSaveId = useCareer((state) => state.save?.id);
  const passPeriodEndsAt = useCareer((state) => state.save?.pass?.periodEndsAt);
  const premiumEntitlementActive = useCareer(
    (state) => state.save?.entitlements.seasonPass?.premium ?? false,
  );
  const premiumEntitlementExpiresAt = useCareer(
    (state) => state.save?.entitlements.seasonPass?.expiresAt,
  );
  const hideNativeSplash = useCallback(() => {
    void ExpoSplashScreen.hideAsync().catch(() => undefined);
  }, []);

  const navTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.bg,
      primary: colors.primary,
      text: colors.text,
      border: colors.border,
    },
  };

  useEffect(() => {
    // Best-effort platform wiring — all safe no-ops without the native side.
    crash.installGlobalHandler();
    notifications.configureForegroundHandler();
    syncMusicWithSettings();
    analytics.logEvent(analytics.EVT.APP_OPEN);
    // Monetization providers. No-op in dev / Expo Go / when keys are absent.
    void purchases
      .configurePurchases(MONETIZATION.revenueCat)
      .catch(() => undefined);
    // Local sign-in hydration must not wait for the store's network handshake.
    void auth.rehydrateAuth().catch(() => undefined);
    // No startup age questionnaire. Preserve prior ad eligibility without
    // inventing an adult declaration for new installs; UMP remains mandatory.
    void getJSON<unknown>(AGE_DECLARATION_KEY)
      .then((stored) => ads.configureAds(MONETIZATION.admob, isAgeDeclaration(stored) && canUseAds(stored)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Native timers pause with the app. Reconcile the UTC month as soon as
        // any screen returns to the foreground.
        void useCareer
          .getState()
          .synchronizeSeasonPassClock(Date.now())
          .catch(() => undefined);
        return;
      }
      // Background transitions have a short execution window. Bypass the
      // animation delay and ask AsyncStorage to confirm the write immediately.
      void useCareer
        .getState()
        .persistCritical(true)
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (passPeriodEndsAt == null || !Number.isFinite(passPeriodEndsAt))
      return undefined;
    const passClockTargetAt =
      premiumEntitlementActive &&
      premiumEntitlementExpiresAt != null &&
      Number.isFinite(premiumEntitlementExpiresAt)
        ? Math.min(passPeriodEndsAt, premiumEntitlementExpiresAt)
        : passPeriodEndsAt;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const synchronizeAtBoundary = () => {
      if (cancelled) return;
      const remainingMs = passClockTargetAt - Date.now();
      if (remainingMs <= 0) {
        void useCareer
          .getState()
          .synchronizeSeasonPassClock(Date.now())
          .catch(() => undefined);
        return;
      }
      // Stay below native timer limits and recheck clocks at least hourly.
      timer = setTimeout(synchronizeAtBoundary, Math.min(remainingMs + 25, 3_600_000));
    };
    synchronizeAtBoundary();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    activeSaveId,
    passPeriodEndsAt,
    premiumEntitlementActive,
    premiumEntitlementExpiresAt,
  ]);

  useEffect(() => {
    if (!fontsReady) return undefined;
    const frame = requestAnimationFrame(hideNativeSplash);
    const fallback = setTimeout(hideNativeSplash, 500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [fontsReady, hideNativeSplash]);

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={hideNativeSplash}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ModalQueueProvider>
            <GlassBlurProvider target={<View style={{ flex: 1, backgroundColor: colors.bg }} />}>
              <StatusBar style={isDark ? 'light' : 'dark'} />
                <AppIntegrityGate>
                  <NavigationContainer theme={navTheme}>
                    <Stack.Navigator
                      initialRouteName="Splash"
                      screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                        contentStyle: { backgroundColor: colors.bg },
                      }}
                    >
                      <Stack.Screen
                        name="Splash"
                        component={SplashScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen
                        name="MainMenu"
                        component={MainMenuScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen name="NewGame" component={NewGameScreen} />
                      <Stack.Screen name="PlayerCreation" component={PlayerCreationScreen} />
                      <Stack.Screen name="TeamSelect" component={TeamSelectScreen} />
                      <Stack.Screen
                        name="Match"
                        component={MatchScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen name="SavedGames" component={SavedGamesScreen} />
                      <Stack.Screen name="Settings" component={SettingsScreen} />
                      <Stack.Screen name="CricketAcademy" component={CricketAcademyScreen} />
                      <Stack.Screen name="Login" component={LoginScreen} />
                      <Stack.Screen name="Purchase" component={PurchaseScreen} />
                      <Stack.Screen
                        name="CareerHub"
                        component={CareerHubScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen name="ManagerHub" component={ManagerHubScreen} />
                      <Stack.Screen name="Training" component={TrainingScreen} />
                      <Stack.Screen name="ManagerLeadership" component={ManagerLeadershipScreen} />
                      <Stack.Screen name="Squad" component={SquadScreen} />
                      <Stack.Screen name="Transfers" component={TransfersScreen} />
                      <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
                      <Stack.Screen name="PlayerLife" component={PlayerLifeScreen} />
                      <Stack.Screen name="Records" component={RecordsScreen} />
                      <Stack.Screen
                        name="Narrative"
                        component={NarrativeScreen}
                        options={{ animation: 'slide_from_bottom' }}
                      />
                      <Stack.Screen name="ClubOffice" component={ClubOfficeScreen} />
                      <Stack.Screen name="MedicalCentre" component={MedicalCentreScreen} />
                      <Stack.Screen name="ClubStadium" component={ClubStadiumScreen} />
                      <Stack.Screen name="Academy" component={AcademyScreen} />
                      <Stack.Screen
                        name="Press"
                        component={PressConferenceScreen}
                        options={{ animation: 'slide_from_bottom' }}
                      />
                      <Stack.Screen name="SeasonPass" component={SeasonPassScreen} />
                      <Stack.Screen name="PremiumClubhouse" component={PremiumClubhouseScreen} />
                      <Stack.Screen name="LeagueEditor" component={LeagueEditorScreen} />
                      <Stack.Screen name="StaffRecruitment" component={StaffRecruitmentScreen} />
                      <Stack.Screen
                        name="AwardsNight"
                        component={AwardsNightScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen
                        name="MilestoneCinematic"
                        component={MilestoneCinematicScreen}
                        options={{ animation: 'fade', presentation: 'transparentModal' }}
                      />
                      <Stack.Screen name="PlayerCosmetics" component={PlayerCosmeticsScreen} />
                      <Stack.Screen
                        name="NotificationInbox"
                        component={NotificationInboxScreen}
                        options={{ animation: 'slide_from_right' }}
                      />
                      <Stack.Screen
                        name="DailyChallenge"
                        component={DailyChallengeScreen}
                        options={{ animation: 'slide_from_bottom' }}
                      />
                      <Stack.Screen
                        name="BoardMeeting"
                        component={BoardMeetingScreen}
                        options={{ animation: 'fade', presentation: 'transparentModal' }}
                      />
                      <Stack.Screen
                        name="HallOfFameCeremony"
                        component={HallOfFameCeremonyScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen
                        name="InjuryReport"
                        component={InjuryReportScreen}
                        options={{ animation: 'slide_from_bottom' }}
                      />
                      <Stack.Screen
                        name="TransferDeadlineDay"
                        component={TransferDeadlineDayScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen
                        name="YouthGraduateCeremony"
                        component={YouthGraduateCeremonyScreen}
                        options={{ animation: 'fade' }}
                      />
                      <Stack.Screen name="InvestmentScreen" component={InvestmentScreen} />
                      <Stack.Screen name="AcademyManagement" component={AcademyManagementScreen} />
                      <Stack.Screen name="U19WorldCup" component={U19WorldCupScreen} />
                      <Stack.Screen
                        name="InternationalCalendar"
                        component={InternationalCalendarScreen}
                      />
                      <Stack.Screen name="WageBreakdown" component={WageBreakdownScreen} />
                      <Stack.Screen
                        name="ContractNegotiation"
                        component={ContractNegotiationScreen}
                      />
                    </Stack.Navigator>
                  </NavigationContainer>
                </AppIntegrityGate>
              <Onboarding />
              <GlassAlertHost />
              <PlayerContractMoment />
            </GlassBlurProvider>
          </ModalQueueProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}
