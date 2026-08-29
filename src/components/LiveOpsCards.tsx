import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  claimablePassRewards,
  isQuestComplete,
  PASS_TIER_COUNT,
  passLevel,
  pickDailyQuests,
  QuestDef,
  weeklyQuestsForMode,
  xpForTier,
} from '../game/liveops';
import { isSeasonPassActive, monthlyBundleForSave } from '../game/seasonPass';
import { RootStackParamList } from '../navigation';
import { useCareer } from '../state/careerStore';
import { fontSize, fontWeight, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { RewardModal, RewardModalData } from './RewardModal';

interface LiveOpsCardsProps {
  /** Cricket-home ticket summary; full quest detail remains available elsewhere. */
  compact?: boolean;
}

/** A single, low-density Home entry for the save-specific Season Pass. */
export function SeasonPassHomeCard() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const save = useCareer((s) => s.save);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save?.pass) return null;

  const pass = save.pass;
  const premiumActive = isSeasonPassActive(save);
  const monthlyBundle = monthlyBundleForSave(save);
  const modeLabel = save.mode === 'manager' ? 'MANAGER' : 'PLAYER';
  const level = passLevel(pass.xp);
  const claimable = claimablePassRewards(pass).length;
  const nextTierXp = level < PASS_TIER_COUNT ? xpForTier(level + 1) : xpForTier(PASS_TIER_COUNT);
  const thisTierXp = level > 0 ? xpForTier(level) : 0;
  const progress = nextTierXp > thisTierXp ? (pass.xp - thisTierXp) / (nextTierXp - thisTierXp) : 1;

  return (
    <Card
      style={styles.homePassCard}
      onPress={() => navigation.navigate('SeasonPass')}
      accessibilityLabel={`${modeLabel.toLowerCase()} Season Pass, ${monthlyBundle.title}, tier ${level} of ${PASS_TIER_COUNT}${claimable ? `, ${claimable} rewards ready` : ''}. Open reward track.`}
    >
      <View style={styles.homePassTopRow}>
        <View style={styles.homePassTicket}>
          <Text style={styles.homePassTicketIcon}>🎟</Text>
        </View>
        <View style={styles.homePassCopy}>
          <Text style={styles.homePassEyebrow}>{modeLabel} SEASON PASS</Text>
          <Text style={styles.homePassTitle}>
            {monthlyBundle.title} · Tier {level}/{PASS_TIER_COUNT}
          </Text>
          <Text style={styles.homePassMode}>{premiumActive ? 'Premium track' : 'Free track'}</Text>
        </View>
        <Text style={[styles.homePassAction, claimable > 0 && { color: colors.success }]}>
          {claimable > 0 ? `${claimable} READY` : 'OPEN →'}
        </Text>
      </View>
      <ProgressBar value={progress} color={colors.accent} style={styles.homePassProgress} />
      <Text style={styles.homePassXp}>
        {level >= PASS_TIER_COUNT ? 'TRACK COMPLETE' : `${pass.xp}/${nextTierXp} XP`}
      </Text>
    </Card>
  );
}

/** Daily quests + season-pass progress, wired to the career store. */
export function LiveOpsCards({ compact = false }: LiveOpsCardsProps) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const save = useCareer((s) => s.save);
  const claimQuestReward = useCareer((s) => s.claimQuestReward);
  const claimWeeklyReward = useCareer((s) => s.claimWeeklyReward);
  const claimPass = useCareer((s) => s.claimPass);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);

  if (!save || !save.quests || !save.pass) return null;
  const weeklyDefs = weeklyQuestsForMode(save.mode);
  const weeklyDefById = new Map<string, QuestDef>(weeklyDefs.map((d) => [d.id, d]));

  const defs = pickDailyQuests(save.quests.day, undefined, save.mode);
  const defById = new Map<string, QuestDef>(defs.map((d) => [d.id, d]));
  const pass = save.pass;
  const level = passLevel(pass.xp);
  const claimable = claimablePassRewards(pass).length;
  const nextTierXp = level < PASS_TIER_COUNT ? xpForTier(level + 1) : xpForTier(PASS_TIER_COUNT);
  const thisTierXp = level > 0 ? xpForTier(level) : 0;
  const progress = nextTierXp > thisTierXp ? (pass.xp - thisTierXp) / (nextTierXp - thisTierXp) : 1;
  const dailyReady = save.quests.items.filter((item) => {
    const def = defById.get(item.id);
    return Boolean(def && !item.claimed && isQuestComplete(item, def));
  });
  const weeklyReady = (save.weeklyQuests?.items ?? []).filter((item) => {
    const def = weeklyDefById.get(item.id);
    return Boolean(def && !item.claimed && isQuestComplete(item, def));
  });

  if (compact) {
    const objectiveReady = dailyReady.length + weeklyReady.length;
    const activeObjectives = save.quests.items.length + (save.weeklyQuests?.items.length ?? 0);
    return (
      <>
        <Card style={styles.compactCard}>
          <View style={styles.compactSummaryRow}>
            <View style={styles.compactSummaryCell}>
              <Text style={styles.compactLabel}>🎟 OBJECTIVES</Text>
              <Text style={[styles.compactValue, objectiveReady > 0 && styles.compactReady]}>
                {objectiveReady > 0 ? `${objectiveReady} READY` : `${activeObjectives} ACTIVE`}
              </Text>
            </View>
            <View style={styles.compactDivider} />
            <View style={styles.compactSummaryCell}>
              <Text style={styles.compactLabel}>PASS TICKET</Text>
              <Text style={styles.compactValue}>TIER {level}</Text>
            </View>
          </View>
          {objectiveReady > 0 ? (
            <Button
              label={`Claim ${objectiveReady} objective reward${objectiveReady === 1 ? '' : 's'}`}
              size="sm"
              variant="gold"
              style={styles.compactAction}
              onPress={() => {
                let coins = 0;
                for (const item of dailyReady) coins += claimQuestReward(item.id).coins;
                for (const item of weeklyReady) coins += claimWeeklyReward(item.id).coins;
                setRewardModal({
                  title: 'Objectives claimed',
                  items: [`Coins x ${coins}`],
                });
              }}
            />
          ) : null}
          {claimable > 0 ? (
            <Button
              label={`Claim ${claimable} pass reward${claimable === 1 ? '' : 's'}`}
              size="sm"
              variant="gold"
              style={styles.compactAction}
              onPress={() => {
                const reward = claimPass();
                if (reward.count <= 0) return;
                setRewardModal({
                  title: 'Season Pass reward claimed',
                  items: reward.items,
                  balances: [
                    `Coins: ${reward.previousCoins.toLocaleString()} -> ${reward.newCoins.toLocaleString()}`,
                  ],
                  icon: 'trophy',
                });
              }}
            />
          ) : null}
          <Button
            label="Open objectives & pass"
            size="sm"
            variant="ghost"
            style={styles.compactAction}
            onPress={() => navigation.navigate('SeasonPass')}
          />
        </Card>
        <RewardModal data={rewardModal} onClose={() => setRewardModal(null)} />
      </>
    );
  }

  return (
    <>
      <Text style={styles.section}>Daily Quests</Text>
      <Card>
        {save.quests.items.map((p) => {
          const def = defById.get(p.id);
          if (!def) return null;
          const done = isQuestComplete(p, def);
          return (
            <View key={p.id} style={styles.questRow}>
              <View style={styles.questInfo}>
                <Text style={styles.questTitle}>{def.title}</Text>
                <Text style={styles.questDesc}>
                  {def.description} · {Math.min(p.progress, def.target)}/{def.target}
                </Text>
                <ProgressBar
                  value={def.target ? p.progress / def.target : 0}
                  color={done ? colors.success : colors.primary}
                  style={{ marginTop: 4 }}
                />
              </View>
              {p.claimed ? (
                <Text style={styles.claimed}>Claimed</Text>
              ) : done ? (
                <Button
                  label={`+${def.rewardCoins}`}
                  size="sm"
                  variant="gold"
                  fullWidth={false}
                  onPress={() => {
                    const reward = claimQuestReward(p.id);
                    if (!reward.ok) return;
                    setRewardModal({
                      title: 'Daily quest complete',
                      items: [
                        `Coins x ${reward.coins}`,
                        ...(reward.gems ? [`Gems x ${reward.gems}`] : []),
                      ],
                    });
                  }}
                />
              ) : (
                <Text style={styles.reward}>+{def.rewardCoins}</Text>
              )}
            </View>
          );
        })}
      </Card>

      {save.weeklyQuests ? (
        <>
          <Text style={styles.section}>Weekly Challenges</Text>
          <Card>
            {save.weeklyQuests.items.map((p) => {
              const def = weeklyDefById.get(p.id);
              if (!def) return null;
              const done = isQuestComplete(p, def);
              return (
                <View key={p.id} style={styles.questRow}>
                  <View style={styles.questInfo}>
                    <Text style={styles.questTitle}>{def.title}</Text>
                    <Text style={styles.questDesc}>
                      {def.description} · {Math.min(p.progress, def.target)}/{def.target}
                    </Text>
                    <ProgressBar
                      value={def.target ? p.progress / def.target : 0}
                      color={done ? colors.success : colors.info}
                      style={{ marginTop: 4 }}
                    />
                  </View>
                  {p.claimed ? (
                    <Text style={styles.claimed}>Claimed</Text>
                  ) : done ? (
                    <Button
                      label={`+${def.rewardCoins}`}
                      size="sm"
                      variant="gold"
                      fullWidth={false}
                      onPress={() => {
                        const reward = claimWeeklyReward(p.id);
                        if (!reward.ok) return;
                        setRewardModal({
                          title: 'Weekly challenge complete',
                          items: [
                            `Coins x ${reward.coins}`,
                            ...(reward.gems ? [`Gems x ${reward.gems}`] : []),
                          ],
                          icon: 'trophy',
                        });
                      }}
                    />
                  ) : (
                    <Text style={styles.reward}>
                      +{def.rewardCoins}
                      {def.rewardGems ? ` · ${def.rewardGems}💎` : ''}
                    </Text>
                  )}
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <Text style={styles.section}>Season Pass</Text>
      <Card>
        <View style={styles.passHead}>
          <Text style={styles.passTier}>
            Tier {level}/{PASS_TIER_COUNT} reached
          </Text>
          <Text
            style={[styles.passPremium, { color: pass.premium ? colors.accent : colors.textFaint }]}
          >
            {pass.premium ? '★ Premium' : 'Free track'}
          </Text>
        </View>
        <ProgressBar value={progress} color={colors.accent} style={{ marginTop: spacing.sm }} />
        <Text style={styles.passXp}>{pass.xp} XP</Text>
        <Button
          label="View full track"
          size="sm"
          variant="secondary"
          style={{ marginTop: spacing.sm }}
          onPress={() => navigation.navigate('SeasonPass')}
        />
        {claimable > 0 ? (
          <Button
            label={`Claim ${claimable} track reward${claimable === 1 ? '' : 's'}`}
            variant="gold"
            style={{ marginTop: spacing.sm }}
            onPress={() => {
              const reward = claimPass();
              if (reward.count <= 0) return;
              setRewardModal({
                title: 'Season Pass reward claimed',
                subtitle: `${reward.count} reward${reward.count === 1 ? '' : 's'} added`,
                items: reward.items,
                balances: [
                  `Coins: ${reward.previousCoins.toLocaleString()} -> ${reward.newCoins.toLocaleString()}`,
                ],
                icon: 'trophy',
              });
            }}
          />
        ) : null}
      </Card>
      <RewardModal data={rewardModal} onClose={() => setRewardModal(null)} />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    questRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    questInfo: { flex: 1 },
    questTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    questDesc: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    reward: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    claimed: { color: colors.textFaint, fontSize: fontSize.xs },
    passHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    passTier: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    passPremium: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    passXp: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 4 },
    passNote: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm },
    compactCard: { marginTop: spacing.md },
    compactSummaryRow: { alignItems: 'center', flexDirection: 'row' },
    compactSummaryCell: { flex: 1, paddingVertical: spacing.xs },
    compactDivider: { alignSelf: 'stretch', backgroundColor: colors.border, width: 1 },
    compactLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.6,
    },
    compactValue: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    compactReady: { color: colors.success },
    compactAction: { marginTop: spacing.sm },
    homePassCard: {
      marginTop: spacing.md,
      borderColor: colors.accent + '88',
      backgroundColor: colors.surface,
    },
    homePassTopRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
    homePassTicket: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent + '18',
      borderWidth: 1,
      borderColor: colors.accent + '66',
    },
    homePassTicketIcon: { fontSize: 18 },
    homePassCopy: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
    homePassEyebrow: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    homePassTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    homePassMode: { color: colors.textFaint, fontSize: 9, marginTop: 1 },
    homePassAction: {
      color: colors.accentLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginLeft: spacing.sm,
    },
    homePassProgress: { marginTop: spacing.sm },
    homePassXp: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      marginTop: 4,
      textAlign: 'right',
    },
  });
