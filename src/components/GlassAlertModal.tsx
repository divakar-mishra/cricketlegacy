import { useSyncExternalStore } from 'react';
import {
  type AlertButton,
  type AlertOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { fonts, fontSize, fontWeight, radius, spacing } from '../theme';
import { AppText as Text } from './AppText';
import { Button, type ButtonVariant } from './Button';
import { GlassSurface } from './GlassSurface';

type GlassAlertRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};

const requests: GlassAlertRequest[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): GlassAlertRequest | null {
  return requests[0] ?? null;
}

function removeRequest(id: number): void {
  const index = requests.findIndex((request) => request.id === id);
  if (index >= 0) requests.splice(index, 1);
  emit();
}

/**
 * Drop-in replacement for React Native Alert.alert. Calls can originate from
 * stores and event handlers; GlassAlertHost renders them through the app queue.
 */
export const GlassAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    requests.push({
      id: nextId++,
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      options,
    });
    emit();
  },
};

function variantFor(button: AlertButton, index: number, count: number): ButtonVariant {
  if (button.style === 'destructive') return 'danger';
  if (button.style === 'cancel') return 'ghost';
  return index === count - 1 ? 'primary' : 'secondary';
}

export function GlassAlertHost() {
  const request = useSyncExternalStore(subscribe, snapshot, snapshot);
  const queueVisible = useModalQueue(
    Boolean(request),
    MODAL_PRIORITY.critical,
    `glass-alert-${request?.id ?? 'idle'}`,
  );

  if (!request || !queueVisible) return null;

  const close = (button?: AlertButton) => {
    removeRequest(request.id);
    button?.onPress?.();
  };

  const dismiss = () => {
    if (request.options?.cancelable === false) return;
    removeRequest(request.id);
    request.options?.onDismiss?.();
  };

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={dismiss}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        style={styles.backdrop}
      >
        {request.options?.cancelable !== false ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss dialog"
          />
        ) : null}
        <Animated.View entering={ZoomIn.springify().duration(300).damping(18)} style={styles.frame}>
          <GlassSurface intensity={0.72} rounded={radius.lg} style={styles.card}>
            <Text style={styles.title}>{request.title}</Text>
            {request.message ? (
              <ScrollView
                style={styles.messageScroll}
                contentContainerStyle={styles.messageContent}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.message}>{request.message}</Text>
              </ScrollView>
            ) : null}
            <View style={styles.actions}>
              {request.buttons.map((button, index) => (
                <Button
                  key={`${button.text ?? 'OK'}-${index}`}
                  label={button.text ?? 'OK'}
                  variant={variantFor(button, index, request.buttons.length)}
                  onPress={() => close(button)}
                />
              ))}
            </View>
          </GlassSurface>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    padding: spacing.lg,
  },
  frame: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    width: '100%',
    maxHeight: '78%',
    backgroundColor: '#0C0E15',
    borderColor: '#1A2035',
    borderWidth: 1,
  },
  title: {
    color: '#ECEFF4',
    fontFamily: fonts.headingSemi,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  messageScroll: {
    maxHeight: 300,
    marginTop: spacing.md,
  },
  messageContent: {
    paddingBottom: spacing.xs,
  },
  message: {
    color: '#A8B1C0',
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
