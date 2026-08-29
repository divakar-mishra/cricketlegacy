export interface MonthlyPassContent {
  id: string;
  title: string;
  description: string;
  kit: { id: string; label: string; color: string };
  celebration: { id: string; label: string; preview: string };
  office: { inventoryId: string; themeId: string; label: string; accent: string };
  collectible: { id: string; label: string };
  scenario: {
    id: string;
    title: string;
    description: string;
    objective: string;
    targetMatches: number;
    targetWins: number;
    rewardCoins: number;
    tournament: boolean;
  };
  playerStory: { openingTitle: string; hook: string; followUpTitle: string; consequence: string };
  managerStory: { openingTitle: string; hook: string; followUpTitle: string; consequence: string };
}

/**
 * One full year of recurring pass content. Every cycle has three cosmetics,
 * including a Manager-only office theme, plus a collectible that never appears
 * on the tier ladder. IDs are permanent ownership keys and must never be reused.
 */
export const MONTHLY_PASS_CONTENT: readonly MonthlyPassContent[] = [
  {
    id: 'monsoon_nights',
    title: 'Monsoon Nights',
    description: 'Wet outfields, late movement and a month built around adaptability.',
    kit: { id: 'pass_kit_monsoon', label: 'Monsoon Teal kit', color: '#0B6B62' },
    celebration: { id: 'pass_celebration_rainmaker', label: 'Rainmaker salute', preview: '///' },
    office: {
      inventoryId: 'pass_office_monsoon',
      themeId: 'office_monsoon',
      label: 'Monsoon strategy room',
      accent: '#36C6B0',
    },
    collectible: { id: 'pass_memento_monsoon', label: 'Monsoon pennant' },
    scenario: {
      id: 'monsoon_chase',
      title: 'The Wet Chase',
      description: 'A three-match pressure run where adaptability matters more than perfection.',
      objective: 'Win 2 of your next 3 matches.',
      targetMatches: 3,
      targetWins: 2,
      rewardCoins: 1_250,
      tournament: false,
    },
    playerStory: {
      openingTitle: 'Rain on the Covers',
      hook: 'A shortened match forces the captain to choose between aggression and control.',
      followUpTitle: 'The Revised Target',
      consequence: 'Your earlier advice now shapes who the dressing room trusts under uncertainty.',
    },
    managerStory: {
      openingTitle: 'Forecast Meeting',
      hook: 'The analysts expect interruptions and ask you to commit to a flexible match plan.',
      followUpTitle: 'A Moving Target',
      consequence: 'The board now judges whether your flexibility looked decisive or indecisive.',
    },
  },
  {
    id: 'coastal_clash',
    title: 'Coastal Clash',
    description: 'Sea breeze, hard lengths and a rivalry played at full volume.',
    kit: { id: 'pass_kit_coastal', label: 'Coastal Coral kit', color: '#D94F4F' },
    celebration: { id: 'pass_celebration_wave', label: 'Breaking Wave', preview: '~~~' },
    office: {
      inventoryId: 'pass_office_harbour',
      themeId: 'office_harbour',
      label: 'Harbour boardroom',
      accent: '#50B7C5',
    },
    collectible: { id: 'pass_memento_coastal', label: 'Coastal rivalry crest' },
    scenario: {
      id: 'coastal_clash_series',
      title: 'Coastal Clash Series',
      description: 'A compact rivalry series where one poor result cannot become a collapse.',
      objective: 'Win 3 of your next 4 matches.',
      targetMatches: 4,
      targetWins: 3,
      rewardCoins: 1_650,
      tournament: true,
    },
    playerStory: {
      openingTitle: 'The Away End',
      hook: 'A hostile crowd turns a routine fixture into a test of temperament.',
      followUpTitle: 'Noise After Midnight',
      consequence: 'Your response becomes part of the rivalry before the return fixture.',
    },
    managerStory: {
      openingTitle: 'Derby Week',
      hook: 'Supporters demand a statement while the staff warn against abandoning the season plan.',
      followUpTitle: 'The Morning Papers',
      consequence:
        'Your derby message now affects both supporter patience and dressing-room belief.',
    },
  },
  {
    id: 'heritage_cup',
    title: 'Heritage Cup',
    description:
      'Tradition, old records and the pressure of representing everyone who came before.',
    kit: { id: 'pass_kit_heritage', label: 'Heritage Maroon kit', color: '#7B1E2B' },
    celebration: { id: 'pass_celebration_crest', label: 'Crest touch', preview: '[C]' },
    office: {
      inventoryId: 'pass_office_heritage',
      themeId: 'office_heritage',
      label: 'Heritage gallery',
      accent: '#D5B56D',
    },
    collectible: { id: 'pass_memento_heritage', label: 'Founders medal' },
    scenario: {
      id: 'heritage_knockout',
      title: 'Heritage Knockout',
      description: 'A fictional knockout run carrying the weight of the club history.',
      objective: 'Win 3 consecutive matches.',
      targetMatches: 3,
      targetWins: 3,
      rewardCoins: 1_900,
      tournament: true,
    },
    playerStory: {
      openingTitle: 'The Old Cap',
      hook: 'A club great presents the squad with an heirloom before the cup begins.',
      followUpTitle: 'What the Cap Means',
      consequence: 'The veteran remembers whether you treated history as fuel or as weight.',
    },
    managerStory: {
      openingTitle: 'Founders Night',
      hook: 'Former players want tradition protected while your analysts argue for change.',
      followUpTitle: 'A Club in Two Eras',
      consequence:
        'Your choice defines how the board talks about the project for the rest of the month.',
    },
  },
  {
    id: 'neon_finals',
    title: 'Neon Finals',
    description: 'Night matches, bold tactics and a modern stage for high-pressure cricket.',
    kit: { id: 'pass_kit_neon', label: 'Neon Finals kit', color: '#42D77D' },
    celebration: { id: 'pass_celebration_pulse', label: 'Pulse point', preview: '*.*' },
    office: {
      inventoryId: 'pass_office_analytics',
      themeId: 'office_analytics',
      label: 'Analytics lab',
      accent: '#5DADE2',
    },
    collectible: { id: 'pass_memento_neon', label: 'Finals light badge' },
    scenario: {
      id: 'neon_final_four',
      title: 'Final Four',
      description: 'A four-match sprint that rewards sustained control under lights.',
      objective: 'Win 3 of your next 4 matches.',
      targetMatches: 4,
      targetWins: 3,
      rewardCoins: 1_700,
      tournament: true,
    },
    playerStory: {
      openingTitle: 'Under the LED Wall',
      hook: 'The media team wants a louder persona just as the cricket gets serious.',
      followUpTitle: 'The Clip Goes Live',
      consequence: 'The version of yourself you presented now follows you into the final.',
    },
    managerStory: {
      openingTitle: 'The Data Wall',
      hook: 'A new model challenges the instincts of your most experienced coach.',
      followUpTitle: 'Numbers in the Dugout',
      consequence: 'The staff remember whether you backed evidence, experience or a compromise.',
    },
  },
  {
    id: 'winter_tour',
    title: 'Winter Tour',
    description: 'Cold mornings, unfamiliar conditions and a test of life away from home.',
    kit: { id: 'pass_kit_winter', label: 'Winter Ice kit', color: '#D8E7F0' },
    celebration: { id: 'pass_celebration_ice', label: 'Ice Veins', preview: 'ICE' },
    office: {
      inventoryId: 'pass_office_winter',
      themeId: 'office_winter',
      label: 'Winter tour suite',
      accent: '#8FB8D8',
    },
    collectible: { id: 'pass_memento_winter', label: 'Winter tour patch' },
    scenario: {
      id: 'winter_away_run',
      title: 'Away from Home',
      description: 'Recover quickly across a demanding fictional away schedule.',
      objective: 'Win 2 of your next 4 matches.',
      targetMatches: 4,
      targetWins: 2,
      rewardCoins: 1_300,
      tournament: false,
    },
    playerStory: {
      openingTitle: 'A Long Way from Home',
      hook: 'A teammate is struggling with the isolation of the tour and asks for your help.',
      followUpTitle: 'The Quiet Breakfast',
      consequence: 'Your teammate remembers whether you made time when nobody else noticed.',
    },
    managerStory: {
      openingTitle: 'Tour Fatigue',
      hook: 'The performance team asks you to rest stars before a commercially important fixture.',
      followUpTitle: 'The Cost of Rotation',
      consequence: 'Players and directors now attach different meanings to your idea of duty.',
    },
  },
  {
    id: 'champions_month',
    title: 'Champions Month',
    description: 'A celebration of winning habits without pretending trophies are guaranteed.',
    kit: { id: 'pass_kit_champions', label: 'Champions Gold kit', color: '#C9972B' },
    celebration: { id: 'pass_celebration_crown', label: 'Champion stance', preview: '^W^' },
    office: {
      inventoryId: 'pass_office_champions',
      themeId: 'office_champions',
      label: 'Champions room',
      accent: '#E1B94F',
    },
    collectible: { id: 'pass_memento_champions', label: 'Champions ribbon' },
    scenario: {
      id: 'champions_invitational',
      title: 'Champions Invitational',
      description: 'A premium five-match challenge layered onto the current career calendar.',
      objective: 'Win 4 of your next 5 matches.',
      targetMatches: 5,
      targetWins: 4,
      rewardCoins: 2_200,
      tournament: true,
    },
    playerStory: {
      openingTitle: 'The Winning Standard',
      hook: 'The captain asks what the squad must sacrifice to become champions.',
      followUpTitle: 'Standards Have a Cost',
      consequence: 'The dressing room now measures your daily actions against your answer.',
    },
    managerStory: {
      openingTitle: 'The Title Window',
      hook: 'The board believes the squad can win now, but the academy needs patience and funding.',
      followUpTitle: 'One Month, Two Futures',
      consequence: 'Your priorities now shape both board expectations and player development.',
    },
  },
  {
    id: 'rising_stars',
    title: 'Rising Stars',
    description: 'Prospects, mentors and the difficult choices behind a genuine pathway.',
    kit: { id: 'pass_kit_rising', label: 'Rising Violet kit', color: '#7B5CC7' },
    celebration: { id: 'pass_celebration_startrail', label: 'Star trail', preview: '+*+' },
    office: {
      inventoryId: 'pass_office_academy',
      themeId: 'office_academy',
      label: 'Academy loft',
      accent: '#9D86E8',
    },
    collectible: { id: 'pass_memento_rising', label: 'Rising star pin' },
    scenario: {
      id: 'rising_stars_series',
      title: 'Rising Stars Series',
      description: 'Build momentum while younger teammates face selection pressure.',
      objective: 'Win 2 of your next 3 matches.',
      targetMatches: 3,
      targetWins: 2,
      rewardCoins: 1_350,
      tournament: false,
    },
    playerStory: {
      openingTitle: 'The Next One Up',
      hook: 'A highly rated prospect asks whether talent alone is enough to survive.',
      followUpTitle: 'Advice Remembered',
      consequence: 'The prospect acts on your words and changes the competition around your place.',
    },
    managerStory: {
      openingTitle: 'The Pathway Promise',
      hook: 'A prospect wants minutes while a reliable veteran expects loyalty.',
      followUpTitle: 'Selection Has a Memory',
      consequence: 'The squad now understands what your pathway promise means in practice.',
    },
  },
  {
    id: 'red_soil_rivalry',
    title: 'Red Soil Rivalry',
    description: 'A fierce regional contest built around pride, patience and pressure.',
    kit: { id: 'pass_kit_redsoil', label: 'Red Soil kit', color: '#B84232' },
    celebration: { id: 'pass_celebration_dust', label: 'Dust storm', preview: ':::' },
    office: {
      inventoryId: 'pass_office_rivalry',
      themeId: 'office_rivalry',
      label: 'Rivalry room',
      accent: '#E36A54',
    },
    collectible: { id: 'pass_memento_redsoil', label: 'Rivalry shield' },
    scenario: {
      id: 'red_soil_test',
      title: 'Red Soil Test',
      description: 'A bruising sequence where recovery after defeat matters.',
      objective: 'Win 3 of your next 5 matches.',
      targetMatches: 5,
      targetWins: 3,
      rewardCoins: 1_700,
      tournament: false,
    },
    playerStory: {
      openingTitle: 'A Line in the Dirt',
      hook: 'Your rival turns a routine interview into a public challenge.',
      followUpTitle: 'The Reply',
      consequence:
        'The rivalry changes depending on whether you escalated, defused or redirected it.',
    },
    managerStory: {
      openingTitle: 'Rivalry Clause',
      hook: 'A sponsor offers a bonus for the derby but wants influence over team messaging.',
      followUpTitle: 'Who Owns the Rivalry',
      consequence: 'Supporters and directors remember whose priorities you protected.',
    },
  },
  {
    id: 'night_derby',
    title: 'Night Derby',
    description: 'A city rivalry under lights where every tactical choice is magnified.',
    kit: { id: 'pass_kit_derby', label: 'Night Derby kit', color: '#152B52' },
    celebration: { id: 'pass_celebration_lightsout', label: 'Lights Out', preview: 'XOX' },
    office: {
      inventoryId: 'pass_office_derby',
      themeId: 'office_derby',
      label: 'Derby war room',
      accent: '#5D86D7',
    },
    collectible: { id: 'pass_memento_derby', label: 'Night derby ticket' },
    scenario: {
      id: 'night_derby_cup',
      title: 'Night Derby Cup',
      description: 'A fictional knockout event with no room for a slow start.',
      objective: 'Win 3 consecutive matches.',
      targetMatches: 3,
      targetWins: 3,
      rewardCoins: 1_950,
      tournament: true,
    },
    playerStory: {
      openingTitle: 'The Tunnel Stare',
      hook: 'A familiar opponent tries to unsettle you before the biggest match in the city.',
      followUpTitle: 'After the Floodlights',
      consequence: 'Your response becomes a story supporters repeat at the next derby.',
    },
    managerStory: {
      openingTitle: 'City Divided',
      hook: 'The board wants control, supporters want attack and your squad wants clarity.',
      followUpTitle: 'The Derby Debrief',
      consequence: 'The club now knows whose voice carries most weight in your office.',
    },
  },
  {
    id: 'festival_cricket',
    title: 'Festival Cricket',
    description: 'Colour, packed stands and the tension between entertainment and results.',
    kit: { id: 'pass_kit_festival', label: 'Festival Rose kit', color: '#E04F87' },
    celebration: { id: 'pass_celebration_fireworks', label: 'Firework finish', preview: '*^*' },
    office: {
      inventoryId: 'pass_office_festival',
      themeId: 'office_festival',
      label: 'Festival lounge',
      accent: '#FF8EC4',
    },
    collectible: { id: 'pass_memento_festival', label: 'Festival wristband' },
    scenario: {
      id: 'festival_sprint',
      title: 'Festival Sprint',
      description: 'An attacking four-match run in front of packed fictional venues.',
      objective: 'Win 2 of your next 4 matches.',
      targetMatches: 4,
      targetWins: 2,
      rewardCoins: 1_250,
      tournament: false,
    },
    playerStory: {
      openingTitle: 'Play to the Crowd',
      hook: 'A promoter wants spectacle while the coach wants the percentage option.',
      followUpTitle: 'Applause and Scoreboards',
      consequence: 'Your choice changes how the crowd, coach and captain define responsibility.',
    },
    managerStory: {
      openingTitle: 'The Entertainment Brief',
      hook: 'Commercial staff ask for aggressive cricket during the highest-attendance week.',
      followUpTitle: 'The Gate and the Result',
      consequence: 'The board compares the match result with the commercial promise you made.',
    },
  },
  {
    id: 'record_breakers',
    title: 'Record Breakers',
    description: 'Personal milestones meet team responsibility in a month about legacy.',
    kit: { id: 'pass_kit_records', label: 'Record Blue kit', color: '#2970B5' },
    celebration: { id: 'pass_celebration_numberone', label: 'Number One', preview: '#1' },
    office: {
      inventoryId: 'pass_office_records',
      themeId: 'office_records',
      label: 'Records vault',
      accent: '#6CA8E5',
    },
    collectible: { id: 'pass_memento_records', label: 'Record book plate' },
    scenario: {
      id: 'record_breakers_run',
      title: 'Record Breakers Run',
      description: 'A sustained run that rewards consistency rather than one spectacular result.',
      objective: 'Win 4 of your next 6 matches.',
      targetMatches: 6,
      targetWins: 4,
      rewardCoins: 2_250,
      tournament: false,
    },
    playerStory: {
      openingTitle: 'One Away',
      hook: 'A personal record is within reach, but chasing it could distort the team plan.',
      followUpTitle: 'What the Record Says',
      consequence: 'Teammates remember whether the milestone belonged to you or to the group.',
    },
    managerStory: {
      openingTitle: 'History Within Reach',
      hook: 'A club record is close enough to shape selection and tactics.',
      followUpTitle: 'The Record Ledger',
      consequence: 'The board records whether you protected the achievement or the process.',
    },
  },
  {
    id: 'legacy_finals',
    title: 'Legacy Finals',
    description: 'The annual closing chapter: endings, succession and what survives a season.',
    kit: { id: 'pass_kit_legacy', label: 'Legacy Black kit', color: '#20252A' },
    celebration: { id: 'pass_celebration_legacy', label: 'Legacy salute', preview: 'L//L' },
    office: {
      inventoryId: 'pass_office_legacy',
      themeId: 'office_legacy',
      label: 'Legacy boardroom',
      accent: '#C9A45C',
    },
    collectible: { id: 'pass_memento_legacy', label: 'Legacy year plate' },
    scenario: {
      id: 'legacy_finale',
      title: 'Legacy Finale',
      description: 'The hardest fictional challenge of the annual pass calendar.',
      objective: 'Win 4 of your next 5 matches.',
      targetMatches: 5,
      targetWins: 4,
      rewardCoins: 2_400,
      tournament: true,
    },
    playerStory: {
      openingTitle: 'The Letter to Tomorrow',
      hook: 'The club asks you to write one message for the next generation.',
      followUpTitle: 'A Letter Read Aloud',
      consequence: 'Your words become part of how teammates describe your season.',
    },
    managerStory: {
      openingTitle: 'The Succession File',
      hook: 'The board asks what part of the club must outlast your own tenure.',
      followUpTitle: 'What You Leave Behind',
      consequence: 'Your answer becomes a long-term objective instead of a press-conference line.',
    },
  },
] as const;

export function monthlyContentIndex(cycleId: string): number {
  const calendarMonth = /^pass-\d{4}-(\d{2})$/.exec(cycleId);
  if (calendarMonth) {
    const month = Number.parseInt(calendarMonth[1], 10);
    if (month >= 1 && month <= 12) return month - 1;
  }
  const parsed = Number.parseInt(cycleId.replace(/\D/g, ''), 10);
  const value = Number.isFinite(parsed) ? parsed : 0;
  return (
    ((value % MONTHLY_PASS_CONTENT.length) + MONTHLY_PASS_CONTENT.length) %
    MONTHLY_PASS_CONTENT.length
  );
}

export function monthlyContentForCycle(cycleId: string): MonthlyPassContent {
  return MONTHLY_PASS_CONTENT[monthlyContentIndex(cycleId)];
}

export const MONTHLY_PASS_ITEM_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  MONTHLY_PASS_CONTENT.flatMap((content) => [
    [content.kit.id, content.kit.label],
    [content.celebration.id, content.celebration.label],
    [content.office.inventoryId, content.office.label],
    [content.collectible.id, content.collectible.label],
  ]),
);
