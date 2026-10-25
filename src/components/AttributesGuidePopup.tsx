import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { CAREER_GUIDES } from '../content/careerGuides';
import { fontSize, fontWeight, radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

/** A single static explanation: no spotlight, native measurement or animation. */
export function AttributesGuidePopup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const focused = useIsFocused();
  const shown = useModalQueue(visible && focused, MODAL_PRIORITY.prompt, 'attributes-intro');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const guide = CAREER_GUIDES['player.attributes'][0];
  if (!shown) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay,
        paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}
          accessibilityRole="button" accessibilityLabel="Dismiss attributes guide" />
        <View testID="attributes-guide-popup" accessibilityViewIsModal
          style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.accent }]}>
          <ScrollView bounces={false} style={styles.copy} contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.accent }]}>{guide.title}</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>{guide.body}</Text>
          </ScrollView>
          <View style={styles.actions}><Button label="Got it" variant="gold" onPress={onClose} /></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { width: '100%', maxWidth: 440, maxHeight: '100%', borderWidth: 1, borderRadius: radius.md },
  copy: { flexShrink: 1, flexGrow: 0 },
  content: { padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { fontSize: fontSize.sm, lineHeight: 21 },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
