import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Keyboard,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAREER_GUIDES, type GuideChapter } from '../content/careerGuides';
import {
  firstGuideStep,
  guideAction,
  guidePlacement,
  guidePrefix,
  guideScrollRange,
  guideSkipKey,
  guideStepKey,
  subscribeGuideActions,
  type GuideRect,
} from '../game/coachGuide';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { useSettings } from '../state/settingsStore';
import { fontSize, fontWeight, radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

type Target = { ref: React.RefObject<View | null>; reveal?: () => void; focusHeight?: number; ready?: boolean };
type GuideContextValue = {
  register: (id: string, target: Target) => () => void;
  refresh: () => void;
  scrolled: (delta: number) => void;
  constrainScroll: boolean;
  activeTarget?: string;
  scope?: string;
};
const GuideContext = createContext<GuideContextValue | null>(null);
const GuideScrollContext = createContext<((ref: React.RefObject<View | null>) => void) | undefined>(
  undefined,
);
export type CareerGuideConfig = {
  chapter: GuideChapter;
  enabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  /** Plain pages keep session progress but use no pointer or guided scrolling. */
  layout?: 'overlay' | 'docked' | 'plain';
  /** New forms start fresh; home/training guides still remember completed steps. */
  progress?: 'saved' | 'session';
};

/** Measurable native anchor. Outside a guided screen this is just a normal View. */
export function GuideTarget({
  id,
  children,
  style,
  focusHeight,
  ready,
}: {
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  focusHeight?: number;
  ready?: boolean;
}) {
  const ref = useRef<View>(null);
  const guide = useContext(GuideContext);
  const reveal = useContext(GuideScrollContext);
  const register = guide?.register;
  useEffect(
    () => register?.(id, { ref, reveal: () => reveal?.(ref), focusHeight, ready }),
    [id, register, reveal, focusHeight, ready],
  );
  return (
    <View
      ref={ref}
      testID={`guide-target-${id}`}
      collapsable={false}
      style={style}
      onLayout={() => {
        if (guide?.activeTarget === id) {
          reveal?.(ref);
          guide.refresh();
        }
      }}
    >
      {children}
    </View>
  );
}

/** Finds anchors inside the nearest scroll container, including nested training lists. */
export function GuideScrollView({
  scrollRef,
  ...props
}: ScrollViewProps & {
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const ownRef = useRef<ScrollView>(null);
  const ref = scrollRef ?? ownRef;
  // RN 0.86 exposes the native content View through innerViewRef. Content-local
  // coordinates do not drift while native scroll events are still in flight.
  const ownInnerRef = useRef<View>(null!);
  const innerRef = props.innerViewRef ?? ownInnerRef;
  const offset = useRef(0);
  const geometry = useRef({ width: 0, height: 0, contentHeight: 0 });
  type Anchor = { ref: React.RefObject<View | null>; scope?: string; constrained: boolean; entered: boolean };
  type Range = { scope?: string; min: number; max: number };
  const anchor = useRef<Anchor | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const guide = useContext(GuideContext);
  const constrained = guide?.constrainScroll === true;
  const scope = guide?.scope;
  const runtime = useRef({ constrained, scope });
  runtime.current = { constrained, scope };
  const scrollHandle = useRef(ref);
  scrollHandle.current = ref;
  const scrollTo = useCallback((y: number) => {
    const native = scrollHandle.current.current;
    if (!native || Math.abs(offset.current - y) < 1 ||
      (pendingScroll.current != null && Math.abs(pendingScroll.current - y) < 1)) return;
    pendingScroll.current = y;
    native.scrollTo({ y, animated: false });
  }, []);
  const reveal = useCallback(
    (target: React.RefObject<View | null>) => {
      const current = runtime.current;
      if (!current.scope) return;
      if (anchor.current?.ref !== target || anchor.current.scope !== current.scope ||
        anchor.current.constrained !== current.constrained) {
        anchor.current = { ref: target, ...current, entered: false };
        pendingScroll.current = null;
      }
      generation.current += 1;
      if (frame.current != null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const item = anchor.current;
        const content = innerRef.current;
        const { height: viewport, contentHeight } = geometry.current;
        if (!item || !content || viewport <= 0 || contentHeight <= 0) return;
        const ticket = generation.current;
        item.ref.current?.measureLayout(content, (_x, y, _width, height) => {
          if (!mounted.current || generation.current !== ticket || anchor.current !== item ||
            runtime.current.scope !== item.scope || runtime.current.constrained !== item.constrained) return;
          const maxOffset = Math.max(0, contentHeight - viewport);
          const bounds = guideScrollRange(y, height, viewport, maxOffset);
          const nextRange = { scope: item.scope, ...bounds };
          rangeRef.current = nextRange;
          setRange(previous => previous && previous.scope === item.scope && previous.min === bounds.min && previous.max === bounds.max
            ? previous : nextRange);
          const next = item.constrained
            ? item.entered ? Math.max(bounds.min, Math.min(bounds.max, offset.current)) : bounds.min
            : Math.max(0, Math.min(maxOffset, y - Math.min(100, viewport * 0.18)));
          item.entered = true;
          scrollTo(next);
        }, () => { /* A later real layout/step change may retry; never spin. */ });
      });
    },
    [innerRef, scrollTo],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, []);
  return (
    <GuideScrollContext.Provider value={reveal}>
      <ScrollView
        {...props}
        ref={ref}
        innerViewRef={innerRef}
        scrollEnabled={props.scrollEnabled !== false && (!constrained || Boolean(range && range.scope === scope && range.max > range.min))}
        bounces={constrained ? false : props.bounces}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const requested = event.nativeEvent.contentOffset.y;
          const delta = requested - offset.current;
          offset.current = requested;
          if (pendingScroll.current != null && Math.abs(pendingScroll.current - requested) < 1) pendingScroll.current = null;
          const bounds = rangeRef.current;
          if (constrained && bounds && bounds.scope === scope) scrollTo(Math.max(bounds.min, Math.min(bounds.max, requested)));
          // Move the cached spotlight with the content. Do not do two native
          // window measurements on every scroll frame or re-reveal the target.
          if (delta !== 0 && scope && anchor.current?.scope === scope) guide?.scrolled(delta);
          props.onScroll?.(event);
        }}
        onContentSizeChange={(w, h) => {
          if (Math.abs(geometry.current.contentHeight - h) >= 1) {
            geometry.current.contentHeight = h;
            if (anchor.current && anchor.current.scope === scope) reveal(anchor.current.ref);
            guide?.refresh();
          }
          props.onContentSizeChange?.(w, h);
        }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (Math.abs(geometry.current.width - width) >= 1 || Math.abs(geometry.current.height - height) >= 1) {
            geometry.current = { ...geometry.current, width, height };
            if (anchor.current && anchor.current.scope === scope) reveal(anchor.current.ref);
            guide?.refresh();
          }
          props.onLayout?.(event);
        }}
      />
    </GuideScrollContext.Provider>
  );
}

export function replayCareerGuide(chapter: GuideChapter) {
  useSettings.setState((state) => ({
    dismissedTips: state.dismissedTips.filter(
      (key) => !key.startsWith(guidePrefix(chapter)) && key !== guideSkipKey(chapter),
    ),
  }));
  guideAction(`replay:${chapter}`);
}

export function useGuidePending(chapter: GuideChapter) {
  return useSettings(
    (state) =>
      !state.dismissedTips.includes(guideSkipKey(chapter)) &&
      firstGuideStep(chapter, CAREER_GUIDES[chapter], state.dismissedTips) <
        CAREER_GUIDES[chapter].length,
  );
}

export function GuideReplayButton({ chapter }: { chapter: GuideChapter }) {
  return (
    <Button
      label="Show screen guide"
      size="sm"
      variant="ghost"
      onPress={() => replayCareerGuide(chapter)}
    />
  );
}

/** Pointer overlay is in the SAME native scene, not a Modal intercepting the
 * highlighted button. Plain pages suspend pointers but retain session history.
 * It never invokes a game action or advances on a timer. */
export function CareerGuide({
  chapter,
  enabled = true,
  onActiveChange,
  layout = 'overlay',
  progress = 'saved',
  children,
}: CareerGuideConfig & { children: React.ReactNode }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { colors } = useTheme();
  const hydrated = useSettings((s) => s.hasHydrated);
  const onboarded = useSettings((s) => s.hasOnboarded);
  const savedDone = useSettings((s) => s.dismissedTips);
  const savedDismiss = useSettings((s) => s.dismissTip);
  const [sessionDone, setSessionDone] = useState<string[]>([]);
  const done = progress === 'session' ? sessionDone : savedDone;
  const dismiss = useCallback((key: string) => {
    if (progress === 'session') setSessionDone((previous) => previous.includes(key) ? previous : [...previous, key]);
    else savedDismiss(key);
  }, [progress, savedDismiss]);
  const steps = CAREER_GUIDES[chapter];
  const first = firstGuideStep(chapter, steps, done);
  const [position, setPosition] = useState({ chapter, index: first });
  const index = position.chapter === chapter ? position.index : first;
  const step = steps[index];
  const targets = useRef(new Map<string, Target>());
  const [revision, setRevision] = useState(0);
  const root = useRef<View>(null);
  const rootY = useRef(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [rect, setRect] = useState<GuideRect | null>(null);
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const [cardHeight, setCardHeight] = useState(230);
  const measureRef = useRef<() => void>(() => {});
  const target = step ? targets.current.get(step.target) : undefined;
  const activeTargetRef = useRef(step?.target);
  activeTargetRef.current = step?.target;
  const wants = Boolean(
    layout !== 'plain' &&
    enabled &&
    focused &&
    hydrated &&
    onboarded &&
    step &&
    target &&
    !done.includes(guideSkipKey(chapter)),
  );
  const visible = useModalQueue(wants, MODAL_PRIORITY.prompt, `coach-${chapter}`, true);
  const action = step && 'action' in step ? step.action : undefined;
  const completed = Boolean(step && done.includes(guideStepKey(chapter, step.target)));
  const required = Boolean(step && 'required' in step && step.required);
  const ready = !required || target?.ready === true;
  const advance = useCallback(() => {
    if (!step || !ready) return;
    Keyboard.dismiss();
    dismiss(guideStepKey(chapter, step.target));
    setPosition({ chapter, index: index + 1 });
  }, [chapter, dismiss, index, ready, step]);
  const skip = useCallback(() => dismiss(guideSkipKey(chapter)), [chapter, dismiss]);
  const refresh = useCallback(() => measureRef.current(), []);
  const scrolled = useCallback((delta: number) => setRect(previous => previous
    ? { ...previous, y: previous.y - delta } : previous), []);
  const register = useCallback((id: string, item: Target) => {
    targets.current.set(id, item);
    if (id === activeTargetRef.current) setRevision((v) => v + 1);
    return () => {
      if (targets.current.get(id) === item) {
        targets.current.delete(id);
        if (id === activeTargetRef.current) setRevision((v) => v + 1);
      }
    };
  }, []);
  const constrainScroll = layout === 'docked' && visible;
  const context = useMemo(() => ({ register, refresh, scrolled, constrainScroll,
    activeTarget: visible ? step?.target : undefined, scope: visible ? `${chapter}:${index}` : undefined }),
    [register, refresh, scrolled, constrainScroll, visible, chapter, index, step?.target]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardTop(event.endCoordinates.screenY),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardTop(null));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (onboarded)
      setPosition((current) =>
        current.chapter !== chapter || (current.index >= steps.length && first < steps.length)
          ? { chapter, index: first }
          : current,
      );
  }, [chapter, first, onboarded, steps.length]);

  useEffect(
    () =>
      subscribeGuideActions((event) => {
        if (event === `replay:${chapter}`) {
          setSessionDone((previous) => previous.filter(key => !key.startsWith(guidePrefix(chapter)) && key !== guideSkipKey(chapter)));
          setPosition({ chapter, index: 0 });
        }
        else if (visible && wants && action && event === action) advance();
      }),
    [action, advance, chapter, visible, wants],
  );

  useEffect(() => {
    setRect(null);
    if (!visible || !target) return;
    let alive = true;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.current?.measureInWindow((rx, ry, rw, rh) => {
          rootY.current = ry;
          target.ref.current?.measureInWindow((x, y, width, height) => {
            if (!alive || width <= 0 || height <= 0 || rw <= 0 || rh <= 0) return;
            const next = {
              x: x - rx,
              y: y - ry,
              width,
              height: Math.min(height, target.focusHeight ?? height),
            };
            setSize((previous) =>
              previous.width === rw && previous.height === rh
                ? previous
                : { width: rw, height: rh },
            );
            setRect((previous) =>
              previous &&
              Object.keys(next).every(
                (key) =>
                  Math.abs(previous[key as keyof GuideRect] - next[key as keyof GuideRect]) < 1,
              )
                ? previous
                : next,
            );
          });
        });
      });
    };
    measureRef.current = measure;
    target.reveal?.();
    measure();
    // Re-measure after the native navigation transition/keyboard layout settles.
    const settle = setTimeout(measure, 350);
    const keyboardShow = Keyboard.addListener('keyboardDidShow', measure);
    const keyboardHide = Keyboard.addListener('keyboardDidHide', measure);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      keyboardShow.remove();
      keyboardHide.remove();
      measureRef.current = () => {};
    };
  }, [visible, target, chapter, index, revision, window.width, window.height, window.fontScale]);

  useEffect(() => {
    if (!visible || !step) return;
    AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.body}`);
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      skip();
      return true;
    });
    return () => back.remove();
  }, [visible, step, skip]);

  const visibleHeight =
    keyboardTop == null ? size.height : Math.min(size.height, keyboardTop - rootY.current);
  const docked = layout === 'docked' && visible && Boolean(step);
  const dockHeight = Math.min(cardHeight, Math.max(110, visibleHeight * 0.4));
  const dockTop = Math.max(insets.top, visibleHeight - dockHeight - (keyboardTop == null ? insets.bottom : 0));
  const placement = rect
    ? guidePlacement(
        rect,
        size.width,
        docked ? dockTop : visibleHeight,
        cardHeight,
        insets.top,
        keyboardTop == null ? insets.bottom : 0,
      )
    : null;
  const canShow = Boolean(
    visible && step && placement && placement.rect.height > 0 && (docked || placement.maxHeight >= 110),
  );
  useEffect(() => {
    onActiveChange?.(canShow);
    return () => onActiveChange?.(false);
  }, [canShow, onActiveChange]);
  const p = placement;
  return (
    <GuideContext.Provider value={layout === 'plain' ? null : context}>
      <View
        ref={root}
        testID="guide-root"
        collapsable={false}
        style={styles.fill}
        onLayout={layout === 'plain' ? undefined : refresh}
      >
        <View style={docked ? { height: dockTop } : styles.fill} testID="guide-screen-body">
          {children}
        </View>
        {canShow && p && step ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="career-guide">
            {/* During creation only the highlighted choices can be touched.
                Career hub/match guides retain their non-blocking overlay. */}
            <View
              pointerEvents={docked ? 'auto' : 'none'}
              onStartShouldSetResponder={() => docked}
              testID="guide-dim-top"
              style={[styles.dim, { top: 0, left: 0, right: 0, height: p.rect.y }]}
            />
            <View
              pointerEvents={docked ? 'auto' : 'none'}
              onStartShouldSetResponder={() => docked}
              style={[styles.dim, { top: p.rect.y + p.rect.height, left: 0, right: 0, bottom: docked ? size.height - dockTop : 0 }]}
            />
            <View
              pointerEvents={docked ? 'auto' : 'none'}
              onStartShouldSetResponder={() => docked}
              style={[
                styles.dim,
                { top: p.rect.y, left: 0, width: p.rect.x, height: p.rect.height },
              ]}
            />
            <View
              pointerEvents={docked ? 'auto' : 'none'}
              onStartShouldSetResponder={() => docked}
              style={[
                styles.dim,
                { top: p.rect.y, left: p.rect.x + p.rect.width, right: 0, height: p.rect.height },
              ]}
            />
            <View
              pointerEvents="none"
              testID="guide-highlight"
              style={[
                styles.highlight,
                {
                  top: p.rect.y,
                  left: p.rect.x,
                  width: p.rect.width,
                  height: p.rect.height,
                  borderColor: colors.accent,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.arrow,
                {
                  left: p.arrowX - 7,
                  top:
                    docked ? dockTop - 8 : p.side === 'below' ? p.cardY - 8 : p.cardY + Math.min(cardHeight, p.maxHeight),
                  borderBottomColor: docked || p.side === 'below' ? colors.accent : 'transparent',
                  borderTopColor: !docked && p.side === 'above' ? colors.accent : 'transparent',
                  borderBottomWidth: docked || p.side === 'below' ? 8 : 0,
                  borderTopWidth: !docked && p.side === 'above' ? 8 : 0,
                },
              ]}
            />
            <View
              testID="guide-card"
              style={[
                styles.card,
                {
                  top: docked ? dockTop : p.cardY,
                  height: docked ? dockHeight : undefined,
                  maxHeight: docked ? dockHeight : p.maxHeight,
                  backgroundColor: colors.bgElevated,
                  borderColor: colors.accent,
                },
              ]}
              onLayout={(event) => {
                // Keyboard-constrained height must not become the permanent
                // preferred height after the keyboard closes again.
                if (layout !== 'docked') setCardHeight(event.nativeEvent.layout.height);
              }}
            >
              <ScrollView
                testID="guide-copy"
                style={styles.cardCopy}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.cardContent}
              >
                <Text style={[styles.kicker, { color: colors.accent }]}>
                  CAREER COACH · {index + 1}/{steps.length}
                </Text>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                  {step.title}
                </Text>
                <Text style={[styles.body, { color: colors.textMuted }]}>{step.body}</Text>
                {required && !ready ? (
                  <Text style={[styles.actionHint, { color: colors.accentLight }]}>
                    Complete the highlighted choice to continue.
                  </Text>
                ) : null}
                {action && !completed ? (
                  <Text style={[styles.actionHint, { color: colors.accentLight }]}>
                    Try the highlighted control, or skip this step.
                  </Text>
                ) : null}
              </ScrollView>
                <View style={styles.buttons} testID="guide-actions">
                  <Button
                    label="Back"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    disabled={index === 0}
                    onPress={() => setPosition({ chapter, index: Math.max(0, index - 1) })}
                  />
                  <Button
                    label={
                      action && !completed && !required
                        ? 'Skip step'
                        : index === steps.length - 1
                          ? 'Finish'
                          : 'Next'
                    }
                    variant="primary"
                    size="sm"
                    fullWidth={false}
                    disabled={!ready}
                    onPress={advance}
                  />
                  <Button
                    label="Skip guide"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={skip}
                  />
                </View>
            </View>
          </View>
        ) : null}
      </View>
    </GuideContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.70)' },
  highlight: { position: 'absolute', borderWidth: 2, borderRadius: radius.sm },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  card: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  cardContent: { padding: spacing.md, gap: spacing.sm },
  cardCopy: { flexShrink: 1 },
  kicker: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
  body: { fontSize: fontSize.sm, lineHeight: 21 },
  actionHint: { fontSize: fontSize.xs, lineHeight: 18 },
  buttons: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    flexShrink: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
});
