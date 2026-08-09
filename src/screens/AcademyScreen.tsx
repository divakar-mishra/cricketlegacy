import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  AppText as Text,
  Button,
  Card,
  PlayerStatusBadges,
  Screen,
  ScreenHeader,
} from '../components';
import { Player } from '../domain/types';
import {
  academyProspects,
  facilityUpgradeCost,
  MAX_FACILITY,
} from '../game/manager';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { fontSize, fontWeight, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';

const ROLE_ABBR: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BOWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};

export function AcademyScreen({ navigation }: ScreenProps<'Academy'>) {
  const save = useCareer((s) => s.save);
  const promoteYouth = useCareer((s) => s.promoteYouth);
  const releaseYouth = useCareer((s) => s.releaseYouth);
  const upgradeFacilityLevel = useCareer((s) => s.upgradeFacilityLevel);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const { gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [, force] = useState(0);

  useFocusEffect(useCallback(() => refreshEnergy(), [refreshEnergy]));

  if (!save || save.mode !== 'manager') {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Academy" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>Available in Manager mode.</Text>
      </Screen>
    );
  }

  const prospects = academyProspects(save);
  const level = save.facilities?.academy ?? 1;
  const nextIntake = save.academy?.nextIntakeYear;
  const academyMaxed = level >= MAX_FACILITY;
  const upgradeCost = facilityUpgradeCost(level + 1);

  const onPromote = (p: Player) => {
    const res = promoteYouth(p.id);
    if (!res.ok) Alert.alert('Cannot promote', res.reason ?? 'Unavailable.');
    force((n) => n + 1);
  };
  const onRelease = (p: Player) => {
    Alert.alert('Release prospect', `Release ${p.name} from the academy?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Release',
        style: 'destructive',
        onPress: () => {
          releaseYouth(p.id);
          force((n) => n + 1);
        },
      },
    ]);
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Youth Academy"
        subtitle={`Level ${level} · intake ${nextIntake ?? '—'}`}
        onBack={() => navigation.goBack()}
      />

      <Card style={styles.info}>
        <Text style={styles.infoText}>
          A fresh intake arrives each season. Higher academy and a better chief scout produce more —
          and better — prospects. Promote the ones you rate into your senior squad, or release them
          to make room.
        </Text>
      </Card>

      <Card style={styles.development}>
        <View style={styles.developmentRow}>
          <View style={styles.developmentCopy}>
            <Text style={styles.developmentTitle}>Academy development</Text>
            <Text style={styles.infoText}>
              Level {level}/{MAX_FACILITY} · stronger levels improve each annual intake.
            </Text>
          </View>
          <Button
            label={academyMaxed ? 'Max level' : `Upgrade · ${upgradeCost.toLocaleString()}`}
            size="sm"
            variant={academyMaxed ? 'ghost' : 'secondary'}
            fullWidth={false}
            disabled={academyMaxed}
            onPress={() => {
              const result = upgradeFacilityLevel('academy');
              if (!result.ok) {
                Alert.alert('Cannot upgrade academy', result.reason ?? 'Unavailable.');
              }
              force((value) => value + 1);
            }}
          />
        </View>
      </Card>

      {prospects.length === 0 ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.empty}>
            No prospects in the academy right now. The next intake arrives at the season rollover.
          </Text>
        </Card>
      ) : (
        prospects
          .slice()
          .sort((a, b) => b.overall - a.overall || a.age - b.age)
          .map((p) => {
            return (
              <Card key={p.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.meta}>
                      Age {p.age} · {ROLE_ABBR[p.role] ?? p.role} · OVR {p.overall}
                    </Text>
                    <Text style={styles.status}>
                      Form {Math.round(p.meta.form)} · Fitness {Math.round(p.meta.fitness)}
                    </Text>
                  </View>
                  <PlayerStatusBadges
                    injured={Boolean(p.injury)}
                    fitness={p.meta.fitness}
                    mood={p.morale}
                  />
                </View>
                <View style={styles.actions}>
                  <Button
                    label="Promote"
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    onPress={() => onPromote(p)}
                  />
                  <Button
                    label="Release"
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    onPress={() => onRelease(p)}
                  />
                </View>
              </Card>
            );
          })
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md },
    info: { marginTop: spacing.md },
    development: { marginTop: spacing.md },
    developmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.md,
    },
    developmentCopy: { flex: 1, minWidth: 190 },
    developmentTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      marginBottom: 3,
    },
    infoText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
    empty: { color: colors.textMuted, fontSize: fontSize.sm },
    card: { marginTop: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center' },
    name: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    meta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    status: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  });
