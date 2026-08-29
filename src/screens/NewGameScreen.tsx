import { StyleSheet, View } from 'react-native';
import { Card, Screen, ScreenHeader, AppText as Text } from '../components';
import { useT } from '../i18n';
import { ScreenProps } from '../navigation';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

export function NewGameScreen({ navigation }: ScreenProps<'NewGame'>) {
  const t = useT();
  return (
    <Screen scroll>
      <ScreenHeader title={t('newgame.title')} onBack={() => navigation.goBack()} />

      <ModeCard
        icon="🏏"
        title={t('newgame.playerTitle')}
        badge="Recommended"
        description={t('newgame.playerDesc')}
        onPress={() => navigation.navigate('PlayerCreation')}
      />

      <ModeCard
        icon="📋"
        title={t('newgame.managerTitle')}
        badge="Advanced"
        description={t('newgame.managerDesc')}
        onPress={() => navigation.navigate('TeamSelect')}
      />
    </Screen>
  );
}

function ModeCard({
  icon,
  title,
  badge,
  description,
  onPress,
}: {
  icon: string;
  title: string;
  badge: string;
  description: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>
      <Text style={styles.desc}>{description}</Text>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { marginBottom: spacing.lg },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    icon: { fontSize: 30 },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy, flex: 1 },
    desc: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
    badge: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    badgeText: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  });
