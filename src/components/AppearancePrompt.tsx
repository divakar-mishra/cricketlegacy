import { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, View } from 'react-native';
import { APPEARANCE_PROMPT_MS, useSettings } from '../state/settingsStore';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function AppearancePrompt({ eligible, route }: { eligible: boolean; route?: string }) {
  const s = useSettings();
  const colors = useColors();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const tracking = eligible && s.hasHydrated && s.hasOnboarded && !s.appearancePromptDone;
  useEffect(() => {
    if (!tracking) return;
    let previous = Date.now();
    let foreground = AppState.currentState === 'active';
    const flush = () => {
      const now = Date.now();
      if (foreground) useSettings.getState().addAppearancePlayTime(Math.max(0, now - previous));
      previous = now;
    };
    const timer = setInterval(flush, 5000);
    const listener = AppState.addEventListener('change', next => {
      flush();
      foreground = next === 'active';
      setActive(foreground);
    });
    return () => { clearInterval(timer); listener.remove(); flush(); };
  }, [tracking]);
  const safe = route === 'MainMenu' || route === 'CareerHub' || route === 'ManagerHub';
  const visible = useModalQueue(tracking && active && safe && s.appearancePlayMs >= APPEARANCE_PROMPT_MS,
    MODAL_PRIORITY.prompt, 'appearance');
  if (!visible) return null;
  return <Modal transparent visible animationType="fade" onRequestClose={s.dismissAppearancePrompt}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.overlay }}>
      <Pressable accessibilityLabel="Dismiss appearance choice" accessibilityRole="button"
        onPress={s.dismissAppearancePrompt} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      <ScrollView style={{ maxHeight: '85%', flexGrow: 0, backgroundColor: colors.surface, borderRadius: 20 }}
        contentContainerStyle={{ padding: 24, gap: 16 }}>
        <AppText style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Choose your look</AppText>
        <AppText style={{ color: colors.textMuted }}>Keep the original green and gold, or try warmer charcoal, cream and bronze. You can change this anytime in Settings.</AppText>
        <Button label="Keep Classic" onPress={() => s.setAppearance('classic')} />
        <Button label="Choose Warm" variant="secondary" onPress={() => s.setAppearance('warm')} />
        <Button label="Not now" variant="ghost" onPress={s.dismissAppearancePrompt} />
      </ScrollView>
    </View>
  </Modal>;
}
