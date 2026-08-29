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

function coins(value: number): string {
  return `${Math.round(value).toLocaleString()} coins`;
}

export function FranchiseOfferModal({ save, offers, onAccept, onStay }: Props) {
  const styles = useThemedStyles(makeStyles);
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const currentClubId = save.franchiseTeamId ?? save.userTeamId;
  const currentClub = currentClubId ? save.teams[currentClubId] : undefined;
  const currentSalary = Math.max(0, save.franchiseContract?.wage ?? 0);
  if (!offers.length || !user) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>FRANCHISE INTEREST</Text>
          <Text style={styles.title}>Clubs want to sign {user.name}</Text>
          <Text style={styles.current}>
            Current T20 team · {currentClub?.name ?? 'No franchise'} ·{' '}
            {currentSalary > 0 ? `${coins(currentSalary)}/season` : 'renewal due'}
          </Text>

          <ScrollView contentContainerStyle={styles.offerList} bounces={false}>
            {offers.map((offer) => {
              const club = save.teams[offer.teamId];
              const increase =
                currentSalary > 0
                  ? Math.max(0, Math.round((offer.wagePromise / currentSalary - 1) * 100))
                  : null;
              return (
                <View key={offer.teamId} style={styles.offerCard}>
                  <Text style={styles.club}>{club?.name ?? 'Interested club'}</Text>
                  <Text style={styles.interest}>want you for the next season</Text>
                  <View style={styles.termsRow}>
                    <View style={styles.term}>
                      <Text style={styles.termLabel}>SEASON SALARY</Text>
                      <Text style={styles.termValue}>{coins(offer.wagePromise)}</Text>
                      {increase !== null ? (
                        <Text style={styles.raise}>+{increase}% from current deal</Text>
                      ) : null}
                    </View>
                    <View style={styles.term}>
                      <Text style={styles.termLabel}>SIGNING BONUS</Text>
                      <Text style={styles.termValue}>{coins(offer.signingBonus)}</Text>
                    </View>
                  </View>
                  <Button
                    label={`Accept ${club?.shortName ?? 'offer'}`}
                    variant="gold"
                    onPress={() => onAccept(offer.teamId)}
                  />
                </View>
              );
            })}
          </ScrollView>

          <Pressable accessibilityRole="button" onPress={onStay} style={styles.stayButton}>
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
    offerList: { gap: spacing.md, paddingVertical: spacing.lg },
    offerCard: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    club: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    interest: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    termsRow: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.md },
    term: { flex: 1 },
    termLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.7,
    },
    termValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: 3,
    },
    raise: { color: colors.success, fontSize: fontSize.xs, marginTop: 3 },
    stayButton: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stayText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  });
