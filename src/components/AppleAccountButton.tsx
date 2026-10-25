import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

/** Apple-branded web OAuth entry. Credentials stay in ASWebAuthenticationSession. */
export function AppleAccountButton({ onPress, disabled = false, loading = false }: {
  onPress: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.content}>
        <Ionicons name="logo-apple" color="#FFFFFF" size={22} />
        <Text style={styles.label}>Continue with Apple</Text>
      </View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, width: '100%', backgroundColor: '#000000', borderRadius: 8,
    borderColor: '#FFFFFF', borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12 },
  label: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
