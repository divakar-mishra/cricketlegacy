import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AuctionOffer, Player, SaveGame, Team } from '../domain/types';
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
  return `${Math.round(value).toLocaleString()} coins`;
}

/** Cricket context for an offer; it does not alter selection or auction outcomes. */
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

function TeamPaddle({
  team,
  offer,
  selected,
  onPress,
}: {
  team: Team | undefined;
  offer: AuctionOffer;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const primary = team?.primaryColor ?? '#9B6A2F';
  const secondary = team?.secondaryColor ?? '#F4E5BE';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${team?.name ?? 'Interested club'} final bid, ${coins(offer.fee)}`}
      onPress={onPress}
      style={[styles.paddle, selected && styles.paddleSelected]}
    >
      <View style={[styles.paddleStripe, { backgroundColor: primary }]} />
      <View style={[styles.clubDisc, { backgroundColor: primary, borderColor: secondary }]}>
        <Text style={[styles.clubDiscText, { color: secondary }]}>{team?.shortName ?? 'CLB'}</Text>
      </View>
      <View style={styles.paddleCopy}>
        <Text style={styles.paddleClub} numberOfLines={1}>
          {team?.name ?? 'Interested club'}
        </Text>
        <Text style={styles.paddleStatus}>PADDLE UP · FINAL BID</Text>
      </View>
      <Text style={styles.paddleBid}>{coins(offer.fee)}</Text>
    </Pressable>
  );
}

export function FranchiseOfferModal({ save, offers, onAccept, onStay }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [selectedTeamId, setSelectedTeamId] = useState(offers[0]?.teamId ?? '');
  const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const currentClubId = save.franchiseTeamId ?? save.userTeamId;
  const currentClub = currentClubId ? save.teams[currentClubId] : undefined;
  const currentSalary = Math.max(0, save.franchiseContract?.wage ?? 0);
  if (!offers.length || !user) return null;

  const selectedOffer = offers.find((offer) => offer.teamId === selectedTeamId) ?? offers[0];
  const selectedClub = save.teams[selectedOffer.teamId];
  const fit = selectedClub ? franchiseSquadFit(save, selectedClub, user) : null;
  const increase =
    currentSalary > 0
      ? Math.max(0, Math.round((selectedOffer.wagePromise / currentSalary - 1) * 100))
      : null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onStay} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.rostrum}>
            <View style={styles.gavelMark}>
              <Text style={styles.gavel}>◆</Text>
            </View>
            <View style={styles.rostrumCopy}>
              <Text style={styles.kicker}>T20 FRANCHISE AUCTION · FINAL CALL</Text>
              <Text style={styles.title}>The room is bidding for {user.name}</Text>
              <Text style={styles.intro}>
                Compare the cricket opportunity first. Your domestic club does not change.
              </Text>
            </View>
          </View>

          <View style={styles.lotStrip}>
            <View style={styles.shirtMark}>
              <Text style={styles.shirtNumber}>{user.overall}</Text>
              <Text style={styles.shirtLabel}>OVR</Text>
            </View>
            <View style={styles.lotCopy}>
              <Text style={styles.lotLabel}>PLAYER LOT</Text>
              <Text style={styles.playerName}>{user.name}</Text>
              <Text style={styles.playerLine}>
                {ROLE_LABEL[user.role]} · Form {Math.round(user.meta.form ?? 60)}
              </Text>
            </View>
            <View style={styles.currentClubBlock}>
              <Text style={styles.currentClubLabel}>CURRENT T20 SIDE</Text>
              <Text style={styles.currentClubName} numberOfLines={1}>
                {currentClub?.shortName ?? 'Unsigned'}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.bidHeader}>
              <Text style={styles.sectionLabel}>BIDDING PADDLES</Text>
              <Text style={styles.bidCount}>
                {offers.length} final bid{offers.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.paddleList}>
              {offers.map((offer) => (
                <TeamPaddle
                  key={offer.teamId}
                  team={save.teams[offer.teamId]}
                  offer={offer}
                  selected={selectedOffer.teamId === offer.teamId}
                  onPress={() => setSelectedTeamId(offer.teamId)}
                />
              ))}
            </View>

            <View style={styles.managerNote}>
              <View
                style={[
                  styles.managerTape,
                  { backgroundColor: selectedClub?.secondaryColor ?? '#D8B45D' },
                ]}
              />
              <Text style={styles.noteKicker}>
                CRICKET FIT · {selectedClub?.shortName ?? 'CLUB'}
              </Text>
              <Text style={styles.noteHeadline}>{fit?.headline ?? 'Squad role under review'}</Text>
              <Text style={styles.noteDetail}>
                {fit?.detail ?? 'The club will confirm your role after the auction.'}
              </Text>
            </View>

            <View style={styles.contractSheet}>
              <View style={styles.contractNotchLeft} />
              <View style={styles.contractNotchRight} />
              <Text style={styles.contractTitle}>AGENT&apos;S CONTRACT SHEET</Text>
              <View style={styles.contractRule} />
              <View style={styles.contractRow}>
                <View style={styles.contractItem}>
                  <Text style={styles.contractLabel}>HAMMER BID</Text>
                  <Text style={styles.contractValue}>{coins(selectedOffer.fee)}</Text>
                </View>
                <View style={styles.contractItem}>
                  <Text style={styles.contractLabel}>SEASON SALARY</Text>
                  <Text style={styles.contractValue}>{coins(selectedOffer.wagePromise)}</Text>
                  {increase !== null ? (
                    <Text style={styles.raise}>+{increase}% on current terms</Text>
                  ) : null}
                </View>
                <View style={styles.contractItem}>
                  <Text style={styles.contractLabel}>SIGNING BONUS</Text>
                  <Text style={styles.contractValue}>{coins(selectedOffer.signingBonus)}</Text>
                </View>
              </View>
              <Text style={styles.contractFootnote}>
                Separate T20 contract · First-Class and List A affiliation stays unchanged
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button
              label={`Sign for ${selectedClub?.shortName ?? 'club'}`}
              variant="gold"
              onPress={() => onAccept(selectedOffer.teamId)}
            />
            <Pressable accessibilityRole="button" onPress={onStay} style={styles.stayButton}>
              <Text style={styles.stayText}>
                Pass auction · stay at {currentClub?.shortName ?? 'current club'}
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
      maxHeight: '94%',
      overflow: 'hidden',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.bg,
    },
    rostrum: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderBottomWidth: 3,
      borderBottomColor: colors.accent,
      backgroundColor: colors.surface,
    },
    gavelMark: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: colors.surfaceMuted,
    },
    gavel: { color: colors.accent, fontSize: 22, fontWeight: fontWeight.black },
    rostrumCopy: { flex: 1, minWidth: 0 },
    kicker: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1.1,
    },
    title: {
      marginTop: 3,
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
    },
    intro: { marginTop: 4, color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
    lotStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surfaceMuted,
    },
    shirtMark: {
      width: 54,
      height: 62,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.accent,
      backgroundColor: colors.primaryDark,
    },
    shirtNumber: { color: colors.white, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    shirtLabel: { color: colors.accentLight, fontSize: 9, fontWeight: fontWeight.bold },
    lotCopy: { flex: 1, minWidth: 0 },
    lotLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    playerName: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.black },
    playerLine: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    currentClubBlock: { maxWidth: 86, alignItems: 'flex-end' },
    currentClubLabel: {
      color: colors.textFaint,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      textAlign: 'right',
    },
    currentClubName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.black },
    scrollContent: { padding: spacing.lg, gap: spacing.md },
    bidHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    bidCount: { color: colors.textFaint, fontSize: fontSize.xs },
    paddleList: { gap: spacing.sm },
    paddle: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      overflow: 'hidden',
      paddingRight: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    paddleSelected: { borderWidth: 2, borderColor: colors.accent },
    paddleStripe: { alignSelf: 'stretch', width: 7 },
    clubDisc: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    clubDiscText: { fontSize: 10, fontWeight: fontWeight.black },
    paddleCopy: { flex: 1, minWidth: 0 },
    paddleClub: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    paddleStatus: {
      color: colors.textFaint,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.6,
      marginTop: 2,
    },
    paddleBid: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.black },
    managerNote: {
      overflow: 'hidden',
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
    },
    managerTape: {
      position: 'absolute',
      top: -4,
      left: '40%',
      width: 70,
      height: 13,
      opacity: 0.72,
      transform: [{ rotate: '-2deg' }],
    },
    noteKicker: {
      color: colors.primaryLight,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0.8,
    },
    noteHeadline: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      marginTop: 5,
    },
    noteDetail: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 3 },
    contractSheet: {
      overflow: 'hidden',
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: '#F4ECD8',
    },
    contractNotchLeft: {
      position: 'absolute',
      left: -8,
      top: '46%',
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.bg,
    },
    contractNotchRight: {
      position: 'absolute',
      right: -8,
      top: '46%',
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.bg,
    },
    contractTitle: {
      color: '#26344A',
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    contractRule: { height: 1, backgroundColor: '#B9A77B', marginVertical: spacing.sm },
    contractRow: { flexDirection: 'row', gap: spacing.sm },
    contractItem: { flex: 1 },
    contractLabel: {
      color: '#746849',
      fontSize: 8,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
    },
    contractValue: {
      color: '#12213A',
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    raise: { color: '#176536', fontSize: 9, fontWeight: fontWeight.bold, marginTop: 2 },
    contractFootnote: { color: '#746849', fontSize: 9, lineHeight: 13, marginTop: spacing.md },
    actions: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
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
    stayText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  });
