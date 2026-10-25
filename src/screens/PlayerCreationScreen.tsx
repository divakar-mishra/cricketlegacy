import { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  PortraitPicker,
  Button,
  Card,
  CountrySelect,
  ProgressBar,
  Screen,
  ScreenHeader,
  SelectableCard,
  SegmentedControl,
  Stepper,
  AppText as Text,
} from '../components';
import { ATTR_META, CREATION } from '../data/attributes';
import { DEFAULT_AVATAR_CONFIG } from '../avatar';
import type { AvatarConfig } from '../avatar';
import { getCountry } from '../data/countries';
import { BattingStyle, BowlingStyle, CareerArchetype, Difficulty, Role } from '../domain/types';
import { buildUserPlayer, createCareerSave } from '../game/createGame';
import { playerDomesticBlueprints } from '../game/domesticBranding';
import { GuideReplayButton, GuideTarget } from '../components/CareerGuide';
import { AttributesGuidePopup } from '../components/AttributesGuidePopup';
import { guideAction } from '../game/coachGuide';
import {
  activeCreationAttributeDelta,
  allocatedActiveCreationPoints,
  CreationAttrs,
} from '../game/creationAllocation';
import { ScreenProps } from '../navigation';
import { analytics } from '../services';
import { useCareer } from '../state/careerStore';
import { findCreationSlot, setLastPlayed, writeSave } from '../storage/saveGames';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

type AllAttrs = CreationAttrs;

const ROLES: { value: Role; label: string; desc: string; bowls: boolean }[] = [
  { value: 'BATTER', label: 'Batter', desc: 'Specialist run-scorer.', bowls: false },
  { value: 'BOWLER', label: 'Bowler', desc: 'Specialist wicket-taker.', bowls: true },
  { value: 'ALLROUNDER', label: 'All-Rounder', desc: 'Bat and bowl.', bowls: true },
  { value: 'WK_BATTER', label: 'Wicket-Keeper', desc: 'Keeps wicket and bats.', bowls: false },
];

type BowlingHand = 'RIGHT' | 'LEFT';
type BowlingDiscipline = 'PACE' | 'MEDIUM' | 'OFF_SPIN' | 'LEG_SPIN';

const BOWLING_HANDS: { value: BowlingHand; label: string }[] = [
  { value: 'RIGHT', label: 'Right-arm' },
  { value: 'LEFT', label: 'Left-arm' },
];

const BOWLING_DISCIPLINES: { value: BowlingDiscipline; label: string }[] = [
  { value: 'PACE', label: 'Fast pace' },
  { value: 'MEDIUM', label: 'Medium pace' },
  { value: 'OFF_SPIN', label: 'Off-spin' },
  { value: 'LEG_SPIN', label: 'Leg-spin' },
];

function resolveBowlingStyle(hand: BowlingHand, discipline: BowlingDiscipline): BowlingStyle {
  if (hand === 'RIGHT') return discipline;
  return discipline === 'PACE' || discipline === 'MEDIUM' ? 'LEFT_ARM_PACE' : 'LEFT_ARM_SPIN';
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HARD', label: 'Hard' },
  { value: 'PRO', label: 'Pro' },
];

const STEP_TITLES = ['Identity & Avatar', 'Pathway & Attributes', 'Club', 'Review'];

/** Career starts in one Grade A pathway to keep onboarding focused. */
const CAREER_START_OPTIONS = [
  {
    value: 'u14' as const,
    label: 'Grade A Cricket',
    desc: 'Age 16 · Local first-team cricket.',
    ageOverride: 16,
    attrScale: 0.52,
  },
] as const;

type CareerStart = (typeof CAREER_START_OPTIONS)[number]['value'];
type AttrRow = { group: keyof AllAttrs; key: string; label: string };
type AttrSection = { id: string; label: string; rows: AttrRow[] };

const creationBudgetFor = (role: Role, scale: number) =>
  Math.round((role === 'BATTER' || role === 'BOWLER' ? 150 : CREATION.budget) * scale);
function initialCreationAttrs(): AllAttrs {
  return Object.fromEntries(Object.entries(ATTR_META).map(([group, rows]) => [
    group, Object.fromEntries(rows.map(([key]) => [key, CREATION.base])),
  ])) as unknown as AllAttrs;
}
const CREATION_GUIDES = ['player.identity', 'player.attributes', 'player.club', 'player.review'] as const;

export function PlayerCreationScreen({ navigation, route }: ScreenProps<'PlayerCreation'>) {
  const setActive = useCareer((s) => s.setActive);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [step, setStep] = useState(0);
  const [attributesGuideOpen, setAttributesGuideOpen] = useState(true);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [role, setRole] = useState<Role>('ALLROUNDER');
  const [roleChosen, setRoleChosen] = useState(false);
  const [sexChosen, setSexChosen] = useState(false);
  const [toneChosen, setToneChosen] = useState(false);
  const [portraitChosen, setPortraitChosen] = useState(false);
  const [battingStyle, setBattingStyle] = useState<BattingStyle>('RHB');
  const [bowlingHand, setBowlingHand] = useState<BowlingHand>('RIGHT');
  const [bowlingDiscipline, setBowlingDiscipline] = useState<BowlingDiscipline>('PACE');
  const [attrs, setAttrs] = useState<AllAttrs>(initialCreationAttrs);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [careerStart, setCareerStart] = useState<CareerStart>('u14');
  const [archetype, setArchetype] = useState<CareerArchetype>('SPECIALIST');
  const [ironman, setIronman] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => ({
    ...DEFAULT_AVATAR_CONFIG,
  }));

  const roleBowls = role === 'BOWLER' || role === 'ALLROUNDER';
  const bowlingStyle = roleBowls ? resolveBowlingStyle(bowlingHand, bowlingDiscipline) : undefined;
  const careerStartOpt =
    CAREER_START_OPTIONS.find((o) => o.value === careerStart) ?? CAREER_START_OPTIONS[0];
  const creationBudget = creationBudgetFor(role, careerStartOpt.attrScale);

  /**
   * Show only the attribute groups that are relevant to the chosen role.
   * Fielding stays in the engine, but creation only exposes attributes that
   * define the selected playing role.
   * Points unspent in hidden groups remain at the base value — specialists
   * effectively have more budget to pour into their core attributes.
   */
  const attrSections = useMemo<AttrSection[]>(() => {
    const battingRows: AttrRow[] = [
      ...ATTR_META.batting.map(([key, label]) => ({ group: 'batting' as const, key, label })),
      ...ATTR_META.meta.map(([key, label]) => ({ group: 'meta' as const, key, label })),
    ];
    const bowlingRows: AttrRow[] = [
      ...ATTR_META.bowling.map(([key, label]) => ({ group: 'bowling' as const, key, label })),
      ...ATTR_META.meta.map(([key, label]) => ({ group: 'meta' as const, key, label })),
    ];
    const fieldingRows: AttrRow[] = ATTR_META.fielding.map(([key, label]) => ({
      group: 'fielding' as const,
      key,
      label,
    }));

    if (role === 'BATTER') return [{ id: 'batting', label: 'Batting', rows: battingRows }];
    if (role === 'BOWLER') return [{ id: 'bowling', label: 'Bowling', rows: bowlingRows }];
    if (role === 'WK_BATTER') {
      return [
        { id: 'batting', label: 'Batting', rows: battingRows },
        {
          id: 'wicketkeeping',
          label: 'Wicketkeeping',
          rows: fieldingRows.filter((row) => row.key === 'keeping'),
        },
      ];
    }
    return [
      { id: 'batting', label: 'Batting', rows: battingRows },
      {
        id: 'bowling',
        label: 'Bowling',
        rows: ATTR_META.bowling.map(([key, label]) => ({ group: 'bowling' as const, key, label })),
      },
    ];
  }, [role]);

  const countryTeams = useMemo(
    () =>
      nationality ? playerDomesticBlueprints(nationality).filter((team) => team.tier === 3) : [],
    [nationality],
  );

  // Reset team if it no longer belongs to the new country.
  const changeNationality = (n: string) => {
    setNationality(n);
    setTeamId(null);
    guideAction('player-country');
  };

  const allocated = useMemo(() => {
    return allocatedActiveCreationPoints(attrs, careerStartOpt.attrScale);
  }, [attrs, careerStartOpt.attrScale]);
  const remaining = creationBudget - allocated;

  const preview = useMemo(
    () =>
      buildUserPlayer({
        sex: avatarConfig.sex,
        name: name.trim() || 'New Player',
        nationality: nationality ?? 'india',
        role,
        battingStyle,
        bowlingStyle: roleBowls ? bowlingStyle : undefined,
        batting: attrs.batting,
        bowling: attrs.bowling,
        fielding: attrs.fielding,
        meta: attrs.meta,
        age: careerStartOpt.ageOverride,
        attrScale: careerStartOpt.attrScale,
      }),
    [name, nationality, role, battingStyle, bowlingStyle, roleBowls, attrs, careerStartOpt, avatarConfig.sex],
  );

  const changeRole = (next: Role) => {
    setRole(next);
    setRoleChosen(true);
    setAttrs(initialCreationAttrs());
    guideAction('player-role');
    const bowls = next === 'BOWLER' || next === 'ALLROUNDER';
    if (bowls) setBowlingDiscipline((current) => current ?? 'PACE');
  };

  const bump = (group: keyof AllAttrs, key: string, delta: number) => {
    setAttrs((prev) => {
      const current = (prev[group] as Record<string, number>)[key];
      const prevRemaining = creationBudget - allocatedActiveCreationPoints(prev, careerStartOpt.attrScale);
      const change = activeCreationAttributeDelta(current, delta, prevRemaining, careerStartOpt.attrScale);
      if (change === 0) return prev;
      return { ...prev, [group]: { ...prev[group], [key]: current + change } };
    });
  };

  const canProceed = useMemo(() => {
    if (step === 0) {
      return name.trim().length >= 2 && Boolean(nationality && getCountry(nationality)) && sexChosen && toneChosen && portraitChosen && roleChosen;
    }
    if (step === 2) return Boolean(teamId);
    return true;
  }, [step, name, nationality, teamId, sexChosen, toneChosen, portraitChosen, roleChosen]);

  const isLast = step === STEP_TITLES.length - 1;
  const attributesPage = step === 1;
  const proceedHint =
    step === 0
      ? name.trim().length < 2
        ? 'Enter at least 2 characters for your player name.'
        : !nationality
          ? 'Choose your country to continue.'
          : !sexChosen
            ? 'Choose Male or Female to continue.'
            : !toneChosen
              ? 'Choose a skin tone range to continue.'
            : !portraitChosen
              ? 'Choose a portrait or Randomize to continue.'
              : !roleChosen
                ? 'Choose your playing role to continue.'
                : null
      : step === 2 && !teamId
        ? 'Choose a Tier 3 club to start your career.'
        : null;
  const onBack = () => {
    if (creatingRef.current) return;
    if (step === 0) navigation.goBack();
    else setStep(s => s - 1);
  };
  const create = async () => {
    if (!nationality || !getCountry(nationality) || !teamId || name.trim().length < 2 || !sexChosen || !toneChosen || !portraitChosen || !roleChosen || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const player = buildUserPlayer({
        sex: avatarConfig.sex,
        name: name.trim(),
        nationality,
        role,
        battingStyle,
        bowlingStyle: roleBowls ? bowlingStyle : undefined,
        batting: attrs.batting,
        bowling: attrs.bowling,
        fielding: attrs.fielding,
        meta: attrs.meta,
        age: careerStartOpt.ageOverride,
        attrScale: careerStartOpt.attrScale,
      });
      const slot = await findCreationSlot('career', route?.params?.slot);
      if (!slot) {
        Alert.alert('All slots full', 'Delete a career from Saved Games to start a new one.', [
          { text: 'OK', onPress: () => navigation.navigate('SavedGames') },
        ]);
        return;
      }
      const save = createCareerSave({
        player,
        teamId,
        difficulty,
        format: 'T20',
        newGamePlus: route?.params?.legacy,
        legacyScore: route?.params?.legacyScore,
        archetype,
        ironman,
        avatarConfig,
      });
      await writeSave('career', slot, save);
      // The career is already durable. Optional resume metadata must not turn
      // success into a retry that creates a second career in another slot.
      try {
        await setLastPlayed('career', slot);
      } catch {
        console.warn('Career created; last-played metadata could not be updated.');
      }
      setActive(save, 'career', slot);
      analytics.setUserProperty('mode', 'career');
      analytics.logEvent(analytics.EVT.CAREER_START, {
        mode: 'career',
        difficulty,
        new_game_plus: Boolean(route?.params?.legacy),
      });
      guideAction('player-created');
      navigation.reset({ index: 1, routes: [{ name: 'MainMenu' }, { name: 'CareerHub' }] });
    } catch {
      Alert.alert(
        'Career not created',
        'The device did not confirm the first save. Check available storage and try again.',
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const onNext = () => {
    if (!canProceed || creating) return;
    if (isLast) return create();
    guideAction('player-creation-next');
    setStep(s => s + 1);
  };

  return (
    <Screen
      scroll
      guide={{ chapter: CREATION_GUIDES[step], enabled: !attributesPage && !creating && !countryOpen,
        layout: attributesPage ? 'plain' : 'docked', progress: 'session' }}
      scrollResetKey={step}
      footer={
        <View>
          {creating ? <Text accessibilityLiveRegion="polite" style={styles.footerHint}>Creating and saving your career…</Text> : null}
          {proceedHint ? <Text style={styles.footerHint}>{proceedHint}</Text> : null}
          <View style={styles.footerRow}>
            <Button
              label="Back"
              variant="ghost"
              fullWidth={false}
              style={styles.flex}
              disabled={creating}
              onPress={onBack}
            />
            <GuideTarget id="creation-next" style={styles.flex}><Button
              label={isLast ? 'Start Career' : 'Next'}
              variant={isLast ? 'gold' : 'primary'}
              fullWidth={false}
              disabled={!canProceed || creating}
              loading={creating}
              onPress={onNext}
            /></GuideTarget>
          </View>
        </View>
      }
    >
      <ScreenHeader
        title={STEP_TITLES[step]}
        subtitle={`Step ${step + 1} of ${STEP_TITLES.length}`}
        onBack={onBack}
      />
      {attributesPage ? <Button label="Show screen guide" size="sm" variant="ghost"
        onPress={() => setAttributesGuideOpen(true)} /> : <GuideReplayButton chapter={CREATION_GUIDES[step]} />}
      <AttributesGuidePopup visible={attributesPage && attributesGuideOpen}
        onClose={() => setAttributesGuideOpen(false)} />
      <ProgressBar
        value={(step + 1) / STEP_TITLES.length}
        color={colors.accent}
        style={{ marginBottom: spacing.xl }}
      />

      {step === 0 && (
        <View>
          <GuideTarget id="identity-basics" ready={name.trim().length >= 2 && Boolean(nationality && getCountry(nationality))}>
          <Label text="Player name" />
          <GuideTarget id="name" ready={name.trim().length >= 2}><TextInput
            accessibilityLabel="Player name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Arjun Rao"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={22}
          /></GuideTarget>

          <Label text="Nationality" style={{ marginTop: spacing.lg }} />
          <GuideTarget id="country" ready={Boolean(nationality && getCountry(nationality))}><CountrySelect
            value={nationality}
            onChange={changeNationality}
            testID="player-country-select"
            onOpenChange={setCountryOpen}
          /></GuideTarget>
          </GuideTarget>

          <GuideTarget id="appearance" ready={sexChosen && toneChosen && portraitChosen}>
          <PortraitPicker
            value={avatarConfig}
            onChange={setAvatarConfig}
            playerName={name.trim() || 'Your Player'}
            testID="player-creation-avatar"
            creationChoices={{ sex: sexChosen, tone: toneChosen, portrait: portraitChosen }}
            onChooseSex={(sex) => {
              if (!sexChosen || sex !== avatarConfig.sex) {
                setToneChosen(false);
                setPortraitChosen(false);
              }
              setSexChosen(true);
            }}
            onChooseTone={() => { setToneChosen(true); setPortraitChosen(false); }}
            onChoosePortrait={() => setPortraitChosen(true)}
          />
          </GuideTarget>

          <GuideTarget id="role-and-styles" ready={roleChosen}>
          <Label text="Role" style={{ marginTop: spacing.lg }} />
          <GuideTarget id="role" ready={roleChosen}>{ROLES.map((r) => (
            <SelectableCard
              key={r.value}
              title={r.label}
              subtitle={r.desc}
              selected={roleChosen && role === r.value}
              onPress={() => changeRole(r.value)}
              style={{ marginBottom: spacing.sm }}
            />
          ))}</GuideTarget>

          <GuideTarget id="styles">
          <Label text="Career identity" style={{ marginTop: spacing.lg }} />
          {(
            [
              {
                value: 'PRODIGY',
                label: 'Prodigy',
                desc: 'High expectations.',
              },
              {
                value: 'LATE_BLOOMER',
                label: 'Late Bloomer',
                desc: 'Prove them wrong.',
              },
              {
                value: 'SPECIALIST',
                label: 'Specialist',
                desc: 'One defining skill.',
              },
              {
                value: 'COMEBACK',
                label: 'Comeback Story',
                desc: 'A second chance.',
              },
            ] as const
          ).map((option) => (
            <SelectableCard
              key={option.value}
              title={option.label}
              subtitle={option.desc}
              selected={archetype === option.value}
              onPress={() => setArchetype(option.value)}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
          <View style={styles.ironmanRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ironmanTitle}>Ironman career</Text>
              <Text style={styles.ironmanDesc}>Permanent autosave.</Text>
            </View>
            <Switch
              value={ironman}
              onValueChange={setIronman}
              trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              thumbColor={ironman ? colors.accent : colors.textMuted}
              accessibilityLabel="Ironman career"
            />
          </View>

          <ChoiceRow
            label="Batting hand"
            value={battingStyle}
            onChange={setBattingStyle}
            options={[
              { value: 'RHB', label: 'Right' },
              { value: 'LHB', label: 'Left' },
            ]}
          />
          {roleBowls && (
            <>
              <ChoiceRow
                label="Bowling hand"
                value={bowlingHand}
                onChange={setBowlingHand}
                options={BOWLING_HANDS}
              />
              <ChoiceRow
                label="Bowling style"
                value={bowlingDiscipline}
                onChange={setBowlingDiscipline}
                options={BOWLING_DISCIPLINES}
              />
            </>
          )}
          </GuideTarget>
          </GuideTarget>
        </View>
      )}

      {step === 1 && (
        <View>
          <View>
          {/* Pathway is chosen BEFORE allocation so the OVR shown here matches the
              review and in-game value (youth pathways start lower but grow higher). */}
          <View>
          <Label text="Career starting level" />
          {CAREER_START_OPTIONS.map((opt) => (
            <SelectableCard
              key={opt.value}
              title={opt.label}
              subtitle={opt.desc}
              selected={careerStart === opt.value}
              onPress={() => setCareerStart(opt.value)}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
          </View>
          <View>
          <ChoiceRow
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES}
          />
          </View>

          <View>
          <Card style={[styles.summary, { marginTop: spacing.lg }]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{preview.overall}</Text>
              <Text style={styles.summaryLabel}>Active Grade A OVR</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text
                style={[
                  styles.summaryValue,
                  { color: remaining > 0 ? colors.accent : colors.success },
                ]}
              >
                {remaining}
              </Text>
              <Text style={styles.summaryLabel}>Points left</Text>
            </View>
          </Card>
          </View>
          <Card style={styles.attrDashboard}>
            <View style={styles.attrDashHeader}>
              <View>
                <Text style={styles.attrDashTitle}>Attribute Dashboard</Text>
                <Text style={styles.attrDashSub}>
                  {ROLES.find((r) => r.value === role)?.label ?? role}
                </Text>
              </View>
              <Text style={styles.attrDashBudget}>{remaining} pts</Text>
            </View>
            <View style={styles.attrDashChips}>
              {attrSections.map((section) => (
                <Text key={section.id} style={styles.attrDashChip}>
                  {section.label}
                </Text>
              ))}
            </View>
          </Card>
          <Text style={styles.roleHint}>
            Each tap changes the displayed Grade A rating by up to 3 and uses the same number of points.
          </Text>
          </View>

          <View>
          {attrSections.map((section) => (
            <View key={section.id} style={{ marginTop: spacing.lg }}>
              <Text style={styles.groupTitle}>{section.label}</Text>
              {section.rows.map(({ group, key, label }) => {
                const value = (attrs[group] as Record<string, number>)[key];
                const activeValue = Math.max(1, Math.round(value * careerStartOpt.attrScale));
                return (
                  <Stepper
                    key={`${group}-${key}`}
                    label={label}
                    value={value}
                    displayValue={activeValue}
                    progressValue={activeValue}
                    max={Math.round(CREATION.maxPerAttr * careerStartOpt.attrScale)}
                    canDec={value > CREATION.base}
                    canInc={remaining > 0 && value < CREATION.maxPerAttr}
                    onDec={() => bump(group, key, -1)}
                    onInc={() => bump(group, key, 1)}
                  />
                );
              })}
            </View>
          ))}
          </View>
        </View>
      )}

      {step === 2 && (
        <GuideTarget id="clubs" ready={Boolean(teamId)}>
          <Label text="Choose your future Tier 3 club" />
          {!nationality && (
            <Text
              style={{ color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm }}
            >
              Choose a nationality in step 1 to filter clubs.
            </Text>
          )}
          {countryTeams.map((t) => (
            <SelectableCard
              key={t.id}
              title={t.name}
              selected={teamId === t.id}
              onPress={() => { setTeamId(t.id); guideAction('player-club'); }}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.groupTitle}>Starting pathway</Text>
            <Text style={styles.reviewLabel}>Grade A → Under-19 → senior domestic</Text>
          </Card>
        </GuideTarget>
      )}

      {step === 3 && (
        <GuideTarget id="review">
          <ReviewRow label="Name" value={name.trim() || '—'} />
          <ReviewRow label="Nationality" value={getCountry(nationality ?? '')?.name ?? '—'} />
          <ReviewRow label="Gender" value={avatarConfig.sex === 'female' ? 'Female' : 'Male'} />
          <ReviewRow label="Role" value={ROLES.find((r) => r.value === role)?.label ?? role} />
          <ReviewRow label="Batting" value={battingStyle === 'RHB' ? 'Right-hand' : 'Left-hand'} />
          {roleBowls && (
            <>
              <ReviewRow
                label="Bowling hand"
                value={BOWLING_HANDS.find((item) => item.value === bowlingHand)?.label ?? '—'}
              />
              <ReviewRow
                label="Bowling style"
                value={
                  BOWLING_DISCIPLINES.find((item) => item.value === bowlingDiscipline)?.label ?? '—'
                }
              />
            </>
          )}
          <ReviewRow
            label="Career path"
            value={`${careerStartOpt.label} · Age ${careerStartOpt.ageOverride}`}
          />
          <ReviewRow
            label="Reserved Tier 3 club"
            value={countryTeams.find((team) => team.id === teamId)?.name ?? '—'}
          />
          <ReviewRow label="Starting format" value="T20 pathway" />
          <ReviewRow label="Difficulty" value={difficulty} />
          <ReviewRow
            label="Career identity"
            value={
              {
                PRODIGY: 'Prodigy',
                LATE_BLOOMER: 'Late Bloomer',
                SPECIALIST: 'Specialist',
                COMEBACK: 'Comeback Story',
              }[archetype]
            }
          />
          <ReviewRow label="Save rules" value={ironman ? 'Ironman autosave' : 'Standard'} />
          <ReviewRow label="Active Grade A OVR" value={String(preview.overall)} highlight />
          {remaining > 0 && (
            <Text style={styles.warn}>You still have {remaining} unspent points.</Text>
          )}
        </GuideTarget>
      )}
    </Screen>
  );
}

function Label({ text, style }: { text: string; style?: object }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.label, style]}>{text}</Text>;
}

function ChoiceRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Label text={label} />
      <SegmentedControl value={value} options={options} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

function ReviewRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text
        style={[
          styles.reviewValue,
          highlight && { color: colors.accent, fontWeight: fontWeight.heavy },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    footerHint: {
      color: colors.warning,
      fontSize: fontSize.xs,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    label: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: spacing.sm,
    },
    identityHint: {
      color: colors.textFaint,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    roleHint: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    ironmanRow: {
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xs,
      padding: spacing.md,
    },
    ironmanTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    ironmanDesc: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
    },
    summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center', flex: 1 },
    summaryValue: { color: colors.text, fontSize: fontSize.xxxl, fontWeight: fontWeight.black },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    summaryDivider: { width: 1, height: 44, backgroundColor: colors.border },
    attrDashboard: { marginTop: spacing.md, borderColor: colors.primary, borderWidth: 1 },
    attrDashHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
    },
    attrDashTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    attrDashSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    attrDashBudget: { color: colors.accent, fontSize: fontSize.lg, fontWeight: fontWeight.black },
    attrDashChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    attrDashChip: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.primary + '22',
      overflow: 'hidden',
    },
    groupTitle: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.xs,
    },
    reviewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    reviewLabel: { color: colors.textMuted, fontSize: fontSize.sm },
    reviewValue: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      flexShrink: 1,
      textAlign: 'right',
    },
    warn: { color: colors.warning, fontSize: fontSize.sm, marginTop: spacing.lg },
    footerRow: { flexDirection: 'row', gap: spacing.md },
    flex: { flex: 1 },
  });
