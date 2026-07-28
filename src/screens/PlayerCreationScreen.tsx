import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  Button,
  Card,
  PlayerAvatar,
  ProgressBar,
  Screen,
  ScreenHeader,
  SelectableCard,
  Stepper,
  AppText as Text,
} from '../components';
import { TEAM_BLUEPRINTS } from '../content/teams';
import { ATTR_META, CREATION } from '../data/attributes';
import {
  AVATAR_BEARD_OPTIONS,
  AVATAR_BROW_OPTIONS,
  AVATAR_EYE_COLORS,
  AVATAR_FACE_OPTIONS,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_OPTIONS,
  AVATAR_MOUSTACHE_OPTIONS,
  AVATAR_SKIN_TONES,
  DEFAULT_AVATAR_CUSTOMIZATION,
} from '../data/avatar';
import { COUNTRIES, getCountry } from '../data/countries';
import {
  AvatarCustomization,
  BattingStyle,
  BowlingStyle,
  CareerArchetype,
  Difficulty,
  Role,
} from '../domain/types';
import { buildUserPlayer, createCareerSave } from '../game/createGame';
import {
  allocatedCreationPoints,
  creationAttributeDelta,
  CreationAttrs,
} from '../game/creationAllocation';
import { ScreenProps } from '../navigation';
import { analytics } from '../services';
import { useCareer } from '../state/careerStore';
import { firstFreeSlot, listSlots, setLastPlayed, writeSave } from '../storage/saveGames';
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

const BOWLING_STYLES: { value: BowlingStyle; label: string }[] = [
  { value: 'PACE', label: 'Pace' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'OFF_SPIN', label: 'Off-spin' },
  { value: 'LEG_SPIN', label: 'Leg-spin' },
  { value: 'LEFT_ARM_SPIN', label: 'LA-spin' },
  { value: 'LEFT_ARM_PACE', label: 'LA-pace' },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HARD', label: 'Hard' },
  { value: 'PRO', label: 'Pro' },
];

const STEP_TITLES = ['Identity & Avatar', 'Pathway & Attributes', 'Club', 'Review'];

/** Career starts in one school-level pathway to keep onboarding focused. */
const CAREER_START_OPTIONS = [
  {
    value: 'u14' as const,
    label: 'Under-14',
    desc: 'Age 14 - School cricket. Build your game from the first step.',
    ageOverride: 14,
    attrScale: 0.52,
    potentialBonus: 26,
  },
] as const;

type CareerStart = (typeof CAREER_START_OPTIONS)[number]['value'];
type AttrRow = { group: keyof AllAttrs; key: string; label: string };
type AttrSection = { id: string; label: string; rows: AttrRow[] };

function initAttrs(): AllAttrs {
  const b = CREATION.base;
  return {
    batting: { technique: b, timing: b, power: b, footwork: b, temperament: b, running: b },
    bowling: { paceOrSpin: b, accuracy: b, movement: b, variations: b, stamina: b },
    fielding: { catching: b, throwing: b, agility: b, keeping: b },
    meta: { fitness: b, confidence: b, aggression: b, discipline: b },
  };
}

export function PlayerCreationScreen({ navigation, route }: ScreenProps<'PlayerCreation'>) {
  const setActive = useCareer((s) => s.setActive);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('ALLROUNDER');
  const [battingStyle, setBattingStyle] = useState<BattingStyle>('RHB');
  const [bowlingStyle, setBowlingStyle] = useState<BowlingStyle | undefined>('PACE');
  const [attrs, setAttrs] = useState<AllAttrs>(initAttrs);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [careerStart, setCareerStart] = useState<CareerStart>('u14');
  const [archetype, setArchetype] = useState<CareerArchetype>('SPECIALIST');
  const [ironman, setIronman] = useState(false);
  const [avatarCustomization, setAvatarCustomization] = useState<AvatarCustomization>(
    DEFAULT_AVATAR_CUSTOMIZATION,
  );

  const roleBowls = role === 'BOWLER' || role === 'ALLROUNDER';
  const creationBudget = role === 'BATTER' || role === 'BOWLER' ? 150 : 230;

  /**
   * Show only the attribute groups that are relevant to the chosen role.
   * - BATTER / WK_BATTER: batting + fielding + mental (no bowling)
   * - BOWLER: bowling + fielding + mental (no batting detail)
   * - ALLROUNDER: all four groups
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
        { id: 'fielding', label: 'Fielding & Keeping', rows: fieldingRows },
      ];
    }
    return [
      { id: 'batting', label: 'Batting', rows: battingRows },
      {
        id: 'bowling',
        label: 'Bowling',
        rows: ATTR_META.bowling.map(([key, label]) => ({ group: 'bowling' as const, key, label })),
      },
      { id: 'fielding', label: 'Fielding', rows: fieldingRows.filter((r) => r.key !== 'keeping') },
    ];
  }, [role]);

  // Teams matching the chosen nationality, falling back to all teams when none found.
  const countryTeams = useMemo(() => {
    const filtered = TEAM_BLUEPRINTS.filter((t) => t.country === nationality);
    return filtered.length > 0 ? filtered : TEAM_BLUEPRINTS;
  }, [nationality]);
  const teamsAreFiltered = useMemo(
    () => TEAM_BLUEPRINTS.some((t) => t.country === nationality),
    [nationality],
  );

  // Reset team if it no longer belongs to the new country.
  const changeNationality = (n: string) => {
    setNationality(n);
    const stillValid = TEAM_BLUEPRINTS.filter((t) => t.country === n).some((t) => t.id === teamId);
    if (!stillValid) setTeamId(null);
  };

  const allocated = useMemo(() => {
    return allocatedCreationPoints(attrs);
  }, [attrs]);
  const remaining = creationBudget - allocated;

  const careerStartOpt =
    CAREER_START_OPTIONS.find((o) => o.value === careerStart) ?? CAREER_START_OPTIONS[0];

  const preview = useMemo(
    () =>
      buildUserPlayer({
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
        potentialBonus: careerStartOpt.potentialBonus,
      }),
    [name, nationality, role, battingStyle, bowlingStyle, roleBowls, attrs, careerStartOpt],
  );

  const changeRole = (next: Role) => {
    setRole(next);
    setAttrs(initAttrs());
    const bowls = next === 'BOWLER' || next === 'ALLROUNDER';
    if (bowls && !bowlingStyle) setBowlingStyle('PACE');
  };

  const updateAvatar = <K extends keyof AvatarCustomization>(
    key: K,
    value: AvatarCustomization[K],
  ) => {
    setAvatarCustomization((current) => ({ ...current, [key]: value }));
  };

  const bump = (group: keyof AllAttrs, key: string, delta: number) => {
    setAttrs((prev) => {
      const current = (prev[group] as Record<string, number>)[key];
      const prevRemaining = creationBudget - allocatedCreationPoints(prev);
      const change = creationAttributeDelta(current, delta, prevRemaining);
      if (change === 0) return prev;
      return { ...prev, [group]: { ...prev[group], [key]: current + change } };
    });
  };

  const canProceed = useMemo(() => {
    if (step === 0) {
      return (
        name.trim().length >= 2 && Boolean(nationality) && (!roleBowls || Boolean(bowlingStyle))
      );
    }
    if (step === 2) return Boolean(teamId);
    return true;
  }, [step, name, nationality, roleBowls, bowlingStyle, teamId]);

  const isLast = step === STEP_TITLES.length - 1;
  const onBack = () => (step === 0 ? navigation.goBack() : setStep((s) => s - 1));
  const create = async () => {
    if (!nationality || !teamId) return;
    const player = buildUserPlayer({
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
      potentialBonus: careerStartOpt.potentialBonus,
    });
    const slots = await listSlots('career');
    const slot = route?.params?.slot ?? firstFreeSlot(slots);
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
      avatarCustomization,
    });
    await writeSave('career', slot, save);
    await setLastPlayed('career', slot);
    setActive(save, 'career', slot);
    analytics.setUserProperty('mode', 'career');
    analytics.logEvent(analytics.EVT.CAREER_START, {
      mode: 'career',
      difficulty,
      new_game_plus: Boolean(route?.params?.legacy),
    });
    navigation.reset({ index: 1, routes: [{ name: 'MainMenu' }, { name: 'CareerHub' }] });
  };

  const onNext = () => (isLast ? void create() : setStep((s) => s + 1));

  return (
    <Screen
      key={`player-creation-step-${step}`}
      scroll
      footer={
        <View style={styles.footerRow}>
          <Button
            label="Back"
            variant="ghost"
            fullWidth={false}
            style={styles.flex}
            onPress={onBack}
          />
          <Button
            label={isLast ? 'Start Career' : 'Next'}
            variant={isLast ? 'gold' : 'primary'}
            fullWidth={false}
            style={styles.flex}
            disabled={!canProceed}
            onPress={onNext}
          />
        </View>
      }
    >
      <ScreenHeader
        title={STEP_TITLES[step]}
        subtitle={`Step ${step + 1} of ${STEP_TITLES.length}`}
        onBack={onBack}
      />
      <ProgressBar
        value={(step + 1) / STEP_TITLES.length}
        color={colors.accent}
        style={{ marginBottom: spacing.xl }}
      />

      {step === 0 && (
        <View>
          <Label text="Player name" />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Arjun Rao"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={22}
          />

          <Label text="Nationality" style={{ marginTop: spacing.lg }} />
          <View style={styles.grid}>
            {COUNTRIES.map((c) => {
              const sel = nationality === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => changeNationality(c.id)}
                  style={[styles.tile, sel && styles.tileActive]}
                >
                  <Text style={styles.flag}>{c.flag}</Text>
                  <Text style={[styles.tileText, sel && { color: colors.white }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Card style={styles.avatarCard}>
            <PlayerAvatar
              name={name.trim() || 'Your Player'}
              role={role}
              size="xl"
              showRole
              customization={avatarCustomization}
            />
            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>Create your player look</Text>
              <Text style={styles.avatarSub}>Free identity setup before the pathway begins.</Text>
            </View>
          </Card>
          <AvatarColorRow
            title="Skin tone"
            colors={AVATAR_SKIN_TONES}
            selected={avatarCustomization.skinTone}
            onSelect={(value) => updateAvatar('skinTone', value)}
          />
          <AvatarChoiceRow
            title="Face"
            options={AVATAR_FACE_OPTIONS}
            selected={avatarCustomization.faceShape}
            onSelect={(value) => updateAvatar('faceShape', value)}
          />
          <AvatarChoiceRow
            title="Hair"
            options={AVATAR_HAIR_OPTIONS}
            selected={avatarCustomization.hairStyle}
            onSelect={(value) => updateAvatar('hairStyle', value)}
          />
          <AvatarColorRow
            title="Hair colour"
            colors={AVATAR_HAIR_COLORS}
            selected={avatarCustomization.hairColor}
            onSelect={(value) => updateAvatar('hairColor', value)}
          />
          <AvatarChoiceRow
            title="Beard"
            options={AVATAR_BEARD_OPTIONS}
            selected={avatarCustomization.facialHair}
            onSelect={(value) => updateAvatar('facialHair', value)}
          />
          <AvatarChoiceRow
            title="Moustache"
            options={AVATAR_MOUSTACHE_OPTIONS}
            selected={avatarCustomization.moustache}
            onSelect={(value) => updateAvatar('moustache', value)}
          />
          <AvatarChoiceRow
            title="Brows"
            options={AVATAR_BROW_OPTIONS}
            selected={avatarCustomization.browStyle}
            onSelect={(value) => updateAvatar('browStyle', value)}
          />
          <AvatarColorRow
            title="Eye colour"
            colors={AVATAR_EYE_COLORS}
            selected={avatarCustomization.eyeColor}
            onSelect={(value) => updateAvatar('eyeColor', value)}
          />

          <Label text="Role" style={{ marginTop: spacing.lg }} />
          {ROLES.map((r) => (
            <SelectableCard
              key={r.value}
              title={r.label}
              subtitle={r.desc}
              selected={role === r.value}
              onPress={() => changeRole(r.value)}
              style={{ marginBottom: spacing.sm }}
            />
          ))}

          <Label text="Career identity" style={{ marginTop: spacing.lg }} />
          <Text style={styles.identityHint}>
            This shapes story tone and how your journey is remembered, never your paid progression.
          </Text>
          {(
            [
              {
                value: 'PRODIGY',
                label: 'Prodigy',
                desc: 'Expectation arrives before experience.',
              },
              {
                value: 'LATE_BLOOMER',
                label: 'Late Bloomer',
                desc: 'Earn every step after being overlooked.',
              },
              {
                value: 'SPECIALIST',
                label: 'Specialist',
                desc: 'Build a reputation around one defining skill.',
              },
              {
                value: 'COMEBACK',
                label: 'Comeback Story',
                desc: 'Turn setbacks into the heart of the career.',
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
              <Text style={styles.ironmanDesc}>
                Autosave every consequence. This identity cannot be switched off later.
              </Text>
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
            <ChoiceRow
              label="Bowling style"
              value={bowlingStyle ?? 'PACE'}
              onChange={setBowlingStyle}
              options={BOWLING_STYLES}
            />
          )}
        </View>
      )}

      {step === 1 && (
        <View>
          {/* Pathway is chosen BEFORE allocation so the OVR shown here matches the
              review and in-game value (youth pathways start lower but grow higher). */}
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
          <ChoiceRow
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES}
          />

          <Card style={[styles.summary, { marginTop: spacing.lg }]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{preview.overall}</Text>
              <Text style={styles.summaryLabel}>Starting OVR</Text>
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

          {/* Role hint */}
          <Text
            style={{
              color: colors.textFaint,
              fontSize: fontSize.xs,
              marginBottom: spacing.md,
              fontStyle: 'italic',
            }}
          >
            {role === 'BATTER'
              ? 'Specialist batters receive 150 points and bat in the top four.'
              : role === 'BOWLER'
                ? 'Specialist bowlers receive 150 points and bat with the lower order.'
                : role === 'WK_BATTER'
                  ? 'Wicket-keepers receive 230 points across batting and keeping, and bat around 4 to 6.'
                  : 'All-rounders receive 230 points and bat in the middle order.'}
          </Text>

          {attrSections.map((section) => (
            <View key={section.id} style={{ marginTop: spacing.lg }}>
              <Text style={styles.groupTitle}>{section.label}</Text>
              {section.rows.map(({ group, key, label }) => {
                const value = (attrs[group] as Record<string, number>)[key];
                return (
                  <Stepper
                    key={`${group}-${key}`}
                    label={label}
                    value={value}
                    max={CREATION.maxPerAttr}
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
      )}

      {step === 2 && (
        <View>
          <Label text="Choose your club" />
          {!teamsAreFiltered && (
            <Text
              style={{ color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm }}
            >
              Showing all clubs — pick your nationality in step 1 to filter by country.
            </Text>
          )}
          {countryTeams.map((t) => (
            <SelectableCard
              key={t.id}
              title={t.name}
              selected={teamId === t.id}
              onPress={() => setTeamId(t.id)}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={styles.groupTitle}>Starting pathway</Text>
            <Text style={styles.reviewLabel}>
              This club becomes your Tier 3 academy identity. Senior seasons run List A, First-Class
              and a 14-match T20 league; younger careers reach those blocks through school and
              Under-19 cricket.
            </Text>
          </Card>
        </View>
      )}

      {step === 3 && (
        <View>
          <ReviewRow label="Name" value={name.trim() || '—'} />
          <ReviewRow label="Nationality" value={getCountry(nationality ?? '')?.name ?? '—'} />
          <ReviewRow label="Role" value={ROLES.find((r) => r.value === role)?.label ?? role} />
          <ReviewRow label="Batting" value={battingStyle === 'RHB' ? 'Right-hand' : 'Left-hand'} />
          {roleBowls && (
            <ReviewRow
              label="Bowling"
              value={BOWLING_STYLES.find((b) => b.value === bowlingStyle)?.label ?? '—'}
            />
          )}
          <ReviewRow
            label="Career path"
            value={`${careerStartOpt.label} · Age ${careerStartOpt.ageOverride}`}
          />
          <ReviewRow
            label="Club"
            value={TEAM_BLUEPRINTS.find((t) => t.id === teamId)?.name ?? '—'}
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
          <ReviewRow label="In-game starting OVR" value={String(preview.overall)} highlight />
          {remaining > 0 && (
            <Text style={styles.warn}>You still have {remaining} unspent points.</Text>
          )}
        </View>
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Label text={label} />
      <View style={styles.chips}>
        {options.map((o) => {
          const sel = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.chip, sel && styles.chipActive]}
            >
              <Text style={[styles.chipText, sel && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AvatarChoiceRow<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.avatarBuilderGroup}>
      <Text style={styles.avatarBuilderLabel}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.avatarChoiceRow}
      >
        {options.map((option) => {
          const active = option.id === selected;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(option.id)}
              style={[styles.avatarChip, active && styles.avatarChipActive]}
            >
              <Text style={[styles.avatarChipText, active && styles.avatarChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AvatarColorRow({
  title,
  colors: options,
  selected,
  onSelect,
}: {
  title: string;
  colors: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.avatarBuilderGroup}>
      <Text style={styles.avatarBuilderLabel}>{title}</Text>
      <View style={styles.avatarColorRow}>
        {options.map((color) => {
          const active = color === selected;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`${title} ${color}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(color)}
              style={[styles.avatarSwatchWrap, active && styles.avatarSwatchWrapActive]}
            >
              <View style={[styles.avatarSwatch, { backgroundColor: color }]} />
            </Pressable>
          );
        })}
      </View>
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: {
      flexBasis: '31%',
      flexGrow: 1,
      minWidth: 96,
      alignItems: 'center',
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 4,
    },
    tileActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    flag: { fontSize: 24 },
    tileText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    avatarCard: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    avatarCopy: { flex: 1 },
    avatarTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    avatarSub: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    avatarBuilderGroup: { marginTop: spacing.md },
    avatarBuilderLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    avatarChoiceRow: { gap: spacing.xs, paddingRight: spacing.lg },
    avatarChip: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 36,
      minWidth: 70,
      paddingHorizontal: spacing.md,
    },
    avatarChipActive: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
    avatarChipText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    avatarChipTextActive: { color: colors.accent },
    avatarColorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    avatarSwatchWrap: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 2,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    avatarSwatchWrapActive: { borderColor: colors.accent },
    avatarSwatch: { borderRadius: 14, height: 28, width: 28 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    chipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    chipTextActive: { color: colors.white },
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
