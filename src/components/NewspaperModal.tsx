import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NewspaperStory } from '../domain/types';
import { EVT, logEvent } from '../services/analytics';
import { fontSize, fontWeight, spacing } from '../theme';
import { AppText as Text } from './AppText';
import { Icon } from './Icon';

interface Props {
  story: NewspaperStory | null;
  onClose: (storyId: string) => void;
}

function shareText(story: NewspaperStory): string {
  const milestone =
    story.kind === 'TROPHY'
      ? `Champions: ${(story.trophyNames ?? []).join(', ')}`
      : `${story.format} | ${story.result} | Season ${story.season}`;
  return [
    story.edition,
    story.headline,
    story.subheadline,
    milestone,
    'Cricket Legacy',
    '#CricketLegacy #Cricket',
  ].join('\n\n');
}

export function NewspaperModal({ story, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const paperRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  if (!story) return null;

  const close = () => onClose(story.id);
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    logEvent(EVT.SHARE_NEWSPAPER, {
      kind: story.kind ?? 'MATCH',
      format: story.format,
      runs: story.runs,
      trophyCount: story.trophyNames?.length ?? 0,
    });
    try {
      let sharedImage = false;
      try {
        // Kept lazy because Expo Go may not include the native capture module.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ViewShot = require('react-native-view-shot');
        const Sharing = await import('expo-sharing');
        if (!paperRef.current) throw new Error('Newspaper clipping is not ready');
        const uri = await ViewShot.captureRef(paperRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            UTI: 'public.png',
            dialogTitle: 'Share to WhatsApp or Instagram Story',
          });
          sharedImage = true;
        }
      } catch {
        // Text sharing remains available in Expo Go and unsupported environments.
      }
      if (!sharedImage) {
        await Share.share({
          title: story.headline,
          message: shareText(story),
        });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.paper,
            {
              width: Math.min(width - spacing.lg * 2, 620),
              maxHeight: Math.min(height - spacing.xl * 2, 760),
            },
          ]}
        >
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close newspaper story"
              onPress={close}
              style={styles.iconButton}
            >
              <Icon name="close" size={23} color="#33291d" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View ref={paperRef} collapsable={false} style={styles.shareSurface}>
              <Text style={styles.edition}>{story.edition}</Text>
              <View style={styles.rule} />
              <Text style={styles.kicker}>{story.kicker}</Text>
              <Text style={styles.headline}>{story.headline}</Text>
              <Text style={styles.subheadline}>{story.subheadline}</Text>

              <View style={styles.scoreline}>
                {story.kind === 'TROPHY' ? (
                  (story.trophyNames ?? ['Champions']).map((trophy) => (
                    <Text key={trophy} style={styles.trophy}>
                      {trophy.toUpperCase()}
                    </Text>
                  ))
                ) : story.kind === 'ELIMINATION' ? (
                  <>
                    <Text style={styles.trophy}>TOURNAMENT EXIT</Text>
                    <Text style={styles.score}>{story.format}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.score}>
                      {story.runs} ({story.balls})
                    </Text>
                    <Text style={styles.score}>{story.wickets} WKT</Text>
                    <Text style={styles.score}>{story.format}</Text>
                  </>
                )}
              </View>

              <Text style={styles.body}>{story.body}</Text>
              <View style={styles.footerRule} />
              <Text style={styles.footer}>
                {story.kind === 'TROPHY'
                  ? `CHAMPIONS | SEASON ${story.season}`
                  : story.kind === 'ELIMINATION'
                    ? `${story.opponentName.toUpperCase()} | GROUP STAGE | SEASON ${story.season}`
                    : `${story.opponentName.toUpperCase()} | ${story.result} | SEASON ${story.season}`}
              </Text>
              <Text style={styles.brand}>CRICKET LEGACY</Text>
            </View>
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share to WhatsApp or Instagram Story"
            disabled={sharing}
            onPress={() => void share()}
            style={({ pressed }) => [
              styles.shareButton,
              (pressed || sharing) && styles.shareButtonPressed,
            ]}
          >
            <Icon
              name={sharing ? 'hourglass-outline' : 'share-social-outline'}
              size={21}
              color="#ffffff"
            />
            <Text style={styles.shareButtonText}>
              {sharing ? 'Preparing clipping...' : 'Share to WhatsApp / Instagram Story'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(8, 10, 12, 0.82)',
  },
  paper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#8b7657',
    borderRadius: 6,
    backgroundColor: '#eee1bd',
  },
  toolbar: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#aa9875',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  scrollContent: {
    backgroundColor: '#eee1bd',
  },
  shareSurface: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: '#eee1bd',
  },
  edition: {
    color: '#33291d',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  rule: {
    height: 3,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#33291d',
  },
  kicker: {
    color: '#7a271d',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  headline: {
    marginTop: spacing.sm,
    color: '#211b14',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
  subheadline: {
    marginTop: spacing.md,
    color: '#443728',
    fontSize: fontSize.md,
    lineHeight: 23,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  scoreline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#8b7657',
  },
  score: {
    color: '#33291d',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  trophy: {
    maxWidth: '100%',
    color: '#7a271d',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
  body: {
    color: '#33291d',
    fontSize: fontSize.md,
    lineHeight: 25,
  },
  footerRule: {
    height: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: '#8b7657',
  },
  footer: {
    color: '#5a4935',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  brand: {
    marginTop: spacing.sm,
    color: '#7a271d',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
  shareButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#176b3a',
  },
  shareButtonPressed: {
    opacity: 0.78,
  },
  shareButtonText: {
    flexShrink: 1,
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
});
