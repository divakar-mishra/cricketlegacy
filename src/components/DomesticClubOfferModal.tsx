import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AuctionOffer, SaveGame } from '../domain/types';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

interface Props {
  save: SaveGame;
  offers: AuctionOffer[];
  onAccept: (teamId: string) => void;
  onStay: () => void;
}

const coins = (value: number): string => `${Math.round(value).toLocaleString()} coins`;

export function DomesticClubOfferModal({ save, offers, onAccept, onStay }: Props) {
  const styles = useThemedStyles(makeStyles);
  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const currentClub = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const currentSalary = Math.max(0, player?.contract?.wage ?? 0);
  if (!offers.length || !player) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>DOMESTIC CONTRACTS</Text>
          <Text style={styles.title}>First-Class clubs want {player.name}</Text>
          <Text style={styles.current}>
            {currentClub?.name ?? 'Current club'} · First-Class and List A
          </Text>

          <ScrollView contentContainerStyle={styles.list} bounces={false}>
            {offers.map((offer) => {
              const club = save.teams[offer.teamId];
              const increase =
                currentSalary > 0
                  ? Math.max(0, Math.round((offer.wagePromise / currentSalary - 1) * 100))
                  : null;
              return (
                <View key={offer.teamId} style={styles.card}>
                  <Text style={styles.club}>{club?.name ?? 'Interested club'}</Text>
                  <View style={styles.terms}>
                    <View style={styles.term}>
                      <Text style={styles.label}>SEASON SALARY</Text>
                      <Text style={styles.value}>{coins(offer.wagePromise)}</Text>
                      {increase !== null ? <Text style={styles.raise}>+{increase}%</Text> : null}
                    </View>
                    <View style={styles.term}>
                      <Text style={styles.label}>SIGNING BONUS</Text>
                      <Text style={styles.value}>{coins(offer.signingBonus)}</Text>
                    </View>
                  </View>
                  <Button
                    label={`Join ${club?.shortName ?? 'club'}`}
                    variant="gold"
                    onPress={() => onAccept(offer.teamId)}
                  />
                </View>
              );
            })}
          </ScrollView>

          <Pressable accessibilityRole="button" onPress={onStay} style={styles.stay}>
            <Text style={styles.stayText}>Stay at {currentClub?.name ?? 'my club'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: 'rgba(2, 6, 14, 0.88)',
    },
    sheet: {
      maxHeight: '88%',
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.bg,
    },
    kicker: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1.1,
    },
    title: {
      marginTop: spacing.xs,
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
    },
    current: { marginTop: spacing.xs, color: colors.textMuted, fontSize: fontSize.xs },
    list: { gap: spacing.md, paddingVertical: spacing.lg },
    card: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    club: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    terms: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.md },
    term: { flex: 1 },
    label: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.7,
    },
    value: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy, marginTop: 3 },
    raise: { color: colors.success, fontSize: fontSize.xs, marginTop: 3 },
    stay: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stayText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  });
