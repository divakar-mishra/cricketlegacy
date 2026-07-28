/**
 * Core story-event bank for the Player Career.
 *
 * Each event is a narrative beat with 2–4 branching choices; choices carry
 * consequences (attributes, morale, form, brand, integrity, money,
 * relationships, and story flags that unlock later beats). Copy supports
 * {tokens}: {name} {first} {team} {country} {coach} {captain} {mentor} {agent}
 * {rival} {selector}. There is rarely a "correct" answer — only trade-offs.
 */
import { StoryEvent } from '../game/narrative';
import { isSeasonPassActive } from '../game/seasonPass';
import { EXTRA_EVENTS } from './storyEventsExtra';
import { ARCHETYPE_EVENTS } from './archetypeEvents';
import { MONTHLY_PASS_PLAYER_EVENTS } from './monthlyPassPlayerStories';

const CORE_EVENTS: StoryEvent[] = [
  {
    id: 'career_start',
    trigger: 'CAREER_START',
    title: 'The First Morning',
    speaker: '{coach}',
    priority: 100,
    once: true,
    body: "Pre-season. {coach} pulls you aside on the outfield. \u201CWelcome to {team}, {name}. Talent gets you in the door. What you do with it is on you. So \u2014 what kind of cricketer do you want to be?\u201D",
    choices: [
      {
        id: 'work',
        label: 'A relentless worker',
        desc: 'Earn respect through graft',
        effects: {
          attrs: [{ group: 'meta', key: 'discipline', delta: 3 }],
          relationship: [{ id: 'coach', delta: 12 }],
          morale: 4,
          timeline: { kind: 'DEBUT', text: 'Joined {team} determined to out-work everyone.' },
        },
        resultText: '{coach} nods. \u201CGood. The nets open at six. See you there.\u201D',
      },
      {
        id: 'flair',
        label: 'A match-winner',
        desc: 'Back your talent to shine',
        effects: {
          attrs: [{ group: 'meta', key: 'aggression', delta: 3 }],
          brand: 6,
          confidence: 6,
          timeline: { kind: 'DEBUT', text: 'Arrived at {team} with a swagger the fans already love.' },
        },
        resultText: '\u201CConfidence is fine,\u201D {coach} says. \u201CJust make sure the scoreboard agrees with you.\u201D',
      },
      {
        id: 'team',
        label: 'Whatever the team needs',
        desc: 'Selfless from day one',
        effects: {
          relationship: [{ id: 'captain', delta: 12 }, { id: 'coach', delta: 6 }],
          morale: 2,
          flags: { teamFirst: 1 },
          timeline: { kind: 'DEBUT', text: 'Joined {team} as the ultimate team player.' },
        },
        resultText: '{captain} overhears and grins. \u201CI like this one already.\u201D',
      },
    ],
  },

  {
    id: 'press_first_star',
    trigger: 'GOOD_MATCH',
    title: 'The Cameras Find You',
    speaker: 'Press Room',
    weight: 2,
    condition: (c) => (c.rating ?? 0) >= 7.5,
    body: "A cracking performance. The press pack wants a word. The first question is a trap dressed as a compliment: \u201C{first}, some are already calling you the next big thing. Do you agree?\u201D",
    choices: [
      {
        id: 'humble',
        label: '\u201CI just do my job.\u201D',
        desc: 'Deflect, stay grounded',
        effects: { integrity: 4, relationship: [{ id: 'coach', delta: 5 }], morale: 2 },
        resultText: 'A boring quote, but the dressing room respects it. {coach} approves.',
      },
      {
        id: 'bold',
        label: '\u201CJudge me at the end.\u201D',
        desc: 'Confident, quotable',
        effects: { brand: 8, confidence: 4, flags: { outspoken: 1 } },
        resultText: 'It leads the back pages. Your profile spikes \u2014 and so do expectations.',
      },
      {
        id: 'callout',
        label: 'Call out the doubters',
        desc: 'Make it personal',
        effects: { brand: 5, integrity: -4, relationship: [{ id: 'rival', delta: -12 }], flags: { outspoken: 2 } },
        resultText: 'The clip goes viral. {rival} screenshots it. This will come back around.',
      },
    ],
  },

  {
    id: 'slump_coach_talk',
    trigger: 'BAD_MATCH',
    title: 'A Quiet Word',
    speaker: '{coach}',
    weight: 2,
    condition: (c) => (c.user.meta.form ?? 60) < 45,
    body: "Three failures in a row. {coach} finds you in the analysis room. \u201CYour feet aren\u2019t moving. I can drop you to clear your head, or you can tell me you\u2019ll fix it. Your call.\u201D",
    choices: [
      {
        id: 'grind',
        label: 'Ask for extra nets',
        desc: 'Technique work',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 2 }, { group: 'batting', key: 'footwork', delta: 2 }], relationship: [{ id: 'coach', delta: 8 }], form: 4 },
        resultText: 'You stay back for an hour of throwdowns. It hurts. It helps.',
      },
      {
        id: 'rest',
        label: 'Ask to be rested',
        desc: 'Reset mentally',
        effects: { morale: 8, form: 6, brand: -3, relationship: [{ id: 'coach', delta: -3 }] },
        resultText: 'A week away clears the fog \u2014 but a fringe kid scores runs in your place.',
      },
      {
        id: 'defiant',
        label: '\u201CI\u2019m fine. Pick me.\u201D',
        desc: 'Back yourself',
        effects: { confidence: 6, relationship: [{ id: 'coach', delta: -6 }], flags: { defiant: 1 } },
        resultText: '{coach} raises an eyebrow. \u201COkay. Prove it. I\u2019m watching.\u201D',
      },
    ],
  },

  {
    id: 'sponsor_local',
    trigger: 'GOOD_MATCH',
    title: 'A Deal on the Table',
    speaker: '{agent}',
    weight: 2,
    once: true,
    condition: (c) => (c.save.brand ?? 0) >= 25,
    body: "{agent} slides a phone across the cafe table. \u201CA regional bat brand wants you. Small money now, but it opens doors. There\u2019s also a fast-food ad \u2014 more cash, less classy. Or we hold out for something bigger.\u201D",
    choices: [
      {
        id: 'bat',
        label: 'Sign the bat deal',
        desc: 'On-brand, modest pay',
        effects: {
          addSponsor: { brand: 'Willow & Co.', tier: 'LOCAL', perMatchCoins: 40, signingBonus: 300, seasonsLeft: 3 },
          brand: 4,
        },
        resultText: 'A new sticker on your bat and a little money in the bank. It feels real now.',
      },
      {
        id: 'fastfood',
        label: 'Take the fast-food money',
        desc: 'More cash, cheaper image',
        effects: {
          addSponsor: { brand: 'BurgerBlast', tier: 'NATIONAL', perMatchCoins: 70, signingBonus: 600, seasonsLeft: 2, requiresIntegrity: false },
          brand: 6,
          integrity: -5,
        },
        resultText: 'The cheque is fat. The billboard is... a lot. Your mentor sends a facepalm emoji.',
      },
      {
        id: 'hold',
        label: 'Hold out for more',
        desc: 'Bet on yourself',
        effects: { flags: { holdingOut: 1 }, relationship: [{ id: 'agent', delta: -4 }] },
        resultText: '{agent} sighs. \u201CBold. Don\u2019t make me look stupid \u2014 go score some runs.\u201D',
      },
    ],
  },

  {
    id: 'rival_needle',
    trigger: 'IDLE',
    title: 'The Needle',
    speaker: '{rival}',
    weight: 1,
    condition: (c) => (c.save.relationships?.rival?.level ?? 0) <= -5,
    body: "In the tunnel before the toss, {rival} \u2014 quicker than you, and never lets you forget it \u2014 mutters just loud enough: \u201CHeard the selectors think you\u2019re a flat-track bully.\u201D",
    choices: [
      {
        id: 'ignore',
        label: 'Say nothing',
        desc: 'Let your bat talk',
        effects: { confidence: 3, flags: { coolHead: 1 }, relationship: [{ id: 'rival', delta: 2 }] },
        resultText: 'You walk past. Ice. It rattles {rival} more than any comeback would.',
      },
      {
        id: 'fire',
        label: 'Fire back',
        desc: 'Give as good as you get',
        effects: { confidence: 5, integrity: -2, relationship: [{ id: 'rival', delta: -10 }], flags: { feud: 1 } },
        resultText: 'The fourth umpire has words. The feud is officially on the record now.',
      },
      {
        id: 'bet',
        label: 'Make a wager',
        desc: 'Most runs today',
        effects: { confidence: 4, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }], flags: { rivalBet: 1 } },
        resultText: '\u201CMost runs today. Loser carries the drinks.\u201D {rival} smirks. \u201CDeal.\u201D',
      },
    ],
  },

  {
    id: 'captaincy_offer',
    trigger: 'SEASON_END',
    title: 'The Armband',
    speaker: '{coach}',
    once: true,
    priority: 20,
    condition: (c) => !c.save.captainClub && c.user.overall >= 66 && (c.save.relationships?.captain?.level ?? 0) >= 0,
    body: "{captain} is moving on. {coach} closes the office door. \u201CThe group respects you. I want you to lead {team} next season. It\u2019s a burden as much as an honour. Are you ready?\u201D",
    choices: [
      {
        id: 'accept',
        label: 'Accept the captaincy',
        desc: 'Lead from the front',
        effects: {
          captainClub: true,
          confidence: 8,
          brand: 8,
          relationship: [{ id: 'coach', delta: 10 }],
          flags: { captain: 1 },
        },
        resultText: 'You\u2019re captain of {team}. The weight settles on your shoulders \u2014 and it fits.',
      },
      {
        id: 'decline',
        label: 'Not yet \u2014 focus on my game',
        desc: 'Protect your form',
        effects: { form: 5, morale: 4, relationship: [{ id: 'coach', delta: -4 }], flags: { turnedDownCaptaincy: 1 } },
        resultText: '{coach} nods slowly. \u201CHonest. The door won\u2019t stay open forever, though.\u201D',
      },
    ],
  },

  {
    id: 'temptation_approach',
    trigger: 'IDLE',
    title: 'A Stranger\u2019s Offer',
    speaker: 'Unknown Number',
    once: true,
    weight: 1,
    condition: (c) => c.user.overall >= 62,
    body: "A stranger buys you dinner through a \u201Cmutual friend.\u201D Halfway through, the pitch drops: bat slowly for ten balls in one game. Nobody gets hurt. The number he writes on the napkin has a lot of zeros.",
    choices: [
      {
        id: 'refuse',
        label: 'Walk out',
        desc: 'Report it',
        effects: { integrity: 12, morale: -3, relationship: [{ id: 'coach', delta: 8 }], unlockAchievement: 'clean_hands', timeline: { kind: 'STORY', text: 'Reported a corrupt approach to the anti-corruption unit.' } },
        resultText: 'You report it that night. Hands shaking. It\u2019s the proudest you\u2019ve felt off the field.',
      },
      {
        id: 'ignore',
        label: 'Say nothing, do nothing',
        desc: 'Pretend it never happened',
        effects: { integrity: -4, flags: { knewAndStayedQuiet: 1 } },
        resultText: 'You leave the napkin on the table. But you\u2019ll remember his face. And he has yours.',
      },
      {
        id: 'tempted',
        label: 'Ask how it would work',
        desc: 'Dangerous curiosity',
        effects: { integrity: -18, coins: 1200, flags: { compromised: 1 }, relationship: [{ id: 'mentor', delta: -20 }] },
        resultText: 'The money hits your account. So does a weight that never quite lifts.',
      },
    ],
  },

  {
    id: 'callup_moment',
    trigger: 'CALLUP',
    title: 'The Call',
    speaker: '{selector}',
    once: true,
    priority: 50,
    body: "Your phone rings with an unknown code. \u201C{first}? {selector} here. Congratulations, son. You\u2019re in the {country} squad. Don\u2019t let anyone tell you it\u2019s a fluke.\u201D Your hands won\u2019t stop shaking.",
    choices: [
      {
        id: 'family',
        label: 'Call your family first',
        desc: 'Share the moment',
        effects: { morale: 12, brand: 4, timeline: { kind: 'CALLUP', text: 'Called up to the {country} squad \u2014 rang home before anyone else.' } },
        resultText: 'Your mother cries down the phone. Everything you sacrificed just became worth it.',
      },
      {
        id: 'work',
        label: 'Head straight to the nets',
        desc: 'Prove you belong',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], confidence: 6, form: 4, timeline: { kind: 'CALLUP', text: 'Called up for {country} \u2014 and was in the nets an hour later.' } },
        resultText: 'No celebration. Just throwdowns until dark. This is only the start.',
      },
    ],
  },

  {
    id: 'injury_setback',
    trigger: 'INJURY',
    title: 'The Physio\u2019s Verdict',
    speaker: 'Team Physio',
    body: "The scan is back. It\u2019s not season-ending, but it\u2019s real. \u201CYou can rush back and risk it going again,\u201D the physio says, \u201Cor do the rehab properly and come back stronger. Players your age always want to rush.\u201D",
    choices: [
      {
        id: 'proper',
        label: 'Do the rehab properly',
        desc: 'Long game',
        effects: { attrs: [{ group: 'meta', key: 'fitness', delta: 4 }], morale: -4, form: -4, flags: { patient: 1 } },
        resultText: 'Weeks in the gym while others play. But you come back moving better than ever.',
      },
      {
        id: 'rush',
        label: 'Rush back for the run-in',
        desc: 'High risk',
        effects: { form: 4, morale: 4, attrs: [{ group: 'meta', key: 'fitness', delta: -5 }], flags: { rushedBack: 1 } },
        resultText: 'You strap up and play. The crowd roars your name. Your knee has other opinions.',
      },
    ],
  },

  {
    id: 'mentor_wisdom',
    trigger: 'POST_MATCH',
    title: 'The Old Pro',
    speaker: '{mentor}',
    weight: 1,
    once: true,
    condition: (c) => (c.save.relationships?.mentor?.level ?? 0) >= 10,
    body: "{mentor}, twelve years your senior and near the end, sits beside you as the ground empties. \u201CCan I give you the advice nobody gave me? Money, fame, records \u2014 chase what you like. But the game remembers how you treated people.\u201D",
    choices: [
      {
        id: 'listen',
        label: 'Really listen',
        desc: 'Take it to heart',
        effects: { integrity: 6, relationship: [{ id: 'mentor', delta: 12 }], morale: 4, flags: { mentored: 1 } },
        resultText: 'You talk until the floodlights die. You\u2019ll carry this conversation for years.',
      },
      {
        id: 'polite',
        label: 'Nod politely',
        desc: 'You\u2019ve heard it before',
        effects: { relationship: [{ id: 'mentor', delta: -4 }] },
        resultText: 'He sees you check your phone. He stops talking. Something closes a little.',
      },
    ],
  },

  {
    id: 'life_balance',
    trigger: 'IDLE',
    title: 'Someone Back Home',
    weight: 1,
    once: true,
    body: "It\u2019s your closest friend\u2019s wedding \u2014 the same weekend as a crucial fixture. There\u2019s no easy version of this conversation. Cricket has already cost you birthdays, funerals, ordinary Tuesdays.",
    choices: [
      {
        id: 'game',
        label: 'Play the match',
        desc: 'The team needs you',
        effects: { form: 4, morale: -6, relationship: [{ id: 'coach', delta: 6 }], flags: { sacrificedLife: 1 } },
        resultText: 'You score runs. Your phone fills with photos you weren\u2019t in. Both things are true.',
      },
      {
        id: 'wedding',
        label: 'Go to the wedding',
        desc: 'Some things matter more',
        effects: { morale: 12, relationship: [{ id: 'coach', delta: -5 }], form: -2, flags: { choseLife: 1 } },
        resultText: 'You dance badly and laugh until it hurts. Monday\u2019s cricket can wait one weekend.',
      },
    ],
  },

  {
    id: 'season_reflection',
    trigger: 'SEASON_END',
    title: 'Season\u2019s End',
    speaker: '{coach}',
    weight: 1,
    body: "The last ball of the season is bowled. {coach} finds you packing your kit. \u201CLong year. Before you disappear for the break \u2014 what did you learn about yourself?\u201D",
    choices: [
      {
        id: 'hunger',
        label: '\u201CI want more.\u201D',
        desc: 'Channel ambition',
        effects: { confidence: 5, form: 4, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }] },
        resultText: 'He smiles. \u201CGood. Hold onto that when it gets hard. It always gets hard.\u201D',
      },
      {
        id: 'balance',
        label: '\u201CTo enjoy it more.\u201D',
        desc: 'Find peace',
        effects: { morale: 10, integrity: 3 },
        resultText: '\u201CThe ones who last,\u201D he says, \u201Care the ones who remember to enjoy it. Rest well.\u201D',
      },
    ],
  },
];

const PASS_EVENTS: StoryEvent[] = [
  {
    id: 'pass_captains_table',
    trigger: 'IDLE',
    title: "The Captain's Table",
    speaker: '{captain}',
    weight: 2,
    condition: (context) => isSeasonPassActive(context.save),
    body: '{captain} invites you to a private tactical review. One question dominates the room: what identity should {team} carry into the next match?',
    choices: [
      { id: 'brave', label: 'Play without fear', desc: 'Back controlled aggression', effects: { confidence: 5, attrs: [{ group: 'meta', key: 'aggression', delta: 1 }], relationship: [{ id: 'captain', delta: 5 }] }, resultText: '{captain} nods. The plan is bold, but everyone understands the risk.' },
      { id: 'patient', label: 'Win the long moments', desc: 'Prioritise discipline', effects: { morale: 3, attrs: [{ group: 'meta', key: 'discipline', delta: 1 }], relationship: [{ id: 'coach', delta: 4 }] }, resultText: 'The room settles around a patient plan. Nobody expects an easy win.' },
    ],
  },
  {
    id: 'pass_legacy_interview',
    trigger: 'GOOD_MATCH',
    title: 'Legacy Interview',
    speaker: 'Clubhouse Studio',
    weight: 2,
    condition: (context) => isSeasonPassActive(context.save) && (context.rating ?? 0) >= 7,
    body: 'The studio asks what mattered most in your performance: personal preparation, trust from teammates, or proving a point to {rival}?',
    choices: [
      { id: 'prep', label: 'Preparation', effects: { integrity: 3, relationship: [{ id: 'coach', delta: 4 }] }, resultText: 'The answer is measured, and the coaching group remembers the credit.' },
      { id: 'team', label: 'Trust from the team', effects: { morale: 5, relationship: [{ id: 'captain', delta: 5 }] }, resultText: 'The dressing room clips the interview. It lands exactly as intended.' },
      { id: 'rival', label: 'I had a point to prove', effects: { brand: 5, confidence: 4, relationship: [{ id: 'rival', delta: -5 }] }, resultText: 'The quote travels quickly. So does the reply from {rival}.' },
    ],
  },
];

/** The full bank the engine draws from (core beats + the extended bank). */
export const STORY_EVENTS: StoryEvent[] = [
  ...CORE_EVENTS,
  ...ARCHETYPE_EVENTS,
  ...EXTRA_EVENTS,
  ...PASS_EVENTS,
  ...MONTHLY_PASS_PLAYER_EVENTS,
];
