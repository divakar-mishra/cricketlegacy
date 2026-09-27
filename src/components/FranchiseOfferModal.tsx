import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AuctionOffer, Player, SaveGame, Team } from '../domain/types';
import { contractCoinsAtLeast, roundContractCoins } from '../game/career';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

interface Props {
  save: SaveGame;
  offers: AuctionOffer[];
  onAccept: (teamId: string) => void;
  onStay: () => void;
}

interface SquadFit {
  headline: string;
  detail: string;
  roleRank: number;
  rolePeers: number;
}

const ROLE_LABEL: Record<Player['role'], string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALLROUNDER: 'All-rounder',
  WK_BATTER: 'Wicketkeeper-batter',
};

function coins(value: number): string {
  return `${roundContractCoins(value).toLocaleString()} coins`;
}

/** Cricket context for an offer; it does not alter club choice or contract terms. */
export function franchiseSquadFit(save: SaveGame, team: Team, user: Player): SquadFit {
  const peers = team.playerIds
    .map((id) => save.players[id])
    .filter((player): player is Player => Boolean(player) && player.role === user.role)
    .sort((left, right) => right.overall - left.overall);
  const roleRank = peers.filter((player) => player.overall > user.overall).length + 1;
  const rolePeers = peers.length;

  if (roleRank === 1) {
    return {
      headline: `First-choice ${ROLE_LABEL[user.role].toLowerCase()}`,
      detail: `You would arrive as the strongest ${ROLE_LABEL[user.role].toLowerCase()} in a group of ${Math.max(1, rolePeers)}.`,
      roleRank,
      rolePeers,
    };
  }
  if (roleRank <= 2) {
    return {
      headline: 'Clear route into the XI',
      detail: `You rank second among the club's ${Math.max(1, rolePeers)} ${ROLE_LABEL[user.role].toLowerCase()} options.`,
      roleRank,
      rolePeers,
    };
  }
  return {
    headline: 'Competition for a starting place',
    detail: `${rolePeers} players cover your role. Strong form will be needed to own a place in the XI.`,
    roleRank,
    rolePeers,
  };
}

export function FranchiseOfferModal({ save, offers, onAccept, onStay }: Props) {
  const styles = useThemedStyles(makeStyles);
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const currentClubId = save.franchiseTeamId ?? save.userTeamId;
  const currentClub = currentClubId ? save.teams[currentClubId] : undefined;
  const currentSalary = Math.max(0, save.franchiseContract?.wage ?? 0);
  if (!offers.length || !user) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onStay} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.kicker}>T20 CLUB OFFERS</Text>
            <Text style={styles.title}>
              {offers.length === 1
                ? 'A club has approached you'
                : `${offers.length} clubs have approached you`}
            </Text>
            <Text style={styles.intro}>
              Compare the terms and choose where {user.name} will play T20 cricket.
            </Text>
            <Text style={styles.currentClub}>
              Current T20 club: {currentClub?.name ?? 'Unsigned'}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.offerList}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {offers.map((offer) => {
              const club = save.teams[offer.teamId];
              const fit = club ? franchiseSquadFit(save, club, user) : null;
              // An older save may hold raw numbers. Display exactly the rounded
              // salary and bonus that acceptance will write/pay for this offer.
              const salary = contractCoinsAtLeast(offer.wagePromise, currentSalary);
              const signingBonus = roundContractCoins(offer.signingBonus);
              return (
                <View key={offer.teamId} style={styles.offerCard}>
                  <View style={styles.clubRow}>
                    <View
                      style={[
                        styles.clubDisc,
                        {
                          backgroundColor: club?.primaryColor ?? '#9B6A2F',
                          borderColor: club?.secondaryColor ?? '#F4E5BE',
                        },
                      ]}
                    >
                      <Text
                        style={[styles.clubInitials, { color: club?.secondaryColor ?? '#F4E5BE' }]}
                      >
                        {club?.shortName ?? 'CLB'}
                      </Text>
                    </View>
                    <Text style={styles.clubName} numberOfLines={2}>
                      {club?.name ?? 'Interested club'}
                    </Text>
                  </View>
                  <View style={styles.terms}>
                    <View style={styles.term}>
                      <Text style={styles.termLabel}>SEASON SALARY</Text>
                      <Text style={styles.termValue}>{coins(salary)}</Text>
                    </View>
                    <View style={styles.term}>
                      <Text style={styles.termLabel}>SIGNING BONUS</Text>
                      <Text style={styles.termValue}>{coins(signingBonus)}</Text>
                    </View>
                  </View>
                  {fit ? <Text style={styles.fit}>Squad role: {fit.headline}</Text> : null}
                  <Button
                    label={`Sign with ${club?.shortName ?? 'club'}`}
                    variant="gold"
                    onPress={() => onAccept(offer.teamId)}
                  />
                </View>
              );
            })}
            <Text style={styles.footnote}>Your First-Class and List A club will not change.</Text>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={onStay} style={styles.stayButton}>
              <Text style={styles.stayText}>
                Stay with {currentClub?.shortName ?? 'current T20 club'}
              </Text>
            </Pressable>
          </View>
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
      padding: spacing.md,
      backgroundColor: 'rgba(2, 6, 14, 0.92)',
    },
    sheet: {
      maxHeight: '90%',
      overflow: 'hidden',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.bg,
    },
    header: {
      padding: spacing.lg,
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
      backgroundColor: colors.surface,
    },
    kicker: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    title: {
      marginTop: spacing.xs,
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
    },
    intro: { marginTop: spacing.xs, color: colors.textMuted, fontSize: fontSize.sm },
    currentClub: { marginTop: spacing.sm, color: colors.textMuted, fontSize: fontSize.xs },
    offerList: { padding: spacing.md, gap: spacing.md },
    offerCard: {
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    clubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    clubDisc: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    clubInitials: { fontSize: fontSize.xs, fontWeight: fontWeight.black },
    clubName: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    terms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    term: { flexGrow: 1, minWidth: 116 },
    termLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
    },
    termValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    fit: { color: colors.textMuted, fontSize: fontSize.xs },
    footnote: { color: colors.textMuted, fontSize: fontSize.xs },
    footer: {
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    stayButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stayText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  });
