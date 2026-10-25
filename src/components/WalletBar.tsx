import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { energyCapacity } from '../game/economy';
import { useCareer } from '../state/careerStore';
import { useEnergyRecovery } from '../state/energyRecoveryStore';
import { Wallet } from '../domain/types';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useColors,
  useThemedStyles,
} from '../theme';
import { CountUp } from './CountUp';
import { Icon, IconName } from './Icon';

type WalletBarProps = {
  wallet: Wallet;
  showEnergy?: boolean;
};

export const WalletBar = React.memo(function WalletBar({
  wallet,
  showEnergy = true,
}: WalletBarProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const cap = useCareer((s) => energyCapacity(s.save?.entitlements));
  const openRecovery = useEnergyRecovery((s) => s.open);
  return (
    <View style={styles.bar}>
      <Item
        icon="cash"
        color={colors.accent}
        value={wallet.coins}
        format={(n) => n.toLocaleString()}
      />
      <Item icon="diamond" color={colors.info} value={wallet.gems} />
      {showEnergy ? (
        <Item
          icon="flash"
          color={colors.warning}
          value={wallet.energy}
          suffix={`/${cap}`}
          onPress={openRecovery}
          label={`Energy ${wallet.energy} of ${cap}. Show recovery time and free ad options`}
        />
      ) : null}
    </View>
  );
});

function Item({
  icon,
  color,
  value,
  suffix,
  format,
  onPress,
  label,
}: {
  icon: IconName;
  color: string;
  value: number;
  suffix?: string;
  format?: (n: number) => string;
  onPress?: () => void;
  label?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const content = (
    <>
      <Icon name={icon} size={16} color={color} />
      <CountUp style={styles.value} value={value} suffix={suffix} format={format} />
    </>
  );
  return onPress ? (
    <Pressable
      style={styles.item}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.item}>{content}</View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    value: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  });
