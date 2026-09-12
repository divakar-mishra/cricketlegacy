import type { ImageSourcePropType } from 'react-native';
import { FacilityKind, GroundTrack, visualLevel } from './venueVisuals';

export interface VenueArtwork {
  id: string;
  source: ImageSourcePropType;
}

// Literal requires keep all stages offline. Independent views, not a merged stadium.
const capacity = [
  require('../../assets/venues/capacity-1.webp'),
  require('../../assets/venues/capacity-2.webp'),
  require('../../assets/venues/capacity-3.webp'),
  require('../../assets/venues/capacity-4.webp'),
  require('../../assets/venues/capacity-5.webp'),
] as const;
const experience = [
  require('../../assets/venues/experience-1.webp'),
  require('../../assets/venues/experience-2.webp'),
  require('../../assets/venues/experience-3.webp'),
  require('../../assets/venues/experience-4.webp'),
  require('../../assets/venues/experience-5.webp'),
] as const;
const academy = [
  require('../../assets/venues/academy-1.webp'),
  require('../../assets/venues/academy-2.webp'),
  require('../../assets/venues/academy-3.webp'),
  require('../../assets/venues/academy-4.webp'),
  require('../../assets/venues/academy-5.webp'),
] as const;

const training = [
  require('../../assets/venues/training-1.webp'),
  require('../../assets/venues/training-2.webp'),
  require('../../assets/venues/training-3.webp'),
  require('../../assets/venues/training-4.webp'),
  require('../../assets/venues/training-5.webp'),
] as const;
const medical = [
  require('../../assets/venues/medical-1.webp'),
  require('../../assets/venues/medical-2.webp'),
  require('../../assets/venues/medical-3.webp'),
  require('../../assets/venues/medical-4.webp'),
  require('../../assets/venues/medical-5.webp'),
] as const;
const facilities = { academy, training, medical };

export function facilityArtwork(kind: FacilityKind, level: number): VenueArtwork {
  const stage = visualLevel(level);
  return { id: `${kind}-${stage}`, source: facilities[kind][stage - 1] };
}

export function groundArtwork(track: GroundTrack, level: number): VenueArtwork {
  const stage = visualLevel(level);
  return {
    id: `${track}-${stage}`,
    source: (track === 'capacity' ? capacity : experience)[stage - 1],
  };
}

export function academyArtwork(level: number): VenueArtwork {
  const stage = visualLevel(level);
  return { id: `academy-${stage}`, source: academy[stage - 1] };
}
