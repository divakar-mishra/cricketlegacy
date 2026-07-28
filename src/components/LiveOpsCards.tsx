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
import { useCareer } from '../state/careerStore';
import { fontSize, fontWeight, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { RewardModal, RewardModalData } from './RewardModal';

/** Daily quests + season-pass progress, wired to the career store. */
export function LiveOpsCards() {
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
            Tier {level}/{PASS_TIER_COUNT}
          </Text>
          <Text
            style={[styles.passPremium, { color: pass.premium ? colors.accent : colors.textFaint }]}
          >
            {pass.premium ? '★ Premium' : 'Free track'}
          </Text>
        </View>
        <ProgressBar value={progress} color={colors.accent} style={{ marginTop: spacing.sm }} />
        <Text style={styles.passXp}>{pass.xp} XP</Text>
        {claimable > 0 ? (
          <Button
            label={`Claim ${claimable} pass reward${claimable === 1 ? '' : 's'}`}
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
                  `Gems: ${reward.previousGems.toLocaleString()} -> ${reward.newGems.toLocaleString()}`,
                ],
                icon: 'trophy',
              });
            }}
          />
        ) : (
          <Text style={styles.passNote}>Play matches and complete quests to earn pass XP.</Text>
        )}
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
  });
