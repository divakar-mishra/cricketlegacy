import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText as Text } from './AppText';
import { ContractSheet } from './ContractSheet';
import { useCareer } from '../state/careerStore';
import { useContractPresentation } from '../state/contractPresentationStore';

export function ContractMomentModal({
  children,
  onContinue,
}: {
  children: ReactNode;
  onContinue: () => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onContinue}>
      <View style={styles.backdrop}>
        <View style={[styles.frame, { maxHeight: height * 0.88 }]}>
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
  const signed = useContractPresentation((s) => s.signed);
  const dismiss = useContractPresentation((s) => s.dismiss);
  const saveId = useCareer((s) => s.save?.id);
  useEffect(() => {
    if (signed && signed.saveId !== saveId) dismiss();
  }, [signed, saveId, dismiss]);
  if (!signed || signed.saveId !== saveId) return null;
  return (
    <ContractMomentModal onContinue={dismiss}>
      <ContractSheet club={signed.club} player={signed.player} offer={signed.offer} signed />
    </ContractMomentModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 12 },
  frame: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: '#24211c',
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: { paddingBottom: 12 },
  button: {
    backgroundColor: '#d8ae46',
    padding: 16,
    alignItems: 'center',
    margin: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#201b13', fontSize: 17, fontWeight: '800' },
});
