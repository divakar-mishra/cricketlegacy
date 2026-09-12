import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { kitBackArtwork, kitThumbnailArtwork } from '../avatar/layeredPortraits';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  isCanonicalSponsorBrandId,
  SPONSOR_LOCKUP_BACKGROUND,
  SPONSOR_BRANDS,
  type SponsorBrandDefinition,
} from '../game/sponsorBrands';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import type { LargeAvatarBrandingLayout } from './sponsorAvatarLayout';
import { KitDesignLayer } from './KitDesign';

export interface SponsorBrandRef {
  brandId?: string;
  brandName?: string;
}

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function mixHex(color: string, target: string, amount: number): string {
  const parse = (value: string) => {
    const normalized = value.replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return [0, 0, 0];
    return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
  };
  const source = parse(color);
  const destination = parse(target);
  return `#${source
    .map((channel, index) =>
      Math.round(channel + (destination[index] - channel) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function resolveBrand(brand?: SponsorBrandRef): SponsorBrandDefinition | undefined {
  if (!brand) return undefined;
  if (isCanonicalSponsorBrandId(brand.brandId)) return SPONSOR_BRANDS[brand.brandId];
  const name = brand.brandName?.trim();
  if (!name) return undefined;
  return {
    id: 'boundary_works',
    name,
    shortName: initials(name) || 'KP',
    primary: '#D5B56D',
    secondary: '#FFF2C7',
    onPrimary: '#161208',
    generic: true,
  };
}

function BrandGlyph({
  brand,
  size,
  monochrome,
}: {
  brand: SponsorBrandDefinition;
  size: number;
  monochrome?: string;
}) {
  const primary = monochrome ?? brand.primary;
  const secondary = monochrome ?? brand.secondary;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {brand.generic ? (
        <>
          <Circle cx="24" cy="24" r="15" fill="none" stroke={primary} strokeWidth="4" />
          <Path d="M13 29 24 15l11 14" fill="none" stroke={secondary} strokeWidth="3" />
        </>
      ) : brand.id === 'boundary_works' ? (
        <>
          <Circle cx="24" cy="24" r="15" fill="none" stroke={primary} strokeWidth="5" />
          <Path d="M7 27h34M11 17h26" stroke={secondary} strokeWidth="3" strokeLinecap="round" />
          <Circle cx="24" cy="24" r="3.5" fill={primary} />
        </>
      ) : brand.id === 'pulse_xi' ? (
        <>
          <Path
            d="M5 25h8l4-10 7 20 6-15 4 5h9"
            fill="none"
            stroke={primary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
          <Line x1="8" y1="37" x2="40" y2="37" stroke={secondary} strokeWidth="2.5" />
        </>
      ) : brand.id === 'longform' ? (
        <>
          <Path
            d="M8 10c8 0 13 2 16 6v25c-3-4-8-6-16-6V10Zm32 0c-8 0-13 2-16 6v25c3-4 8-6 16-6V10Z"
            fill="none"
            stroke={primary}
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
          <Line x1="15" y1="19" x2="21" y2="21" stroke={secondary} strokeWidth="2.5" />
          <Line x1="27" y1="21" x2="33" y2="19" stroke={secondary} strokeWidth="2.5" />
        </>
      ) : brand.id === 'legacy_crown' ? (
        <>
          <Path
            d="M7 15l9 8 8-13 8 13 9-8-4 23H11L7 15Z"
            fill={primary}
            stroke={secondary}
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <Rect x="13" y="32" width="22" height="5" rx="2" fill={secondary} />
        </>
      ) : null}
    </Svg>
  );
}

export function SponsorLogo({
  brand: brandRef,
  variant = 'lockup',
  size = 36,
  style,
  label,
}: {
  brand?: SponsorBrandRef;
  variant?: 'lockup' | 'badge' | 'print';
  size?: number;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const brand = resolveBrand(brandRef);
  if (!brand) return null;
  const badge = variant === 'badge';
  const print = variant === 'print';
  const compact = !badge && !print && size <= 28;
  const glyphSize = badge ? Math.max(6, size * 0.7) : Math.max(12, size * 0.74);
  const a11yLabel = label ?? `${brand.name} sponsor`;
  const visibleName = print && size < 28 ? brand.shortName : brand.name;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={[
        styles.logo,
        badge && styles.logoBadge,
        print && styles.logoPrint,
        compact && styles.logoCompact,
        badge && { width: size, height: size, borderRadius: size / 2 },
        {
          backgroundColor: print ? 'transparent' : SPONSOR_LOCKUP_BACKGROUND,
          borderColor: print ? 'transparent' : brand.primary,
        },
        style,
      ]}
      testID={`sponsor-logo-${brand.id}`}
    >
      <BrandGlyph brand={brand} size={glyphSize} monochrome={print ? brand.secondary : undefined} />
      {!badge ? (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[
            styles.logoName,
            print && styles.logoNamePrint,
            compact && styles.logoNameCompact,
            { color: brand.secondary },
          ]}
        >
          {visibleName}
        </Text>
      ) : null}
    </View>
  );
}

/** Earned and permanent marks are deliberately rendered as separate slots. */
export function SponsorBrandRow({
  earned,
  premium,
  compact = false,
  style,
}: {
  earned?: SponsorBrandRef;
  premium?: SponsorBrandRef;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!earned && !premium) return null;
  return (
    <View
      style={[styles.brandRow, compact && styles.brandRowCompact, style]}
      accessibilityLabel="Visible kit sponsors"
    >
      {earned ? <SponsorLogo brand={earned} size={compact ? 28 : 36} /> : null}
      {premium ? <SponsorLogo brand={premium} size={compact ? 28 : 36} /> : null}
    </View>
  );
}

/** Lower-edge marks for compact avatars; the right side stays clear for role. */
export function AvatarSponsorBadges({
  earned,
  premium,
  avatarSize,
  reserveRoleSpace = false,
}: {
  earned?: SponsorBrandRef;
  premium?: SponsorBrandRef;
  avatarSize: number;
  reserveRoleSpace?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!earned && !premium) return null;
  const sponsorCount = Number(Boolean(earned)) + Number(Boolean(premium));
  const roleSpace = reserveRoleSpace ? Math.max(18, Math.round(avatarSize * 0.34)) : 0;
  const availableWidth = Math.max(8, avatarSize - 4 - roleSpace);
  const fittedSize = Math.floor((availableWidth - (sponsorCount - 1) * 2) / sponsorCount);
  const badgeSize = Math.max(8, Math.min(20, Math.round(avatarSize * 0.25), fittedSize));
  return (
    <View
      pointerEvents="none"
      style={[styles.avatarBadges, reserveRoleSpace && { right: roleSpace }]}
    >
      {earned ? (
        <SponsorLogo
          brand={earned}
          variant="badge"
          size={badgeSize}
          label={`${resolveBrand(earned)?.name ?? 'Earned'} shirt sponsor`}
        />
      ) : null}
      {premium ? (
        <SponsorLogo
          brand={premium}
          variant="badge"
          size={badgeSize}
          label={`${resolveBrand(premium)?.name ?? 'Premium'} premium shirt sponsor`}
        />
      ) : null}
    </View>
  );
}

/** Subtle chest printing used only as a dynamic overlay above large portraits. */
export function PortraitSponsorPrint({
  earned,
  premium,
  layout,
}: {
  earned?: SponsorBrandRef;
  premium?: SponsorBrandRef;
  layout: LargeAvatarBrandingLayout;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!earned && !premium) return null;
  return (
    <View pointerEvents="none" style={styles.portraitPrintLayer}>
      {earned ? (
        <SponsorLogo
          brand={earned}
          variant="print"
          size={layout.earned?.height ?? 18}
          style={[
            styles.portraitEarnedPrint,
            layout.earned && {
              left: layout.earned.x,
              top: layout.earned.y,
              width: layout.earned.width,
              height: layout.earned.height,
            },
          ]}
          label={`${resolveBrand(earned)?.name ?? 'Earned'} printed shirt sponsor`}
        />
      ) : null}
      {premium ? (
        <SponsorLogo
          brand={premium}
          variant="badge"
          size={layout.premium?.width ?? 17}
          style={[
            styles.portraitPremiumPrint,
            layout.premium && {
              left: layout.premium.x,
              top: layout.premium.y,
            },
          ]}
          label={`${resolveBrand(premium)?.name ?? 'Premium'} secondary shirt sponsor`}
        />
      ) : null}
    </View>
  );
}

export function SponsoredKitPreview({
  kitColor,
  kitId,
  earned,
  premium,
  side = 'front',
  shirtName = 'PLAYER',
  shirtNumber = 7,
  style,
}: {
  kitColor: string;
  kitId?: string;
  earned?: SponsorBrandRef;
  premium?: SponsorBrandRef;
  side?: 'front' | 'back';
  shirtName?: string;
  shirtNumber?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  const sponsorNames = [resolveBrand(earned)?.name, resolveBrand(premium)?.name].filter(Boolean);
  const shade = mixHex(kitColor, '#05080F', 0.42);
  const panel = mixHex(kitColor, '#05080F', 0.62);
  const highlight = mixHex(kitColor, '#FFFFFF', 0.18);
  const artwork = side === 'front' ? kitThumbnailArtwork(kitId) : kitBackArtwork(kitId);
  const printColor = kitId === 'kit_white' ? '#1A2534' : '#F1E6C8';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${side === 'front' ? 'Front' : 'Back'} kit preview${sponsorNames.length ? ` with ${sponsorNames.join(' and ')}` : ''}${side === 'back' ? `, ${shirtName}, number ${shirtNumber}` : ''}`}
      style={[styles.kitPreview, style]}
      testID="sponsored-kit-preview"
    >
      {artwork ? <Image source={artwork} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityElementsHidden importantForAccessibility="no" /> : <Svg
        width="100%"
        height="100%"
        viewBox="0 0 320 260"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Defs>
          <SvgLinearGradient id="kit-background" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A2231" />
            <Stop offset="1" stopColor="#090D14" />
          </SvgLinearGradient>
          <SvgLinearGradient id="kit-body" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={highlight} />
            <Stop offset="0.48" stopColor={kitColor} />
            <Stop offset="1" stopColor={shade} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="320" height="260" fill="url(#kit-background)" />
        <Ellipse cx="160" cy="235" rx="104" ry="12" fill="#000000" opacity="0.42" />
        <Path
          d="M110 34 73 49 28 92l29 38 29-23v119h148V107l29 23 29-38-45-43-37-15c-8 17-25 26-50 26s-42-9-50-26Z"
          fill="url(#kit-body)"
          stroke="#D8B65E"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <Path
          d="M110 34c8 17 25 26 50 26s42-9 50-26l-18-7c-7 11-17 16-32 16s-25-5-32-16l-18 7Z"
          fill={panel}
          stroke="#E6C66D"
          strokeWidth="2.5"
        />
        <Path d="M73 49 98 69v157H86V107l-29 23-29-38Z" fill={panel} opacity="0.82" />
        <Path d="M247 49 222 69v157h12V107l29 23 29-38Z" fill={panel} opacity="0.82" />
        <Path d="M31 91 58 126M289 91l-27 35" stroke="#E6C66D" strokeWidth="5" />
        <KitDesignLayer kitId={kitId} />
        <Path d="M99 202h122" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="1.5" />
        <Path d="M100 70 221 190" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="18" />
        <Path d="M102 224h116" stroke="#E6C66D" strokeWidth="3" strokeLinecap="round" />
        {side === 'front' ? (
          <>
            <Path
              d="M112 76h18v21h-18c-5-6-5-15 0-21Z"
              fill="#111722"
              stroke="#E6C66D"
              strokeWidth="1.5"
            />
            <Circle cx="121" cy="86" r="4" fill="#E6C66D" />
            <Path d="M151 73h18" stroke="#FFFFFF" strokeOpacity="0.24" strokeWidth="2" />
          </>
        ) : (
          <Path d="M115 76h90" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="2" />
        )}
      </Svg>}
      {side === 'front' && earned ? (
        <SponsorLogo
          brand={earned}
          variant="print"
          size={34}
          style={styles.kitPrimarySponsor}
          label={`${resolveBrand(earned)?.name ?? 'Earned'} centre-chest sponsor`}
        />
      ) : null}
      {side === 'front' && premium ? (
        <SponsorLogo
          brand={premium}
          variant="badge"
          size={26}
          style={styles.kitPremiumSponsor}
          label={`${resolveBrand(premium)?.name ?? 'Premium'} secondary chest sponsor`}
        />
      ) : null}
      {side === 'back' ? (
        <View pointerEvents="none" style={[styles.kitBackPrint, artwork ? styles.texturedBackPrint : undefined]}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kitBackName, { color: printColor }]}>
            {shirtName}
          </Text>
          <Text style={[styles.kitBackNumber, { color: printColor }]}>{shirtNumber}</Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    logo: {
      minWidth: 112,
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: SPONSOR_LOCKUP_BACKGROUND,
      backgroundColor: SPONSOR_LOCKUP_BACKGROUND,
    },
    logoBadge: {
      minWidth: 0,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderColor: SPONSOR_LOCKUP_BACKGROUND,
      backgroundColor: SPONSOR_LOCKUP_BACKGROUND,
      overflow: 'hidden',
    },
    logoCompact: { minWidth: 82, minHeight: 28, paddingHorizontal: 5, paddingVertical: 2 },
    logoPrint: {
      minWidth: 0,
      minHeight: 0,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderWidth: 0,
      borderRadius: 3,
      backgroundColor: SPONSOR_LOCKUP_BACKGROUND,
    },
    logoName: {
      flexShrink: 1,
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 0.2,
    },
    logoNamePrint: { fontSize: 8, letterSpacing: 0.1 },
    logoNameCompact: { fontSize: 9 },
    brandRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    brandRowCompact: { gap: 5 },
    avatarBadges: {
      position: 'absolute',
      left: 2,
      right: 2,
      bottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      overflow: 'hidden',
      zIndex: 4,
    },
    portraitPrintLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
      zIndex: 3,
    },
    portraitEarnedPrint: { position: 'absolute' },
    portraitPremiumPrint: { position: 'absolute' },
    kitPreview: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
      aspectRatio: 320 / 260,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: radius.xl,
      backgroundColor: '#090D14',
      borderWidth: 1,
      borderColor: '#39445A',
    },
    kitPrimarySponsor: {
      position: 'absolute',
      left: '31%',
      right: '31%',
      top: '45%',
    },
    kitPremiumSponsor: { position: 'absolute', right: '29%', top: '31%' },
    kitBackPrint: {
      position: 'absolute',
      left: '29%',
      right: '29%',
      top: '29%',
      alignItems: 'center',
    },
    kitBackName: {
      width: '100%',
      color: '#F6E8BC',
      fontSize: fontSize.sm,
      lineHeight: 19,
      fontWeight: fontWeight.black,
      letterSpacing: 1.7,
      textAlign: 'center',
      opacity: 0.93,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 0.5 },
      textShadowRadius: 0.5,
    },
    kitBackNumber: {
      color: '#FFFFFF',
      fontSize: 64,
      lineHeight: 70,
      fontWeight: fontWeight.black,
      opacity: 0.93,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 0.5 },
      textShadowRadius: 0.5,
    },
    texturedBackPrint: { top: '26%', left: '32%', right: '32%' },
  });
