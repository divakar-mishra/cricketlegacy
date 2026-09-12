import { StyleSheet, View } from 'react-native';
import type { PlayerLifeAsset } from '../game/playerLife';
import { fontSize, fontWeight, spacing, useColors } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { VenueIllustration } from './VenueIllustration';
import type { VenueArtwork } from './venueArtwork';

// Static requires keep the entire collection available offline, like the facilities.
export const PLAYER_LIFE_ART: Record<string, VenueArtwork> = {
  'personal-bank': {
    id: 'personal-bank',
    source: require('../../assets/player-life/personal-bank.webp'),
  },
  'starter-apartment': {
    id: 'starter-apartment',
    source: require('../../assets/player-life/starter-apartment.webp'),
  },
  'family-house': {
    id: 'family-house',
    source: require('../../assets/player-life/family-house.webp'),
  },
  'legacy-estate': {
    id: 'legacy-estate',
    source: require('../../assets/player-life/legacy-estate.webp'),
  },
  'bat-workshop': {
    id: 'bat-workshop',
    source: require('../../assets/player-life/bat-workshop.webp'),
  },
  'fitness-studio': {
    id: 'fitness-studio',
    source: require('../../assets/player-life/fitness-studio.webp'),
  },
  'media-company': {
    id: 'media-company',
    source: require('../../assets/player-life/media-company.webp'),
  },
};

export function PlayerLifeAssetCard({
  asset,
  owned,
  unlocked,
  walletCoins,
  onBuy,
}: {
  asset: PlayerLifeAsset;
  owned: boolean;
  unlocked: boolean;
  walletCoins: number;
  onBuy: () => void;
}) {
  const colors = useColors();
  const art = PLAYER_LIFE_ART[asset.id];
  const affordable = walletCoins >= asset.cost;
  return (
    <Card style={styles.card}>
      {art ? <VenueIllustration art={art} label={`${asset.name} illustration`} /> : null}
      <View style={styles.details}>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
          {asset.name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          +{asset.seasonalIncome.toLocaleString()} coins / season
        </Text>
        {owned ? (
          <Text
            accessibilityLabel={`${asset.name}: owned`}
            style={{ color: colors.success, fontWeight: fontWeight.bold }}
          >
            Owned
          </Text>
        ) : (
          <>
            <Button
              label={`Buy · ${asset.cost.toLocaleString()} coins`}
              variant="secondary"
              size="sm"
              disabled={!unlocked || !affordable}
              onPress={onBuy}
            />
            {!unlocked || !affordable ? (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {!unlocked ? 'Requires age 18 and a senior career' : 'Not enough Wallet Coins'}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  details: { paddingTop: spacing.md, gap: spacing.sm },
});
