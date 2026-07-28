import {
  AvatarCustomization,
  AvatarFaceShape,
  AvatarFacialHair,
  AvatarHairStyle,
  AvatarMoustache,
} from '../domain/types';

export const DEFAULT_AVATAR_CUSTOMIZATION: AvatarCustomization = {
  skinTone: '#B97850',
  faceShape: 'oval',
  hairStyle: 'short',
  hairColor: '#17130F',
  facialHair: 'none',
  moustache: 'none',
  eyeColor: '#2A1B12',
  browStyle: 'straight',
};

export const AVATAR_SKIN_TONES = [
  '#F2C7A5',
  '#DFA477',
  '#B97850',
  '#8C5439',
  '#633B2B',
  '#3F271E',
] as const;

export const AVATAR_HAIR_COLORS = ['#17130F', '#3B271D', '#70462E', '#A56A3A', '#D8C1A0'] as const;
export const AVATAR_EYE_COLORS = ['#2A1B12', '#5A3825', '#3E5638', '#314E63'] as const;

export const AVATAR_FACE_OPTIONS: { id: AvatarFaceShape; label: string }[] = [
  { id: 'oval', label: 'Oval' },
  { id: 'round', label: 'Round' },
  { id: 'angular', label: 'Angular' },
];

export const AVATAR_HAIR_OPTIONS: { id: AvatarHairStyle; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'crop', label: 'Crop' },
  { id: 'swept', label: 'Swept' },
  { id: 'curly', label: 'Curly' },
  { id: 'fade', label: 'Fade' },
  { id: 'bald', label: 'Shaved' },
];

export const AVATAR_BEARD_OPTIONS: { id: AvatarFacialHair; label: string }[] = [
  { id: 'none', label: 'Clean' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'short_beard', label: 'Short beard' },
  { id: 'full_beard', label: 'Full beard' },
];

export const AVATAR_MOUSTACHE_OPTIONS: { id: AvatarMoustache; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'classic', label: 'Classic' },
  { id: 'handlebar', label: 'Handlebar' },
];

export const AVATAR_BROW_OPTIONS: { id: AvatarCustomization['browStyle']; label: string }[] = [
  { id: 'soft', label: 'Soft' },
  { id: 'straight', label: 'Straight' },
  { id: 'bold', label: 'Bold' },
];
