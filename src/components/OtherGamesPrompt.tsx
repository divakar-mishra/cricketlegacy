import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { areAdsRemoved } from '../game/economy';
import { hasRatingExperience } from '../services/storeReview';
import {
  canOfferOtherGamesPromotion, claimOtherGamesPromotion, hasOtherGamesCampaignStarted,
  openOtherGamesPage, OTHER_GAMES_START_AT,
} from '../services/otherGamesPromotion';
import { useCareer } from '../state/careerStore';
import { useContractPresentation } from '../state/contractPresentationStore';
import { useSettings } from '../state/settingsStore';
import { fontSize, fontWeight, radius, spacing, useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { GlassSurface } from './GlassSurface';
import { modalViewportMetrics } from './modalLayout';

/** Optional, Android-only publisher recommendation. Eligibility is Home-owned;
 * no date bypass/QA preview and no alteration of careers or purchase benefits.
 */
export function OtherGamesPrompt({ eligible }: { eligible: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const save = useCareer(s => s.save);
  const hydrated = useSettings(s => s.hasHydrated);
  const onboarded = useSettings(s => s.hasOnboarded);
  const completedMatches = useSettings(s => s.playedMatchesAllModes);
  const contractVisible = useContractPresentation(s => s.signed !== null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [now, setNow] = useState(Date.now);
  const [stage, setStage] = useState<'loading' | 'candidate' | 'claimed' | 'closed'>('loading');
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const mounted = useRef(false);
  const claiming = useRef(false);
  const openingRef = useRef(false);
  const dismissed = useRef(false);
  const safe = Platform.OS === 'android' && eligible && hydrated && onboarded &&
    hasRatingExperience(completedMatches) && hasOtherGamesCampaignStarted(now) &&
    Boolean(save) && !areAdsRemoved(save?.entitlements, now) &&
    !contractVisible && focused && active;
  const safeRef = useRef(safe);
  safeRef.current = safe;

  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      setNow(Date.now());
    });
    return () => { mounted.current = false; listener.remove(); };
  }, []);

  // One boundary timer, not a per-second poll. Foreground rechecks also handle
  // a suspended timer or changed device clock. No background notification/job.
  useEffect(() => {
    if (Platform.OS !== 'android' || !focused || !active || hasOtherGamesCampaignStarted(now)) return;
    const timer = setTimeout(() => setNow(Date.now()),
      Math.max(1, Math.min(OTHER_GAMES_START_AT - Date.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [active, focused, now]);

  useEffect(() => {
    if (!safe || stage !== 'loading') return;
    let cancelled = false;
    void canOfferOtherGamesPromotion().then(due => {
      if (!cancelled) setStage(due ? 'candidate' : 'closed');
    });
    return () => { cancelled = true; };
  }, [safe, stage]);

  const queueVisible = useModalQueue(
    safe && (stage === 'candidate' || stage === 'claimed'), MODAL_PRIORITY.prompt, 'sunlight-other-games',
  );
  const queueRef = useRef(queueVisible);
  queueRef.current = queueVisible;

  useEffect(() => {
    if (!queueVisible || stage !== 'candidate' || claiming.current) return;
    claiming.current = true;
    void claimOtherGamesPromotion(() => mounted.current && safeRef.current &&
      queueRef.current && !dismissed.current)
      .then(claimed => { if (mounted.current) setStage(claimed ? 'claimed' : 'closed'); })
      .finally(() => { claiming.current = false; });
  }, [queueVisible, stage]);

  // Hiding an already-shown invitation ends that appearance. It must not pop
  // back up when another overlay/route/entitlement change is reversed.
  useEffect(() => {
    if (!safe && stage === 'claimed') {
      dismissed.current = true;
      setStage('closed');
    }
  }, [safe, stage]);

  if (!queueVisible || stage !== 'claimed') return null;
  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    setStage('closed');
  };
  const openPage = async () => {
    if (openingRef.current || dismissed.current) return;
    openingRef.current = true;
    setOpening(true);
    setOpenFailed(false);
    try {
      const opened = await openOtherGamesPage(() => mounted.current && safeRef.current && !dismissed.current);
      if (mounted.current && !dismissed.current) {
        if (opened) dismiss();
        else setOpenFailed(true);
      }
    } finally {
      openingRef.current = false;
      if (mounted.current) setOpening(false);
    }
  };
  const viewport = modalViewportMetrics(height, insets.top, insets.bottom, spacing.lg);
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay,
        paddingTop: insets.top + viewport.verticalMargin, paddingBottom: insets.bottom + viewport.verticalMargin }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button"
          accessibilityLabel="Dismiss other games invitation" />
        <GlassSurface blur={false} padded={false} rounded={radius.lg}
          style={[styles.card, { maxHeight: viewport.availableHeight, backgroundColor: colors.surface }]}>
          <ScrollView bounces={false} style={styles.scroll} contentContainerStyle={styles.content} accessibilityViewIsModal>
            <AppText style={[styles.eyebrow, { color: colors.accent }]}>FROM SUNLIGHT</AppText>
            <AppText style={[styles.title, { color: colors.text }]}>Try another game from Sunlight</AppText>
            <AppText style={[styles.message, { color: colors.textMuted }]}>
              Ready for a different challenge? Explore our other games on Google Play.
            </AppText>
            {openFailed ? <AppText accessibilityRole="alert" style={{ color: colors.textMuted }}>
              Could not open Google Play. Try again, or continue playing.
            </AppText> : null}
            <Button label={opening ? 'Opening Google Play…' : 'View on Google Play'} variant="gold"
              disabled={opening} onPress={openPage} />
            <Button label="Not now" variant="ghost" onPress={dismiss} />
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  card: { width: '100%', maxWidth: 420, flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textAlign: 'center', letterSpacing: 1 },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  message: { fontSize: fontSize.sm, lineHeight: 22, textAlign: 'center' },
});
