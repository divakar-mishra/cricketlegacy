import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { moment } from '../audio';
import { Button, Card, Icon, IconName, ProgressBar, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import type { PersonalCoachDiscipline, PlayerLifeMatch, SaveGame } from '../domain/types';
import { getAchievement } from '../game/achievements';
import { careerSelectionDecision } from '../game/career';
import { careerLegacyScore } from '../game/careerEvents';
import {
  ensurePlayerLifeState,
  legacyTokenPrice,
  PERSONAL_COACHES,
  PLAYER_BUSINESSES,
  PLAYER_EQUIPMENT,
  PLAYER_LIFE_COSTS,
  PLAYER_PROPERTIES,
  playerLifeYear,
  sponsorNegotiationPreview,
} from '../game/playerLife';
import { nextUserFixtureId } from '../game/season';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

type LifeTab = 'overview' | 'development' | 'finance' | 'media' | 'legacy';
type PhoneApp = 'feed' | 'messages' | 'news' | 'wallet';

const LIFE_TABS: readonly { id: LifeTab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'speedometer-outline' },
  { id: 'development', label: 'Development', icon: 'fitness-outline' },
  { id: 'finance', label: 'Finance', icon: 'wallet-outline' },
  { id: 'media', label: 'Media', icon: 'phone-portrait-outline' },
  { id: 'legacy', label: 'Legacy', icon: 'trophy-outline' },
] as const;

const PHONE_APPS: readonly { id: PhoneApp; label: string; icon: IconName }[] = [
  { id: 'feed', label: 'Feed', icon: 'people-outline' },
  { id: 'messages', label: 'Inbox', icon: 'mail-outline' },
  { id: 'news', label: 'News', icon: 'newspaper-outline' },
  { id: 'wallet', label: 'Money', icon: 'card-outline' },
] as const;

function currentPlayer(save: SaveGame) {
  return save.userPlayerId ? save.players[save.userPlayerId] : undefined;
}

function formatCompetition(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ResultBadge({ result }: { result: PlayerLifeMatch['result'] }) {
  const { colors } = useTheme();
  const color = result === 'W' ? colors.success : result === 'L' ? colors.danger : colors.warning;
  return (
    <View style={[shared.resultBadge, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[shared.resultText, { color }]}>{result}</Text>
    </View>
  );
}

export function PlayerLifeScreen({ navigation, route }: ScreenProps<'PlayerLife'>) {
  const {
    save,
    transferPlayerBank,
    buyPlayerAsset,
    tradeLegacyToken,
    hirePersonalCoach,
    buyPlayerEquipment,
    bookPersonalPhysio,
    buyPerformanceAnalysis,
    negotiatePlayerSponsor,
    publishPlayerSocialPost,
    prepareCaptainIssue,
    resolveCaptainIssue,
    importCareerBackup,
  } = useCareer(
    useShallow((state) => ({
      save: state.save,
      transferPlayerBank: state.transferPlayerBank,
      buyPlayerAsset: state.buyPlayerAsset,
      tradeLegacyToken: state.tradeLegacyToken,
      hirePersonalCoach: state.hirePersonalCoach,
      buyPlayerEquipment: state.buyPlayerEquipment,
      bookPersonalPhysio: state.bookPersonalPhysio,
      buyPerformanceAnalysis: state.buyPerformanceAnalysis,
      negotiatePlayerSponsor: state.negotiatePlayerSponsor,
      publishPlayerSocialPost: state.publishPlayerSocialPost,
      prepareCaptainIssue: state.prepareCaptainIssue,
      resolveCaptainIssue: state.resolveCaptainIssue,
      importCareerBackup: state.importCareerBackup,
    })),
  );
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [tab, setTab] = useState<LifeTab>(route.params?.initialTab ?? 'overview');
  const [phoneApp, setPhoneApp] = useState<PhoneApp>('feed');
  const [bankAmount, setBankAmount] = useState('');
  const [tokenUnits, setTokenUnits] = useState('1');
  const [importOpen, setImportOpen] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (save?.captainClub || save?.captainCountry) prepareCaptainIssue();
  }, [prepareCaptainIssue, save?.captainClub, save?.captainCountry]);

  if (!save || save.mode !== 'career') {
    return (
      <Screen>
        <ScreenHeader title="Player Life" onBack={() => navigation.goBack()} />
        <Text style={styles.emptyText}>Open a Player Career to use this screen.</Text>
      </Screen>
    );
  }

  const player = currentPlayer(save);
  if (!player) {
    return (
      <Screen>
        <ScreenHeader title="Player Life" onBack={() => navigation.goBack()} />
        <Text style={styles.emptyText}>The career player could not be loaded.</Text>
      </Screen>
    );
  }

  const life = ensurePlayerLifeState(save);
  const fixtureId = nextUserFixtureId(save);
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  const activeAnalysis =
    fixtureId && life.lastAnalysisReport?.fixtureId === fixtureId
      ? life.lastAnalysisReport
      : undefined;
  const selection = careerSelectionDecision(save, fixture?.format ?? 'T20', fixtureId);
  const selectionMargin = selection.userScore - selection.rivalScore;
  const selectionStatus = selection.selected
    ? selectionMargin >= 6
      ? 'Secure'
      : 'Selected'
    : 'At risk';
  const selectionColor = selection.selected
    ? selectionMargin >= 6
      ? colors.success
      : colors.warning
    : colors.danger;
  const financeUnlocked =
    player.age >= 18 &&
    (save.careerPathLevel === 'DOMESTIC' || save.careerPathLevel === 'INTERNATIONAL');

  const resultAlert = (
    title: string,
    result: { ok: boolean; detail?: string; reason?: string },
  ) => {
    Alert.alert(
      result.ok ? title : 'Not available',
      result.detail ?? result.reason ?? 'Try again.',
    );
  };

  const parseAmount = (value: string): number =>
    Math.max(0, parseInt(value.replace(/[^0-9]/g, ''), 10) || 0);
  const renderSectionTitle = (title: string, detail?: string) => (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );

  const exportCareer = async () => {
    const transferCopy = {
      ...save,
      entitlements: { removeAds: false },
      premiumWallet: undefined,
      premiumInventory: undefined,
      firstPurchaseDone: false,
    };
    try {
      await Share.share({
        title: `${player.name} career backup`,
        message: JSON.stringify(transferCopy),
      });
    } catch {
      Alert.alert('Export failed', 'The system share sheet could not open.');
    }
  };

  const importCareer = async () => {
    setImporting(true);
    const result = await importCareerBackup(backupText);
    setImporting(false);
    if (result.ok) {
      setBackupText('');
      setImportOpen(false);
      Alert.alert('Career imported', 'This slot now contains the transferred Player Career.');
    } else {
      Alert.alert('Import failed', result.reason ?? 'The transfer code could not be read.');
    }
  };

  const renderOverview = () => (
    <>
      {renderSectionTitle(
        'Selection Risk',
        fixture ? `Next: ${fixture.format}` : 'No fixture queued',
      )}
      <Card style={styles.panel}>
        <View style={styles.selectionTop}>
          <View style={styles.flexText}>
            <Text style={styles.panelTitle}>{selectionStatus}</Text>
            <Text style={styles.bodyText}>{selection.reason}</Text>
          </View>
          <Text style={[styles.selectionScore, { color: selectionColor }]}>
            {Math.round(selection.userScore)}
          </Text>
        </View>
        <ProgressBar
          value={Math.max(0, Math.min(1, selection.userScore / 100))}
          color={selectionColor}
          style={styles.progress}
        />
        <View style={styles.inlineStats}>
          <InlineStat label="Your score" value={Math.round(selection.userScore).toString()} />
          <InlineStat label="Role rival" value={Math.round(selection.rivalScore).toString()} />
          <InlineStat
            label="Coach trust"
            value={Math.round(save.playerCareerResources?.coachTrust ?? 50).toString()}
          />
        </View>
      </Card>

      {renderSectionTitle('Last 10 Matches', 'Your appearances only')}
      <Card style={styles.tablePanel}>
        {life.recentMatches.length ? (
          life.recentMatches.map((match) => (
            <View key={match.id} style={styles.matchRow}>
              <ResultBadge result={match.result} />
              <View style={styles.matchIdentity}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {match.opponent}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {match.international ? 'International' : 'Domestic'} |{' '}
                  {formatCompetition(match.competition)}
                </Text>
              </View>
              <View style={styles.matchNumbers}>
                <Text style={styles.performanceLine}>
                  {match.runs} R | {match.wickets} W
                </Text>
                <Text style={styles.ratingLine}>{match.rating.toFixed(1)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyPanelText}>
            Your next official appearance will begin this rolling report.
          </Text>
        )}
      </Card>

      {renderSectionTitle('Career Contracts')}
      <Card style={styles.panel}>
        <SummaryRow
          icon="shirt-outline"
          label="Domestic"
          value={`${save.teams[save.userTeamId ?? '']?.name ?? 'No club'} | ${player.contract?.yearsLeft ?? 0} year(s)`}
        />
        <SummaryRow
          icon="flag-outline"
          label="National"
          value={
            save.capped
              ? `${save.userCaps ?? 0} caps | format selection remains independent`
              : `${save.nationalRep ?? 0}/100 national reputation`
          }
        />
        <SummaryRow
          icon="megaphone-outline"
          label="Sponsors"
          value={
            (save.sponsors ?? []).length
              ? (save.sponsors ?? []).map((sponsor) => sponsor.brand).join(', ')
              : 'No active endorsement'
          }
          last
        />
      </Card>
    </>
  );

  const renderDevelopment = () => (
    <>
      {renderSectionTitle('Personal Support', 'Paid services have seasonal limits')}
      <View style={styles.actionGrid}>
        <ServiceTile
          icon="medkit-outline"
          title="Personal Physio"
          detail={`+25 condition, -1 injury match | ${life.physioVisitsThisSeason}/${PLAYER_LIFE_COSTS.maxPhysioVisits} used`}
          price={PLAYER_LIFE_COSTS.physio}
          disabled={
            life.physioVisitsThisSeason >= PLAYER_LIFE_COSTS.maxPhysioVisits ||
            (!player.injury && (save.playerCareerResources?.playerCondition ?? 100) >= 95)
          }
          onPress={() => resultAlert('Physio complete', bookPersonalPhysio())}
        />
        <ServiceTile
          icon="analytics-outline"
          title="Performance Analyst"
          detail={
            fixture
              ? activeAnalysis
                ? `${activeAnalysis.opponentName} report ready`
                : `Full ${fixture.format} matchup report | +3 confidence, +2 trust`
              : 'No upcoming match to analyse'
          }
          price={PLAYER_LIFE_COSTS.analyst}
          disabled={!fixtureId || life.analysedFixtureIds.includes(fixtureId)}
          onPress={() => resultAlert('Report ready', buyPerformanceAnalysis())}
        />
      </View>

      {activeAnalysis ? (
        <Card style={styles.analysisReport}>
          <View style={styles.analysisHeader}>
            <View style={styles.analysisIcon}>
              <Icon name="analytics" size={22} color={colors.accent} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.panelTitle}>
                {activeAnalysis.opponentName} | {activeAnalysis.format} report
              </Text>
              <Text style={styles.analysisMeta}>Prepared for the next fixture only</Text>
            </View>
          </View>
          <ReportLine label="Primary threat" value={activeAnalysis.threatName} />
          <ReportLine label="Threat profile" value={activeAnalysis.threatDetail} />
          <ReportLine label="Weakness to target" value={activeAnalysis.weakness} />
          <ReportLine label="Match plan" value={activeAnalysis.matchAdvice} />
          <View style={styles.trainingRecommendation}>
            <Text style={styles.trainingRecommendationTitle}>
              Recommended training: {formatCompetition(activeAnalysis.recommendedTrainingGroup)}
            </Text>
            <Text style={styles.trainingRecommendationText}>{activeAnalysis.trainingReason}</Text>
            <Button
              label="Open Training"
              size="sm"
              fullWidth={false}
              style={styles.reportButton}
              onPress={() => navigation.navigate('Training')}
            />
          </View>
        </Card>
      ) : null}

      {renderSectionTitle('Personal Coaches', 'One-season specialist contracts')}
      <Card style={styles.listPanel}>
        {PERSONAL_COACHES.map((coach, index) => {
          const active = (life.personalCoaches[coach.discipline]?.seasonsRemaining ?? 0) > 0;
          return (
            <ActionRow
              key={coach.discipline}
              icon={
                coach.discipline === 'BATTING'
                  ? 'baseball-outline'
                  : coach.discipline === 'BOWLING'
                    ? 'disc-outline'
                    : 'sparkles-outline'
              }
              title={coach.name}
              detail={coach.specialty}
              action={active ? 'Active' : coach.cost.toLocaleString()}
              disabled={active || save.wallet.coins < coach.cost}
              last={index === PERSONAL_COACHES.length - 1}
              onPress={() =>
                resultAlert(
                  'Coach hired',
                  hirePersonalCoach(coach.discipline as PersonalCoachDiscipline),
                )
              }
            />
          );
        })}
      </Card>

      {renderSectionTitle('Equipment', 'Small permanent boosts, applied once')}
      <Card style={styles.listPanel}>
        {PLAYER_EQUIPMENT.map((equipment, index) => {
          const owned = life.equipmentIds.includes(equipment.id);
          return (
            <ActionRow
              key={equipment.id}
              icon={
                equipment.id === 'balanced-bat'
                  ? 'baseball-outline'
                  : equipment.id === 'keeper-gloves'
                    ? 'hand-left-outline'
                    : equipment.id === 'performance-shoes'
                      ? 'footsteps-outline'
                      : 'shield-checkmark-outline'
              }
              title={equipment.name}
              detail={equipment.description}
              action={owned ? 'Owned' : equipment.cost.toLocaleString()}
              disabled={owned || save.wallet.coins < equipment.cost}
              last={index === PLAYER_EQUIPMENT.length - 1}
              onPress={() => resultAlert('Equipment ready', buyPlayerEquipment(equipment.id))}
            />
          );
        })}
      </Card>
      <Button
        label="Open Training"
        variant="secondary"
        style={styles.sectionButton}
        onPress={() => navigation.navigate('Training')}
      />
    </>
  );

  const renderFinance = () => {
    const tokenPrice = legacyTokenPrice(save);
    const tokenValue = tokenPrice * life.legacyTokenUnits;
    const income = life.lastSeasonIncome;
    return (
      <>
        {!financeUnlocked ? (
          <Card style={[styles.panel, styles.lockedPanel]}>
            <View style={styles.lockHeader}>
              <Icon name="lock-closed-outline" size={20} color={colors.warning} />
              <Text style={styles.panelTitle}>Finance unlocks at 18</Text>
            </View>
            <Text style={styles.bodyText}>
              Reach senior domestic cricket before opening bank, property, business and exchange
              accounts.
            </Text>
          </Card>
        ) : null}

        {renderSectionTitle('Personal Bank', '2% interest at season end')}
        <Card style={styles.panel}>
          <View style={styles.balanceBand}>
            <BalanceValue label="Wallet" value={save.wallet.coins} />
            <BalanceValue label="Bank" value={life.bankCoins} />
            <BalanceValue
              label="Last income"
              value={income?.total ?? 0}
              positive={Boolean(income?.total)}
            />
          </View>
          <TextInput
            style={styles.input}
            value={bankAmount}
            onChangeText={setBankAmount}
            keyboardType="number-pad"
            placeholder="Amount in coins"
            placeholderTextColor={colors.textFaint}
            editable={financeUnlocked}
          />
          <View style={styles.twoButtons}>
            <Button
              label="Deposit"
              size="sm"
              fullWidth={false}
              style={styles.halfButton}
              disabled={!financeUnlocked}
              onPress={() => {
                const result = transferPlayerBank('DEPOSIT', parseAmount(bankAmount));
                if (result.ok) setBankAmount('');
                resultAlert('Deposit complete', result);
              }}
            />
            <Button
              label="Withdraw"
              size="sm"
              variant="secondary"
              fullWidth={false}
              style={styles.halfButton}
              disabled={!financeUnlocked}
              onPress={() => {
                const result = transferPlayerBank('WITHDRAW', parseAmount(bankAmount));
                if (result.ok) setBankAmount('');
                resultAlert('Withdrawal complete', result);
              }}
            />
          </View>
        </Card>

        {renderSectionTitle('Property', 'Income is deposited into the bank')}
        <Card style={styles.listPanel}>
          {PLAYER_PROPERTIES.map((asset, index) => (
            <ActionRow
              key={asset.id}
              icon="home-outline"
              title={asset.name}
              detail={`${asset.description} +${asset.seasonalIncome.toLocaleString()}/season`}
              action={life.propertyIds.includes(asset.id) ? 'Owned' : asset.cost.toLocaleString()}
              disabled={
                !financeUnlocked ||
                life.propertyIds.includes(asset.id) ||
                save.wallet.coins < asset.cost
              }
              last={index === PLAYER_PROPERTIES.length - 1}
              onPress={() =>
                resultAlert('Property purchased', buyPlayerAsset('PROPERTY', asset.id))
              }
            />
          ))}
        </Card>

        {renderSectionTitle('Businesses', 'Separate ventures with seasonal profit')}
        <Card style={styles.listPanel}>
          {PLAYER_BUSINESSES.map((asset, index) => (
            <ActionRow
              key={asset.id}
              icon="briefcase-outline"
              title={asset.name}
              detail={`${asset.description} +${asset.seasonalIncome.toLocaleString()}/season`}
              action={life.businessIds.includes(asset.id) ? 'Owned' : asset.cost.toLocaleString()}
              disabled={
                !financeUnlocked ||
                life.businessIds.includes(asset.id) ||
                save.wallet.coins < asset.cost
              }
              last={index === PLAYER_BUSINESSES.length - 1}
              onPress={() =>
                resultAlert('Business purchased', buyPlayerAsset('BUSINESS', asset.id))
              }
            />
          ))}
        </Card>

        {renderSectionTitle('Legacy Exchange', 'Fictional in-game asset, no real-world value')}
        <Card style={styles.panel}>
          <View style={styles.exchangeTop}>
            <View>
              <Text style={styles.panelTitle}>{tokenPrice.toLocaleString()} coins per token</Text>
              <Text style={styles.bodyText}>
                Holding {life.legacyTokenUnits} | Value {tokenValue.toLocaleString()} | Cost basis{' '}
                {life.legacyTokenCostBasis.toLocaleString()}
              </Text>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={tokenUnits}
            onChangeText={setTokenUnits}
            keyboardType="number-pad"
            placeholder="Units"
            placeholderTextColor={colors.textFaint}
            editable={financeUnlocked}
          />
          <View style={styles.twoButtons}>
            <Button
              label="Buy"
              size="sm"
              fullWidth={false}
              style={styles.halfButton}
              disabled={!financeUnlocked}
              onPress={() =>
                resultAlert('Trade complete', tradeLegacyToken('BUY', parseAmount(tokenUnits)))
              }
            />
            <Button
              label="Sell"
              size="sm"
              variant="secondary"
              fullWidth={false}
              style={styles.halfButton}
              disabled={!financeUnlocked || life.legacyTokenUnits === 0}
              onPress={() =>
                resultAlert('Trade complete', tradeLegacyToken('SELL', parseAmount(tokenUnits)))
              }
            />
          </View>
        </Card>

        <View style={styles.twoButtons}>
          <Button
            label="Stock Portfolio"
            variant="secondary"
            fullWidth={false}
            style={styles.halfButton}
            onPress={() => navigation.navigate('InvestmentScreen')}
          />
          <Button
            label="Cricket Academy"
            variant="secondary"
            fullWidth={false}
            style={styles.halfButton}
            onPress={() => navigation.navigate('AcademyManagement')}
          />
        </View>
      </>
    );
  };

  const renderPhoneContent = () => {
    if (phoneApp === 'feed') {
      return life.socialFeed.length ? (
        life.socialFeed.slice(0, 6).map((post) => (
          <View key={post.id} style={styles.phoneItem}>
            <Text style={styles.phoneItemTitle}>{post.headline}</Text>
            <Text style={styles.phoneItemBody}>{post.body}</Text>
            <Text style={styles.phoneItemMeta}>
              {post.reactions.toLocaleString()} reactions | {post.comments.length} comments | +
              {post.followersDelta.toLocaleString()} followers
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.phoneEmpty}>Match milestones and your posts will appear here.</Text>
      );
    }
    if (phoneApp === 'messages') {
      return (save.inbox ?? []).length ? (
        (save.inbox ?? [])
          .slice()
          .reverse()
          .slice(0, 6)
          .map((message) => (
            <View key={message.id} style={styles.phoneItem}>
              <Text style={styles.phoneItemTitle}>{message.title}</Text>
              <Text style={styles.phoneItemBody} numberOfLines={2}>
                {message.body}
              </Text>
              <Text style={styles.phoneItemMeta}>{message.read ? 'Read' : 'Unread'}</Text>
            </View>
          ))
      ) : (
        <Text style={styles.phoneEmpty}>No messages.</Text>
      );
    }
    if (phoneApp === 'news') {
      const stories = save.experience?.mediaScrapbook ?? [];
      return stories.length ? (
        stories
          .slice()
          .reverse()
          .slice(0, 6)
          .map((story) => (
            <View key={story.id} style={styles.phoneItem}>
              <Text style={styles.phoneItemMeta}>
                {story.format} | SEASON {story.season}
              </Text>
              <Text style={styles.phoneItemTitle}>{story.headline}</Text>
              <Text style={styles.phoneItemBody}>{story.subheadline}</Text>
            </View>
          ))
      ) : (
        <Text style={styles.phoneEmpty}>
          Your first newspaper clipping has not been published yet.
        </Text>
      );
    }
    return (
      <>
        <SummaryRow icon="wallet-outline" label="Wallet" value={`${save.wallet.coins} coins`} />
        <SummaryRow icon="business-outline" label="Bank" value={`${life.bankCoins} coins`} />
        <SummaryRow
          icon="trending-up-outline"
          label="Stocks"
          value={`${save.stockInvestment?.currentValue ?? 0} coins`}
        />
        <SummaryRow
          icon="home-outline"
          label="Assets"
          value={`${life.propertyIds.length} properties | ${life.businessIds.length} businesses`}
          last
        />
      </>
    );
  };

  const renderMedia = () => (
    <>
      <View style={styles.followersBand}>
        <View>
          <Text style={styles.metricLabel}>FOLLOWERS</Text>
          <Text style={styles.followerValue}>{life.followers.toLocaleString()}</Text>
        </View>
        <View style={styles.followersRight}>
          <Text style={styles.metricLabel}>POSTS THIS SEASON</Text>
          <Text style={styles.followerMinor}>
            {life.mediaPostsThisSeason}/{PLAYER_LIFE_COSTS.maxSocialPosts}
          </Text>
        </View>
      </View>

      <View style={styles.phoneShell}>
        <View style={styles.phoneStatus}>
          <Text style={styles.phoneBrand}>LEGACY PHONE</Text>
          <Icon name="wifi-outline" size={16} color={colors.textMuted} />
        </View>
        <View style={styles.phoneApps}>
          {PHONE_APPS.map((app) => {
            const active = app.id === phoneApp;
            return (
              <Pressable
                key={app.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.phoneApp, active && styles.phoneAppActive]}
                onPress={() => {
                  if (app.id === 'messages') moment('phone');
                  setPhoneApp(app.id);
                }}
              >
                <Icon name={app.icon} size={20} color={active ? colors.text : colors.textMuted} />
                <Text style={[styles.phoneAppLabel, active && styles.phoneAppLabelActive]}>
                  {app.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.phoneContent}>{renderPhoneContent()}</View>
      </View>

      {renderSectionTitle('Player Press Room', 'Three meaningful posts per season')}
      <Text style={styles.mediaGuidance}>
        Humble gives the lowest reach, Team first gives balanced reach, and Confident gives the
        highest reach plus the largest Brand gain. Every choice consumes one of the three seasonal
        posts.
      </Text>
      <View style={styles.threeButtons}>
        <Button
          label="Humble"
          size="sm"
          variant="secondary"
          fullWidth={false}
          style={styles.thirdButton}
          disabled={life.mediaPostsThisSeason >= PLAYER_LIFE_COSTS.maxSocialPosts}
          onPress={() => resultAlert('Post published', publishPlayerSocialPost('HUMBLE'))}
        />
        <Button
          label="Confident"
          size="sm"
          variant="secondary"
          fullWidth={false}
          style={styles.thirdButton}
          disabled={life.mediaPostsThisSeason >= PLAYER_LIFE_COSTS.maxSocialPosts}
          onPress={() => resultAlert('Post published', publishPlayerSocialPost('CONFIDENT'))}
        />
        <Button
          label="Team first"
          size="sm"
          variant="secondary"
          fullWidth={false}
          style={styles.thirdButton}
          disabled={life.mediaPostsThisSeason >= PLAYER_LIFE_COSTS.maxSocialPosts}
          onPress={() => resultAlert('Post published', publishPlayerSocialPost('TEAM_FIRST'))}
        />
      </View>

      {renderSectionTitle('Sponsor Negotiation', 'One completed negotiation per season')}
      <Card style={styles.panel}>
        <Text style={styles.bodyText}>
          Current slots: {(save.sponsors ?? []).length}/2. A safer ask pays less; a bold ask can be
          rejected.
        </Text>
        <View style={styles.negotiationGrid}>
          {(['SAFE', 'BALANCED', 'BOLD'] as const).map((approach) => {
            const preview = sponsorNegotiationPreview(save, approach);
            const disabled =
              life.sponsorNegotiatedYear === playerLifeYear(save) ||
              (save.sponsors ?? []).length >= 2;
            return (
              <Pressable
                key={approach}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                style={[styles.negotiationOption, disabled && styles.disabledTile]}
                onPress={() => resultAlert('Sponsor signed', negotiatePlayerSponsor(approach))}
              >
                <Text style={styles.negotiationTitle}>{approach}</Text>
                <Text style={styles.negotiationChance}>{preview.chance}% acceptance</Text>
                <Text style={styles.negotiationPayout}>
                  {preview.signingBonus.toLocaleString()} now
                </Text>
                <Text style={styles.negotiationMeta}>
                  +{preview.perMatchCoins}/match | {preview.seasons} seasons | Form{' '}
                  {preview.minForm}+
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Button
        label="Open Full Inbox"
        variant="ghost"
        style={styles.sectionButton}
        onPress={() => navigation.navigate('NotificationInbox')}
      />
    </>
  );

  const renderLegacy = () => {
    const legacy = careerLegacyScore(save);
    const titles = save.records?.titles ?? [];
    const unlocked = (save.achievements ?? [])
      .map((id) => getAchievement(id))
      .filter((achievement): achievement is NonNullable<typeof achievement> =>
        Boolean(achievement),
      );
    const issue = life.captainIssue;
    return (
      <>
        {renderSectionTitle('Legacy Museum', `${legacy.score}/100 legacy score`)}
        <Card style={styles.museumPanel}>
          <View style={styles.museumHeader}>
            <View style={styles.museumIcon}>
              <Icon name="trophy" size={30} color={colors.accent} />
            </View>
            <View style={styles.flexText}>
              <Text style={styles.panelTitle}>{player.name}</Text>
              <Text style={styles.bodyText}>
                {statsLine(player.careerStats)} | {save.userCaps ?? 0} international caps
              </Text>
            </View>
          </View>
          <ProgressBar value={legacy.score / 100} color={colors.accent} style={styles.progress} />
          <View style={styles.cabinet}>
            {titles.length ? (
              titles.slice(-8).map((title, index) => (
                <View key={`${title.name}-${title.year}-${index}`} style={styles.trophySlot}>
                  <Icon name="trophy-outline" size={24} color={colors.accent} />
                  <Text style={styles.trophyName} numberOfLines={2}>
                    {title.detail || title.name}
                  </Text>
                  <Text style={styles.trophyYear}>{title.year}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.phoneEmpty}>
                Win a competition to place the first trophy in the museum.
              </Text>
            )}
          </View>
          {unlocked.length ? (
            <Text style={styles.museumFooter}>
              {unlocked.length} achievement{unlocked.length === 1 ? '' : 's'} unlocked, including{' '}
              {unlocked
                .slice(-3)
                .map((achievement) => achievement.title)
                .join(', ')}
              .
            </Text>
          ) : null}
        </Card>

        {save.captainClub || save.captainCountry ? (
          <>
            {renderSectionTitle('Captain Control Centre')}
            <Card style={styles.panel}>
              {issue && !issue.resolved ? (
                <>
                  <Text style={styles.panelTitle}>{issue.title}</Text>
                  <Text style={styles.bodyText}>{issue.detail}</Text>
                  <View style={styles.threeButtons}>
                    <Button
                      label="Support"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      style={styles.thirdButton}
                      onPress={() =>
                        resultAlert('Captaincy outcome', resolveCaptainIssue('SUPPORT'))
                      }
                    />
                    <Button
                      label="Mediate"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      style={styles.thirdButton}
                      onPress={() =>
                        resultAlert('Captaincy outcome', resolveCaptainIssue('MEDIATE'))
                      }
                    />
                    <Button
                      label="Discipline"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      style={styles.thirdButton}
                      onPress={() =>
                        resultAlert('Captaincy outcome', resolveCaptainIssue('DISCIPLINE'))
                      }
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.emptyPanelText}>
                  The dressing room is settled. A new leadership issue can emerge next season.
                </Text>
              )}
            </Card>
          </>
        ) : null}

        {renderSectionTitle('Career Transfer', 'Purchases are restored from the store account')}
        <Card style={styles.panel}>
          <Text style={styles.bodyText}>
            Export this career through the system share sheet, or paste a Cricket Legacy transfer
            code to replace this slot. Imported files cannot grant store entitlements.
          </Text>
          <View style={styles.twoButtons}>
            <Button
              label="Export"
              size="sm"
              fullWidth={false}
              style={styles.halfButton}
              onPress={() => void exportCareer()}
            />
            <Button
              label={importOpen ? 'Close import' : 'Import'}
              size="sm"
              variant="secondary"
              fullWidth={false}
              style={styles.halfButton}
              onPress={() => setImportOpen((open) => !open)}
            />
          </View>
          {importOpen ? (
            <View style={styles.importArea}>
              <TextInput
                style={[styles.input, styles.backupInput]}
                value={backupText}
                onChangeText={setBackupText}
                multiline
                placeholder="Paste career transfer JSON"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                label="Replace This Slot"
                variant="danger"
                loading={importing}
                disabled={!backupText.trim()}
                onPress={() => {
                  Alert.alert(
                    'Replace this career slot?',
                    'The current slot will be replaced by the imported career.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Replace', style: 'destructive', onPress: () => void importCareer() },
                    ],
                  );
                }}
              />
            </View>
          ) : null}
        </Card>
        <Button
          label="Records and Hall of Fame"
          variant="secondary"
          style={styles.sectionButton}
          onPress={() => navigation.navigate('Records')}
        />
      </>
    );
  };

  const page =
    tab === 'development'
      ? renderDevelopment()
      : tab === 'finance'
        ? renderFinance()
        : tab === 'media'
          ? renderMedia()
          : tab === 'legacy'
            ? renderLegacy()
            : renderOverview();

  return (
    <Screen scroll>
      <ScreenHeader
        title="Player Life"
        subtitle="Career, support, money, media and legacy"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.metricBand}>
        <HeaderMetric label="Followers" value={life.followers.toLocaleString()} />
        <HeaderMetric label="Wallet" value={save.wallet.coins.toLocaleString()} />
        <HeaderMetric label="Bank" value={life.bankCoins.toLocaleString()} />
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {LIFE_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(item.id)}
            >
              <Icon name={item.icon} size={18} color={active ? colors.text : colors.textMuted} />
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.page}>{page}</View>
    </Screen>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.headerMetric}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text
        style={styles.metricValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
    </View>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.inlineStat}>
      <Text style={styles.inlineValue}>{value}</Text>
      <Text style={styles.inlineLabel}>{label}</Text>
    </View>
  );
}

function BalanceValue({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.balanceValue}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <Text
        style={[styles.balanceNumber, positive && { color: colors.success }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value.toLocaleString()}
      </Text>
    </View>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.summaryRow, last && styles.lastRow]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={19} color={colors.primaryLight} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  detail,
  action,
  disabled,
  last,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  action: string;
  disabled?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.actionRow, last && styles.lastRow]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={colors.primaryLight} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{detail}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[styles.rowAction, disabled && styles.rowActionDisabled]}
        onPress={onPress}
      >
        <Text style={[styles.rowActionText, disabled && styles.rowActionTextDisabled]}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

function ReportLine({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.reportLine}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={styles.reportValue}>{value}</Text>
    </View>
  );
}

function ServiceTile({
  icon,
  title,
  detail,
  price,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  price: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.serviceTile, disabled && styles.disabledTile]}>
      <Icon name={icon} size={24} color={colors.primaryLight} />
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceDetail}>{detail}</Text>
      <Button
        label={disabled ? 'Unavailable' : `${price.toLocaleString()} coins`}
        size="sm"
        variant="secondary"
        disabled={disabled}
        style={styles.serviceButton}
        onPress={onPress}
      />
    </View>
  );
}

function statsLine(stats: SaveGame['players'][string]['careerStats']): string {
  if (!stats) return 'No official appearances';
  return `${stats.matches} matches | ${stats.runs} runs | ${stats.wickets} wickets`;
}

const shared = StyleSheet.create({
  resultBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultText: { fontSize: fontSize.sm, fontWeight: fontWeight.heavy, letterSpacing: 0 },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    emptyText: { color: colors.textMuted, fontSize: fontSize.md },
    page: { paddingBottom: spacing.xxl },
    flexText: { flex: 1, minWidth: 0 },
    sectionHeading: { marginTop: spacing.xl, marginBottom: spacing.sm },
    sectionTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
      letterSpacing: 0,
    },
    sectionDetail: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontFamily: fonts.medium,
      marginTop: 2,
      letterSpacing: 0,
    },
    metricBand: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    headerMetric: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      fontFamily: fonts.bold,
      letterSpacing: 0,
    },
    metricValue: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
      marginTop: 2,
      letterSpacing: 0,
    },
    tabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    tab: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 92,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    tabActive: {
      backgroundColor: colors.primaryDark,
      borderColor: colors.primaryLight,
    },
    tabLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      fontFamily: fonts.bold,
      letterSpacing: 0,
    },
    tabLabelActive: { color: colors.text },
    panel: { borderRadius: radius.sm },
    listPanel: { paddingVertical: 0, borderRadius: radius.sm },
    tablePanel: { paddingVertical: spacing.xs, borderRadius: radius.sm },
    panelTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.bold,
      letterSpacing: 0,
    },
    bodyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: spacing.xs,
      letterSpacing: 0,
    },
    selectionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    selectionScore: {
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      letterSpacing: 0,
    },
    progress: { marginTop: spacing.md },
    inlineStats: {
      flexDirection: 'row',
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    inlineStat: { flex: 1, minWidth: 0, alignItems: 'center' },
    inlineValue: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.bold,
      letterSpacing: 0,
    },
    inlineLabel: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      textAlign: 'center',
      letterSpacing: 0,
    },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 58,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    matchIdentity: { flex: 1, minWidth: 0 },
    rowTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      fontFamily: fonts.bold,
      letterSpacing: 0,
    },
    rowMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: 2,
      letterSpacing: 0,
    },
    matchNumbers: { minWidth: 84, alignItems: 'flex-end' },
    performanceLine: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 0,
    },
    ratingLine: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
      letterSpacing: 0,
    },
    emptyPanelText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.lg,
      lineHeight: 19,
      letterSpacing: 0,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 54,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: { borderBottomWidth: 0 },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontFamily: fonts.medium,
      letterSpacing: 0,
    },
    summaryValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: 2,
      letterSpacing: 0,
    },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    analysisReport: {
      marginTop: spacing.md,
      borderColor: colors.accent,
      borderLeftWidth: 3,
      borderRadius: radius.sm,
    },
    analysisHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    analysisIcon: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      backgroundColor: `${colors.accent}18`,
    },
    analysisMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      letterSpacing: 0,
    },
    reportLine: {
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    reportLabel: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    reportValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: 3,
      letterSpacing: 0,
    },
    trainingRecommendation: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
    },
    trainingRecommendationTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      letterSpacing: 0,
    },
    trainingRecommendationText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.xs,
      letterSpacing: 0,
    },
    reportButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
    serviceTile: {
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: 150,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    disabledTile: { opacity: 0.6 },
    serviceTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.sm,
      letterSpacing: 0,
    },
    serviceDetail: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: spacing.xs,
      flexGrow: 1,
      letterSpacing: 0,
    },
    serviceButton: { marginTop: spacing.md },
    actionRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowAction: {
      minWidth: 74,
      minHeight: 36,
      maxWidth: 104,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}18`,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    rowActionDisabled: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    rowActionText: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
      letterSpacing: 0,
    },
    rowActionTextDisabled: { color: colors.textMuted },
    sectionButton: { marginTop: spacing.md },
    lockedPanel: { borderColor: colors.warning },
    lockHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    balanceBand: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    balanceValue: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      padding: spacing.sm,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
    },
    balanceNumber: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.bold,
      marginTop: 2,
      letterSpacing: 0,
    },
    input: {
      minHeight: 46,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      letterSpacing: 0,
    },
    twoButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    halfButton: { flexGrow: 1, flexBasis: '46%', minWidth: 138 },
    threeButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    thirdButton: { flexGrow: 1, flexBasis: '30%', minWidth: 92 },
    exchangeTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    followersBand: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    followerValue: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      letterSpacing: 0,
    },
    followersRight: { alignItems: 'flex-end' },
    followerMinor: {
      color: colors.primaryLight,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      letterSpacing: 0,
    },
    phoneShell: {
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    phoneStatus: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    phoneBrand: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: fontWeight.heavy,
      letterSpacing: 0,
    },
    phoneApps: {
      flexDirection: 'row',
      padding: spacing.xs,
      gap: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    phoneApp: {
      flex: 1,
      minWidth: 0,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      gap: 2,
    },
    phoneAppActive: { backgroundColor: colors.surfaceAlt },
    phoneAppLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0,
    },
    phoneAppLabelActive: { color: colors.text },
    phoneContent: { paddingHorizontal: spacing.md, minHeight: 190, maxHeight: 430 },
    phoneItem: {
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    phoneItemTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      letterSpacing: 0,
    },
    phoneItemBody: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: 2,
      letterSpacing: 0,
    },
    phoneItemMeta: {
      color: colors.textFaint,
      fontSize: 10,
      marginTop: spacing.xs,
      letterSpacing: 0,
    },
    phoneEmpty: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
      lineHeight: 19,
      letterSpacing: 0,
    },
    negotiationGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    negotiationOption: {
      flexGrow: 1,
      flexBasis: 104,
      minWidth: 104,
      minHeight: 112,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.sm,
    },
    negotiationTitle: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.heavy,
      letterSpacing: 0,
    },
    negotiationChance: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: 2,
      letterSpacing: 0,
    },
    negotiationPayout: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.xs,
      letterSpacing: 0,
    },
    negotiationMeta: {
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 14,
      marginTop: 3,
      textAlign: 'center',
      letterSpacing: 0,
    },
    mediaGuidance: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginBottom: spacing.sm,
    },
    museumPanel: { borderRadius: radius.sm },
    museumHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    museumIcon: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      backgroundColor: `${colors.accent}18`,
      borderWidth: 1,
      borderColor: `${colors.accent}55`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cabinet: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    trophySlot: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 94,
      minHeight: 102,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.sm,
    },
    trophyName: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
      marginTop: spacing.xs,
      letterSpacing: 0,
    },
    trophyYear: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      letterSpacing: 0,
    },
    museumFooter: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: spacing.md,
      letterSpacing: 0,
    },
    importArea: { marginTop: spacing.md, gap: spacing.sm },
    backupInput: {
      minHeight: 130,
      textAlignVertical: 'top',
      fontFamily: fonts.body,
      fontSize: fontSize.xs,
    },
  });
