import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ECONOMY } from '../data/gameConfig';
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
          suffix={`/${ECONOMY.energyMax}`}
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
}: {
  icon: IconName;
  color: string;
  value: number;
  suffix?: string;
  format?: (n: number) => string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.item}>
      <Icon name={icon} size={16} color={color} />
      <CountUp style={styles.value} value={value} suffix={suffix} format={format} />
    </View>
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
