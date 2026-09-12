/**
 * Manager press-conferences & boardroom beats — a choice-driven narrative for
 * the dugout. Unlike the player narrative (which moves personal attributes),
 * these choices move **board confidence**, **club reputation**, the **budget**,
 * and **squad morale/form**. State lives in `save.managerStory`.
 */
import { SaveGame } from '../domain/types';
import { AppliedEffect, sanitizeNarrativeText } from './narrative';
import { Rng } from '../engine/rng';
import { clamp } from '../utils/math';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { ensureSeasonPassExperience, isSeasonPassActive, monthlyBundleForSave, passContentCycleId } from './seasonPass';

export type MgrTrigger = 'PRE_SEASON' | 'POST_WIN' | 'POST_LOSS' | 'SEASON_END' | 'MEDIA';

export interface MgrEffect {
  boardConfidence?: number;
  reputation?: number;
  budget?: number;
  squadMorale?: number;
  squadForm?: number;
}

export interface MgrChoice {
  id: string;
  label: string;
  desc?: string;
  effects: MgrEffect;
  resultText: string;
  nextEventId?: string;
}

export interface MgrEvent {
  id: string;
  trigger: MgrTrigger | MgrTrigger[];
  title: string;
  speaker?: string;
  body: string;
  choices: MgrChoice[];
  once?: boolean;
  weight?: number;
  priority?: number;
  condition?: (save: SaveGame) => boolean;
}

/* ---------------- Content ---------------- */

const MONTHLY_PASS_MANAGER_EVENTS: MgrEvent[] = MONTHLY_PASS_CONTENT.flatMap((content) => {
  const openingId = `pass_monthly_manager_${content.id}_opening`;
  const followUpId = `pass_monthly_manager_${content.id}_followup`;
  return [
    {
      id: openingId,
      trigger: ['PRE_SEASON', 'POST_WIN', 'POST_LOSS', 'MEDIA'],
      title: content.managerStory.openingTitle,
      speaker: 'Executive Office',
      priority: 150,
      condition: (save) =>
        isSeasonPassActive(save) &&
        monthlyBundleForSave(save).id === content.id &&
        save.seasonPassExperience?.managerStoryCycleId !== passContentCycleId(save),
      body: `${content.managerStory.hook} The leadership group needs one clear decision from you.`,
      choices: [
        {
          id: 'decisive',
          label: 'Set the direction',
          desc: 'Accept the pressure personally',
          effects: { boardConfidence: 3, squadForm: 2 },
          resultText: 'The room leaves with clarity. The result will belong to your call.',
          nextEventId: followUpId,
        },
        {
          id: 'collaborative',
          label: 'Build staff consensus',
          desc: 'Trade speed for shared ownership',
          effects: { squadMorale: 4, boardConfidence: 1 },
          resultText: 'The staff argue honestly, then commit to the same message.',
          nextEventId: followUpId,
        },
        {
          id: 'long_term',
          label: 'Protect the long-term plan',
          desc: 'Refuse a short-term reaction',
          effects: { reputation: 1, boardConfidence: -1, squadMorale: 2 },
          resultText: 'The decision is less dramatic, but it gives the project a spine.',
          nextEventId: followUpId,
        },
      ],
    },
    {
      id: followUpId,
      trigger: 'MEDIA',
      title: content.managerStory.followUpTitle,
      speaker: 'Board Room',
      condition: () => false,
      body: `${content.managerStory.consequence} The board asks how you will respond now that the trade-offs are visible.`,
      choices: [
        {
          id: 'accountable',
          label: 'Own the decision',
          effects: { boardConfidence: 4, squadMorale: 2 },
          resultText: 'Accountability steadies the room even where opinions still differ.',
        },
        {
          id: 'adjust',
          label: 'Adjust without panic',
          effects: { squadForm: 3, reputation: 1 },
          resultText: 'The correction is measured and the staff understand why it changed.',
        },
      ],
    },
  ];
});

export const MANAGER_EVENTS: MgrEvent[] = [
  ...MONTHLY_PASS_MANAGER_EVENTS,
  {
    id: 'm_unveiling',
    trigger: 'PRE_SEASON',
    title: 'The Unveiling',
    speaker: 'Press Room',
    once: true,
    body: 'Your first press conference at {team}. Cameras flash. \u201CManager \u2014 what should the fans expect from you this season?\u201D',
    choices: [
      {
        id: 'promise',
        label: 'Promise silverware',
        desc: 'Raise expectations',
        effects: { boardConfidence: 8, reputation: 1, squadMorale: -3 },
        resultText: 'Bold headlines. The board loves it \u2014 now you have to deliver.',
      },
      {
        id: 'process',
        label: 'Preach patience',
        desc: 'Play the long game',
        effects: { squadMorale: 5, boardConfidence: -2 },
        resultText: 'Measured. The dressing room exhales; the board raises an eyebrow.',
      },
      {
        id: 'players',
        label: 'Credit the players',
        desc: 'Deflect to the squad',
        effects: { squadMorale: 8, boardConfidence: 2 },
        resultText: 'The squad hears it loud and clear. Trust banked.',
      },
    ],
  },
  {
    id: 'm_bad_run',
    trigger: 'POST_LOSS',
    title: 'Under the Microscope',
    speaker: 'Press Room',
    weight: 2,
    body: 'Another defeat. A reporter leans in: \u201CThree losses on the bounce. Are you the right man for {team}?\u201D',
    choices: [
      {
        id: 'defiant',
        label: 'Defend your record',
        desc: 'Show backbone',
        effects: { boardConfidence: 4, squadMorale: -2 },
        resultText: 'You stare them down. The board respects the fight \u2014 for now.',
      },
      {
        id: 'blame_self',
        label: 'Take the blame',
        desc: 'Shield the players',
        effects: { squadMorale: 9, boardConfidence: -4 },
        resultText:
          '\u201CThat\u2019s on me.\u201D The players would run through a wall for you now.',
      },
      {
        id: 'blame_players',
        label: 'Question the effort',
        desc: 'Light a fire',
        effects: { squadForm: 4, squadMorale: -8, boardConfidence: 2 },
        resultText: 'It stings the dressing room. Some sharpen up; some resent it.',
      },
    ],
  },
  {
    id: 'm_good_run',
    trigger: 'POST_WIN',
    title: 'Riding High',
    speaker: 'Press Room',
    weight: 2,
    condition: (s) => (s.boardConfidence ?? 60) >= 55,
    body: 'A commanding win. \u201CThe fans are dreaming now \u2014 do you dare to dream with them?\u201D',
    choices: [
      {
        id: 'humble',
        label: 'Stay grounded',
        desc: 'One game at a time',
        effects: { squadForm: 2, boardConfidence: 2 },
        resultText: 'Classic manager-speak. Keeps everyone honest.',
      },
      {
        id: 'title',
        label: 'Declare a title tilt',
        desc: 'Embrace the pressure',
        effects: { boardConfidence: 6, reputation: 1, squadMorale: -2 },
        resultText: 'The headline writes itself. Now the pressure is real.',
      },
    ],
  },
  {
    id: 'm_star_unsettled',
    trigger: 'MEDIA',
    title: 'Transfer Speculation',
    speaker: 'Agent',
    weight: 1,
    body: 'A bigger club is sniffing around your best player. The agent hints they \u201Cwant to test themselves.\u201D The board would bank the fee.',
    choices: [
      {
        id: 'keep',
        label: 'Refuse to sell',
        desc: 'Send a message',
        effects: { squadMorale: 6, boardConfidence: -3 },
        resultText: 'The squad sees you back your best. The board grumbles about the lost fee.',
      },
      {
        id: 'sell',
        label: 'Cash in',
        desc: 'Reinvest the money',
        effects: { budget: 900_000, squadMorale: -6, boardConfidence: 5 },
        resultText: 'A war chest arrives \u2014 and a hole in the dressing room to fill.',
      },
      {
        id: 'promise_review',
        label: 'Promise to review in summer',
        desc: 'Buy time',
        effects: { squadMorale: 1 },
        resultText: 'A politician\u2019s answer. It holds the line, barely.',
      },
    ],
  },
  {
    id: 'm_back_youngster',
    trigger: 'MEDIA',
    title: 'The Kid or the Veteran',
    speaker: 'Press Room',
    weight: 1,
    body: 'The academy graduate is turning heads, but a senior pro is stewing on the bench. The media wants to know who you trust.',
    choices: [
      {
        id: 'youth',
        label: 'Back the youngster',
        desc: 'Trust youth development',
        effects: { reputation: 1, squadForm: 3, boardConfidence: 2 },
        resultText: 'A statement of intent. The academy takes note.',
      },
      {
        id: 'experience',
        label: 'Trust experience',
        desc: 'Reward loyalty',
        effects: { squadMorale: 4 },
        resultText: 'The old pro stands taller. Continuity over risk.',
      },
    ],
  },
  {
    id: 'm_board_review',
    trigger: 'SEASON_END',
    title: 'The Boardroom',
    speaker: 'Chairman',
    weight: 2,
    body: 'Season review with the board of {team}. The chairman folds his hands. \u201CWhere do we go from here?\u201D',
    choices: [
      {
        id: 'ambition',
        label: 'Demand backing to push on',
        desc: 'Ask for funds',
        effects: { budget: 700_000, boardConfidence: -3 },
        resultText: 'They open the cheque book \u2014 but expectations climb with it.',
      },
      {
        id: 'stability',
        label: 'Preach stability',
        desc: 'Protect the project',
        effects: { boardConfidence: 6, squadMorale: 3 },
        resultText: 'The board is reassured. A calm summer ahead.',
      },
      {
        id: 'overachieve',
        label: 'Promise to overachieve on a shoestring',
        desc: 'Win them over',
        effects: { boardConfidence: 9, reputation: 1, budget: -200_000 },
        resultText: 'They\u2019re delighted \u2014 and hold you to every word.',
      },
    ],
  },
  {
    id: 'm_fan_forum',
    trigger: 'MEDIA',
    title: 'Fan Forum',
    speaker: 'Supporters',
    weight: 1,
    body: 'The supporters\u2019 club invites you to a forum. They\u2019re passionate, loyal, and not shy about their opinions on your tactics.',
    choices: [
      {
        id: 'engage',
        label: 'Win them over',
        desc: 'Charm the crowd',
        effects: { reputation: 1, boardConfidence: 3 },
        resultText: 'You leave to applause. Goodwill in the bank.',
      },
      {
        id: 'honest',
        label: 'Be brutally honest',
        desc: 'Respect their intelligence',
        effects: { squadMorale: 2, boardConfidence: 1 },
        resultText: 'No spin. They respect the candour.',
      },
    ],
  },
  {
    id: 'm_tactics_questioned',
    trigger: 'POST_LOSS',
    title: 'Tactics on Trial',
    speaker: 'Press Room',
    weight: 1,
    body: '\u201CYour setup looked toothless today. Will you change your approach?\u201D',
    choices: [
      {
        id: 'stick',
        label: 'Trust the plan',
        desc: 'Consistency',
        effects: { boardConfidence: 2, squadForm: 2 },
        resultText: 'You back your ideas. Conviction can be contagious.',
      },
      {
        id: 'adapt',
        label: 'Admit you got it wrong',
        desc: 'Show flexibility',
        effects: { squadMorale: 5, boardConfidence: -1 },
        resultText: 'Humility disarms the room. The players appreciate the honesty.',
      },
    ],
  },
  // ── Dressing Room events (Feature 3) ──────────────────────────────────────
  {
    id: 'm_clique_forming',
    trigger: 'MEDIA',
    title: 'Clique Forming',
    speaker: 'Dressing Room',
    weight: 1,
    condition: (s) => (s.teams[s.userTeamId ?? '']?.playerIds.length ?? 0) >= 10,
    body: 'A trusted senior player quietly mentions that a small group has been going off on their own — separate lunches, separate practice. It\u2019s early, but cliques kill team culture.',
    choices: [
      {
        id: 'address_all',
        label: 'Address the whole squad',
        desc: 'Bring it into the open',
        effects: { squadMorale: -3, squadForm: 3, boardConfidence: 1 },
        resultText: 'Uncomfortable silence — then heads nod. Sunlight is the best disinfectant.',
      },
      {
        id: 'quiet_word',
        label: 'A quiet word with the ringleader',
        desc: 'Handle it privately',
        effects: { squadMorale: 5, boardConfidence: 2 },
        resultText: 'The message lands without a public scene. The clique quietly dissolves.',
      },
      {
        id: 'ignore',
        label: 'Let it run its course',
        desc: 'Pick your battles',
        effects: { squadMorale: -6 },
        resultText: 'Tensions simmer. The divide only deepens.',
      },
    ],
  },
  {
    id: 'm_star_unhappy',
    trigger: 'MEDIA',
    title: 'Star Player Unhappy',
    speaker: 'Agent',
    weight: 1,
    body: 'Your star player\u2019s agent is on the phone. \u201CHe\u2019s not feeling the love. Either his role changes or we\u2019re talking to other clubs in January.\u201D',
    choices: [
      {
        id: 'central_role',
        label: 'Promise a more central role',
        desc: 'Lean into his ego',
        effects: { squadMorale: 4, squadForm: 4, boardConfidence: -2 },
        resultText:
          'He\u2019s pacified. For now. The rest of the squad notices the special treatment.',
      },
      {
        id: 'hold_firm',
        label: 'Tell him to earn it',
        desc: 'Don\u2019t bend to ultimatums',
        effects: { squadMorale: -2, boardConfidence: 5, reputation: 1 },
        resultText: 'He sulks briefly, then knuckles down. Authority restored.',
      },
      {
        id: 'sell',
        label: 'Put him on the market',
        desc: 'Cash in and move on',
        effects: { budget: 1_000_000, squadMorale: -4, boardConfidence: 3 },
        resultText:
          'A handsome fee arrives — and the dressing room waits to see who fills the void.',
      },
    ],
  },
  {
    id: 'm_team_bonding',
    trigger: 'MEDIA',
    title: 'Surprise Team Bonding',
    speaker: 'Dressing Room',
    weight: 1,
    condition: (s) => (s.boardConfidence ?? 60) >= 50,
    body: 'The senior players have quietly organised a team dinner and a trip to the nets. The mood is electric. You\u2019re invited — how do you respond?',
    choices: [
      {
        id: 'join_fully',
        label: 'Join them — be one of the lads',
        desc: 'Show you\u2019re human',
        effects: { squadMorale: 12, squadForm: 3, boardConfidence: 2 },
        resultText: 'Best night of the season. The bond in the dressing room is tangible.',
      },
      {
        id: 'brief_appearance',
        label: 'Make a brief appearance',
        desc: 'Professional distance',
        effects: { squadMorale: 6, boardConfidence: 1 },
        resultText: 'Respected but not effusive. Good balance.',
      },
      {
        id: 'skip',
        label: 'Focus on preparation instead',
        desc: 'Keep the professionalism',
        effects: { squadMorale: -2, boardConfidence: 1 },
        resultText: 'They understand — but they notice the absence.',
      },
    ],
  },
  {
    id: 'pass_recruitment_summit',
    trigger: 'MEDIA',
    title: 'Recruitment Summit',
    speaker: 'Executive Office',
    weight: 2,
    condition: (save) => isSeasonPassActive(save),
    body: 'Your staff debate the next edge for {team}: a marquee signing, deeper coaching, or investing trust in the current squad.',
    choices: [
      {
        id: 'marquee',
        label: 'Build the shortlist',
        desc: 'Raise expectations',
        effects: { reputation: 2, boardConfidence: -2 },
        resultText: 'Scouts widen the search. The board now expects a convincing target.',
      },
      {
        id: 'coaching',
        label: 'Back the coaches',
        desc: 'Improve the environment',
        effects: { squadForm: 3, boardConfidence: 3 },
        resultText: 'The staff leave with clearer ownership and a little more authority.',
      },
      {
        id: 'trust',
        label: 'Trust this squad',
        desc: 'Protect morale',
        effects: { squadMorale: 7, reputation: -1 },
        resultText: 'The players hear the message. The outside world calls it cautious.',
      },
    ],
  },
  {
    id: 'pass_private_briefing',
    trigger: 'PRE_SEASON',
    title: 'Private Board Briefing',
    speaker: 'Board Room',
    weight: 2,
    condition: (save) => isSeasonPassActive(save),
    body: 'The board offers one private priority for the new campaign: identity, youth, or immediate results.',
    choices: [
      {
        id: 'identity',
        label: 'Define our cricket',
        effects: { squadForm: 2, reputation: 2 },
        resultText: 'The club leaves pre-season with a clearer tactical identity.',
      },
      {
        id: 'youth',
        label: 'Create a pathway',
        effects: { squadMorale: 3, boardConfidence: 2 },
        resultText: 'Academy prospects see a route. Senior players know competition is coming.',
      },
      {
        id: 'results',
        label: 'Demand results now',
        effects: { boardConfidence: 5, squadMorale: -3 },
        resultText: 'The target is unmistakable. So is the pressure.',
      },
    ],
  },
];

/* ---------------- Engine ---------------- */

export function renderMgr(text: string, save: SaveGame): string {
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  return sanitizeNarrativeText(
    text.replace(/\{(\w+)\}/g, (_, k: string) =>
      k === 'team' ? (team?.name ?? 'the club') : 'the club',
    ),
    'The club faces a new decision.',
  );
}

function fmt(label: string, delta: number, goodWhenPositive = true): AppliedEffect {
  const good = delta > 0 === goodWhenPositive;
  return {
    label: `${label} ${delta > 0 ? '+' : ''}${delta}`,
    tone: delta === 0 ? 'neutral' : good ? 'good' : 'bad',
  };
}

export function applyMgrEffects(save: SaveGame, e: MgrEffect): AppliedEffect[] {
  const out: AppliedEffect[] = [];
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  if (e.boardConfidence != null) {
    const protectedDelta =
      (save.managerGraceMatchesRemaining ?? 0) > 0 && e.boardConfidence < 0 ? 0 : e.boardConfidence;
    save.boardConfidence = clamp((save.boardConfidence ?? 60) + protectedDelta, 0, 100);
    out.push(fmt('Board confidence', protectedDelta));
  }
  if (team && e.reputation != null) {
    team.reputation = clamp(team.reputation + e.reputation, 40, 95);
    out.push(fmt('Club reputation', e.reputation));
  }
  if (team && e.budget) {
    team.budget = Math.max(0, team.budget + e.budget);
    out.push({
      label: `${e.budget > 0 ? '+' : ''}${Math.round(e.budget / 1000)}k budget`,
      tone: e.budget > 0 ? 'good' : 'bad',
    });
  }
  if (team && (e.squadMorale != null || e.squadForm != null)) {
    for (const id of team.playerIds) {
      const p = save.players[id];
      if (!p) continue;
      if (e.squadMorale != null) p.morale = clamp((p.morale ?? 70) + e.squadMorale, 0, 100);
      if (e.squadForm != null) p.meta.form = clamp(p.meta.form + e.squadForm, 1, 99);
    }
    if (e.squadMorale != null) out.push(fmt('Squad morale', e.squadMorale));
    if (e.squadForm != null) out.push(fmt('Squad form', e.squadForm));
  }
  return out;
}

function ensureMgrStory(save: SaveGame): void {
  if (!save.managerStory)
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
}

export function queueManagerEvent(save: SaveGame, trigger: MgrTrigger, rng: Rng): boolean {
  if (save.mode !== 'manager' || !save.userTeamId) return false;
  ensureMgrStory(save);
  const seen = new Set(save.managerStory!.seenEventIds);
  const seasonYear =
    save.managerCalendar?.year ??
    (save.currentSeasonId ? save.seasons[save.currentSeasonId]?.year : undefined) ??
    2026;
  const pool = MANAGER_EVENTS.filter((ev) => {
    const triggers = Array.isArray(ev.trigger) ? ev.trigger : [ev.trigger];
    if (!triggers.includes(trigger)) return false;
    if (ev.once && seen.has(ev.id)) return false;
    if (save.managerStory!.flags[`lastAskedSeason:${ev.id}`] === seasonYear) return false;
    const lastAskedAt = save.managerStory!.flags[`lastAskedMatch:${ev.id}`];
    if (
      typeof lastAskedAt === 'number' &&
      (save.managerMatchesAtCurrentClub ?? 0) - lastAskedAt < 5
    ) {
      return false;
    }
    if (ev.condition && !ev.condition(save)) return false;
    return true;
  });
  if (!pool.length) return false;
  const maxPriority = Math.max(...pool.map((event) => event.priority ?? 0));
  const prioritized = pool.filter((event) => (event.priority ?? 0) === maxPriority);
  const total = prioritized.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = rng() * total;
  let chosen = prioritized[0];
  for (const e of prioritized) {
    r -= e.weight ?? 1;
    if (r <= 0) {
      chosen = e;
      break;
    }
  }
  if (!save.managerStory!.pendingEventIds.includes(chosen.id))
    save.managerStory!.pendingEventIds.push(chosen.id);
  save.managerStory!.flags[`lastAskedMatch:${chosen.id}`] = save.managerMatchesAtCurrentClub ?? 0;
  save.managerStory!.flags[`lastAskedSeason:${chosen.id}`] = seasonYear;
  if (chosen.id.startsWith('pass_monthly_manager_') && chosen.id.endsWith('_opening')) {
    ensureSeasonPassExperience(save, save.pass?.seasonId);
    save.seasonPassExperience!.managerStoryCycleId = passContentCycleId(save);
  }
  return true;
}

export interface RenderedMgrEvent {
  id: string;
  title: string;
  speaker?: string;
  body: string;
  choices: { id: string; label: string; desc?: string }[];
}

export function nextManagerEvent(save: SaveGame): RenderedMgrEvent | null {
  const id = save.managerStory?.pendingEventIds[0];
  if (!id) return null;
  const ev = MANAGER_EVENTS.find((e) => e.id === id);
  if (!ev) {
    if (save.managerStory)
      save.managerStory.pendingEventIds = save.managerStory.pendingEventIds.filter((x) => x !== id);
    return null;
  }
  return {
    id: ev.id,
    title: ev.title,
    speaker: ev.speaker,
    body: renderMgr(ev.body, save),
    choices: ev.choices.map((c) => ({ id: c.id, label: c.label, desc: c.desc })),
  };
}

export function managerEventCount(save: SaveGame): number {
  return save.managerStory?.pendingEventIds.length ?? 0;
}

export interface MgrChoiceResult {
  ok: boolean;
  resultText?: string;
  applied?: AppliedEffect[];
}

export function resolveManagerChoice(
  save: SaveGame,
  eventId: string,
  choiceId: string,
): MgrChoiceResult {
  const ev = MANAGER_EVENTS.find((e) => e.id === eventId);
  const choice = ev?.choices.find((c) => c.id === choiceId);
  if (!ev || !choice) return { ok: false };
  const applied = applyMgrEffects(save, choice.effects);
  ensureMgrStory(save);
  if (!save.managerStory!.seenEventIds.includes(eventId))
    save.managerStory!.seenEventIds.push(eventId);
  save.managerStory!.pendingEventIds = save.managerStory!.pendingEventIds.filter(
    (x) => x !== eventId,
  );
  if (choice.nextEventId && !save.managerStory!.pendingEventIds.includes(choice.nextEventId)) {
    save.managerStory!.pendingEventIds.push(choice.nextEventId);
  }
  return { ok: true, resultText: renderMgr(choice.resultText, save), applied };
}
