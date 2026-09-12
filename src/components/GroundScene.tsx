import { View } from 'react-native';
import { AppText as Text } from './AppText';
import { GroundAppearance, GroundTrack, visualLevel } from './venueVisuals';
import { groundArtwork } from './venueArtwork';
import { VenueIllustration } from './VenueIllustration';
import { fontSize, spacing, useColors } from '../theme';

export function GroundScene({
  capacityLevel,
  experienceLevel,
  track = 'capacity',
  compact = false,
}: GroundAppearance & { track?: GroundTrack; accent?: string; compact?: boolean }) {
  const colors = useColors();
  const capacity = visualLevel(capacityLevel);
  const experience = visualLevel(experienceLevel);
  const level = track === 'capacity' ? capacity : experience;
  const view = track === 'capacity' ? 'Stands' : 'Matchday facilities';
  return (
    <View style={{ width: '100%', gap: spacing.xs }}>
      <VenueIllustration
        art={groundArtwork(track, level)}
        label={`${view} illustration. Level ${level}. Capacity level ${capacity}, matchday experience level ${experience}. The two upgrade tracks are illustrated separately.`}
      />
      <Text
        style={{ color: colors.textMuted, fontSize: fontSize.xs, paddingHorizontal: spacing.sm }}
      >
        {compact ? `${view} · Level ${level}` : `${view} view · Upgrades shown separately`}
      </Text>
    </View>
  );
}
