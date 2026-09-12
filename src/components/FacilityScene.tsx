import { View } from 'react-native';
import { AppText as Text } from './AppText';
import { FACILITY_ART, FacilityKind, visualLevel } from './venueVisuals';
import { fontSize, spacing, useColors } from '../theme';
import { VenueIllustration } from './VenueIllustration';
import { facilityArtwork } from './venueArtwork';

export function FacilityScene({
  kind,
  level,
  caption = true,
  levelLabel,
}: {
  kind: FacilityKind;
  level: number;
  // Retained for callers; artwork shares the stadium's fixed palette and framing.
  accent?: string;
  compact?: boolean;
  caption?: boolean;
  levelLabel?: string;
}) {
  const colors = useColors();
  const stage = visualLevel(level);
  const title = FACILITY_ART[kind][stage - 1];
  return (
    <View style={{ marginVertical: spacing.sm, gap: spacing.xs }}>
      <VenueIllustration
        art={facilityArtwork(kind, stage)}
        label={`${kind} illustration. ${levelLabel ?? `Level ${stage}`}: ${title}.`}
      />
      {caption ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.xs,
            paddingHorizontal: spacing.sm,
          }}
        >
          {levelLabel ?? `LEVEL ${stage}`} · {title}
        </Text>
      ) : null}
    </View>
  );
}
