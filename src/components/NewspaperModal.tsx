import { useEffect, useRef, useState } from 'react';
import {
  Image,
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
import {
  newspaperArticleBody,
  newspaperArticleLabel,
  newspaperDeskLabel,
  newspaperEditionDetail,
  newspaperFooter,
  newspaperScorePanel,
} from './newspaperPresentation';

interface Props {
  story: NewspaperStory | null;
  onClose: (storyId: string) => void;
}

const GAME_LOGO = require('../../assets/icon.png');

function shareText(story: NewspaperStory): string {
  const detail =
    story.kind === 'TROPHY'
      ? `Champions: ${(story.trophyNames ?? []).join(', ')}`
      : story.kind === 'PROMOTION'
        ? `${story.promotionFrom ?? 'Career'} → ${story.promotionTo ?? story.opponentName}`
        : story.kind === 'ELIMINATION' || story.kind === 'MILESTONE'
          ? `${story.competitionName ?? story.opponentName} | Season ${story.season}`
          : `${story.format} | ${story.result} | Season ${story.season}`;
  return [
    'CRICKET LEGACY',
    story.headline,
    story.subheadline,
    detail,
    '#CricketLegacy #Cricket',
  ].join('\n\n');
}

export function NewspaperModal({ story, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const paperRef = useRef<View>(null);
  const closingStoryRef = useRef<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [dismissedStoryId, setDismissedStoryId] = useState<string | null>(null);

  useEffect(() => {
    if (!story) {
      closingStoryRef.current = null;
      setDismissedStoryId(null);
    } else if (story.id !== closingStoryRef.current) {
      setDismissedStoryId(null);
    }
  }, [story]);

  if (!story || dismissedStoryId === story.id) return null;

  const compact = width < 390;
  const narrow = width < 350;
  const scorePanel = newspaperScorePanel(story);
  const close = () => {
    if (closingStoryRef.current === story.id) return;
    closingStoryRef.current = story.id;
    // Hide locally before persistence or parent state can rerender the pending story.
    setDismissedStoryId(story.id);
    onClose(story.id);
  };

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
        // Lazy loading preserves the text fallback on unsupported native builds.
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
            dialogTitle: 'Share newspaper clipping',
          });
          sharedImage = true;
        }
      } catch {
        // Text sharing remains available in Expo Go and unsupported environments.
      }
      if (!sharedImage) {
        await Share.share({ title: story.headline, message: shareText(story) });
      }
    } finally {
      setSharing(false);
    }
  };

  const horizontalInset = narrow ? spacing.sm : spacing.md;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <Pressable
        accessible={false}
        onPress={close}
        style={[styles.backdrop, { padding: horizontalInset }]}
      >
        <Pressable
          accessible={false}
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.paper,
            {
              width: Math.min(width - horizontalInset * 2, 620),
              maxHeight: Math.min(height - spacing.md * 2, 820),
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View ref={paperRef} collapsable={false} style={styles.shareSurface}>
              <View style={[styles.masthead, compact && styles.mastheadCompact]}>
                <Image
                  accessible
                  accessibilityLabel="Cricket Legacy game logo"
                  source={GAME_LOGO}
                  fadeDuration={0}
                  style={[styles.gameLogo, compact && styles.gameLogoCompact]}
                />
                <View style={styles.mastheadCopy}>
                  <Text style={[styles.gameName, compact && styles.gameNameCompact]}>
                    CRICKET LEGACY
                  </Text>
                  <Text style={[styles.publicationName, narrow && styles.publicationNameNarrow]}>
                    THE CRICKET CHRONICLE
                  </Text>
                  <Text style={styles.tagline}>YOUR CAREER · YOUR STORY · YOUR LEGACY</Text>
                </View>
              </View>

              <View style={[styles.articlePaper, compact && styles.articlePaperCompact]}>
                <View style={styles.doubleRule} />
                <View style={styles.editionRow}>
                  <Text numberOfLines={2} style={styles.editionLeft}>
                    {(story.teamName ?? story.venueName ?? 'CAREER').toUpperCase()} EDITION
                  </Text>
                  <Text style={styles.editionRight}>
                    {newspaperEditionDetail(story)} · {story.format}
                  </Text>
                </View>

                <View style={styles.kickerRow}>
                  <View style={styles.kickerRule} />
                  <Text style={styles.kicker}>{story.kicker}</Text>
                  <View style={styles.kickerRule} />
                </View>

                <Text style={[styles.headline, compact && styles.headlineCompact]}>
                  {story.headline}
                </Text>
                <View style={styles.deck}>
                  <Text style={[styles.subheadline, narrow && styles.subheadlineNarrow]}>
                    {story.subheadline}
                  </Text>
                  <Text style={styles.deskLine}>
                    {newspaperDeskLabel(story)} · THE CHRONICLE DESK
                  </Text>
                </View>

                <View style={styles.editorialVisual}>
                  <Image
                    source={require('../../assets/generated/career-stadium.png')}
                    style={styles.editorialImage}
                    resizeMode="cover"
                    accessible={false}
                    fadeDuration={0}
                  />
                  <View style={styles.visualCaption}>
                    <Text style={styles.visualSubject}>{story.playerName}</Text>
                    <Text style={styles.visualEdition}>
                      {story.kicker} · {story.format}
                    </Text>
                  </View>
                </View>
                <Text style={styles.illustrationCredit}>
                  CRICKET LEGACY · EDITORIAL ILLUSTRATION
                </Text>

                {scorePanel ? (
                  <View style={[styles.scorePanel, compact && styles.scorePanelCompact]}>
                    <View style={styles.scoreTeams}>
                      <View style={styles.scoreCell}>
                        <Text numberOfLines={2} style={styles.scoreTeamName}>
                          {scorePanel.teamName.toUpperCase()}
                        </Text>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.scoreValue}>
                          {scorePanel.teamScore}
                        </Text>
                      </View>
                      <View style={[styles.scoreCell, styles.scoreCellDivider]}>
                        <Text numberOfLines={2} style={styles.scoreTeamName}>
                          {scorePanel.opponentName.toUpperCase()}
                        </Text>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.scoreValue}>
                          {scorePanel.opponentScore}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.resultCell, compact && styles.resultCellCompact]}>
                      <Text style={styles.resultLabel}>RESULT</Text>
                      <Text style={styles.resultValue}>{scorePanel.resultLine.toUpperCase()}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.articleBody}>
                  <View style={styles.articleAccent} />
                  <View style={styles.articleCopy}>
                    <Text style={styles.articleLabel}>{newspaperArticleLabel(story)}</Text>
                    <Text style={[styles.body, narrow && styles.bodyNarrow]}>
                      {newspaperArticleBody(story)}
                    </Text>
                  </View>
                </View>

                <View style={styles.footerRule} />
                <View style={styles.footerRow}>
                  <Text style={styles.archiveLabel}>ARCHIVED TO CAREER SCRAPBOOK</Text>
                  <Text style={styles.footer}>{newspaperFooter(story)}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close newspaper story"
            onPress={close}
            hitSlop={20}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            <Icon name="close" size={30} color="#ffffff" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share newspaper clipping"
            disabled={sharing}
            onPress={() => void share()}
            style={({ pressed }) => [
              styles.shareButton,
              (pressed || sharing) && styles.shareButtonPressed,
            ]}
          >
            <View style={styles.shareIcon}>
              <Icon
                name={sharing ? 'hourglass-outline' : 'share-social-outline'}
                size={22}
                color="#ffffff"
              />
            </View>
            <Text style={styles.shareButtonText}>
              {sharing ? 'Preparing clipping...' : 'Share newspaper clipping'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  editorialVisual: {
    marginTop: 16,
    backgroundColor: '#172820',
    borderWidth: 1,
    borderColor: '#b09b71',
  },
  editorialImage: { width: '100%', height: 150 },
  visualCaption: { padding: 12, borderTopWidth: 3, borderColor: '#b69548' },
  visualSubject: { color: '#fff7e7', fontSize: 23, fontFamily: 'serif', fontWeight: '800' },
  visualEdition: { color: '#ead9af', fontSize: 11, marginTop: 4, letterSpacing: 0.6 },
  illustrationCredit: { color: '#685742', fontSize: 8, marginTop: 4, letterSpacing: 0.6 },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 7, 12, 0.9)',
  },
  paper: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#9a8154',
    borderRadius: 10,
    backgroundColor: '#f4e7c3',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.42,
    shadowRadius: 24,
    elevation: 20,
  },
  scroll: { flexShrink: 1 },
  scrollContent: { backgroundColor: '#f4e7c3' },
  shareSurface: { backgroundColor: '#f4e7c3' },
  masthead: {
    minHeight: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingLeft: spacing.xl,
    paddingRight: 72,
    paddingVertical: spacing.xl,
    backgroundColor: '#0d4634',
  },
  mastheadCompact: {
    minHeight: 124,
    gap: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: 60,
    paddingVertical: spacing.lg,
  },
  gameLogo: {
    width: 68,
    height: 68,
    flexShrink: 0,
    borderRadius: 8,
  },
  gameLogoCompact: { width: 52, height: 52, borderRadius: 6 },
  mastheadCopy: { flex: 1, alignItems: 'center' },
  gameName: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 35,
    fontWeight: fontWeight.black,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  gameNameCompact: { fontSize: 23, lineHeight: 28 },
  publicationName: {
    marginTop: 4,
    color: '#ead9af',
    fontFamily: 'serif',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: fontWeight.black,
    letterSpacing: 2.1,
    textAlign: 'center',
  },
  publicationNameNarrow: { fontSize: 11, lineHeight: 15, letterSpacing: 1.2 },
  tagline: {
    marginTop: 5,
    color: '#c8d4cc',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 4,
    elevation: 30,
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  closeButtonPressed: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  articlePaper: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 38,
    backgroundColor: '#f4e7c3',
  },
  articlePaperCompact: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  doubleRule: {
    height: 7,
    marginTop: 0,
    borderTopWidth: 2,
    borderBottomWidth: 1,
    borderColor: '#5f503b',
  },
  editionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  editionLeft: {
    flex: 1,
    color: '#685742',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: fontWeight.black,
    letterSpacing: 1,
  },
  editionRight: {
    flexShrink: 0,
    color: '#685742',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: fontWeight.black,
    letterSpacing: 0.8,
    textAlign: 'right',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  kickerRule: { flex: 1, height: 1, backgroundColor: '#b09b71' },
  kicker: {
    maxWidth: '70%',
    color: '#8b3028',
    fontSize: fontSize.xs,
    lineHeight: 16,
    fontWeight: fontWeight.black,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  headline: {
    marginTop: spacing.lg,
    color: '#231b12',
    fontFamily: 'serif',
    fontSize: 39,
    lineHeight: 42,
    fontWeight: fontWeight.black,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  headlineCompact: { fontSize: 30, lineHeight: 34, letterSpacing: -0.4 },
  deck: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#8b3028',
    borderRadius: 3,
    backgroundColor: '#ead9ad',
  },
  subheadline: {
    color: '#443728',
    fontSize: fontSize.md,
    lineHeight: 24,
    fontWeight: fontWeight.bold,
  },
  subheadlineNarrow: { fontSize: fontSize.sm, lineHeight: 21 },
  deskLine: {
    marginTop: spacing.sm,
    color: '#796a53',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: fontWeight.black,
    letterSpacing: 0.9,
  },
  scorePanel: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: '#b09b71',
    backgroundColor: '#e8d7aa',
  },
  scorePanelCompact: { flexDirection: 'column' },
  scoreTeams: { flex: 2, flexDirection: 'row' },
  scoreCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
  },
  scoreCellDivider: { borderLeftWidth: 1, borderLeftColor: '#c1ad82' },
  scoreTeamName: {
    minHeight: 28,
    color: '#7a684f',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: fontWeight.black,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  scoreValue: {
    width: '100%',
    marginTop: spacing.sm,
    color: '#231b12',
    fontFamily: 'serif',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
  resultCell: {
    flex: 1,
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: '#c1ad82',
  },
  resultCellCompact: {
    minWidth: 0,
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#c1ad82',
  },
  resultLabel: {
    color: '#7a684f',
    fontSize: 9,
    fontWeight: fontWeight.black,
    letterSpacing: 1,
  },
  resultValue: {
    marginTop: spacing.sm,
    color: '#15533d',
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
  articleBody: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  articleAccent: { width: 4, backgroundColor: '#15533d' },
  articleCopy: { flex: 1, paddingVertical: spacing.sm },
  articleLabel: {
    color: '#15533d',
    fontSize: fontSize.xs,
    lineHeight: 16,
    fontWeight: fontWeight.black,
    letterSpacing: 1.6,
  },
  body: {
    marginTop: spacing.md,
    color: '#372b1e',
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 29,
  },
  bodyNarrow: { fontSize: 16, lineHeight: 25 },
  footerRule: { height: 1, marginTop: spacing.xl, backgroundColor: '#9e8964' },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  archiveLabel: {
    color: '#685742',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: fontWeight.black,
    letterSpacing: 0.8,
  },
  footer: {
    color: '#685742',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: fontWeight.black,
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  filedLine: {
    marginTop: 46,
    color: '#9a805a',
    fontFamily: 'serif',
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontStyle: 'italic',
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  shareButton: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#17753f',
  },
  shareButtonPressed: { opacity: 0.8 },
  shareIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  shareButtonText: {
    flexShrink: 1,
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.black,
    textAlign: 'center',
  },
});
