import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText as Text } from './AppText';
import { roundContractCoins } from '../game/career';
import { useCareer } from '../state/careerStore';
import { useContractPresentation } from '../state/contractPresentationStore';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

export function ContractMomentModal({
  children,
  onContinue,
}: {
  children: ReactNode;
  onContinue: () => void;
}) {
  const { height } = useWindowDimensions();
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onContinue} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.frame, { maxHeight: height * 0.82 }]}>
          <ScrollView bounces={false} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onContinue} style={styles.button}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function PlayerContractMoment() {
  const styles = useThemedStyles(makeStyles);
  const signed = useContractPresentation((s) => s.signed);
  const dismiss = useContractPresentation((s) => s.dismiss);
  const saveId = useCareer((s) => s.save?.id);
  useEffect(() => {
    if (signed && signed.saveId !== saveId) dismiss();
  }, [signed, saveId, dismiss]);
  if (!signed || signed.saveId !== saveId) return null;
  return (
    <ContractMomentModal onContinue={dismiss}>
      <Text style={styles.kicker}>CONTRACT SIGNED</Text>
      <Text style={styles.title}>{signed.club}</Text>
      <Text style={styles.player}>New agreement for {signed.player}</Text>
      <View style={styles.terms}>
        <View style={styles.term}>
          <Text style={styles.termLabel}>Season salary</Text>
          <Text style={styles.termValue}>
            {roundContractCoins(signed.offer.wage).toLocaleString()} coins
          </Text>
        </View>
        <View style={styles.term}>
          <Text style={styles.termLabel}>Signing bonus</Text>
          <Text style={styles.termValue}>
            {roundContractCoins(signed.offer.signingBonus).toLocaleString()} coins
          </Text>
        </View>
        <Text style={styles.length}>
          {signed.offer.years} year{signed.offer.years === 1 ? '' : 's'}
        </Text>
      </View>
    </ContractMomentModal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  frame: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  content: { padding: spacing.lg, gap: spacing.sm },
  kicker: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.black },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black },
  player: { color: colors.textMuted, fontSize: fontSize.sm },
  terms: { marginTop: spacing.sm, gap: spacing.md },
  term: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  termLabel: { color: colors.textMuted, fontSize: fontSize.sm },
  termValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
  length: { color: colors.textMuted, fontSize: fontSize.xs },
  button: {
    backgroundColor: colors.accent,
    padding: spacing.md,
    alignItems: 'center',
    margin: spacing.md,
    borderRadius: radius.md,
  },
  buttonText: { color: colors.bg, fontSize: fontSize.md, fontWeight: fontWeight.black },
});
