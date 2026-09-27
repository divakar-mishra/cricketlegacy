import fs from 'node:fs';
import path from 'node:path';

// Internal-only capture fixtures. They are derived from deterministic engine
// audit saves and are written outside source control for emulator screenshots.
// Never import these into a release build or represent them as organic careers.
const root = process.cwd();
const inputDir = path.join(root, 'test-artifacts/capture-saves');
const outputDir = path.join(root, 'marketing/capture-2026-09/scenario-saves');
fs.mkdirSync(outputDir, { recursive: true });

const playerScenarios = [
  [
    'MATCH',
    'A HUNDRED TO REMEMBER',
    'A century anchors the innings and turns the match.',
    100,
    83,
    0,
    'ODI',
    'Australia National XI',
    'Lord’s',
  ],
  [
    'MATCH',
    'DOUBLE TON AT LORD’S',
    'A commanding double century puts the touring side in control.',
    200,
    174,
    0,
    'TEST',
    'England National XI',
    'Lord’s',
  ],
  [
    'MILESTONE',
    'THE TRIPLE-CENTURY CLUB',
    'An extraordinary 300 carries the innings into the record books.',
    300,
    276,
    0,
    'TEST',
    'Australia National XI',
    'Melbourne Cricket Ground',
  ],
  [
    'MATCH',
    'FIVE WICKETS, ONE SPELL',
    'A five-wicket spell breaks the opposition’s resistance.',
    0,
    0,
    5,
    'TEST',
    'England National XI',
    'The Oval',
  ],
  [
    'MATCH',
    'SEVEN FALL IN A SESSION',
    'Seven wickets turn a hard-fought Test on its head.',
    0,
    0,
    7,
    'TEST',
    'Australia National XI',
    'Sydney Cricket Ground',
  ],
  [
    'MATCH',
    'A CENTURY IN THE CHASE',
    'A measured hundred completes a demanding chase.',
    118,
    101,
    0,
    'ODI',
    'South Africa National XI',
    'Cape Town',
  ],
  [
    'MATCH',
    'UNBEATEN DOUBLE HUNDRED',
    'An unbeaten 214 leaves the opposition chasing the game.',
    214,
    223,
    0,
    'TEST',
    'New Zealand National XI',
    'Wellington',
  ],
  [
    'MATCH',
    'A SIX-WICKET HAUL',
    'Six wickets give the attack a decisive edge.',
    0,
    0,
    6,
    'TEST',
    'Pakistan National XI',
    'Karachi',
  ],
  [
    'MATCH',
    'A HUNDRED UNDER LIGHTS',
    'A clean-hitting century lifts the evening crowd.',
    107,
    58,
    0,
    'T20',
    'West Indies National XI',
    'Bridgetown',
  ],
  [
    'MATCH',
    'THE ALL-ROUND SHOW',
    'A century and four wickets shape a complete performance.',
    101,
    89,
    4,
    'ODI',
    'Sri Lanka National XI',
    'Colombo',
  ],
  ...Array.from({ length: 10 }, (_, index) => [
    'MATCH',
    `CAREER MOMENT ${index + 11}`,
    `A defining ${index % 2 ? 'batting' : 'bowling'} display enters the scrapbook.`,
    index % 2 ? 150 + index : 0,
    index % 2 ? 121 + index : 0,
    index % 2 ? 0 : 5,
    index % 3 ? 'TEST' : 'ODI',
    index % 2 ? 'England National XI' : 'Australia National XI',
    index % 2 ? 'Lord’s' : 'Adelaide Oval',
  ]),
];

const managerScenarios = [
  [
    'TROPHY',
    'WORLD CUP CHAMPIONS',
    'A composed campaign ends with the World Cup lifted.',
    'ODI',
    'World Cup Final',
    'Australia National XI',
    'Lord’s',
  ],
  [
    'TROPHY',
    'WORLD TEST CHAMPIONSHIP WINNERS',
    'The Test side seals the World Test Championship title.',
    'TEST',
    'World Test Championship Final',
    'England National XI',
    'Lord’s',
  ],
  [
    'MATCH',
    'A TEST WIN IN AUSTRALIA',
    'The touring side wins the Test and the series pressure shifts.',
    'TEST',
    'Australia National XI',
    'Australia National XI',
    'Melbourne Cricket Ground',
  ],
  [
    'MATCH',
    'A TEST WIN IN ENGLAND',
    'A hard-earned away Test victory is secured in England.',
    'TEST',
    'England National XI',
    'England National XI',
    'The Oval',
  ],
  [
    'MATCH',
    'THE ASHES TEST WON AWAY',
    'A disciplined fourth-innings chase settles the contest.',
    'TEST',
    'Australia National XI',
    'Australia National XI',
    'Sydney Cricket Ground',
  ],
  [
    'MATCH',
    'ENGLAND BEATEN AT HOME',
    'The visitors take the decisive moments and the result.',
    'TEST',
    'England National XI',
    'England National XI',
    'Lord’s',
  ],
  [
    'TROPHY',
    'A WORLD CUP FINAL TO REMEMBER',
    'The squad delivers when the trophy is on the line.',
    'ODI',
    'World Cup Final',
    'England National XI',
    'Lord’s',
  ],
  [
    'TROPHY',
    'A TESTING ROAD TO THE TITLE',
    'A season of Test cricket ends with silverware.',
    'TEST',
    'World Test Championship Final',
    'Australia National XI',
    'The Oval',
  ],
  ...Array.from({ length: 12 }, (_, index) => [
    'MATCH',
    `MANAGER’S MATCHDAY ${index + 9}`,
    `A decisive ${index % 2 ? 'home' : 'away'} performance becomes part of the campaign.`,
    index % 2 ? 'ODI' : 'TEST',
    index % 2 ? 'Australia National XI' : 'England National XI',
    index % 2 ? 'Australia National XI' : 'England National XI',
    index % 2 ? 'Melbourne Cricket Ground' : 'Lord’s',
  ]),
];

// Keep every visible headline concrete; avoid generic filler in marketing captures.
playerScenarios.splice(
  10,
  10,
  [
    'MATCH',
    'A SECOND HUNDRED AT LORD’S',
    'A patient innings turns a demanding Test into a statement win.',
    156,
    241,
    0,
    'TEST',
    'England National XI',
    'Lord’s',
  ],
  [
    'MATCH',
    'THREE FIGURES AND THREE WICKETS',
    'A century with the bat and a key wicket define the all-round display.',
    132,
    148,
    3,
    'TEST',
    'Australia National XI',
    'Sydney Cricket Ground',
  ],
  [
    'MATCH',
    'SIX WICKETS IN THE FOURTH INNINGS',
    'A match-winning spell closes out the chase at home.',
    0,
    0,
    6,
    'TEST',
    'England National XI',
    'The Oval',
  ],
  [
    'MATCH',
    'FIVE FOR UNDER THE LIGHTS',
    'A five-wicket haul turns the evening international decisively.',
    0,
    0,
    5,
    'T20',
    'Australia National XI',
    'Adelaide Oval',
  ],
  [
    'MATCH',
    'THE DOUBLE TON THAT SET THE TONE',
    'A 200-run innings establishes control from the first session.',
    200,
    231,
    0,
    'TEST',
    'England National XI',
    'Lord’s',
  ],
  [
    'MATCH',
    'A HUNDRED TO WIN THE SERIES',
    'A measured century seals the series for the touring side.',
    124,
    173,
    0,
    'ODI',
    'Australia National XI',
    'Melbourne Cricket Ground',
  ],
  [
    'MATCH',
    'SEVEN WICKETS, ONE SPELL',
    'Seven wickets dismantle the batting order and finish the Test.',
    0,
    0,
    7,
    'TEST',
    'England National XI',
    'Manchester',
  ],
  [
    'MATCH',
    'THE TRIPLE CENTURY THAT MADE HISTORY',
    'A landmark 300 anchors the biggest innings of the career.',
    300,
    287,
    0,
    'TEST',
    'Australia National XI',
    'Melbourne Cricket Ground',
  ],
  [
    'MATCH',
    'A FIVE-WICKET HAUL AT LORD’S',
    'A decisive spell dismantles the visitors at Lord’s.',
    0,
    0,
    5,
    'TEST',
    'England National XI',
    'Lord’s',
  ],
  [
    'MATCH',
    'UNBEATEN 214 IN ENGLAND',
    'An unbeaten double hundred carries the side through a long day.',
    214,
    301,
    0,
    'TEST',
    'England National XI',
    'The Oval',
  ],
);
managerScenarios.splice(
  8,
  12,
  [
    'MATCH',
    'THE TEST SERIES WON IN AUSTRALIA',
    'The touring side holds its nerve to take the series on Australian soil.',
    'TEST',
    'Test Series',
    'Australia National XI',
    'Melbourne Cricket Ground',
  ],
  [
    'MATCH',
    'ENGLAND BEATEN AT LORD’S',
    'A disciplined away performance earns a famous Test win at Lord’s.',
    'TEST',
    'Test Series',
    'England National XI',
    'Lord’s',
  ],
  [
    'TROPHY',
    'WORLD CUP GLORY',
    'The squad completes a memorable World Cup campaign as champions.',
    'ODI',
    'World Cup Final',
    'Australia National XI',
    'Lord’s',
  ],
  [
    'TROPHY',
    'WORLD TEST CHAMPIONSHIP SECURED',
    'A composed final delivers the World Test Championship trophy.',
    'TEST',
    'World Test Championship Final',
    'England National XI',
    'The Oval',
  ],
  [
    'MATCH',
    'A TEST VICTORY IN PERTH',
    'The visitors win the key sessions and close out the match in Perth.',
    'TEST',
    'Test Series',
    'Australia National XI',
    'Perth',
  ],
  [
    'MATCH',
    'TEST WIN AT THE OVAL',
    'The side earns an away win in a hard-fought Test at The Oval.',
    'TEST',
    'Test Series',
    'England National XI',
    'The Oval',
  ],
  [
    'TROPHY',
    'THE CUP RETURNS HOME',
    'A tournament built on steady performances ends with the World Cup lifted.',
    'ODI',
    'World Cup Final',
    'England National XI',
    'Lord’s',
  ],
  [
    'TROPHY',
    'CHAMPIONS OF THE TEST WORLD',
    'The final result confirms the team as World Test Championship winners.',
    'TEST',
    'World Test Championship Final',
    'Australia National XI',
    'Lord’s',
  ],
  [
    'MATCH',
    'AUSTRALIA FALLS IN SYDNEY',
    'A decisive fourth-innings plan delivers a Test win in Sydney.',
    'TEST',
    'Test Series',
    'Australia National XI',
    'Sydney Cricket Ground',
  ],
  [
    'MATCH',
    'ENGLAND DEFEATED AT MANCHESTER',
    'A complete away performance brings home a Test victory at Manchester.',
    'TEST',
    'Test Series',
    'England National XI',
    'Manchester',
  ],
  [
    'TROPHY',
    'WORLD CUP FINAL WON',
    'The team finishes the tournament with its best performance when it matters.',
    'ODI',
    'World Cup Final',
    'Australia National XI',
    'Melbourne Cricket Ground',
  ],
  [
    'TROPHY',
    'WTC FINAL WON',
    'The team claims the World Test Championship after a decisive final.',
    'TEST',
    'World Test Championship Final',
    'England National XI',
    'The Oval',
  ],
);

function story(save, row, index, mode) {
  const [kind, headline, subheadline] = row;
  const season = save.seasons[save.currentSeasonId];
  const teamName = save.teams[save.userTeamId]?.name ?? 'India National XI';
  const isPlayer = mode === 'career';
  const [runs, balls, wickets, format, competitionName, opponentName, venueName] = isPlayer
    ? [row[3], row[4], row[5], row[6], row[6], row[7], row[8]]
    : [0, 0, 0, row[3], row[4], row[5], row[6]];
  const playerName = isPlayer
    ? (save.players[save.userPlayerId]?.name ?? 'Aarav Sen')
    : 'India National XI';
  const won = true;
  return {
    id: `qa-capture-${mode}-${String(index + 1).padStart(2, '0')}`,
    matchId: `qa-capture-match-${mode}-${String(index + 1).padStart(2, '0')}`,
    createdAt: Date.UTC(season.year, 5, index + 1),
    season: season.year,
    kind,
    format,
    edition: `SEASON ${season.year}`,
    kicker: isPlayer ? 'RECORD BOOK' : 'INTERNATIONAL DESK',
    headline,
    subheadline,
    body: `${subheadline} The match plan held, the key players delivered, and the result gives the campaign fresh momentum.`,
    playerName,
    opponentName,
    result: won ? 'WIN' : 'LOSS',
    runs,
    balls,
    wickets,
    teamName,
    teamScore: isPlayer
      ? runs >= 300
        ? '512/6'
        : `${Math.max(310, runs + 180)}/7`
      : '312/6 & 248',
    opponentScore: isPlayer ? '274 & 226' : '280 & 241',
    resultLine: `${teamName} defeat ${opponentName}`,
    competitionName,
    venueName,
  };
}

function decorate(file, scenarios, mode) {
  const save = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));
  save.experience ??= {};
  save.experience.mediaScrapbook = scenarios.map((row, index) => story(save, row, index, mode));
  if (mode === 'career') {
    const player = save.players[save.userPlayerId];
    player.name = 'Aarav Sen';
    player.age = 39;
    player.retired = false;
    save.flags.retired = false;
    save.managerRetired = false;
    player.careerStats.highScore = 300;
    player.careerStats.hundreds = Math.max(player.careerStats.hundreds ?? 0, 65);
    player.careerStats.wickets = 48;
    player.careerStats.bestBowling = '7/42';
    player.awards = [
      ...new Set([...(player.awards ?? []), 'Test triple century', 'Five-wicket haul']),
    ];
  } else {
    save.managerAge = Math.min(save.managerAge ?? 59, 59);
    save.managerRetired = false;
    save.flags.retired = false;
  }
  save.qaCaptureOnly = true;
  const output = path.join(outputDir, `${mode}-capture-only.json`);
  fs.writeFileSync(output, `${JSON.stringify(save)}\n`);
  console.log(`${output} · ${scenarios.length} QA-only press clippings`);
}

decorate(
  'career-81001.json',
  [...playerScenarios.slice(10), ...playerScenarios.slice(0, 10)],
  'career',
);
decorate(
  'manager-71005.json',
  [...managerScenarios.slice(8), ...managerScenarios.slice(0, 8)],
  'manager',
);
