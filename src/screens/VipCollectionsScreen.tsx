import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Card,
  Screen,
  ScreenHeader,
  RewardModal,
  type RewardModalData,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { RewardShowcase } from '../components/RewardShowcase';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { collectionItems, hasModeVip, vipProductId, vipTitle } from '../game/vip';
import {
  claimablePassRewards,
  passLevel,
  passTiersForMode,
  PASS_ITEM_LABELS,
} from '../game/liveops';
import type { ScreenProps } from '../navigation';
import { purchases } from '../services';
import { useCareer } from '../state/careerStore';
import { spacing, useColors } from '../theme';

export function VipCollectionsScreen({
  navigation,
  onLegacy,
}: ScreenProps<'SeasonPass'> & { onLegacy?: () => void }) {
  const save = useCareer((s) => s.save);
  const choose = useCareer((s) => s.chooseVipCollection);
  const claim = useCareer((s) => s.claimVipCollection);
  const purchase = useCareer((s) => s.purchaseProduct);
  const restore = useCareer((s) => s.restorePurchases);
  const claimFree = useCareer((s) => s.claimPass);
  const colors = useColors();
  const [product, setProduct] = useState<purchases.Product>();
  const [busy, setBusy] = useState(false);
  const [showFree, setShowFree] = useState(false);
  const [showBenefits, setShowBenefits] = useState(false);
  const [reward, setReward] = useState<RewardModalData | null>(null);
  useEffect(() => {
    let alive = true;
    setProduct(undefined);
    if (save)
      void purchases.getProducts().then((products) => {
        if (alive) setProduct(products.find((item) => item.id === vipProductId(save.mode)));
      });
    return () => {
      alive = false;
    };
  }, [save?.mode]);
  if (!save)
    return (
      <Screen>
        <ScreenHeader title="VIP Collections" onBack={() => navigation.goBack()} />
        <Text>Start a career first.</Text>
      </Screen>
    );
  const owned = hasModeVip(save);
  const state = save.vipCollections;
  const text = { color: colors.textMuted, marginVertical: spacing.sm };
  const title = { color: colors.text, fontSize: 20, fontWeight: '700' as const };
  const freeReady = save.pass
    ? claimablePassRewards(save.pass).filter((item) => !item.premium).length
    : 0;
  return (
    <Screen scroll>
      <ScreenHeader title={vipTitle(save.mode)} onBack={() => navigation.goBack()} />
      {onLegacy && (
        <Button label="Existing subscription rewards" variant="secondary" onPress={onLegacy} />
      )}
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={title}>
          {owned ? 'Your career. Your collection.' : `${vipTitle(save.mode)} · One-time upgrade`}
        </Text>
        <Text style={text}>12 collections · Choose one each in-game season · No expiry</Text>
        <Text style={text}>Retirement unlocks remaining cosmetics only — no Coins, Gems or cash rewards.</Text>
        <Text style={text}>
          {state?.owned.length ?? 0}/12 owned
          {state?.credits
            ? ` · ${state.credits} collection${state.credits === 1 ? '' : 's'} ready to claim`
            : ''}
        </Text>
        <Button
          label={showBenefits ? 'Hide benefits' : 'What’s included?'}
          variant="ghost"
          onPress={() => setShowBenefits(!showBenefits)}
        />
        {showBenefits && (
          <View>
            <Text style={text}>
              Permanent access across your {save.mode === 'career' ? 'Player' : 'Manager'} saves
              only. No ads{save.mode === 'career' ? ', 60 Focus capacity' : ''}, +20% match coins
              and one extra save slot.
            </Text>
            <Text style={text}>
              {save.mode === 'career'
                ? 'Kits and celebrations, league/team naming, story challenges, +10% training growth and +5% positive selection-reputation gains. Retirement unlocks the remaining collection cosmetics.'
                : 'Office collections, league/team naming, story challenges, +4 percentage points superstar interest and 5% staff-signing discount. Retirement unlocks the remaining collection cosmetics.'}
            </Text>
            <Text style={text}>
              Earned collection cosmetics carry into future careers in this mode. Currency rewards
              stay in the save that earns them.
            </Text>
          </View>
        )}
        {!owned && (
          <Button
            disabled={busy || !product || !purchases.isProductAvailable(product)}
            label={
              busy
                ? 'Please wait…'
                : product && purchases.isProductAvailable(product)
                  ? `Buy · ${product.priceString} once`
                  : 'Store unavailable'
            }
            onPress={async () => {
              if (!product || busy) return;
              setBusy(true);
              try {
                const result = await purchase(product.id);
                if (!result.ok)
                  Alert.alert('Purchase unavailable', result.error ?? 'Please try again.');
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        <Button
          label="Restore purchases"
          variant="ghost"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const result = await restore();
              Alert.alert(
                'Restore purchases',
                result.status === 'RESTORED'
                  ? 'Your applicable purchases have been restored.'
                  : (result.error ?? 'No purchases restored for this mode.'),
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          label="Presentation & challenges"
          variant="secondary"
          onPress={() => navigation.navigate('PremiumClubhouse')}
        />
        {owned && (save.mode === 'manager' || save.userPlayerId) && (
          <Button
            label={save.mode === 'career' ? 'View my player' : 'View Club Office'}
            variant="secondary"
            onPress={() => {
              if (save.mode === 'manager') navigation.navigate('ClubOffice');
              else if (save.userPlayerId) navigation.navigate('PlayerProfile', { playerId: save.userPlayerId });
            }}
          />
        )}
      </Card>
      {MONTHLY_PASS_CONTENT.map((content) => {
        const collected = state?.owned.includes(content.id) ?? false;
        const selected = state?.selectedId === content.id;
        return (
          <Card key={content.id} style={{ marginBottom: spacing.md }}>
            <Text style={title}>{content.title}</Text>
            <RewardShowcase itemIds={collectionItems(save.mode, content)} saveId={save.id} />
            <Text style={text}>
              {collected
                ? 'Owned permanently'
                : selected
                  ? 'Selected collection'
                  : 'Choose this season’s collection'}
            </Text>
            {collected && owned && (
              <Button
                label="Explore story & challenge"
                variant="secondary"
                onPress={() => {
                  choose(content.id);
                  navigation.navigate('PremiumClubhouse');
                }}
              />
            )}
            {!collected && (
              <Button
                disabled={!owned || busy || (selected && !state?.credits)}
                label={
                  selected
                    ? state?.credits
                      ? 'Claim collection'
                      : 'Complete this season'
                    : 'Choose collection'
                }
                variant={selected ? 'gold' : 'secondary'}
                onPress={async () => {
                  if (!selected) {
                    const result = choose(content.id);
                    if (!result.ok) Alert.alert('Unavailable', result.reason);
                    return;
                  }
                  setBusy(true);
                  try {
                    const result = await claim();
                    if (result.ok)
                      setReward({
                        title: `${content.title} unlocked`,
                        items: [],
                        visualRewards: { itemIds: result.items, saveId: save.id },
                      });
                    else Alert.alert('Unavailable', result.reason);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </Card>
        );
      })}
      <Card>
        <Text style={title}>Free career rewards</Text>
        <Text style={text}>
          Tier {passLevel(save.pass?.xp ?? 0)} · {save.pass?.xp ?? 0} XP
        </Text>
        <Button
          label={freeReady ? `Claim ${freeReady} rewards` : 'No rewards ready'}
          disabled={!freeReady}
          onPress={() => {
            const result = claimFree();
            if (result.count)
              setReward({
                title: 'Career rewards claimed',
                items: result.items,
                visualRewards: { itemIds: result.itemIds, saveId: save.id },
              });
          }}
        />
        <Button
          label={showFree ? 'Hide reward track' : 'View reward track'}
          variant="ghost"
          onPress={() => setShowFree(!showFree)}
        />
        {showFree &&
          passTiersForMode(save.mode).map((tier) => (
            <Text key={tier.tier} style={text}>
              Tier {tier.tier} · {tier.xpRequired} XP · {tier.freeReward.coins ?? 0} coins
              {tier.freeReward.item
                ? ` · ${PASS_ITEM_LABELS[tier.freeReward.item] ?? tier.freeReward.item}`
                : ''}
              {save.pass?.claimedFree.includes(tier.tier) ? ' · Claimed' : ''}
            </Text>
          ))}
      </Card>
      <RewardModal data={reward} onClose={() => setReward(null)} />
    </Screen>
  );
}
