import { Image, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

export type AwardArtworkKind = 'cup' | 'bat' | 'ball' | 'silver' | 'bronze';
const AWARD_ART = {
  cup: require('../../assets/awards/cup.webp'),
  bat: require('../../assets/awards/bat.webp'),
  ball: require('../../assets/awards/ball.webp'),
};

export function AwardArtwork({ kind, size = 144 }: { kind: AwardArtworkKind; size?: number }) {
  if (kind === 'silver' || kind === 'bronze') {
    const metal = kind === 'silver' ? '#CCD6DF' : '#BE8658';
    return <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden>
      <Path d="M25 7H43L59 44 44 55Z" fill="#812A36" />
      <Path d="M57 7H75L56 55 41 44Z" fill="#BD4550" />
      <Circle cx="50" cy="61" r="29" fill="#131925" stroke={metal} strokeWidth="4" />
      <Circle cx="50" cy="61" r="24" fill={metal} />
      <Circle cx="50" cy="61" r="20" fill="none" stroke="#45515C" strokeOpacity=".4" />
      <SvgText x="50" y="71" fill="#28303B" fontSize="30" fontWeight="bold" textAnchor="middle">{kind === 'silver' ? '2' : '3'}</SvgText>
    </Svg>;
  }
  return <Image source={AWARD_ART[kind]} style={[styles.art, { width: size, height: size }]}
    resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no" testID={`award-art-${kind}`} />;
}
const styles = StyleSheet.create({ art: { borderRadius: 16 } });
