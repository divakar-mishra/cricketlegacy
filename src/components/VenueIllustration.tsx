import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import type { VenueArtwork } from './venueArtwork';

export function VenueIllustration({ art, label }: { art: VenueArtwork; label: string }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const failed = failedId === art.id;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}${failed ? ' Illustration unavailable.' : ''}`}
      style={styles.frame}
      testID={`venue-art-${art.id}`}
    >
      {failed ? (
        <Text style={styles.unavailable}>Illustration unavailable</Text>
      ) : (
        <Image
          key={art.id}
          source={art.source}
          resizeMode="contain"
          fadeDuration={0}
          accessible={false}
          style={styles.image}
          onError={() => setFailedId(art.id)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // This backdrop is part of the art; surrounding text follows the app theme.
  frame: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: '#243044',
    overflow: 'hidden',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  unavailable: { color: '#F5EEDC', fontSize: 13, padding: 16, textAlign: 'center' },
});
