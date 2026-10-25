import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readInputDiagnosticsDisplay, subscribeInputDiagnostics } from './inputDiagnostics';

// Passive, layout-free badge. It never becomes a responder or masks controls.
export function InputDiagnosticsBadge() {
  const label = useSyncExternalStore(subscribeInputDiagnostics, readInputDiagnosticsDisplay, () => '');
  const insets = useSafeAreaInsets();
  if (!label) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 2,
      alignSelf: 'center', maxWidth: '94%', zIndex: 10000, paddingHorizontal: 5,
      backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 4 }}>
      <Text pointerEvents="none" style={{ color: '#FFFFFF', fontSize: 9, lineHeight: 13 }}>{label}</Text>
    </View>
  );
}
