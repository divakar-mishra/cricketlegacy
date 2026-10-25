import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { QA_TOOLS_ENABLED } from '../config/qa';
import {
  claimPlayRatingPrompt,
  hasRatingExperience,
  hasSeenPlayRatingPrompt,
  openPlayStoreReview,
  requestAppleStoreReview,
} from '../services/storeReview';
import { useSettings } from '../state/settingsStore';
import { useContractPresentation } from '../state/contractPresentationStore';
import { fontSize, fontWeight, radius, spacing, useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { GlassSurface } from './GlassSurface';
import { modalViewportMetrics } from './modalLayout';

/** Lowest-priority, dismissible ask. Safe-screen eligibility comes from the hub;
 * matches/results, balances, ads and purchase state are never changed here.
 */
export function PlayRatingPrompt({
  eligible,
  qaPreview = false,
  onDismiss,
}: {
  eligible: boolean;
  /** Explicit, installation-local QA preview; ignored unless QA tools are enabled. */
  qaPreview?: boolean;
  onDismiss?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const focused = useIsFocused();
  const hydrated = useSettings((s) => s.hasHydrated);
  const onboarded = useSettings((s) => s.hasOnboarded);
  const completedMatches = useSettings((s) => s.playedMatchesAllModes);
  const contractVisible = useContractPresentation((s) => s.signed !== null);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [stage, setStage] = useState<'loading' | 'unseen' | 'claimed' | 'dismissed' | 'blocked'>(
    'loading',
  );
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const claiming = useRef(false);
  const openingRef = useRef(false);
  const dismissed = useRef(false);
  const mounted = useRef(false);
  const preview = QA_TOOLS_ENABLED && qaPreview;
  const experienced = preview || (hydrated && onboarded && hasRatingExperience(completedMatches));
  const safe =
    eligible && experienced && !contractVisible && (Platform.OS === 'android' || Platform.OS === 'ios') && active && focused;
  const safeRef = useRef(safe);
  safeRef.current = safe;

  useEffect(() => {
    mounted.current = true;
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    setActive(AppState.currentState === 'active');
    return () => {
      mounted.current = false;
      listener.remove();
    };
  }, []);

  useEffect(() => {
    if (!experienced) return;
    if (Platform.OS === 'ios') {
      setStage('unseen');
      return;
    }
    if (Platform.OS !== 'android') return;
    if (preview) {
      setStage('unseen');
      return;
    }
    let cancelled = false;
    void hasSeenPlayRatingPrompt().then((seen) => {
      if (!cancelled)
        setStage((current) => (current === 'loading' ? (seen ? 'blocked' : 'unseen') : current));
    });
    return () => {
      cancelled = true;
    };
  }, [experienced, preview]);

  const queueVisible = useModalQueue(
    safe && (stage === 'unseen' || stage === 'claimed'),
    MODAL_PRIORITY.prompt,
    'play-rating',
  );

  useEffect(() => {
    if (!queueVisible || stage !== 'unseen' || claiming.current) return;
    claiming.current = true;
    const isCurrent = () => mounted.current && safeRef.current && !dismissed.current;
    if (Platform.OS === 'ios') {
      void requestAppleStoreReview(isCurrent).finally(() => {
        claiming.current = false;
        if (mounted.current) setStage('dismissed');
      });
      return;
    }
    // Preview exercises the same modal/CTA but never touches real prompt history.
    const claim = preview ? Promise.resolve(isCurrent()) : claimPlayRatingPrompt(isCurrent);
    void claim
      .then((claimed) => {
        if (mounted.current) setStage(claimed ? 'claimed' : 'blocked');
      })
      .finally(() => {
        claiming.current = false;
      });
  }, [queueVisible, stage, preview]);

  if (Platform.OS !== 'android' || !queueVisible || stage !== 'claimed') return null;
  const dismiss = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    setStage('dismissed');
    onDismiss?.();
  };
  const openReview = async () => {
    if (openingRef.current || dismissed.current) return;
    openingRef.current = true;
    setOpening(true);
    setOpenFailed(false);
    const opened = await openPlayStoreReview();
    if (mounted.current && !dismissed.current) {
      if (opened) dismiss();
      else {
        setOpening(false);
        setOpenFailed(true);
      }
    }
    openingRef.current = false;
  };
  const viewport = modalViewportMetrics(height, insets.top, insets.bottom, spacing.lg);

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: colors.overlay,
            paddingTop: insets.top + viewport.verticalMargin,
            paddingBottom: insets.bottom + viewport.verticalMargin,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss rating invitation"
        />
        <GlassSurface
          blur={false}
          padded={false}
          rounded={radius.lg}
          style={[
            styles.card,
            { maxHeight: viewport.availableHeight, backgroundColor: colors.surface },
          ]}
        >
          <ScrollView
            bounces={false}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            accessibilityViewIsModal
          >
            <AppText style={[styles.title, { color: colors.text }]}>
              Rate Cricket: Player &amp; Manager
            </AppText>
            <AppText style={[styles.message, { color: colors.textMuted }]}>
              Share an honest review on Google Play. Your feedback helps shape the next innings.
            </AppText>
            {openFailed ? (
              <AppText accessibilityRole="alert" style={{ color: colors.textMuted }}>
                Could not open Google Play. Try again, or continue playing.
              </AppText>
            ) : null}
            <Button
              label={opening ? 'Opening Google Play…' : 'Rate on Google Play'}
              disabled={opening}
              onPress={openReview}
            />
            <Button label="Not now" variant="ghost" onPress={dismiss} />
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: { width: '100%', maxWidth: 420, flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  message: { fontSize: fontSize.sm, lineHeight: 22, textAlign: 'center' },
});
