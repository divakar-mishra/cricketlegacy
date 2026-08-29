import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES, getCountry } from '../data/countries';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { CountryFlag } from './CountryFlag';
import { GlassSurface } from './GlassSurface';
import { Icon } from './Icon';

type Props = {
  value: string | null;
  onChange: (countryId: string) => void;
  placeholder?: string;
  testID?: string;
};

/** Compact, scrollable country selector shared by both career-creation flows. */
export function CountrySelect({ value, onChange, placeholder = 'Select country', testID }: Props) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const selectedCountry = value ? getCountry(value) : undefined;
  const modalHeight = Math.max(
    1,
    Math.min(560, height - insets.top - insets.bottom - spacing.xl * 2),
  );

  const chooseCountry = (countryId: string) => {
    onChange(countryId);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Country, ${selectedCountry?.name ?? 'not selected'}`}
        accessibilityHint="Opens the country list"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        {selectedCountry ? (
          <CountryFlag countryId={selectedCountry.id} flag={selectedCountry.flag} size={24} />
        ) : (
          <Icon name="globe-outline" size={24} color={colors.textMuted} />
        )}
        <Text
          style={[styles.triggerText, !selectedCountry && styles.placeholder]}
          numberOfLines={1}
        >
          {selectedCountry?.name ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.backdrop,
            {
              paddingTop: insets.top + spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close country list"
          />
          <View style={styles.sheetFrame} accessibilityViewIsModal>
            <GlassSurface
              intensity={0.72}
              rounded={radius.lg}
              padded={false}
              style={[styles.sheet, { maxHeight: modalHeight }]}
            >
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Choose country</Text>
                <Pressable
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close country list"
                  hitSlop={8}
                  style={({ pressed }) => [styles.close, pressed && styles.pressed]}
                >
                  <Icon name="close" size={22} />
                </Pressable>
              </View>
              <FlatList
                data={COUNTRIES}
                keyExtractor={(country) => country.id}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator
                renderItem={({ item }) => {
                  const selected = item.id === value;
                  return (
                    <Pressable
                      testID={`country-option-${item.id}`}
                      onPress={() => chooseCountry(item.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={item.name}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <CountryFlag countryId={item.id} flag={item.flag} size={24} />
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {item.name}
                      </Text>
                      {selected ? (
                        <Icon name="checkmark" size={20} color={colors.primaryLight} />
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            </GlassSurface>
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    trigger: {
      minHeight: 54,
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      borderWidth: 1.5,
    },
    triggerText: {
      color: colors.text,
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
    placeholder: { color: colors.textMuted },
    pressed: { opacity: 0.72 },
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.overlay,
    },
    sheetFrame: {
      width: '100%',
      maxWidth: 480,
      flexShrink: 1,
    },
    sheet: {
      width: '100%',
      flexShrink: 1,
      overflow: 'hidden',
      backgroundColor: colors.bgElevated,
      borderColor: colors.borderStrong,
      borderWidth: 1,
    },
    sheetHeader: {
      minHeight: 58,
      alignItems: 'center',
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetTitle: {
      color: colors.text,
      flex: 1,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
    },
    close: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
    },
    list: { flexShrink: 1 },
    listContent: { padding: spacing.sm },
    option: {
      minHeight: 50,
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    optionSelected: { backgroundColor: colors.primary + '1F' },
    optionText: {
      color: colors.text,
      flex: 1,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
    },
    optionTextSelected: { color: colors.primaryLight, fontWeight: fontWeight.bold },
  });
