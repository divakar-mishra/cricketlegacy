import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { StoryEvent } from '../game/narrative';
import { isSeasonPassActive, monthlyBundleForSave } from '../game/seasonPass';

/** Two-step Player Career chain for every monthly content cycle. */
export const MONTHLY_PASS_PLAYER_EVENTS: StoryEvent[] = MONTHLY_PASS_CONTENT.flatMap(
  (content) => {
    const openingId = `pass_monthly_player_${content.id}_opening`;
    const followUpId = `pass_monthly_player_${content.id}_followup`;
    const currentCycle = (save: Parameters<NonNullable<StoryEvent['condition']>>[0]['save']) =>
      isSeasonPassActive(save) &&
      monthlyBundleForSave(save).id === content.id &&
      save.seasonPassExperience?.playerStoryCycleId !== save.pass?.seasonId;
    return [
      {
        id: openingId,
        trigger: ['POST_MATCH', 'GOOD_MATCH', 'BAD_MATCH', 'IDLE'],
        title: content.playerStory.openingTitle,
        speaker: '{captain}',
        priority: 150,
        condition: (context) => currentCycle(context.save),
        body: `${content.playerStory.hook} {captain} asks for your honest answer before the squad moves on.`,
        choices: [
          {
            id: 'lead',
            label: 'Take responsibility',
            desc: 'Put your name behind the decision',
            effects: { confidence: 4, relationship: [{ id: 'captain', delta: 5 }], queueEvent: followUpId },
            resultText: '{captain} accepts the answer. The room now expects you to live it.',
          },
          {
            id: 'listen',
            label: 'Ask the room first',
            desc: 'Build a shared response',
            effects: { morale: 4, relationship: [{ id: 'coach', delta: 4 }], queueEvent: followUpId },
            resultText: 'The discussion takes longer, but more voices leave the room invested.',
          },
          {
            id: 'provoke',
            label: 'Challenge the group',
            desc: 'Create productive tension',
            effects: { form: 3, integrity: -1, relationship: [{ id: 'rival', delta: -4 }], queueEvent: followUpId },
            resultText: 'The challenge lands sharply. Nobody can claim the month feels routine now.',
          },
        ],
      },
      {
        id: followUpId,
        trigger: 'IDLE',
        title: content.playerStory.followUpTitle,
        speaker: '{coach}',
        // Follow-ups only arrive through queueEvent from the opening choice.
        condition: () => false,
        body: `${content.playerStory.consequence} {coach} asks what you learned from seeing the consequences up close.`,
        choices: [
          {
            id: 'own_it',
            label: 'Own the outcome',
            effects: { integrity: 3, relationship: [{ id: 'coach', delta: 5 }] },
            resultText: '{coach} remembers the accountability more than the result.',
          },
          {
            id: 'adapt',
            label: 'Change the approach',
            effects: { attrs: [{ group: 'meta', key: 'discipline', delta: 1 }], form: 2 },
            resultText: 'The adjustment is small, specific and visible at the next session.',
          },
        ],
      },
    ];
  },
);
