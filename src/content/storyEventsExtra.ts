/**
 * Extended story-event bank (authored to expand the core set in
 * content/storyEvents.ts). Kept in its own file so the content can grow without
 * touching the engine or the hand-written core beats.
 *
 * Same house style as CORE_EVENTS: grounded, literary, second-person, with real
 * trade-offs and no obviously-correct choice. Copy supports {tokens}: {name}
 * {first} {team} {country} {coach} {captain} {mentor} {agent} {rival} {selector}.
 *
 * Several beats chain into multi-event storylines via `queueEvent` +
 * `condition`/`requiresFlag`:
 *   - Rivalry:      x_rivalry_spark -> x_rivalry_media -> x_rivalry_resolution
 *   - Sponsorship:  x_sponsor_global_offer -> x_sponsor_scandal -> x_sponsor_fallout
 *   - Corruption:   x_fixer_returns -> x_acu_knock  (+ x_teammate_approached)
 *   - Injury:       x_injury_long_road -> x_injury_dark_days -> x_injury_comeback_match
 *   - Loyalty:      x_agent_bigger_club -> x_transfer_decision
 *   - Mentoring:    x_gym_youngster -> x_youngster_choice
 *   - Captaincy:    x_captain_first_test / x_captain_dressing_room / x_captain_burnout
 */
import { StoryEvent } from '../game/narrative';

export const EXTRA_EVENTS: StoryEvent[] = [
  /* ------------------------------------------------------------------ *
   * IDLE — life between the whites: media, money, temptation, family    *
   * ------------------------------------------------------------------ */
  {
    id: 'x_social_media_storm',
    trigger: 'IDLE',
    title: 'The Old Post',
    speaker: '{agent}',
    weight: 2,
    once: true,
    body: "{agent} calls at midnight, voice tight. \u201CSomeone dug up a stupid post from your teenage account. It\u2019s trending. We can delete it and stay quiet, apologise properly, or get ahead of it and laugh it off. Pick fast \u2014 the internet doesn\u2019t sleep.\u201D",
    choices: [
      {
        id: 'apologise',
        label: 'Apologise sincerely',
        desc: 'Own it fully',
        effects: { integrity: 8, brand: -4, morale: -3, relationship: [{ id: 'agent', delta: 3 }] },
        resultText: "You write it yourself, no PR gloss. Some mock you for going soft. More respect you for meaning it.",
      },
      {
        id: 'delete',
        label: 'Delete and deny',
        desc: 'Make it disappear',
        effects: { brand: 3, integrity: -6, flags: { hidPast: 1 } },
        resultText: "It\u2019s gone within the hour. Screenshots, of course, are forever. You just have to hope nobody kept one.",
      },
      {
        id: 'joke',
        label: 'Laugh it off',
        desc: 'Turn it into a meme',
        effects: { brand: 7, confidence: 3, integrity: -2 },
        resultText: "Your self-deprecating reply gets more likes than the original. Crisis becomes content. {agent} exhales.",
      },
    ],
  },

  {
    id: 'x_charity_visit',
    trigger: 'IDLE',
    title: 'The Children\u2019s Ward',
    weight: 2,
    body: "A hospital invites you to visit the children\u2019s ward \u2014 no cameras, no coverage, just an afternoon. It clashes with a recovery day the fitness staff mapped out for you.",
    choices: [
      {
        id: 'go_quiet',
        label: 'Go, tell no one',
        desc: 'For them, not the feed',
        effects: { integrity: 8, morale: 8, form: -2 },
        resultText: "You spend three hours signing plaster casts and losing at cards. Nobody films it. You drive home lighter than you\u2019ve felt in months.",
      },
      {
        id: 'go_public',
        label: 'Go, bring the cameras',
        desc: 'Do good, look good',
        effects: { brand: 8, integrity: -2, morale: 4 },
        resultText: "The photos are lovely and the reach is huge. A few call it a stunt. The kids didn\u2019t care either way \u2014 and neither, quite, did you.",
      },
      {
        id: 'decline',
        label: 'Stick to recovery',
        desc: 'Protect your body',
        effects: { attrs: [{ group: 'meta', key: 'fitness', delta: 3 }], morale: -4, flags: { skippedCharity: 1 } },
        resultText: "You do the right thing for your career and feel wrong about it all evening. The ward sends a thank-you anyway. That stings more.",
      },
    ],
  },

  {
    id: 'x_burnout_whisper',
    trigger: 'IDLE',
    title: 'Running on Empty',
    weight: 2,
    condition: (c) => (c.user.morale ?? 70) < 45,
    body: "You realise you can\u2019t remember the last day you didn\u2019t think about cricket. Sleep is thin. The bat feels heavy before you\u2019ve even picked it up. Nobody\u2019s noticed yet. You could keep it that way.",
    choices: [
      {
        id: 'speak',
        label: 'Tell the team psychologist',
        desc: 'Ask for help',
        effects: { morale: 10, integrity: 3, relationship: [{ id: 'coach', delta: 4 }], flags: { openedUp: 1 } },
        resultText: "Saying it out loud cracks something open. She doesn\u2019t fix you in an hour, but for the first time in weeks you feel less alone.",
      },
      {
        id: 'push',
        label: 'Push through it',
        desc: 'Grind in silence',
        effects: { confidence: -4, form: 3, attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], flags: { bottledUp: 1 } },
        resultText: "You bury it under more work. The runs come, briefly. The emptiness waits, patient, for the quiet moments.",
      },
      {
        id: 'break',
        label: 'Take a real break',
        desc: 'Switch off completely',
        effects: { morale: 12, form: -5, brand: -2 },
        resultText: "You turn your phone off for a week and go somewhere green. The world keeps spinning without you. That, it turns out, is the lesson.",
      },
    ],
  },

  {
    id: 'x_superstition_ritual',
    trigger: 'IDLE',
    title: 'The Left Pad First',
    weight: 1,
    body: "It started as a joke \u2014 left pad first, the same walk to the crease, the lucky under-shirt you refuse to retire. Then you had a good run, and now you can\u2019t stop. A teammate teases you about it in front of the group.",
    choices: [
      {
        id: 'embrace',
        label: 'Lean into the ritual',
        desc: 'Whatever works',
        effects: { confidence: 6, flags: { superstitious: 1 } },
        resultText: "You laugh and double down. If the brain believes it, the hands relax. Silly, maybe. But you feel ready.",
      },
      {
        id: 'drop',
        label: 'Ditch the crutch',
        desc: 'Trust preparation, not luck',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 3 }], confidence: -2, integrity: 2 },
        resultText: "You throw the under-shirt in the wash and bat on process alone. It feels naked. It also feels grown-up.",
      },
    ],
  },

  {
    id: 'x_family_money_call',
    trigger: 'IDLE',
    title: 'A Call From Home',
    weight: 1,
    once: true,
    body: "Your uncle calls. The family business is drowning, and everyone already assumes the cricketer will step in. The number he needs is most of what you\u2019ve saved. Nobody says the word \u201Cloan.\u201D",
    choices: [
      {
        id: 'give',
        label: 'Give what they need',
        desc: 'Family is family',
        effects: { coins: -1500, morale: 6, integrity: 4, flags: { bailedFamily: 1 } },
        resultText: "You transfer it before you can overthink it. Relief floods the call. Your own account looks suddenly, frighteningly thin.",
      },
      {
        id: 'lend',
        label: 'Offer a smaller amount',
        desc: 'Help, but keep a boundary',
        effects: { coins: -600, morale: 2, relationship: [{ id: 'mentor', delta: 3 }] },
        resultText: "You give what you can and say the rest has to come from somewhere else. It\u2019s the responsible answer. It doesn\u2019t feel generous enough.",
      },
      {
        id: 'refuse',
        label: 'Say no',
        desc: 'Protect your future',
        effects: { morale: -8, integrity: -2, flags: { refusedFamily: 1 } },
        resultText: "You explain about wages that don\u2019t last and careers that end at thirty-four. He listens. The silence after is very long.",
      },
    ],
  },

  {
    id: 'x_night_out',
    trigger: 'IDLE',
    title: 'One More Round',
    weight: 2,
    body: "A teammate\u2019s birthday, a private room, and a match in thirty-six hours. The group is loose and loud and someone keeps ordering. Your phone camera-roll is one bad decision away from a headline.",
    choices: [
      {
        id: 'leave',
        label: 'Leave early',
        desc: 'Discipline over fun',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 3 }], form: 3, relationship: [{ id: 'captain', delta: -2 }] },
        resultText: "You slip out before midnight. A couple call you boring. You call it professional, and sleep like the professional you\u2019re trying to be.",
      },
      {
        id: 'stay_smart',
        label: 'Stay, but stay sober',
        desc: 'Bond without the risk',
        effects: { morale: 6, relationship: [{ id: 'captain', delta: 5 }], flags: { teamGlue: 1 } },
        resultText: "You\u2019re the last one standing with a lime soda, ferrying teammates into taxis. Nobody forgets who looked after them.",
      },
      {
        id: 'lose_it',
        label: 'Let loose',
        desc: 'You\u2019re young once',
        effects: { morale: 8, form: -5, brand: -4, integrity: -3, flags: { messyNight: 1 } },
        resultText: "It\u2019s a brilliant night. The training-ground fine and the grainy photo the next morning are less brilliant.",
      },
    ],
  },

  {
    id: 'x_influencer_dm',
    trigger: 'IDLE',
    title: 'The Blue Tick',
    speaker: '{agent}',
    weight: 1,
    once: true,
    condition: (c) => (c.save.brand ?? 0) >= 35,
    body: "A famous influencer slides into your messages \u2014 a public flirtation would be gold for both your followings, {agent} says. It would also be entirely manufactured. And there\u2019s someone real back home you haven\u2019t called in a week.",
    choices: [
      {
        id: 'play',
        label: 'Play the game',
        desc: 'Numbers are numbers',
        effects: { brand: 9, integrity: -5, morale: -3, flags: { fakeRomance: 1 } },
        resultText: "The staged photos break the internet for a day. Your followers double. The person who actually knows you goes quiet.",
      },
      {
        id: 'decline_kind',
        label: 'Decline politely',
        desc: 'Keep it real',
        effects: { integrity: 5, morale: 4, relationship: [{ id: 'agent', delta: -3 }] },
        resultText: "You send a friendly no. {agent} groans about \u201Cleaving money on the table.\u201D You call home instead. It\u2019s the better call.",
      },
    ],
  },

  {
    id: 'x_rivalry_spark',
    trigger: 'IDLE',
    title: 'Beyond the Needle',
    speaker: '{rival}',
    once: true,
    priority: 5,
    condition: (c) => (c.save.relationships?.rival?.level ?? 0) <= -15,
    body: "It stops being banter. {rival} corners you in the car park after a session. \u201COne of us is getting picked ahead of the other this year. Let\u2019s not pretend we\u2019re friends.\u201D The air is suddenly very still.",
    choices: [
      {
        id: 'escalate',
        label: 'Meet fire with fire',
        desc: 'Make it a war',
        effects: { confidence: 6, integrity: -3, relationship: [{ id: 'rival', delta: -12 }], flags: { rivalryArc: 1 }, queueEvent: 'x_rivalry_media' },
        resultText: "\u201CGood,\u201D you say. \u201CI do my best work with something to prove.\u201D It\u2019s on now, and the whole dressing room can feel it.",
      },
      {
        id: 'defuse',
        label: 'Refuse the war',
        desc: 'Take the high road',
        effects: { integrity: 6, morale: 3, relationship: [{ id: 'rival', delta: 4 }], flags: { rivalryArc: 1 }, queueEvent: 'x_rivalry_media' },
        resultText: "\u201CI\u2019m not fighting you for a shirt,\u201D you say. \u201CI\u2019m just going to score more runs than you.\u201D He blinks. He didn\u2019t expect calm.",
      },
      {
        id: 'undermine',
        label: 'Take it to the coach',
        desc: 'Fight it quietly',
        effects: { relationship: [{ id: 'coach', delta: -4 }, { id: 'rival', delta: -8 }], integrity: -5, flags: { rivalryArc: 1, wentBehindBack: 1 }, queueEvent: 'x_rivalry_media' },
        resultText: "You mention his \u201Cattitude\u201D to {coach}. It might help selection. It definitely makes you someone who does that now.",
      },
    ],
  },

  {
    id: 'x_fixer_returns',
    trigger: 'IDLE',
    title: 'He Remembers Your Face',
    speaker: 'Unknown Number',
    once: true,
    priority: 15,
    condition: (c) => (c.save.story?.flags.compromised ?? 0) >= 1 || (c.save.story?.flags.knewAndStayedQuiet ?? 0) >= 1,
    body: "The number you hoped never to see again lights up your phone. \u201CFriend. We did good business once. There\u2019s a bigger opportunity now \u2014 or would you rather your teammates learned about the first one?\u201D",
    choices: [
      {
        id: 'report_now',
        label: 'Report it, whatever it costs',
        desc: 'End it, take the fall',
        effects: { integrity: 12, morale: -5, coins: -400, relationship: [{ id: 'coach', delta: 6 }], flags: { acuCase: 1 }, queueEvent: 'x_acu_knock', unlockAchievement: 'came_clean', timeline: { kind: 'STORY', text: 'Walked into the anti-corruption unit and told them everything.' } },
        resultText: "You tell them everything, including your own part. It may cost you a ban. It buys back something you thought you\u2019d sold for good.",
      },
      {
        id: 'pay_off',
        label: 'Pay him to vanish',
        desc: 'Buy your silence',
        effects: { coins: -1500, integrity: -6, morale: -4, flags: { deeperIn: 1 } },
        resultText: "The money leaves your account and, for now, so does he. Blackmail, you learn, is a subscription, not a purchase.",
      },
      {
        id: 'in_deeper',
        label: 'Take the bigger job',
        desc: 'In too far to stop',
        effects: { coins: 1500, integrity: -18, confidence: -3, relationship: [{ id: 'mentor', delta: -12 }], flags: { deeperIn: 2 } },
        resultText: "The account swells. So does the file someone, somewhere, is quietly building with your name on the cover.",
      },
    ],
  },

  {
    id: 'x_teammate_approached',
    trigger: 'IDLE',
    title: 'What He Told You',
    speaker: 'Teammate',
    once: true,
    priority: 8,
    body: "A young teammate finds you alone. He\u2019s shaking. \u201CSomeone offered me money to give away runs. I said no. I think. I don\u2019t know what to do.\u201D He chose you to tell. That means something.",
    choices: [
      {
        id: 'report_together',
        label: 'Walk him to the officials',
        desc: 'Do it properly, together',
        effects: { integrity: 10, relationship: [{ id: 'coach', delta: 8 }], morale: 4, flags: { protectedRookie: 1 } },
        resultText: "You sit beside him through every question. He\u2019ll never forget that you didn\u2019t let him face it alone.",
      },
      {
        id: 'advise',
        label: 'Tell him to block the number',
        desc: 'Handle it quietly',
        effects: { integrity: 2, relationship: [{ id: 'coach', delta: -3 }], flags: { keptItQuiet: 1 } },
        resultText: "You talk him down and hope it ends there. Hope is not a plan, and part of you knows it.",
      },
      {
        id: 'use_it',
        label: 'Ask who approached him',
        desc: 'A door, if you want it',
        effects: { integrity: -8, flags: { curiousAgain: 1 } },
        resultText: "You keep your voice casual. He gives you a name he shouldn\u2019t. You tell yourself you\u2019ll only use it to warn people.",
      },
    ],
  },

  {
    id: 'x_gym_youngster',
    trigger: 'IDLE',
    title: 'The Kid at Six A.M.',
    weight: 1,
    once: true,
    body: "There\u2019s a teenager already in the gym every morning when you arrive, watching you more than his own reps. Today he works up the nerve to ask if you\u2019ll look at his game. He reminds you, uncomfortably, of you.",
    choices: [
      {
        id: 'take_under_wing',
        label: 'Take him under your wing',
        desc: 'Pay it forward',
        effects: { morale: 6, integrity: 4, relationship: [{ id: 'coach', delta: 3 }], flags: { youngsterArc: 1 }, queueEvent: 'x_youngster_choice' },
        resultText: "You start throwing him a few dozen extra balls each morning. He soaks up everything. Somewhere, a mentor of yours is smiling.",
      },
      {
        id: 'polite_distance',
        label: 'Keep a professional distance',
        desc: 'He\u2019s a rival for places',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], form: 2, flags: { youngsterArc: 1 }, queueEvent: 'x_youngster_choice' },
        resultText: "You give him one honest tip and get back to your own work. Kind, but clipped. He nods and files it away.",
      },
    ],
  },

  {
    id: 'x_agent_bigger_club',
    trigger: 'IDLE',
    title: 'The Bigger Badge',
    speaker: '{agent}',
    once: true,
    priority: 6,
    condition: (c) => c.user.overall >= 68,
    body: "{agent} can barely sit still. \u201CA giant club wants you. Triple the wage, Champions cricket, a proper stage. {team} gave you your start, sure \u2014 but sentiment doesn\u2019t pay pensions. They\u2019re waiting on your word.\u201D",
    choices: [
      {
        id: 'interested',
        label: 'Tell them you\u2019re listening',
        desc: 'Open the door',
        effects: { brand: 5, relationship: [{ id: 'agent', delta: 6 }, { id: 'coach', delta: -5 }], flags: { bigClubArc: 1 }, queueEvent: 'x_transfer_decision' },
        resultText: "Word travels faster than you\u2019d like. By training the next day, {coach} already knows. He doesn\u2019t say much. He doesn\u2019t have to.",
      },
      {
        id: 'loyal_lean',
        label: '\u201CHappy here \u2014 for now\u201D',
        desc: 'Loyal, but honest',
        effects: { relationship: [{ id: 'coach', delta: 6 }], morale: 4, flags: { bigClubArc: 1 }, queueEvent: 'x_transfer_decision' },
        resultText: "You tell {agent} not to slam the door, just don\u2019t walk through it yet. He respects the patience more than he expected to.",
      },
    ],
  },

  {
    id: 'x_sponsor_scandal',
    trigger: 'IDLE',
    title: 'The Brand Goes Bad',
    speaker: '{agent}',
    once: true,
    priority: 10,
    condition: (c) => (c.save.story?.flags.sponsorArc ?? 0) >= 1,
    body: "The global brand whose logo now sits on your chest is all over the news \u2014 and not the good kind. Labour scandals, ugly footage. {agent} is blunt: \u201CThey\u2019ll pay a fortune to keep you quiet, or you can walk and eat the loss.\u201D",
    choices: [
      {
        id: 'walk',
        label: 'Terminate the deal publicly',
        desc: 'Principle over payday',
        effects: { integrity: 12, brand: 4, coins: -800, relationship: [{ id: 'agent', delta: -6 }], flags: { sponsorArc: 2 }, queueEvent: 'x_sponsor_fallout' },
        resultText: "You return the money and say why, on the record. Lawyers panic. A lot of people who never noticed you before are suddenly listening.",
      },
      {
        id: 'silent',
        label: 'Stay, say nothing',
        desc: 'Honour the contract',
        effects: { coins: 800, integrity: -8, brand: -3, flags: { sponsorArc: 2 }, queueEvent: 'x_sponsor_fallout' },
        resultText: "You keep the logo and your mouth shut. The retainer clears. Every time you pull on the shirt, you feel the weight of the choice.",
      },
      {
        id: 'renegotiate',
        label: 'Quietly negotiate an exit',
        desc: 'Leave without the fight',
        effects: { coins: 200, integrity: 2, brand: -2, relationship: [{ id: 'agent', delta: 3 }], flags: { sponsorArc: 2 }, queueEvent: 'x_sponsor_fallout' },
        resultText: "No grand statement, no burned bridge \u2014 just a lawyer\u2019s letter and a clean break. Nobody\u2019s hero. Nobody\u2019s villain.",
      },
    ],
  },

  {
    id: 'x_captain_dressing_room',
    trigger: 'IDLE',
    title: 'A House Divided',
    once: true,
    priority: 8,
    condition: (c) => c.save.captainClub === true,
    body: "As captain you can feel the room splitting \u2014 the senior players who want things the old way, the younger ones who feel talked over. Both camps keep catching your eye, waiting to see whose side you\u2019re on.",
    choices: [
      {
        id: 'seniors',
        label: 'Back the senior core',
        desc: 'Experience wins matches',
        effects: { relationship: [{ id: 'captain', delta: 4 }], confidence: 4, flags: { sidedSeniors: 1 } },
        resultText: "The old guard close ranks around you. The kids go quiet in meetings now. You\u2019ve bought unity at one end of the room by losing it at the other.",
      },
      {
        id: 'youth',
        label: 'Empower the young players',
        desc: 'Build for the future',
        effects: { relationship: [{ id: 'coach', delta: 5 }], morale: 4, flags: { sidedYouth: 1 } },
        resultText: "You give the youngsters a voice and real roles. The seniors mutter about disrespect. The dressing room feels younger overnight \u2014 for better and worse.",
      },
      {
        id: 'bridge',
        label: 'Force them into a room together',
        desc: 'Refuse to pick a side',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], morale: -3, relationship: [{ id: 'coach', delta: 3 }], flags: { builtBridge: 1 } },
        resultText: "You lock the doors and make them talk. It\u2019s awkward and slow and nobody enjoys it. Leadership, you\u2019re learning, rarely feels heroic.",
      },
    ],
  },

  {
    id: 'x_injury_dark_days',
    trigger: 'IDLE',
    title: 'The Long Rehab',
    once: true,
    priority: 12,
    condition: (c) => (c.save.story?.flags.injuryArc ?? 0) >= 1,
    body: "Months in. The physio room ceiling has forty-two tiles; you\u2019ve counted them all. The team wins without you on the TV in the corner. Some mornings you wonder, quietly, if you\u2019ll ever be the same player \u2014 or if anyone would notice if you weren\u2019t.",
    choices: [
      {
        id: 'lean_mentor',
        label: 'Call {mentor}',
        desc: 'Ask someone who\u2019s been here',
        effects: { morale: 10, relationship: [{ id: 'mentor', delta: 8 }], flags: { injuryArc: 2 }, queueEvent: 'x_injury_comeback_match' },
        resultText: "{mentor} has the scars to match yours. \u201CThe body heals on a schedule,\u201D he says. \u201CThe head heals when you let people in.\u201D You listen.",
      },
      {
        id: 'therapy',
        label: 'See a sports psychologist',
        desc: 'Treat the mind too',
        effects: { morale: 8, integrity: 3, attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], flags: { injuryArc: 2 }, queueEvent: 'x_injury_comeback_match' },
        resultText: "You book the session you\u2019ve been avoiding. Rehab, you realise, was never only about the knee.",
      },
      {
        id: 'isolate',
        label: 'Shut everyone out',
        desc: 'Suffer in private',
        effects: { morale: -6, confidence: -4, form: 4, flags: { injuryArc: 2, isolatedRehab: 1 }, queueEvent: 'x_injury_comeback_match' },
        resultText: "You go dark and grind alone. The muscle comes back faster than the joy does. You tell yourself that\u2019s a fair trade.",
      },
    ],
  },

  {
    id: 'x_acu_knock',
    trigger: 'IDLE',
    title: 'The Knock at the Door',
    speaker: 'Investigator',
    once: true,
    priority: 20,
    condition: (c) => (c.save.story?.flags.acuCase ?? 0) >= 1,
    body: "Two investigators, one folder, your kitchen table. \u201CThank you for coming forward. We need the whole timeline \u2014 dates, names, amounts. Cooperate fully and we\u2019ll note it. Hold anything back and we can\u2019t protect you.\u201D",
    choices: [
      {
        id: 'full',
        label: 'Hold nothing back',
        desc: 'Total honesty',
        effects: { integrity: 12, morale: 6, nationalRep: -4, relationship: [{ id: 'coach', delta: 6 }], unlockAchievement: 'whistleblower', timeline: { kind: 'STORY', text: 'Cooperated fully with the corruption inquiry.' } },
        resultText: "You give them everything. There\u2019s a short suspension and a long headline. But you sleep, properly, for the first time in a year.",
      },
      {
        id: 'lawyer',
        label: 'Say only what you must',
        desc: 'Protect yourself first',
        effects: { integrity: 2, brand: -3, flags: { guardedTestimony: 1 } },
        resultText: "Your lawyer does the talking. You survive with your record technically intact and your conscience quietly otherwise.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * POST_MATCH — the reckoning after the last ball                      *
   * ------------------------------------------------------------------ */
  {
    id: 'x_dropped_catch_blame',
    trigger: 'POST_MATCH',
    title: 'The One You Grassed',
    weight: 2,
    condition: (c) => c.won === false,
    body: "You put down a regulation catch and it cost the game. In the huddle nobody quite looks at you. The bowler whose figures you ruined is very obviously not saying anything.",
    choices: [
      {
        id: 'own_it',
        label: 'Own it to the group',
        desc: 'Front up',
        effects: { integrity: 6, relationship: [{ id: 'captain', delta: 5 }], confidence: -3, attrs: [{ group: 'fielding', key: 'catching', delta: 2 }] },
        resultText: "\u201CThat\u2019s on me. Won\u2019t happen again.\u201D You say it before anyone else can. The bowler finally nods. The air clears an inch.",
      },
      {
        id: 'deflect',
        label: 'Blame the lights',
        desc: 'It really was hard to see',
        effects: { confidence: 2, integrity: -5, relationship: [{ id: 'captain', delta: -4 }] },
        resultText: "Maybe it was the floodlights. Maybe. Nobody in the room buys it, and now they\u2019re thinking about two things instead of one.",
      },
      {
        id: 'extra_work',
        label: 'Hit the fielding drills at dawn',
        desc: 'Answer with work',
        effects: { attrs: [{ group: 'fielding', key: 'catching', delta: 3 }, { group: 'fielding', key: 'agility', delta: 2 }], morale: -4, relationship: [{ id: 'coach', delta: 4 }] },
        resultText: "You say nothing and take five hundred high balls the next morning until your palms burn. The answer to a dropped catch is more catches.",
      },
    ],
  },

  {
    id: 'x_walk_or_not',
    trigger: ['POST_MATCH', 'GOOD_MATCH'],
    title: 'You Knew You Hit It',
    weight: 2,
    condition: (c) => (c.runs ?? 0) >= 20,
    body: "You feathered it to the keeper on nine. The umpire\u2019s finger stayed down. You went on to a big score. In the press room afterwards, a journalist asks, half-smiling, whether you got a touch on that early one.",
    choices: [
      {
        id: 'honest',
        label: 'Admit you nicked it',
        desc: 'The truth costs nothing now',
        effects: { integrity: 8, brand: 3, relationship: [{ id: 'rival', delta: 2 }] },
        resultText: "\u201CYeah, I hit it. Rub of the green.\u201D The honesty makes a nice story. Some old pros grumble that walkers don\u2019t win much.",
      },
      {
        id: 'straight_face',
        label: 'Keep a straight face',
        desc: 'The umpire\u2019s job, not yours',
        effects: { confidence: 4, integrity: -3, flags: { playedTheGame: 1 } },
        resultText: "\u201CThe umpire\u2019s call is the umpire\u2019s call.\u201D It\u2019s within the rules and everyone knows exactly what it means.",
      },
    ],
  },

  {
    id: 'x_teammate_milestone',
    trigger: 'POST_MATCH',
    title: 'His Day, Not Yours',
    weight: 2,
    condition: (c) => (c.runs ?? 0) < 15,
    body: "You got a duck. At the other end, a teammate raised his bat for a hundred and the crowd sang his name. He finds you afterwards, buzzing, wanting to share it. Your smile has to come from somewhere it doesn\u2019t feel like reaching.",
    choices: [
      {
        id: 'gracious',
        label: 'Celebrate him fully',
        desc: 'Be bigger than your ego',
        effects: { integrity: 5, morale: 4, relationship: [{ id: 'captain', delta: 4 }], flags: { goodTeammate: 1 } },
        resultText: "You mean it, mostly, and by the time you\u2019ve carried his bag off you mean it entirely. Generosity, it turns out, is a skill you can practise.",
      },
      {
        id: 'hollow',
        label: 'Congratulate him, then leave',
        desc: 'Say the words, save the rest',
        effects: { morale: -3, confidence: 3 },
        resultText: "You shake his hand and drive home to stew. There\u2019s fuel in the frustration \u2014 as long as you don\u2019t let it turn to poison.",
      },
      {
        id: 'learn',
        label: 'Ask how he built the innings',
        desc: 'Steal his method',
        effects: { attrs: [{ group: 'batting', key: 'temperament', delta: 2 }, { group: 'batting', key: 'technique', delta: 1 }], form: 2, relationship: [{ id: 'captain', delta: 2 }] },
        resultText: "You swallow the pride and pick his brain for an hour. His hundred just taught you something your duck never could.",
      },
    ],
  },

  {
    id: 'x_press_criticism',
    trigger: ['POST_MATCH', 'BAD_MATCH'],
    title: 'The Verdict',
    speaker: 'Press Room',
    weight: 2,
    condition: (c) => (c.rating ?? 5) < 4.5,
    body: "A columnist you\u2019ve never met has written that you \u201Cdon\u2019t have the temperament for this level.\u201D It\u2019s pinned to the noticeboard \u2014 someone\u2019s idea of motivation. Your phone won\u2019t stop buzzing.",
    choices: [
      {
        id: 'fuel',
        label: 'Pin it above your locker',
        desc: 'Turn spite into runs',
        effects: { confidence: 5, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }], form: 3, flags: { chipOnShoulder: 1 } },
        resultText: "You leave it there where you\u2019ll see it every day. Some people need calm to perform. You, apparently, need a nemesis.",
      },
      {
        id: 'ignore',
        label: 'Delete the apps for a week',
        desc: 'Protect your head',
        effects: { morale: 8, confidence: 2, brand: -2 },
        resultText: "You log out of everything and the noise fades to nothing. You\u2019d forgotten cricket could be quiet. It helps more than the fury would.",
      },
      {
        id: 'clapback',
        label: 'Reply to him directly',
        desc: 'Defend yourself publicly',
        effects: { brand: 4, integrity: -3, morale: 2, flags: { thinSkinned: 1 } },
        resultText: "Your reply gets ten times his readership and proves, unfortunately, that he got to you. The next column writes itself.",
      },
    ],
  },

  {
    id: 'x_fan_letter',
    trigger: 'POST_MATCH',
    title: 'The Handwritten Letter',
    weight: 1,
    body: "Amid the fan mail your club forwards, one envelope is handwritten. A kid who stammers writes that watching you bat is the only hour a week he forgets to be afraid. He doesn\u2019t ask for anything. He just wanted you to know.",
    choices: [
      {
        id: 'reply',
        label: 'Write back by hand',
        desc: 'Answer a person, not a fan',
        effects: { morale: 8, integrity: 5, form: 2 },
        resultText: "You post a real letter, no template. Somewhere a kid keeps an envelope forever. It re-centres everything you\u2019d let get complicated.",
      },
      {
        id: 'invite',
        label: 'Invite him to a match',
        desc: 'Make it a day he keeps',
        effects: { morale: 6, brand: 5, coins: -300 },
        resultText: "You leave tickets and a signed shirt at will-call. His grin from the boundary is worth more than the gate money you covered.",
      },
      {
        id: 'busy',
        label: 'File it with the rest',
        desc: 'There are hundreds',
        effects: { form: 2, morale: -2 },
        resultText: "You mean to get to it. The season swallows the intention whole. Weeks later the envelope surfaces and something in your chest tightens.",
      },
    ],
  },

  {
    id: 'x_captain_first_test',
    trigger: ['POST_MATCH', 'CAPTAINCY'],
    title: 'Your First Hard Call',
    once: true,
    priority: 10,
    condition: (c) => c.save.captainClub === true,
    body: "As captain, your first real decision is a cruel one: a beloved veteran is visibly past it, and a hungry kid is tearing up the seconds. The veteran gave the club a decade. The kid gives you a better chance to win on Saturday.",
    choices: [
      {
        id: 'pick_kid',
        label: 'Pick the kid',
        desc: 'Win now, hurt someone',
        effects: { relationship: [{ id: 'coach', delta: 6 }, { id: 'captain', delta: -6 }], confidence: 4, flags: { ruthlessCaptain: 1 } },
        resultText: "You tell the veteran yourself, eye to eye. He takes it like a pro and something between you never fully mends. Leadership has a body count.",
      },
      {
        id: 'loyalty',
        label: 'Keep the veteran',
        desc: 'Honour service',
        effects: { relationship: [{ id: 'captain', delta: 8 }], morale: 3, form: -2, flags: { loyalCaptain: 1 } },
        resultText: "You give the old warrior one more week. The dressing room loves you for it. The results table is less sentimental.",
      },
      {
        id: 'honest_convo',
        label: 'Plan the veteran a farewell',
        desc: 'Ease him out with dignity',
        effects: { integrity: 6, relationship: [{ id: 'captain', delta: 4 }, { id: 'coach', delta: 3 }], flags: { statesmanCaptain: 1 } },
        resultText: "You map him a proper send-off \u2014 three more games, then a testimonial. Harder than a clean cut, kinder than a lie. He shakes your hand.",
      },
    ],
  },

  {
    id: 'x_captain_declaration',
    trigger: 'POST_MATCH',
    title: 'The Gamble',
    weight: 2,
    condition: (c) => c.save.captainClub === true,
    body: "The game is balanced on a knife\u2019s edge and every set of eyes turns to you for the call. Play safe and you likely draw. Gamble \u2014 a bold declaration, an all-out chase \u2014 and you either win big or lose ugly.",
    choices: [
      {
        id: 'bold',
        label: 'Roll the dice',
        desc: 'Captains are remembered for boldness',
        effects: { confidence: 5, brand: 4, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }], flags: { boldSkipper: 1 } },
        resultText: "You throw the game open and dare the day to punish you. Win or lose, nobody in that ground will forget you tried to seize it.",
      },
      {
        id: 'safe',
        label: 'Shut up shop',
        desc: 'A point in the bank',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], relationship: [{ id: 'coach', delta: 3 }], confidence: -2 },
        resultText: "You take the safe half-loaf. The pundits call it \u201Cpragmatic,\u201D which is what they call boring when it works.",
      },
    ],
  },

  {
    id: 'x_rivalry_media',
    trigger: 'POST_MATCH',
    title: 'Feeding the Story',
    speaker: 'Press Room',
    once: true,
    priority: 10,
    condition: (c) => (c.save.story?.flags.rivalryArc ?? 0) >= 1,
    body: "The press have caught the scent of you and {rival}. \u201CHe says he\u2019s the better player and you\u2019re living off one good season. Your response?\u201D Every outlet in the room leans in for the headline.",
    choices: [
      {
        id: 'humble_rival',
        label: 'Refuse to bite',
        desc: 'Starve the story',
        effects: { integrity: 6, relationship: [{ id: 'rival', delta: 6 }], brand: -2, flags: { rivalryArc: 2 }, queueEvent: 'x_rivalry_resolution' },
        resultText: "\u201CHe\u2019s a fine player. Print that.\u201D The room deflates, disappointed. Somewhere, {rival} reads it and doesn\u2019t know what to do with it.",
      },
      {
        id: 'sharpen',
        label: 'Sharpen the blade',
        desc: 'Give them a headline',
        effects: { brand: 8, integrity: -4, relationship: [{ id: 'rival', delta: -12 }], flags: { rivalryArc: 2 }, queueEvent: 'x_rivalry_resolution' },
        resultText: "\u201CScoreboard\u2019s public. He can read.\u201D It leads every bulletin. The feud now has a life of its own, and it feeds on days like this.",
      },
    ],
  },

  {
    id: 'x_youngster_choice',
    trigger: 'POST_MATCH',
    title: 'The Student Passes the Master',
    once: true,
    priority: 8,
    condition: (c) => (c.save.story?.flags.youngsterArc ?? 0) >= 1,
    body: "The kid you\u2019ve been helping just outscored you in the same match, and the selectors were watching. He looks at you, unsure whether he\u2019s allowed to be happy. You could make this moment about him, or about you.",
    choices: [
      {
        id: 'proud',
        label: 'Tell him you\u2019re proud',
        desc: 'Let the torch pass',
        effects: { integrity: 8, morale: 6, relationship: [{ id: 'coach', delta: 4 }], unlockAchievement: 'passed_the_torch', flags: { mentorLegacy: 1 } },
        resultText: "\u201CThat,\u201D you say, \u201Cwas better than anything I did today.\u201D His face. You\u2019d forgotten this feeling existed on the giving side.",
      },
      {
        id: 'threatened',
        label: 'Pull back your help',
        desc: 'Guard your own place',
        effects: { form: 4, confidence: 3, relationship: [{ id: 'coach', delta: -3 }], flags: { closedOff: 1 } },
        resultText: "You go quieter in the nets, keep a little more to yourself. He notices the door closing. So, later, will you.",
      },
    ],
  },

  {
    id: 'x_injury_comeback_match',
    trigger: ['POST_MATCH', 'GOOD_MATCH'],
    title: 'The Return',
    once: true,
    priority: 14,
    condition: (c) => (c.save.story?.flags.injuryArc ?? 0) >= 2,
    body: "First match back after the long dark of rehab. The knee held. The applause as you walked out was louder than the scoreline deserved. In the rooms afterwards, {mentor} asks quietly what you learned down there.",
    choices: [
      {
        id: 'grateful',
        label: '\u201CNot to waste a single day\u201D',
        desc: 'Come back changed',
        effects: { morale: 10, integrity: 5, form: 4, attrs: [{ group: 'meta', key: 'fitness', delta: 2 }], unlockAchievement: 'the_comeback', timeline: { kind: 'STORY', text: 'Completed a long comeback from injury a different player.' } },
        resultText: "You mean every word. The layoff took months and gave you back a perspective you\u2019d somehow lost while winning.",
      },
      {
        id: 'angry',
        label: '\u201CThat I\u2019m owed those months back\u201D',
        desc: 'Return with a vengeance',
        effects: { confidence: 6, attrs: [{ group: 'meta', key: 'aggression', delta: 3 }], morale: -2, flags: { vengefulReturn: 1 } },
        resultText: "The fury is rocket fuel and you know it. {mentor} studies you. \u201CJust don\u2019t let it be the only thing driving,\u201D he says.",
      },
      {
        id: 'lonely',
        label: '\u201CThat I did it alone\u201D',
        desc: 'You shut everyone out and made it',
        requiresFlag: { key: 'isolatedRehab', min: 1 },
        effects: { confidence: 5, morale: -4, integrity: -2, relationship: [{ id: 'mentor', delta: -4 }], flags: { loneWolf: 1 } },
        resultText: "\u201CI didn\u2019t need anyone,\u201D you say, and {mentor}\u2019s face falls a little. You proved you could. You never asked what it cost.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * GOOD_MATCH — the doors that open when you shine                     *
   * ------------------------------------------------------------------ */
  {
    id: 'x_sponsor_global_offer',
    trigger: 'GOOD_MATCH',
    title: 'The Global Deal',
    speaker: '{agent}',
    once: true,
    priority: 8,
    condition: (c) => (c.save.brand ?? 0) >= 45,
    body: "{agent} is almost vibrating. \u201CA global brand. Life-changing money, worldwide campaign, your face on airport walls. They\u2019re fast and loose with ethics, between us \u2014 but nobody signs a deal this size and asks questions.\u201D",
    choices: [
      {
        id: 'sign_global',
        label: 'Sign the mega-deal',
        desc: 'Set yourself up for life',
        effects: { addSponsor: { brand: 'Apex Global', tier: 'GLOBAL', perMatchCoins: 140, signingBonus: 1200, seasonsLeft: 3, requiresIntegrity: false }, brand: 10, integrity: -4, flags: { sponsorArc: 1 }, queueEvent: 'x_sponsor_scandal' },
        resultText: "You sign the biggest contract of your life with a pen they gift you. Somewhere in the fine print is a version of you that you\u2019ll meet later.",
      },
      {
        id: 'due_diligence',
        label: 'Sign, but demand ethics clauses',
        desc: 'Less money, an exit clause',
        effects: { addSponsor: { brand: 'Apex Global', tier: 'GLOBAL', perMatchCoins: 100, signingBonus: 800, seasonsLeft: 3, requiresIntegrity: true }, brand: 7, integrity: 2, flags: { sponsorArc: 1 }, queueEvent: 'x_sponsor_scandal' },
        resultText: "You take less money for an exit clause your lawyers had to fight for. {agent} calls it paranoid. You call it Tuesday.",
      },
      {
        id: 'walk_away',
        label: 'Walk away entirely',
        desc: 'Some money isn\u2019t worth it',
        effects: { integrity: 8, brand: -3, relationship: [{ id: 'agent', delta: -8 }], flags: { turnedDownGlobal: 1 } },
        resultText: "You pass on more money than your parents earned in a lifetime. {agent} doesn\u2019t speak to you for a week. You sleep fine.",
      },
    ],
  },

  {
    id: 'x_national_watchers',
    trigger: 'GOOD_MATCH',
    title: 'Men With Notebooks',
    speaker: '{selector}',
    weight: 2,
    condition: (c) => (c.rating ?? 0) >= 7 && !c.save.capped,
    body: "You spot {selector} in the members\u2019 stand, notebook out, watching only you. This is the audition you\u2019ve chased your whole life. You could play the percentages and look solid, or try to produce something they\u2019ll never forget.",
    choices: [
      {
        id: 'safe_runs',
        label: 'Bank the solid, safe innings',
        desc: 'Look reliable',
        effects: { nationalRep: 4, attrs: [{ group: 'batting', key: 'temperament', delta: 2 }], form: 2 },
        resultText: "You compile rather than dazzle. {selector} writes the word \u201Cdependable,\u201D underlined twice. It\u2019s not glamorous. It gets people picked.",
      },
      {
        id: 'showstopper',
        label: 'Go for the spectacular',
        desc: 'Make them gasp',
        effects: { nationalRep: 6, brand: 6, confidence: 4, flags: { swungForFences: 1 } },
        resultText: "You try to author a highlight reel. When it comes off, the stand rises. High risk \u2014 but selectors dream in headlines too.",
      },
    ],
  },

  {
    id: 'x_endorsement_ethics',
    trigger: 'GOOD_MATCH',
    title: 'The Easy Money',
    speaker: '{agent}',
    weight: 1,
    condition: (c) => (c.save.brand ?? 0) >= 30,
    body: "A betting app and a crypto exchange both want you as an ambassador \u2014 huge fees, minimal work. {agent} reminds you half the sport is signing these now. Your {mentor} once told you exactly what he thought of them.",
    choices: [
      {
        id: 'take_it',
        label: 'Take the betting deal',
        desc: 'Everyone else is',
        effects: { addSponsor: { brand: 'BetKing', tier: 'NATIONAL', perMatchCoins: 90, signingBonus: 700, seasonsLeft: 2, requiresIntegrity: false }, coins: 200, integrity: -8, brand: 4, relationship: [{ id: 'mentor', delta: -8 }] },
        resultText: "The money is absurd for how little they ask. {mentor} sees the ad and doesn\u2019t text you for a while. You knew he wouldn\u2019t.",
      },
      {
        id: 'crypto',
        label: 'Front the crypto exchange',
        desc: 'Riskier, trendier',
        effects: { coins: 900, brand: 6, integrity: -6, flags: { cryptoShill: 1 } },
        resultText: "You film the ad reading words you don\u2019t understand about coins you don\u2019t own. If it collapses, your face is on it. If it soars, you\u2019re a genius.",
      },
      {
        id: 'refuse_both',
        label: 'Turn both down',
        desc: 'Keep your name clean',
        effects: { integrity: 8, relationship: [{ id: 'mentor', delta: 6 }], coins: -100, flags: { cleanEndorser: 1 } },
        resultText: "You say no to money that would have cleared your mortgage. {mentor} simply replies: \u201CGood lad.\u201D Two words that pay a different kind of interest.",
      },
    ],
  },

  {
    id: 'x_purple_patch',
    trigger: 'GOOD_MATCH',
    title: 'In the Zone',
    weight: 2,
    condition: (c) => (c.user.meta.form ?? 60) >= 75,
    body: "Everything is slow and huge. You can\u2019t remember the last time you failed. In this rare, golden window you could ride the wave and rest on it \u2014 or attack the weakness you always meant to fix, while confidence is high enough to survive the discomfort.",
    choices: [
      {
        id: 'coast',
        label: 'Ride the wave',
        desc: 'Don\u2019t fix what isn\u2019t broken',
        effects: { confidence: 6, form: 4, brand: 3 },
        resultText: "You keep doing exactly what\u2019s working and cash in while it lasts. Every hot streak ends. You intend to enjoy this one first.",
      },
      {
        id: 'improve',
        label: 'Rebuild the weak shot now',
        desc: 'Grow while it\u2019s safe',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 3 }, { group: 'batting', key: 'footwork', delta: 2 }], form: -3, confidence: -2 },
        resultText: "You dismantle the flaw mid-purple-patch \u2014 the only time it doesn\u2019t terrify you. Scores dip briefly. The player who emerges has no obvious door left ajar.",
      },
    ],
  },

  {
    id: 'x_franchise_auction',
    trigger: 'GOOD_MATCH',
    title: 'Under the Hammer',
    speaker: '{agent}',
    once: true,
    priority: 6,
    condition: (c) => c.user.overall >= 64,
    body: "A glittering overseas franchise league wants you \u2014 six weeks, a fortune, a private-jet lifestyle. The catch: it clashes with your national side\u2019s window. {selector} has already hinted that choosing cash over country will be remembered.",
    choices: [
      {
        id: 'franchise',
        label: 'Chase the franchise gold',
        desc: 'Money now, cricket now',
        effects: { coins: 1500, brand: 8, nationalRep: -6, relationship: [{ id: 'selector', delta: -8 }], flags: { choseFranchise: 1 } },
        resultText: "You board the jet. The lifestyle is unreal and the bank balance obscene. Back home, {selector} quietly writes a name that isn\u2019t yours.",
      },
      {
        id: 'country',
        label: 'Honour the national window',
        desc: 'The cap comes first',
        effects: { nationalRep: 6, integrity: 6, coins: -200, relationship: [{ id: 'selector', delta: 8 }], flags: { choseCountry: 1 } },
        resultText: "You turn down life-changing money to wear your country\u2019s badge. Some call you a fool. {selector} calls you \u201Cour kind of player.\u201D",
      },
      {
        id: 'both',
        label: 'Try to negotiate a release',
        desc: 'Want it all',
        effects: { relationship: [{ id: 'agent', delta: 4 }, { id: 'selector', delta: -3 }], brand: 3, flags: { playedBothEnds: 1 } },
        resultText: "You send everyone into a scheduling war and please no one entirely. You get a slice of both worlds and a reputation for wanting the whole cake.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * BAD_MATCH — failure, and what it makes of you                       *
   * ------------------------------------------------------------------ */
  {
    id: 'x_technical_flaw',
    trigger: 'BAD_MATCH',
    title: 'The Video Doesn\u2019t Lie',
    speaker: '{coach}',
    weight: 2,
    body: "{coach} freezes the footage. \u201CThere. Your head\u2019s falling over every time. Fixable \u2014 but it means rebuilding a movement you\u2019ve trusted for fifteen years, and it\u2019ll get worse before it gets better.\u201D",
    choices: [
      {
        id: 'rebuild',
        label: 'Tear it down and rebuild',
        desc: 'Fix the root cause',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 3 }, { group: 'batting', key: 'footwork', delta: 2 }], form: -5, confidence: -3, flags: { rebuilding: 1 } },
        resultText: "You commit to the ugly middle. For weeks you look worse than ever and trust the map more than your eyes. {coach} stays late every night with you.",
      },
      {
        id: 'patch',
        label: 'Patch it with a trigger move',
        desc: 'A quicker fix',
        effects: { attrs: [{ group: 'batting', key: 'timing', delta: 2 }], form: 3, confidence: 2 },
        resultText: "You add a small trigger to mask the flaw. It works for now. {coach} warns that patches hold until the day they very publicly don\u2019t.",
      },
      {
        id: 'ignore_coach',
        label: 'Trust your own method',
        desc: 'It got you here',
        effects: { confidence: 4, relationship: [{ id: 'coach', delta: -6 }], flags: { ignoredTechAdvice: 1 } },
        resultText: "\u201CIt\u2019s served me fine so far.\u201D {coach} closes the laptop. \u201CIt has. Right up until it doesn\u2019t.\u201D He lets you walk out.",
      },
    ],
  },

  {
    id: 'x_scapegoat',
    trigger: 'BAD_MATCH',
    title: 'Someone Has to Take It',
    speaker: '{captain}',
    weight: 1,
    condition: (c) => c.won === false,
    body: "A humiliating loss, and the manager needs a public scapegoat before the board finds one for him. Word reaches you that your name is being floated \u2014 unfairly. {captain} quietly asks if you\u2019ll \u201Ctake one for the group\u201D in the review.",
    choices: [
      {
        id: 'take_it',
        label: 'Take the fall for the team',
        desc: 'Absorb the blame',
        effects: { relationship: [{ id: 'captain', delta: 10 }, { id: 'coach', delta: 4 }], brand: -5, morale: -5, integrity: 3, flags: { tookTheFall: 1 } },
        resultText: "You let the story land on you. The dressing room knows exactly what you did. The public only knows the headline. You carry both.",
      },
      {
        id: 'defend',
        label: 'Defend yourself with the facts',
        desc: 'Refuse the frame',
        effects: { confidence: 4, relationship: [{ id: 'captain', delta: -5 }], integrity: 4, flags: { refusedScapegoat: 1 } },
        resultText: "You lay out what actually happened, calmly and completely. You keep your reputation. {captain} learns you won\u2019t be an easy man to sacrifice.",
      },
    ],
  },

  {
    id: 'x_confidence_crisis',
    trigger: 'BAD_MATCH',
    title: 'The Voice in Your Head',
    weight: 2,
    condition: (c) => (c.user.meta.confidence ?? 60) < 40,
    body: "You walk out to bat and, for the first time, a small voice asks whether you actually belong here. The bowler hasn\u2019t changed. The pitch hasn\u2019t changed. Only the person carrying the bat feels suddenly like a fraud.",
    choices: [
      {
        id: 'basics',
        label: 'Shrink the game to one ball',
        desc: 'Just watch the ball',
        effects: { attrs: [{ group: 'batting', key: 'temperament', delta: 3 }], confidence: 4, form: 2 },
        resultText: "You stop thinking about careers and averages and reduce the world to a red sphere. Ball by ball, the fraud goes quiet.",
      },
      {
        id: 'sports_psych',
        label: 'Finally book the psychologist',
        desc: 'Treat the cause',
        effects: { morale: 8, confidence: 6, integrity: 2, flags: { seekingHelp: 1 } },
        resultText: "You make the appointment you\u2019ve been too proud to make. She tells you the voice is normal, common, beatable. Naming it steals half its power.",
      },
      {
        id: 'mask',
        label: 'Fake the swagger',
        desc: 'Bluff the world and yourself',
        effects: { confidence: 3, brand: 2, morale: -4, flags: { faking: 1 } },
        resultText: "You strut and chirp and perform certainty you don\u2019t feel. The crowd buys it. Alone in the car afterwards, the mask slips off heavy.",
      },
    ],
  },

  {
    id: 'x_partner_support',
    trigger: 'BAD_MATCH',
    title: 'The One Who Stays',
    weight: 1,
    body: "You come home foul after another failure, ready to be left alone. Instead there\u2019s dinner, no cricket talk, and someone who loved you before you could bat and will after you can\u2019t. They ask nothing. They just stayed.",
    choices: [
      {
        id: 'let_in',
        label: 'Let them in',
        desc: 'Be a person, not a scoreboard',
        effects: { morale: 10, confidence: 3, form: 2, integrity: 3 },
        resultText: "You put the day down at the door and pick up your actual life. By morning the failure is just a failure again, not the whole of you.",
      },
      {
        id: 'push_away',
        label: 'Shut yourself in the study',
        desc: 'Drown in the footage',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 2 }], morale: -6, form: 3, flags: { pushedThemAway: 1 } },
        resultText: "You rewatch every dismissal until 2 a.m. You might have found something technical. You definitely missed something that mattered more.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * SEASON_END — the long view, contracts, awards, reckonings           *
   * ------------------------------------------------------------------ */
  {
    id: 'x_contract_renewal',
    trigger: 'SEASON_END',
    title: 'The New Terms',
    speaker: '{agent}',
    weight: 1,
    body: "{team} tables a renewal. It\u2019s loyal money, not top money. {agent} says he can squeeze a rival club for far more, but {coach} took a chance on you when nobody else would, and this dressing room feels like home.",
    choices: [
      {
        id: 'sign_loyal',
        label: 'Sign for less, stay home',
        desc: 'Loyalty has value',
        effects: { relationship: [{ id: 'coach', delta: 8 }, { id: 'captain', delta: 4 }], morale: 6, coins: -300, integrity: 4, flags: { oneClubMan: 1 } },
        resultText: "You put pen to paper and leave money in the room. {coach} shakes your hand a beat too long. Some contracts aren\u2019t only about the number.",
      },
      {
        id: 'push_money',
        label: 'Make them pay market rate',
        desc: 'You\u2019ve earned it',
        effects: { coins: 900, relationship: [{ id: 'coach', delta: -4 }, { id: 'agent', delta: 6 }], brand: 3, flags: { hardBargain: 1 } },
        resultText: "{agent} plays hardball and wins you a proper deal. The club pays, slightly resentful. Sentiment is lovely; a career is short.",
      },
      {
        id: 'test_market',
        label: 'Delay and test the market',
        desc: 'See what you\u2019re worth',
        effects: { relationship: [{ id: 'coach', delta: -6 }], brand: 4, flags: { testingMarket: 1 } },
        resultText: "You ask for time. The club hears \u201Cmaybe leaving\u201D and starts, quietly, to plan without you. Leverage cuts both ways.",
      },
    ],
  },

  {
    id: 'x_awards_night',
    trigger: 'SEASON_END',
    title: 'Player of the Year',
    weight: 1,
    once: true,
    condition: (c) => c.user.overall >= 72,
    body: "A hushed ballroom, a trophy with your name on it, and a microphone waiting. A whole season\u2019s worth of doubters are watching from home. Sixty seconds. What kind of champion are you?",
    choices: [
      {
        id: 'thank',
        label: 'Thank the people who built you',
        desc: 'Share the credit',
        effects: { integrity: 6, relationship: [{ id: 'coach', delta: 6 }, { id: 'mentor', delta: 6 }], morale: 6, timeline: { kind: 'AWARD', text: 'Named Player of the Year \u2014 thanked everyone but himself.' } },
        resultText: "You name the coach who stayed late and the mentor who never let you drift. The clip that trends is you, visibly meaning it.",
      },
      {
        id: 'statement',
        label: 'Send a message to the doubters',
        desc: 'This is your moment',
        effects: { brand: 9, confidence: 6, integrity: -3, flags: { toldYouSo: 1 }, timeline: { kind: 'AWARD', text: 'Named Player of the Year \u2014 and made sure the critics heard about it.' } },
        resultText: "\u201CTo everyone who wrote me off \u2014 read it again.\u201D The room roars, half thrilled, half wincing. You\u2019ll live with both halves.",
      },
      {
        id: 'humble_award',
        label: 'Keep it short and humble',
        desc: 'Let the trophy speak',
        effects: { integrity: 4, brand: 3, morale: 4, timeline: { kind: 'AWARD', text: 'Named Player of the Year.' } },
        resultText: "\u201CThanks. Back to work.\u201D Eleven words and a nod. It ages better than any speech in the room.",
      },
      {
        id: 'callback_critic',
        label: 'Find the columnist who buried you',
        desc: 'Settle an old score, publicly',
        requiresFlag: { key: 'chipOnShoulder', min: 1 },
        effects: { brand: 6, confidence: 5, integrity: -4, relationship: [{ id: 'agent', delta: 2 }], flags: { settledScore: 1 } },
        resultText: "You raise the trophy toward the press table and the exact seat you\u2019ve pictured all year. He doesn\u2019t clap. He doesn\u2019t need to. You saw his face.",
      },
    ],
  },

  {
    id: 'x_offseason_choice',
    trigger: 'SEASON_END',
    title: 'The Break',
    weight: 2,
    body: "A long season is finally done and your body is begging. The smart move might be total rest \u2014 or a brutal winter of strength work while rivals switch off \u2014 or a coaching sabbatical in conditions you always struggle in.",
    choices: [
      {
        id: 'rest',
        label: 'Switch off completely',
        desc: 'Recharge the mind',
        effects: { morale: 10, attrs: [{ group: 'meta', key: 'fitness', delta: 2 }], form: -2 },
        resultText: "You do nothing, gloriously, for weeks. You come back hungry and whole. The obsessives got fitter; you got happier. Time will judge the trade.",
      },
      {
        id: 'grind',
        label: 'Brutal winter training',
        desc: 'Steal a march',
        effects: { attrs: [{ group: 'meta', key: 'fitness', delta: 4 }, { group: 'meta', key: 'discipline', delta: 2 }], morale: -6, form: 3 },
        resultText: "While others post beach photos, you post nothing and lift everything. You arrive at pre-season a level above. Something in you is a little more tired than muscle.",
      },
      {
        id: 'learn_conditions',
        label: 'Sabbatical in foreign conditions',
        desc: 'Fix a blind spot',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 3 }, { group: 'batting', key: 'temperament', delta: 2 }], morale: -3, coins: -400 },
        resultText: "You go and get humbled on pitches that don\u2019t forgive your favourite shots. You return worse for a month and better for a decade.",
      },
    ],
  },

  {
    id: 'x_sponsor_fallout',
    trigger: 'SEASON_END',
    title: 'What the Deal Left Behind',
    speaker: '{agent}',
    once: true,
    priority: 10,
    condition: (c) => (c.save.story?.flags.sponsorArc ?? 0) >= 2,
    body: "The dust settles on the whole sponsorship saga. {agent} lays out where it leaves you \u2014 and a new, cleaner brand has been watching how you handled it, ready to talk if your image survived intact.",
    choices: [
      {
        id: 'ethical_brand',
        label: 'Sign the values-led brand',
        desc: 'Rebuild on principle',
        effects: { addSponsor: { brand: 'Meridian Sport', tier: 'NATIONAL', perMatchCoins: 80, signingBonus: 500, seasonsLeft: 3, requiresIntegrity: true }, integrity: 6, brand: 5, flags: { sponsorArc: 3 } },
        resultText: "A brand that actually checks who it partners with picks you \u2014 partly because of how you handled the last one. Redemption pays, eventually.",
      },
      {
        id: 'go_solo',
        label: 'Build your own label instead',
        desc: 'Answer to no one',
        effects: { coins: -600, brand: 8, integrity: 4, flags: { ownBrand: 1, sponsorArc: 3 } },
        resultText: "You sink savings into your own small kit line. Terrifying, and yours. No boardroom scandal can ever ambush your chest again.",
      },
    ],
  },

  {
    id: 'x_captain_burnout',
    trigger: 'SEASON_END',
    title: 'The Weight of the Armband',
    once: true,
    priority: 8,
    condition: (c) => c.save.captainClub === true,
    body: "A year of captaincy has quietly hollowed you out. You lead others so hard you\u2019ve stopped scoring for yourself. In the season review, {coach} asks the question you\u2019ve avoided: is the armband still making you better, or just heavier?",
    choices: [
      {
        id: 'keep_leading',
        label: 'Keep leading, but adapt',
        desc: 'Grow into it',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 3 }], confidence: 4, morale: -3, relationship: [{ id: 'coach', delta: 5 }], flags: { seasonedCaptain: 1 } },
        resultText: "You choose to lead smarter, not harder \u2014 delegate, protect your own game, learn to switch off. The load doesn\u2019t vanish. You just get stronger under it.",
      },
      {
        id: 'delegate',
        label: 'Lean hard on a deputy',
        desc: 'Share the burden',
        effects: { form: 6, morale: 8, confidence: 3, relationship: [{ id: 'captain', delta: 6 }], flags: { sharedLoad: 1 } },
        resultText: "You promote a trusted deputy and hand over half the daily weight. Your batting breathes again. Leadership, you learn, was never meant to be carried alone.",
      },
    ],
  },

  {
    id: 'x_rivalry_resolution',
    trigger: ['SEASON_END', 'IDLE'],
    title: 'Where It Ends',
    speaker: '{rival}',
    once: true,
    priority: 10,
    condition: (c) => (c.save.story?.flags.rivalryArc ?? 0) >= 2,
    body: "The season that defined your feud is over. {rival} finds you in an empty bar, no cameras, two beers already poured. \u201CWe pushed each other harder than any coach ever did,\u201D he says. \u201CQuestion is what we do now.\u201D",
    choices: [
      {
        id: 'bury_hatchet',
        label: 'Bury the hatchet',
        desc: 'Respect over hatred',
        effects: { integrity: 6, morale: 6, relationship: [{ id: 'rival', delta: 15 }], flags: { rivalryArc: 3, buriedHatchet: 1 }, timeline: { kind: 'STORY', text: 'Turned a bitter rivalry into an unlikely friendship.' } },
        resultText: "You clink glasses with the man you spent a year trying to bury. Enemies made you great. Maybe an ally can make you greater.",
      },
      {
        id: 'respect_only',
        label: 'Cold respect, nothing more',
        desc: 'Never friends',
        effects: { confidence: 4, relationship: [{ id: 'rival', delta: 4 }], flags: { rivalryArc: 3 } },
        resultText: "You drink in near silence and leave a nod\u2019s worth of peace on the table. Not friends. Not enemies. Just two men who made each other real.",
      },
      {
        id: 'forever',
        label: 'Keep the war alive',
        desc: 'You perform on hatred',
        effects: { confidence: 6, attrs: [{ group: 'meta', key: 'aggression', delta: 3 }], integrity: -4, relationship: [{ id: 'rival', delta: -10 }], flags: { rivalryArc: 3, eternalFeud: 1 } },
        resultText: "\u201CNothing to bury,\u201D you say, and leave the beer untouched. Some fires you keep burning because the cold scares you more.",
      },
    ],
  },

  {
    id: 'x_transfer_decision',
    trigger: 'SEASON_END',
    title: 'Stay or Go',
    speaker: '{agent}',
    once: true,
    priority: 12,
    condition: (c) => (c.save.story?.flags.bigClubArc ?? 0) >= 1,
    body: "Decision day. The giant club\u2019s offer stands until midnight: silverware, spotlight, and money {team} can never match. {coach} hasn\u2019t asked you to stay \u2014 too proud \u2014 but you know what your leaving would do to him.",
    choices: [
      {
        id: 'transfer',
        label: 'Sign for the giants',
        desc: 'Chase the trophies',
        effects: { coins: 1500, brand: 10, nationalRep: 4, relationship: [{ id: 'coach', delta: -12 }], flags: { leftForBigClub: 1 }, timeline: { kind: 'TRANSFER', text: 'Left {team} for a bigger club and a bigger stage.' } },
        resultText: "You sign. The unveiling is dazzling. Somewhere, a coach who believed in you first watches on mute and turns the TV off.",
      },
      {
        id: 'stay',
        label: 'Stay and build something',
        desc: 'Loyalty over glory',
        effects: { relationship: [{ id: 'coach', delta: 12 }, { id: 'captain', delta: 6 }], morale: 8, brand: 3, coins: -300, flags: { stayedLoyal: 1 }, timeline: { kind: 'STORY', text: 'Turned down a giant club to stay loyal to {team}.' } },
        resultText: "You let the deadline pass. {coach} says nothing, just grips your shoulder hard enough to bruise. You chose people over trophies. Ask yourself again in ten years.",
      },
      {
        id: 'one_more',
        label: 'Promise one more year, then decide',
        desc: 'Delay the heartbreak',
        effects: { morale: 3, relationship: [{ id: 'coach', delta: 4 }, { id: 'agent', delta: -5 }], flags: { kickedCanDown: 1 } },
        resultText: "You buy a year of not choosing. {agent} is furious. {coach} is relieved. The giant club simply moves to the next name on their list.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * MILESTONE — the peaks, and who you are on them                      *
   * ------------------------------------------------------------------ */
  {
    id: 'x_maiden_hundred',
    trigger: 'MILESTONE',
    title: 'Three Figures',
    weight: 2,
    condition: (c) => c.milestone === 'HUNDRED',
    body: "You raise the bat for the first time to a full house, and the years \u2014 the early mornings, the sacrifices, the doubters \u2014 all crash over you at once. How do you meet the biggest moment of your career so far?",
    choices: [
      {
        id: 'point_sky',
        label: 'Point to the sky',
        desc: 'For someone who isn\u2019t here',
        effects: { morale: 10, integrity: 4, form: 3, timeline: { kind: 'MILESTONE', text: 'Reached a maiden hundred \u2014 and looked to the sky.' } },
        resultText: "You look up, past the roaring stand, to the one person who should have seen this. The tears are real. Nobody in the ground begrudges them.",
      },
      {
        id: 'roar',
        label: 'Roar at the doubters\u2019 stand',
        desc: 'Let it all out',
        effects: { confidence: 6, brand: 6, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }], timeline: { kind: 'MILESTONE', text: 'Brought up a maiden hundred with a roar heard three counties over.' } },
        resultText: "You scream everything you\u2019ve swallowed for years into the sky. The video is everywhere by dinner. It is not humble. It is honest.",
      },
      {
        id: 'calm',
        label: 'A quiet nod, keep batting',
        desc: 'The job isn\u2019t done',
        effects: { attrs: [{ group: 'batting', key: 'temperament', delta: 3 }], confidence: 4, form: 3, timeline: { kind: 'MILESTONE', text: 'Reached a maiden hundred and simply took guard again.' } },
        resultText: "A raised bat, a nod, and straight back into your stance. The purists purr. A hundred, you\u2019ve decided, is a checkpoint, not a destination.",
      },
    ],
  },

  {
    id: 'x_fivefer_glory',
    trigger: 'MILESTONE',
    title: 'Five in an Innings',
    weight: 2,
    condition: (c) => c.milestone === 'FIVEFER',
    body: "The fifth wicket cartwheels and the ball is yours for good. Your first five-for at this level. As you leave the field milking the applause, the young quick you\u2019ve mentored is clapping hardest of all \u2014 he set up two of them.",
    choices: [
      {
        id: 'share_credit',
        label: 'Toss him the match ball',
        desc: 'Share the glory',
        effects: { integrity: 6, relationship: [{ id: 'captain', delta: 4 }], morale: 6, timeline: { kind: 'MILESTONE', text: 'Took a maiden five-wicket haul \u2014 and gave the ball away.' } },
        resultText: "You lob the ball to the kid who bowled the pressure from the other end. \u201CHalf of those were yours.\u201D He\u2019ll frame it. You\u2019ll never regret it.",
      },
      {
        id: 'keep_ball',
        label: 'Keep the ball, soak it in',
        desc: 'Your moment, take it',
        effects: { confidence: 6, brand: 4, attrs: [{ group: 'bowling', key: 'variations', delta: 2 }], timeline: { kind: 'MILESTONE', text: 'Took a maiden five-wicket haul.' } },
        resultText: "You pocket the ball and drink in every clap. You earned this. There\u2019s no shame in letting a hard-won moment be entirely, selfishly yours.",
      },
    ],
  },

  {
    id: 'x_potm_spotlight',
    trigger: 'MILESTONE',
    title: 'Man of the Match',
    speaker: 'Presenter',
    weight: 2,
    condition: (c) => c.milestone === 'POTM',
    body: "Live on the podium, medal in hand, a presenter beams: \u201CIncredible stuff. But the team lost some big names this year \u2014 are performances like yours proof the doubters were wrong about this squad?\u201D It\u2019s a loaded question with a camera on it.",
    choices: [
      {
        id: 'credit_team',
        label: 'Redirect to the collective',
        desc: 'It\u2019s never one man',
        effects: { integrity: 5, relationship: [{ id: 'captain', delta: 5 }, { id: 'coach', delta: 3 }], morale: 4 },
        resultText: "\u201CI got the medal; eleven of us won the game.\u201D The dressing room hears it and stands a little taller. Leadership doesn\u2019t need an armband.",
      },
      {
        id: 'take_spotlight',
        label: 'Enjoy the individual shine',
        desc: 'Own your night',
        effects: { brand: 7, confidence: 5, integrity: -2 },
        resultText: "You give them the quotable, star-making soundbite they wanted. Your profile leaps. A couple of teammates rewatch it with folded arms.",
      },
      {
        id: 'donate',
        label: 'Pledge the cheque to charity',
        desc: 'On live TV',
        effects: { integrity: 8, brand: 5, coins: -500, morale: 5 },
        resultText: "\u201CThe prize money\u2019s going to the flood appeal.\u201D It\u2019s spontaneous and it\u2019s real. The presenter, for once, has nothing slick to say.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * DROPPED — the exile, and the road back (or not)                     *
   * ------------------------------------------------------------------ */
  {
    id: 'x_axed_reaction',
    trigger: 'DROPPED',
    title: 'The Drop',
    speaker: '{coach}',
    weight: 2,
    body: "{coach} shuts the door and doesn\u2019t sit down. \u201CI\u2019m leaving you out. It\u2019s not forever, but it\u2019s real. How you take this next bit tells me more about you than any innings has.\u201D",
    choices: [
      {
        id: 'professional',
        label: 'Take it on the chin, ask what to fix',
        desc: 'Respond like a pro',
        effects: { relationship: [{ id: 'coach', delta: 8 }], attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], morale: -4, form: 3 },
        resultText: "You ask for the honest list, write it down, and thank him. He didn\u2019t expect grace. It changes, quietly, how he\u2019ll pick you back.",
      },
      {
        id: 'rage',
        label: 'Let him have it',
        desc: 'You disagree, loudly',
        effects: { confidence: 3, relationship: [{ id: 'coach', delta: -10 }], morale: 2, flags: { burnedCoach: 1 } },
        resultText: "You say things that feel true and sound reckless. The door rattles behind you. Some of it he needed to hear. Most of it you\u2019ll wish you\u2019d kept.",
      },
      {
        id: 'shell',
        label: 'Go silent and withdraw',
        desc: 'Retreat into yourself',
        effects: { morale: -8, confidence: -4, form: 4, flags: { withdrew: 1 } },
        resultText: "You nod, say nothing, and vanish into the second XI and your own head. The work gets done. Nobody can reach you while it does.",
      },
    ],
  },

  {
    id: 'x_dropped_public',
    trigger: 'DROPPED',
    title: 'The Question Everyone Asks',
    speaker: 'Reporter',
    weight: 1,
    body: "A reporter catches you in the car park the morning after you\u2019re left out. \u201CSources say you\u2019ve lost the coach\u2019s trust. Is your time at {team} over?\u201D The recorder is already running.",
    choices: [
      {
        id: 'classy',
        label: '\u201CI\u2019ll fight for my place\u201D',
        desc: 'Say the right thing',
        effects: { integrity: 5, relationship: [{ id: 'coach', delta: 5 }], brand: 3 },
        resultText: "\u201CI\u2019ve been dropped, not finished. I\u2019ll earn it back.\u201D It\u2019s the mature line and, said with a straight back, people believe it.",
      },
      {
        id: 'hint_exit',
        label: 'Hint you might leave',
        desc: 'Apply pressure',
        effects: { brand: 4, relationship: [{ id: 'coach', delta: -6 }], flags: { publicPressure: 1 } },
        resultText: "\u201CI have to play. If that\u2019s not here...\u201D You leave the sentence hanging and let the transfer talk do your negotiating. It\u2019s a gamble with your home.",
      },
      {
        id: 'no_comment',
        label: 'Walk to your car',
        desc: 'Give them nothing',
        effects: { confidence: 3, morale: -2, integrity: 2 },
        resultText: "You keep walking and let the silence be the quote. No headline today. Just a man and his kit bag and a point to prove where it counts.",
      },
    ],
  },

  {
    id: 'x_dropped_crossroads',
    trigger: 'DROPPED',
    title: 'Is This the End?',
    speaker: '{mentor}',
    once: true,
    priority: 8,
    condition: (c) => c.user.age >= 31,
    body: "Dropped again, and the years are no longer on your side. Over coffee {mentor} is gentle but honest: \u201CThere\u2019s no shame in any road from here. Fight on, drop down to play regularly somewhere smaller, or start the life after. Only you know which is brave.\u201D",
    choices: [
      {
        id: 'fight',
        label: 'Fight for your place here',
        desc: 'Not done yet',
        effects: { confidence: 5, attrs: [{ group: 'meta', key: 'discipline', delta: 3 }], morale: -3, flags: { refusedToFade: 1 } },
        resultText: "\u201COne more fight,\u201D you tell him. He smiles like he already knew. The odds are unkind. You\u2019ve beaten unkind odds before.",
      },
      {
        id: 'drop_down',
        label: 'Move somewhere you\u2019ll play weekly',
        desc: 'Cricket over prestige',
        effects: { form: 6, morale: 6, brand: -4, nationalRep: -4, flags: { droppedDown: 1 }, timeline: { kind: 'TRANSFER', text: 'Left the big stage to play regular cricket somewhere smaller.' } },
        resultText: "You choose playing over sitting, a smaller badge over a bigger bench. The crowds shrink; the joy, unexpectedly, doesn\u2019t.",
      },
      {
        id: 'plan_after',
        label: 'Start planning life after cricket',
        desc: 'Face the horizon',
        effects: { integrity: 4, morale: 4, coins: 300, attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], flags: { planningRetirement: 1 } },
        resultText: "You take a coaching badge and a hard, clear look at the horizon. Naming the ending doesn\u2019t summon it \u2014 it just means you\u2019ll meet it on your terms.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * INJURY — the body's betrayal, and grey-market temptations           *
   * ------------------------------------------------------------------ */
  {
    id: 'x_injury_long_road',
    trigger: 'INJURY',
    title: 'The Bad One',
    speaker: 'Team Physio',
    once: true,
    priority: 12,
    body: "This isn\u2019t a niggle. The surgeon\u2019s word is \u201Creconstruction,\u201D and the timeline is months, not weeks. \u201CHow you attack the next half-year,\u201D the physio says, \u201Cdecides whether we get the old you back \u2014 or a lesser one.\u201D",
    choices: [
      {
        id: 'best_surgeon',
        label: 'Pay for the best surgeon abroad',
        desc: 'Spare no expense',
        effects: { coins: -1500, attrs: [{ group: 'meta', key: 'fitness', delta: 2 }], morale: 3, flags: { injuryArc: 1 }, queueEvent: 'x_injury_dark_days', timeline: { kind: 'INJURY', text: 'Underwent major reconstructive surgery to save his career.' } },
        resultText: "You empty a chunk of your savings for the surgeon with the best record on earth. If your body is the business, this is capital expenditure.",
      },
      {
        id: 'club_route',
        label: 'Trust the club\u2019s medical team',
        desc: 'Keep faith at home',
        effects: { relationship: [{ id: 'coach', delta: 5 }], morale: 2, flags: { injuryArc: 1 }, queueEvent: 'x_injury_dark_days', timeline: { kind: 'INJURY', text: 'Began a long rehab under the club\u2019s medical staff.' } },
        resultText: "You put your career in the club\u2019s hands and let them own the recovery. It knits you closer to the badge. It also ties your fate to their judgement.",
      },
      {
        id: 'downplay',
        label: 'Downplay it, aim to rush back',
        desc: 'Deny the timeline',
        effects: { confidence: 3, attrs: [{ group: 'meta', key: 'fitness', delta: -3 }], integrity: -2, flags: { injuryArc: 1, denial: 1 }, queueEvent: 'x_injury_dark_days' },
        resultText: "\u201CIt\u2019s not that bad.\u201D You say it to the physio, the press, and the mirror. Bodies, unlike headlines, cannot be spun.",
      },
    ],
  },

  {
    id: 'x_injury_insurance',
    trigger: 'INJURY',
    title: 'The Grey-Market Cure',
    weight: 1,
    body: "A man your agent half-knows offers a \u201Ctreatment\u201D that\u2019ll have you back in half the time \u2014 not quite banned, not quite approved, definitely not on any team form. He also mentions, smiling, an insurance payout you could quietly maximise.",
    choices: [
      {
        id: 'refuse_clean',
        label: 'Refuse it all',
        desc: 'Do it clean',
        effects: { integrity: 8, morale: -3, attrs: [{ group: 'meta', key: 'fitness', delta: 2 }] },
        resultText: "You show him the door. The rehab stays long and honest. When you come back, everything you\u2019ve got is provably, cleanly yours.",
      },
      {
        id: 'grey_treatment',
        label: 'Take the fast treatment',
        desc: 'Back sooner, risk later',
        effects: { form: 5, attrs: [{ group: 'meta', key: 'fitness', delta: 3 }], integrity: -8, flags: { greyCure: 1 } },
        resultText: "You heal alarmingly fast and answer no questions about how. Every drug test now comes with a held breath you didn\u2019t used to hold.",
      },
      {
        id: 'insurance_fraud',
        label: 'Play the insurance angle',
        desc: 'Easy money while hurt',
        effects: { coins: 1200, integrity: -18, morale: -4, flags: { insuranceScam: 1 } },
        resultText: "The payout lands while you\u2019re still limping. It spends like any other money and sits, cold, in a corner of you that used to be clean.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * CAPTAINCY — the loneliest jobs in the game                          *
   * ------------------------------------------------------------------ */
  {
    id: 'x_captaincy_country',
    trigger: 'CAPTAINCY',
    title: 'Leading the Nation',
    speaker: '{selector}',
    once: true,
    priority: 30,
    condition: (c) => c.save.capped === true,
    body: "{selector} calls you into a bare hotel room. \u201CWe want you to captain {country}. It\u2019s the highest honour the game can hand you \u2014 and the loneliest job in it. Every result, every selection, every defeat: yours. Say yes and your life is never fully your own again.\u201D",
    choices: [
      {
        id: 'accept_country',
        label: 'Accept the national captaincy',
        desc: 'Answer the call',
        effects: { nationalRep: 8, brand: 10, confidence: 8, relationship: [{ id: 'selector', delta: 10 }], flags: { countryCaptain: 1 }, unlockAchievement: 'lead_the_nation', timeline: { kind: 'CAPTAINCY', text: 'Named captain of {country} \u2014 the honour of a lifetime.' } },
        resultText: "You say yes and the room tilts. You are, from this second, the face of a nation\u2019s summers. Pride and dread arrive together, holding hands.",
      },
      {
        id: 'not_now',
        label: 'Ask them to wait a year',
        desc: 'Not ready to give up your game',
        effects: { form: 4, morale: 4, relationship: [{ id: 'selector', delta: -6 }], flags: { deferredCountryCaptaincy: 1 } },
        resultText: "\u201CGive me a year to earn it properly.\u201D {selector} frowns; honours like this rarely knock twice. But you know your own weight.",
      },
      {
        id: 'decline_country',
        label: 'Decline \u2014 you\u2019re a player, not a leader',
        desc: 'Know yourself',
        effects: { integrity: 5, form: 5, relationship: [{ id: 'selector', delta: -4 }], flags: { refusedCountryCaptaincy: 1 } },
        resultText: "You hand the crown back untried. Some will never understand it. You\u2019d rather score the runs that win it than carry the weight that loses it.",
      },
    ],
  },

  {
    id: 'x_vice_captain',
    trigger: 'CAPTAINCY',
    title: 'The Deputy',
    speaker: '{captain}',
    weight: 1,
    once: true,
    condition: (c) => !c.save.captainClub,
    body: "{captain} offers you the vice-captaincy. \u201CI need someone who\u2019ll tell me I\u2019m wrong when the room won\u2019t. It\u2019s influence without the crown \u2014 and the blame when I fall on my face.\u201D",
    choices: [
      {
        id: 'accept_vc',
        label: 'Accept the deputy role',
        desc: 'Lead from beside',
        effects: { confidence: 5, relationship: [{ id: 'captain', delta: 10 }, { id: 'coach', delta: 4 }], attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], flags: { viceCaptain: 1 } },
        resultText: "You take the armband\u2019s quieter cousin. Real say, real responsibility, none of the spotlight. It suits you more than you admit.",
      },
      {
        id: 'honest_vc',
        label: 'Accept, but promise real honesty',
        desc: 'Be the voice, not the echo',
        effects: { integrity: 6, relationship: [{ id: 'captain', delta: 6 }], flags: { honestDeputy: 1 } },
        resultText: "\u201CI\u2019ll back you in public and fight you in private. Deal?\u201D {captain} grins. \u201CThat\u2019s exactly why I asked you.\u201D",
      },
      {
        id: 'decline_vc',
        label: 'Focus on your own game',
        desc: 'No distractions',
        effects: { form: 4, confidence: 2, relationship: [{ id: 'captain', delta: -3 }] },
        resultText: "You thank him and pass. Right now your bat needs all of you. He nods, a little disappointed, and asks the next man.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * CALLUP — the first steps onto the biggest stage                     *
   * ------------------------------------------------------------------ */
  {
    id: 'x_callup_debut_nerves',
    trigger: 'CALLUP',
    title: 'The Night Before the Cap',
    weight: 1,
    once: true,
    body: "Tomorrow they hand you your international cap. Tonight the hotel room is too quiet and the ceiling too close. Everyone you\u2019ve ever known will be watching. Sleep will not come by ordering it.",
    choices: [
      {
        id: 'visualise',
        label: 'Visualise, then rest',
        desc: 'Calm the storm',
        effects: { attrs: [{ group: 'batting', key: 'temperament', delta: 3 }], confidence: 4, form: 3 },
        resultText: "You rehearse the first over in your mind until it feels ordinary, then sleep like it\u2019s any other night. The professional\u2019s trick: make the huge feel small.",
      },
      {
        id: 'call_mentor',
        label: 'Ring {mentor} at midnight',
        desc: 'Borrow a steadier heart',
        effects: { morale: 8, relationship: [{ id: 'mentor', delta: 8 }], confidence: 3 },
        resultText: "{mentor} picks up on the second ring like he was waiting. \u201CNerves mean you care,\u201D he says. \u201CNow put the phone down and go be great.\u201D",
      },
      {
        id: 'overthink',
        label: 'Study tomorrow\u2019s bowlers all night',
        desc: 'Prepare until dawn',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 2 }], confidence: 3, form: -3, flags: { overprepared: 1 } },
        resultText: "You watch footage until the birds start up outside. You know their every ball. You\u2019ll walk out tomorrow armed to the teeth and running on fumes.",
      },
    ],
  },

  {
    id: 'x_callup_veteran_advice',
    trigger: 'CALLUP',
    title: 'The Senior Pro\u2019s Welcome',
    speaker: 'Senior Pro',
    weight: 1,
    once: true,
    body: "In the national dressing room, a legend with two hundred caps drops his kit beside yours \u2014 the seat, everyone whispers, of the last man who wore your number. \u201CFirst timer,\u201D he says without looking up. \u201CWord of advice, or would you rather find out the hard way?\u201D",
    choices: [
      {
        id: 'ask_advice',
        label: 'Ask for the advice',
        desc: 'Humility on day one',
        effects: { relationship: [{ id: 'mentor', delta: 8 }], attrs: [{ group: 'batting', key: 'temperament', delta: 2 }], confidence: 3, flags: { earnedRespect: 1 } },
        resultText: "\u201CGo on then.\u201D He tells you which battles to pick and which to let go. Ten minutes that would\u2019ve taken you five years to learn alone.",
      },
      {
        id: 'prove_first',
        label: '\u201CLet me earn it first\u201D',
        desc: 'Respect through runs',
        effects: { confidence: 5, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }], flags: { independentStreak: 1 } },
        resultText: "\u201CAsk me again when I\u2019ve done something.\u201D He raises an eyebrow, then almost smiles. \u201CFair. We\u2019ll see what you\u2019re made of.\u201D",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 1: Form slumps — the dark valley of every career          *
   * ------------------------------------------------------------------ */
  {
    id: 'x_form_slump_media',
    trigger: 'BAD_MATCH',
    title: 'The Headline Nobody Wants',
    speaker: '{agent}',
    weight: 2,
    condition: (c) => (c.rating ?? 10) < 5,
    body: "The morning paper has your face and a number: five ducks in six innings. {agent} is calling before you\u2019ve had coffee. \u201CThey want a statement. Something vulnerable sells papers. But you could also just go silent and bat your way back. Your call.\u201D",
    choices: [
      {
        id: 'statement',
        label: 'Give an honest interview',
        desc: 'Openness builds goodwill',
        effects: { brand: 8, integrity: 5, morale: -3 },
        resultText: "You talk about doubt and routine. Half the country sympathises. The other half still wants you dropped. But at least you own it.",
      },
      {
        id: 'silent',
        label: 'No comment — let the bat speak',
        desc: 'Let runs answer',
        effects: { morale: 3, confidence: 4, brand: -4, flags: { silentProfessional: 1 } },
        resultText: "{agent} sighs. \u201CYou\u2019re going to make me work hard this week.\u201D You spend that energy in the nets instead. The bat will answer for you — or it won\u2019t.",
      },
      {
        id: 'deflect',
        label: 'Blame the pitches',
        desc: 'Deflect criticism',
        effects: { brand: -5, integrity: -6, morale: 2, relationship: [{ id: 'selector', delta: -5 }] },
        resultText: "The spin you put on it fools nobody. {selector} reads the transcript twice and makes a mental note. Blame the pitch all you like. The scorecard doesn\u2019t care.",
      },
    ],
  },

  {
    id: 'x_form_slump_technical',
    trigger: 'BAD_MATCH',
    title: 'The Technical Fault',
    speaker: '{coach}',
    weight: 3,
    condition: (c) => (c.rating ?? 10) < 4.5,
    body: "{coach} has the video from all five dismissals laid out on a tablet. \u201CThere it is,\u201D they say, pausing on the same frame each time. \u201CA fault crept in. We can strip it out, but it\u2019ll be painful and it\u2019ll take weeks. Or we can trust the feel and hope you work it out yourself.\u201D",
    choices: [
      {
        id: 'strip_down',
        label: 'Strip back and rebuild',
        desc: 'Accept the hard truth',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 5 }], form: -5, confidence: -3, flags: { rebuilding: 1 } },
        resultText: "Two weeks of soul-destroying basics. Back to the start. You feel like you are unlearning everything. Then, slowly, it clicks. The fault is gone. You just have to remember how to score again.",
      },
      {
        id: 'back_yourself',
        label: 'Back yourself out of it',
        desc: 'Trust your instincts',
        effects: { confidence: 4, form: 3, attrs: [{ group: 'batting', key: 'technique', delta: -2 }] },
        resultText: "{coach} nods slowly. You play on feel for the next week. The fault stays, but your confidence keeps the lid on it. For now.",
      },
      {
        id: 'ask_mentor',
        label: 'Ask {mentor} for a second opinion',
        desc: 'Outside perspective',
        effects: { attrs: [{ group: 'batting', key: 'technique', delta: 3 }, { group: 'batting', key: 'temperament', delta: 2 }], relationship: [{ id: 'mentor', delta: 6 }, { id: 'coach', delta: -2 }] },
        resultText: "{mentor} sees it differently to {coach}, but the advice from two masters converges on the same place. The fault starts to dissolve.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 2: Success and its complications                          *
   * ------------------------------------------------------------------ */
  {
    id: 'x_century_hundred_speech',
    trigger: 'GOOD_MATCH',
    title: 'The After-Match Camera',
    speaker: 'Interviewer',
    weight: 2,
    condition: (c) => (c.rating ?? 0) >= 8.5,
    once: false,
    body: "Man of the Match. The camera finds you in the dressing room, still in your pads. The interviewer wants the quote that will play on loop. What\u2019s the narrative?",
    choices: [
      {
        id: 'credit_team',
        label: '\u201CThis is for the boys\u201D',
        desc: 'Deflect to team',
        effects: { relationship: [{ id: 'captain', delta: 5 }], brand: 4, morale: 3 },
        resultText: "Every teammate hears it. The dressing room is a warm place tonight. Even {rival} grudgingly nods.",
      },
      {
        id: 'claim_moment',
        label: 'Savour it publicly',
        desc: 'Own the achievement',
        effects: { brand: 10, confidence: 5, integrity: -2, relationship: [{ id: 'captain', delta: -2 }] },
        resultText: "It\u2019s your moment and you own it completely. The fans love the hunger. The dressing room smiles — mostly.",
      },
      {
        id: 'dedicate',
        label: 'Dedicate it to {mentor}',
        desc: 'Honour your roots',
        effects: { brand: 7, relationship: [{ id: 'mentor', delta: 12 }], integrity: 4, morale: 4 },
        resultText: "You point at the camera and say a name most casual fans don\u2019t recognise. But {mentor} is watching, and he hears it, and it means everything.",
      },
    ],
  },

  {
    id: 'x_famous_victory',
    trigger: 'GOOD_MATCH',
    title: 'The Party After',
    speaker: '{captain}',
    weight: 2,
    condition: (c) => (c.rating ?? 0) >= 9,
    body: "A famous win. {captain} holds the dressing room in silence for a moment, then pulls the cork. \u201CHowever you celebrate, be where you want to be at six in the morning.\u201D The city outside is already celebrating. Tonight belongs to everyone.",
    choices: [
      {
        id: 'celebrate_fully',
        label: 'Embrace the night fully',
        desc: 'A memory for life',
        effects: { morale: 12, brand: 6, form: -2, flags: { celebrated: 1 } },
        resultText: "You will tell this story for thirty years. The price is the next morning, which arrives early and unpleasantly. {coach} notices but says nothing — this time.",
      },
      {
        id: 'early_night',
        label: 'Toast and leave early',
        desc: 'Professionalism wins',
        effects: { form: 4, relationship: [{ id: 'coach', delta: 4 }], morale: 5, confidence: 3 },
        resultText: "You stay for the toast, share the joy, and disappear. The next morning you are the sharpest person in nets. {coach} notices that too.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 3: Captaincy and leadership                               *
   * ------------------------------------------------------------------ */
  {
    id: 'x_captain_tactical_brain',
    trigger: 'IDLE',
    title: 'The Captain\u2019s Dilemma',
    speaker: '{captain}',
    weight: 2,
    condition: (c) => !!(c.save.story?.flags?.namedCaptain),
    body: "First match as {team} captain. Three overs left. The match is poised. You need two wickets; they need twenty runs. Your best bowler has bowled his quota. Every choice from here is yours alone.",
    choices: [
      {
        id: 'aggressive_field',
        label: 'Set an attacking field, go for it',
        desc: 'Win or lose gloriously',
        effects: { confidence: 6, brand: 4, attrs: [{ group: 'meta', key: 'aggression', delta: 2 }], flags: { attackingCaptain: 1 } },
        resultText: "Three fielders in the ring, gaps everywhere, batter and captain locked in a chess match played at speed. The purists love it.",
      },
      {
        id: 'defensive_field',
        label: 'Protect the boundary, take what comes',
        desc: 'Contain and hope',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 2 }], form: 2, flags: { defensiveCaptain: 1 } },
        resultText: "You concede the singles and wait. The crowd is frustrated. The scorecard is clinical. The result is the result.",
      },
      {
        id: 'trust_youngster',
        label: 'Give the ball to the youngest bowler',
        desc: 'Build for the future',
        effects: { relationship: [{ id: 'captain', delta: 8 }], morale: 6, brand: 5, flags: { trustingLeader: 1 } },
        resultText: "The youngster\u2019s hands are shaking. You put the ball in them anyway. Whatever happens next, they will remember that you believed in them.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 4: Financial temptation and integrity                     *
   * ------------------------------------------------------------------ */
  {
    id: 'x_big_commercial_deal',
    trigger: 'IDLE',
    title: 'The Offer on the Table',
    speaker: '{agent}',
    weight: 2,
    condition: (c) => ((c.user as any).brand ?? 0) >= 50,
    once: true,
    body: "{agent} has just forwarded a sponsorship proposal that makes you read the number twice. A global energy drink brand. The money changes everything — but their marketing is aggressive and the product is not something you would give your younger siblings.",
    choices: [
      {
        id: 'take_it',
        label: 'Sign it — the money is real',
        desc: 'Secure the future',
        effects: { brand: 10, integrity: -8, coins: 8000, relationship: [{ id: 'agent', delta: 5 }], flags: { bigSponsor: 1 } },
        resultText: "{agent} pops champagne. You sign on the line. The first advert goes live in a week. The emails from parents are polite. Most of them.",
      },
      {
        id: 'negotiate',
        label: 'Counter: endorsement without youth marketing',
        desc: 'Set conditions',
        effects: { brand: 6, integrity: 3, coins: 4000, relationship: [{ id: 'agent', delta: 2 }] },
        resultText: "They haggle. You hold the line. They accept a narrower deal. Half the money, twice the sleep.",
      },
      {
        id: 'decline',
        label: 'Turn it down — not my brand',
        desc: 'Protect your integrity',
        effects: { integrity: 10, brand: 3, relationship: [{ id: 'agent', delta: -4 }] },
        resultText: "{agent} is quiet for a long moment. \u201CYou know how much you just walked away from.\u201D You do. You also know you\u2019d rather not see that advert every time a child picks up a bat.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 5: International prestige and politics                    *
   * ------------------------------------------------------------------ */
  {
    id: 'x_world_cup_squad_leak',
    trigger: 'IDLE',
    title: 'The Leak',
    speaker: 'Journalist',
    weight: 1,
    condition: (c) => ((c.user as any).caps ?? 0) >= 10,
    once: true,
    body: "A journalist messages: they have the World Cup squad before the official announcement. Your name is on it. They want a quote in exchange for letting you know. If the list is wrong, you will have said something you should not have. If it is right, you will have got early confirmation — and broken an embargo.",
    choices: [
      {
        id: 'take_the_bait',
        label: 'Get the confirmation — quote them briefly',
        desc: 'Calculated risk',
        effects: { brand: 4, integrity: -7, flags: { mediaLeak: 1 }, relationship: [{ id: 'selector', delta: -4 }] },
        resultText: "The squad is real and your name is on it. But {selector} hears about the quote. Nothing is said directly. Something shifts, quietly.",
      },
      {
        id: 'wait_and_say_nothing',
        label: 'Thank them, wait for the official call',
        desc: 'Play it straight',
        effects: { integrity: 8, confidence: 3, relationship: [{ id: 'selector', delta: 3 }] },
        resultText: "The official call comes an hour later. You already knew. That is enough. {selector} hears that you said nothing, and approves.",
      },
      {
        id: 'tell_the_board',
        label: 'Report the leak to {selector}',
        desc: 'Protect the institution',
        effects: { integrity: 12, relationship: [{ id: 'selector', delta: 8 }], brand: 2, flags: { institutionFirst: 1 } },
        resultText: "The journalist is furious. {selector} is grateful in a quiet way that matters. At the World Cup, you are treated like someone who can be trusted with anything.",
      },
    ],
  },

  {
    id: 'x_rival_country_offer',
    trigger: 'IDLE',
    title: 'The Other Flag',
    speaker: '{agent}',
    weight: 1,
    condition: (c) => ((c.user as any).caps ?? 0) < 5 && ((c.user as any).overall ?? 0) >= 68,
    once: true,
    body: "{agent} calls with something unusual. A smaller cricket nation — eligible through family — has approached about representing them. Fewer caps, but guaranteed selection. You are young, the door is still open. Your home nation has not confirmed you yet.",
    choices: [
      {
        id: 'wait_for_home',
        label: 'Commit to {country} — the only flag for you',
        desc: 'Patient loyalty',
        effects: { integrity: 8, morale: 3, relationship: [{ id: 'selector', delta: 5 }], flags: { countryFirst: 1 } },
        resultText: "You tell {agent} no without needing to think long. The wait continues. But some doors only mean something because you chose not to go through the other one.",
      },
      {
        id: 'explore',
        label: 'Ask {agent} for more details — keep options open',
        desc: 'Pragmatic exploration',
        effects: { integrity: -3, brand: 2, relationship: [{ id: 'selector', delta: -3 }] },
        resultText: "It leaks — as these things always do. {selector} hears \u201Cconsidering other options.\u201D The next squad announcement does not include your name.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 6: Ageing, decline, and legacy                           *
   * ------------------------------------------------------------------ */
  {
    id: 'x_body_age',
    trigger: 'IDLE',
    title: 'The Physio\u2019s Warning',
    speaker: 'Team Physio',
    weight: 2,
    condition: (c) => ((c.user as any).age ?? 0) >= 32,
    once: true,
    body: "The physio calls you in after the third long training session this week. \u201CListen,\u201D they say with the tone that means no good news follows. \u201CThe joints are telling us something. You can ignore it another couple of years, or we can manage it now and get two or three more seasons out of you at the top level. Your choice.\u201D",
    choices: [
      {
        id: 'manage',
        label: 'Manage it — three more seasons',
        desc: 'Smart longevity',
        effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 3 }], form: 2, flags: { managedBody: 1 } },
        resultText: "You restructure your week. Ice baths, extra recovery sessions, fewer nets but better ones. The cricket gets smarter as the body gets older.",
      },
      {
        id: 'push_through',
        label: 'Push through — still at the top',
        desc: 'Deny the inevitable',
        effects: { confidence: 3, attrs: [{ group: 'meta', key: 'fitness', delta: -3 }], flags: { bodyClock: 1 } },
        resultText: "You are not ready to think this way. The form holds for now. The body is keeping a different score, though, and eventually it will present the bill.",
      },
    ],
  },

  {
    id: 'x_legacy_the_last_season',
    trigger: 'IDLE',
    title: 'One More Season',
    speaker: '{mentor}',
    weight: 1,
    condition: (c) => ((c.user as any).age ?? 0) >= 35,
    once: true,
    body: "{mentor} calls with the question you\u2019ve been avoiding. \u201CYou don\u2019t have to say it yet, but you need to think it: what does the last season look like, and does this one feel like it?\u201D",
    choices: [
      {
        id: 'not_yet',
        label: 'Not yet — still something to prove',
        desc: 'One more chapter',
        effects: { confidence: 5, morale: 3, flags: { fightingOn: 1 } },
        resultText: "{mentor} smiles. \u201CGood. Then make them drag you away.\u201D You intend to.",
      },
      {
        id: 'yes_this_one',
        label: 'Yes — this is the last season',
        desc: 'Go out on your terms',
        effects: { morale: 8, integrity: 5, brand: 6, confidence: 4, flags: { finalSeason: 1 } },
        resultText: "Saying it aloud makes it real. But it also makes every over feel precious. You are going to savour every single ball.",
      },
      {
        id: 'dont_know',
        label: '\u201CI genuinely don\u2019t know yet\u201D',
        desc: 'Honest uncertainty',
        effects: { morale: 4, integrity: 6, relationship: [{ id: 'mentor', delta: 5 }] },
        resultText: "{mentor} nods. \u201CThat\u2019s the most honest answer you\u2019ve given me in years. Good. Let the cricket tell you.\u201D",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 7: Scandal, temptation, and character moments            *
   * ------------------------------------------------------------------ */
  {
    id: 'x_teammate_addiction',
    trigger: 'IDLE',
    title: 'The Request',
    speaker: 'Teammate',
    weight: 1,
    once: true,
    body: "A teammate you rate highly — the first one you genuinely look forward to batting with — knocks on your hotel room door late. They look wrong. Not sick. Something else. \u201CI need a loan,\u201D they say. \u201CDon\u2019t ask me why. Just trust me.\u201D",
    choices: [
      {
        id: 'give_it',
        label: 'Give it and ask nothing',
        desc: 'Unconditional support',
        effects: { integrity: 4, morale: -4, relationship: [{ id: 'captain', delta: 5 }], flags: { loyalFriend: 1 } },
        resultText: "You hand it over. They do not explain. Something gets fixed that you never find out about. Three months later they score a match-winning hundred and buy you dinner in silence.",
      },
      {
        id: 'ask_first',
        label: 'Insist on knowing why first',
        desc: 'Help carefully',
        effects: { integrity: 5, morale: 2, relationship: [{ id: 'captain', delta: 2 }] },
        resultText: "There is a long silence. Then they tell you. It is not something you would have guessed, and it is not something they can fix alone. You make calls.",
      },
      {
        id: 'say_no',
        label: 'Decline — you can\u2019t help blindly',
        desc: 'Protect yourself',
        effects: { integrity: 3, morale: 3, relationship: [{ id: 'captain', delta: -6 }] },
        resultText: "They nod and leave without a word. The next morning they play the worst innings of their career. You spend a long time thinking about that door.",
      },
    ],
  },

  {
    id: 'x_betting_approach',
    trigger: 'IDLE',
    title: 'The Strange Request',
    speaker: 'Unknown',
    weight: 1,
    once: true,
    body: "After a match, a man you don\u2019t recognise places himself near the team bus. He hands you a card — no name, just a number. He says: \u201CWe can make your next few years very comfortable. No one has to know.\u201D You pocket the card without thinking. That night you think of nothing else.",
    choices: [
      {
        id: 'report_immediately',
        label: 'Report to the Anti-Corruption Unit immediately',
        desc: 'Do the right thing',
        effects: { integrity: 15, brand: 5, relationship: [{ id: 'selector', delta: 6 }], flags: { reportedCorruption: 1 } },
        resultText: "You make the call that night. The ACU handler is professional and calm. They\u2019ve heard this before. They take the card and tell you to play your game. You sleep well for the first time in three days.",
      },
      {
        id: 'ignore_delete',
        label: 'Delete the number and never speak of it',
        desc: 'Bury it and move on',
        effects: { integrity: -2, morale: -5, flags: { hiddenSecret: 1 } },
        resultText: "The card goes into a bin two streets away. You tell yourself the silence is a choice, not a mistake. The thing about silence is it does not stop the man from approaching the next player on the bus.",
      },
      {
        id: 'tell_captain',
        label: 'Tell {captain} privately',
        desc: 'Informal but responsible',
        effects: { integrity: 10, relationship: [{ id: 'captain', delta: 8 }], flags: { reportedToCaptain: 1 } },
        resultText: "{captain} goes pale. Then controlled. \u201CWell done for telling me.\u201D They deal with it through the right channels. Your name stays out of it.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 8: New generation — mentoring the future                 *
   * ------------------------------------------------------------------ */
  {
    id: 'x_first_mentor_moment',
    trigger: 'IDLE',
    title: 'Your Turn to Give Back',
    speaker: 'Young Player',
    weight: 2,
    condition: (c) => ((c.user as any).age ?? 0) >= 28 && ((c.user as any).caps ?? 0) >= 20,
    once: true,
    body: "The most talented young player in the country walks into your dressing room for the first time. They are visibly terrified and visibly brilliant. Nobody else is talking to them. You remember exactly what this feels like.",
    choices: [
      {
        id: 'take_them_under',
        label: 'Introduce yourself and offer to bat with them in nets',
        desc: 'Pay it forward',
        effects: { relationship: [{ id: 'mentor', delta: 6 }], morale: 6, brand: 5, integrity: 4, flags: { activeMentor: 1 } },
        resultText: "Ten minutes in the nets turns into two hours. They are extraordinary. You find yourself learning things. This, you think, is how the game stays alive.",
      },
      {
        id: 'leave_them',
        label: 'Leave them to find their feet — you had to',
        desc: 'Sink or swim',
        effects: { morale: 2, flags: { handoffApproach: 1 } },
        resultText: "They survive the first week by instinct and stubbornness. The same way you did. You watch from a distance and like what you see.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 9: Press conferences and media dynamics                  *
   * ------------------------------------------------------------------ */
  {
    id: 'x_press_controversial_question',
    trigger: 'IDLE',
    title: 'The Question Behind the Question',
    speaker: 'Journalist',
    weight: 2,
    condition: (c) => ((c.user as any).caps ?? 0) >= 5,
    body: "Post-match press conference. One journalist — the one who always asks the sharpest thing — says: \u201C{first}, some people are saying you only got called up because the first choice was injured. Does cricket have a habit of overhyping the lucky ones?\u201D The room goes very quiet.",
    choices: [
      {
        id: 'deflect_gracefully',
        label: '\u201CEveryone gets their chance differently. I\u2019m grateful for mine.\u201D',
        desc: 'Elegant and safe',
        effects: { integrity: 5, brand: 4, confidence: 2 },
        resultText: "A polished answer that gives the journalist nothing and the public something they can print. The press writes: \u201Cmature beyond his years.\u201D",
      },
      {
        id: 'challenge',
        label: '\u201CWhy don\u2019t we let the scores settle that one?\u201D',
        desc: 'Bold and confident',
        effects: { brand: 7, confidence: 6, integrity: 2, relationship: [{ id: 'captain', delta: -2 }] },
        resultText: "The room is briefly electric. The journalist grins. The clip goes viral. Your teammates will reference it for the rest of the tour.",
      },
      {
        id: 'honest',
        label: '\u201CYes. I got lucky. Now I intend to make it mean something.\u201D',
        desc: 'Vulnerable and powerful',
        effects: { integrity: 10, brand: 8, morale: 4, relationship: [{ id: 'selector', delta: 3 }] },
        resultText: "The honesty lands. Every cricketer who\u2019s ever caught a lucky break shares it overnight. You become something the game needed: proof that luck doesn\u2019t have to be wasted.",
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * NEW BLOCK 10: Records, records, records                            *
   * ------------------------------------------------------------------ */
  {
    id: 'x_near_record',
    trigger: 'GOOD_MATCH',
    title: 'One Short of History',
    weight: 2,
    condition: (c) => (c.rating ?? 0) >= 7.5,
    body: "After a strong performance, {selector} tells you something quietly: you are three innings from the all-time record for most runs for {team} in a single season. The previous holder is a legend. The record is within reach. The pressure of knowing is a different kind of weight.",
    choices: [
      {
        id: 'embrace_it',
        label: 'Embrace the chase — you want the record',
        desc: 'Go for history',
        effects: { confidence: 6, brand: 8, form: 3, flags: { chasingRecord: 1 } },
        resultText: "The scoreboard becomes a companion. You think about it between deliveries. Some players crumble under that. You sharpen under it.",
      },
      {
        id: 'ignore_it',
        label: 'File it away — focus on the game',
        desc: 'Process over outcome',
        effects: { attrs: [{ group: 'batting', key: 'temperament', delta: 3 }], form: 4, confidence: 3 },
        resultText: "You refuse to let your mind carry the weight of a number. Just the ball, just the shot. The record comes when it comes, or it doesn\u2019t.",
      },
      {
        id: 'share_with_team',
        label: 'Tell the team — ask them to help you get there',
        desc: 'Collective glory',
        effects: { morale: 8, relationship: [{ id: 'captain', delta: 5 }], brand: 5, confidence: 4 },
        resultText: "The dressing room adopts it. They call it \u201Cthe mission.\u201D They feed you strike when they can. You have never felt more like part of a team.",
      },
    ],
  },
];
