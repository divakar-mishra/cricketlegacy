import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { moment } from '../audio';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  spacing,
  ThemeColors,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { SMOOTH_CARD_ZOOM, SMOOTH_MODAL_ENTER, SMOOTH_MODAL_EXIT } from './Motion';

export interface RewardModalData {
  kicker?: string;
  title: string;
  subtitle?: string;
  items: string[];
  balances?: string[];
  icon?: IconName;
}

interface Props {
  data: RewardModalData | null;
  onClose: () => void;
}

export function RewardModal({ data, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const queueVisible = useModalQueue(Boolean(data), MODAL_PRIORITY.engagement, 'reward');

  useEffect(() => {
    if (data && queueVisible) moment('reward');
  }, [data, queueVisible]);

  if (!data || !queueVisible) return null;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={SMOOTH_MODAL_ENTER}
        exiting={SMOOTH_MODAL_EXIT}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SMOOTH_CARD_ZOOM} style={[styles.card, shadow.card]}>
          <View style={styles.iconWrap}>
            <Icon name={data.icon ?? 'gift'} size={30} color="#F7D06E" />
          </View>
          <Text style={styles.kicker}>{data.kicker ?? 'REWARD RECEIVED'}</Text>
          <Text style={styles.title}>{data.title}</Text>
          {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.rewardList}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {data.items.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.rewardRow}>
                <Icon name="checkmark-circle" size={18} color="#7FD89A" />
                <Text style={styles.rewardText}>{item}</Text>
              </View>
            ))}
            {data.balances?.length ? (
              <View style={styles.balanceBox}>
                {data.balances.map((line) => (
                  <Text key={line} style={styles.balanceText}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <Button label="Collect" variant="gold" onPress={onClose} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.78)',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '82%',
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.accent,
      padding: spacing.lg,
      alignItems: 'stretch',
    },
    iconWrap: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#3A2800',
      borderWidth: 1,
      borderColor: '#C6902A',
      marginBottom: spacing.sm,
    },
    kicker: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
      textAlign: 'center',
    },
    title: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    scroll: { marginVertical: spacing.md },
    rewardList: { gap: spacing.sm },
    rewardRow: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: spacing.xs,
    },
    rewardText: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    balanceBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
      gap: 4,
    },
    balanceText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
  });
