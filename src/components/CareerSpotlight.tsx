import { ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';
import { fonts, fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';

type Props = {
  mode: 'player' | 'manager';
  title: string;
  meta: string;
  accentColor: string;
  status?: string;
};

export function CareerSpotlight({ mode, title, meta, accentColor, status }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const compact = width < 390;

  return (
    <View
      style={[styles.frame, compact && styles.frameCompact]}
      accessibilityRole="header"
    >
      <ImageBackground
        source={require('../../assets/generated/career-stadium.png')}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageContent}
        accessibilityLabel={
          mode === 'manager'
            ? 'Floodlit cricket stadium viewed from the manager dugout'
            : 'Floodlit cricket stadium with a player walking to the crease'
        }
      >
        <View style={styles.dim} />

        <View style={[styles.topRow, compact && styles.topRowCompact]}>
          <View style={[styles.modeChip, { borderColor: accentColor }]}>
            <View style={[styles.liveDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.modeText, { color: accentColor }]}>
              {mode === 'manager' ? 'MANAGER CAREER' : 'PLAYER CAREER'}
            </Text>
          </View>
          {status ? (
            <View style={[styles.statusChip, compact && styles.statusChipCompact]}>
              <Text style={styles.statusText} numberOfLines={1}>
                {status}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.copy}>
          <View style={[styles.accentRule, { backgroundColor: accentColor }]} />
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {meta}
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    frame: {
      height: 190,
      marginHorizontal: -spacing.md,
      marginTop: spacing.sm,
      overflow: 'hidden',
    },
    frameCompact: { height: 214 },
    image: {
      flex: 1,
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    imageContent: { opacity: 0.96 },
    dim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(1,5,10,0.42)',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.md,
    },
    topRowCompact: { alignItems: 'flex-start' },
    modeChip: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      backgroundColor: 'rgba(4,8,12,0.78)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    modeText: {
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
    },
    statusChip: {
      maxWidth: '48%',
      minHeight: 28,
      justifyContent: 'center',
      backgroundColor: 'rgba(4,8,12,0.78)',
      borderColor: 'rgba(255,255,255,0.22)',
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    statusChipCompact: {
      width: '100%',
      maxWidth: '100%',
      alignItems: 'flex-start',
    },
    statusText: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textAlign: 'left',
    },
    copy: {
      backgroundColor: 'rgba(2,5,9,0.78)',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.md,
    },
    accentRule: { width: 42, height: 3, marginBottom: spacing.sm },
    title: {
      color: colors.white,
      fontFamily: fonts.display,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      lineHeight: 28,
    },
    meta: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: 4,
    },
  });
