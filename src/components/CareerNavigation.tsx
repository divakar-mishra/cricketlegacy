import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';
import {
  careerTabs,
  playerHubPage,
  type CareerDestination,
  type CareerTabKey,
} from '../navigation/careerNavigation';
import { useCareer } from '../state/careerStore';
import { useT } from '../i18n';
import { HubTabBar } from './HubTabBar';
import { GuideTarget } from './CareerGuide';

/** Uses popTo for section changes so repeated switches do not grow a duplicate-screen stack. */
export function CareerNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList>>();
  const mode = useCareer((state) => state.save?.mode);
  const saveId = useCareer((state) => state.save?.id);
  const nationalManager = useCareer((state) => state.save?.managerCareerLevel === 'NATIONAL');
  const retiredManager = useCareer((state) => Boolean(state.save?.managerRetired));
  const t = useT();
  if (!mode) return null;
  const params = route.params as RootStackParamList['CareerHub'];
  const page = playerHubPage(route.name === 'CareerHub' ? params?.initialTab : undefined);
  const tabs = careerTabs(mode, route.name, page, nationalManager, retiredManager);
  const open = (destination: CareerDestination, tabKey: CareerTabKey) => {
    // Read at activation, not just render: a queued touch may outlive its save
    // or a change into National duty / retirement.
    const current = useCareer.getState().save;
    if (!current || current.id !== saveId || current.mode !== mode || !navigation.isFocused()) return;
    const allowed = careerTabs(
      current.mode,
      route.name,
      page,
      current.managerCareerLevel === 'NATIONAL',
      Boolean(current.managerRetired),
    ).some((tab) => tab.key === tabKey && tab.destination.screen === destination.screen);
    if (!allowed) return;
    if (destination.screen === 'CareerHub') {
      navigation.popTo('CareerHub', destination.params);
    } else if (destination.screen === 'Records') {
      if (route.name === 'ManagerHub') navigation.navigate('Records', destination.params);
      else navigation.popTo('Records', destination.params);
    } else if (route.name === destination.screen) {
      return;
    } else if (route.name === 'ManagerHub' || route.name === 'CareerHub') {
      navigation.navigate(destination.screen);
    } else {
      navigation.popTo(destination.screen);
    }
  };
  const labelKeys: Record<CareerTabKey, string> = {
    home: 'hub.tabHome',
    stats: 'hub.tabStats',
    progress: 'hub.tabProgress',
    profile: 'hub.tabMore',
    team: 'hub.tabTeam',
    club: 'hub.tabClub',
    store: 'hub.tabStore',
    records: 'hub.tabRecords',
    calendar: 'hub.tabCalendar',
    academy: 'hub.tabAcademy',
  };
  return (
    <GuideTarget id="navigation"><HubTabBar
      tabs={tabs.map((tab) => ({
        ...tab,
        label: t(labelKeys[tab.key]),
        onPress: () => open(tab.destination, tab.key),
      }))}
    /></GuideTarget>
  );
}
