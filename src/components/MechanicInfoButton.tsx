import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { GuidanceTopicId, getGuidanceTopic, guidanceModalMessage } from '../guidance/mechanics';
import { radius, ThemeColors, useThemedStyles } from '../theme';
import { GlassAlert } from './GlassAlertModal';
import { Icon } from './Icon';

export function openMechanicInfo(topicId: GuidanceTopicId): void {
  const topic = getGuidanceTopic(topicId);
  GlassAlert.alert(topic.title, guidanceModalMessage(topic), [{ text: 'Got it' }]);
}

export function MechanicInfoButton({
  topicId,
  size = 36,
  style,
}: {
  topicId: GuidanceTopicId;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  const topic = getGuidanceTopic(topicId);

  return (
    <Pressable
      onPress={() => openMechanicInfo(topicId)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Explain ${topic.title}`}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name="information-circle-outline" size={20} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    pressed: { opacity: 0.62 },
  });
