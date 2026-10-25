import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AppState, Platform } from 'react-native';
import { hasSeenPlayRatingPrompt } from '../services/storeReview';
import { OtherGamesPrompt } from './OtherGamesPrompt';
import { PlayRatingPrompt } from './PlayRatingPrompt';

function ForegroundHubPrompts({ eligible }: { eligible: boolean }) {
  const [ratingSeenAtEntry, setRatingSeenAtEntry] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Read BEFORE enabling the rating ask. A first rating invitation and the
    // campaign never become two back-to-back asks during the same Home visit.
    void hasSeenPlayRatingPrompt().then(seen => { if (!cancelled) setRatingSeenAtEntry(seen); });
    return () => { cancelled = true; };
  }, []);
  return <>
    <PlayRatingPrompt eligible={eligible && ratingSeenAtEntry !== null} />
    <OtherGamesPrompt eligible={eligible && ratingSeenAtEntry === true} />
  </>;
}

/** Share Home-only overlay gates, preserve iOS rating behavior, and refresh the
 * campaign on a later visit/foreground rather than polling every game screen.
 */
function AndroidHubPrompts({ eligible }: { eligible: boolean }) {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  return focused && active ? <ForegroundHubPrompts eligible={eligible} /> : null;
}

export function HubEngagementPrompts({ eligible }: { eligible: boolean }) {
  // Leave Apple's existing system-review component and lifecycle unchanged.
  return Platform.OS === 'android'
    ? <AndroidHubPrompts eligible={eligible} />
    : <PlayRatingPrompt eligible={eligible} />;
}
