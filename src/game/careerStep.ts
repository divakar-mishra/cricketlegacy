import { ManagerCalendarPhase, PlayerCalendarEvent, SaveGame } from '../domain/types';
import { careerSelectionDecision } from './career';
import { fixtureEnergyCost } from './economy';
import { managerControlledTeamId, managerPhaseProgress } from './managerCalendar';
import { currentPlayerCalendarEvent } from './playerCalendar';
import { nextUserFixtureId, seasonComplete } from './season';

export enum CareerStepType {
  TRAINING_MANDATORY = 'TRAINING_MANDATORY',
  MATCHDAY_SELECTED = 'MATCHDAY_SELECTED',
  MATCHDAY_BENCHED = 'MATCHDAY_BENCHED',
  MATCHDAY_RESTED = 'MATCHDAY_RESTED',
  STORY_EVENT_REQUIRED = 'STORY_EVENT_REQUIRED',
  OFFSEASON_TRANSFER = 'OFFSEASON_TRANSFER',
  SEASON_WRAPUP = 'SEASON_WRAPUP',
  CAREER_PROMOTION_CEREMONY = 'CAREER_PROMOTION_CEREMONY',
}

export enum ManagerStepType {
  JOB_OFFER_REQUIRED = 'JOB_OFFER_REQUIRED',
  PRESS_REQUIRED = 'PRESS_REQUIRED',
  MATCHDAY = 'MATCHDAY',
  CALENDAR_ADVANCE = 'CALENDAR_ADVANCE',
  OFFSEASON = 'OFFSEASON',
  SEASON_WRAPUP = 'SEASON_WRAPUP',
  JOB_SEARCH = 'JOB_SEARCH',
}

export type CareerStepAction =
  | 'OPEN_STORY'
  | 'OPEN_TRAINING'
  | 'RESOLVE_CALENDAR'
  | 'PLAY_MATCH'
  | 'SIMULATE_MATCH'
  | 'OPEN_TRANSFERS'
  | 'ADVANCE_SEASON'
  | 'ACKNOWLEDGE_PROMOTION'
  | 'OPEN_PRESS'
  | 'OPEN_JOB_OFFER'
  | 'OPEN_JOB_SEARCH'
  | 'ADVANCE_MANAGER_CALENDAR'
  | 'REFILL_ENERGY';

export interface ResolvedCareerStep {
  mode: 'career';
  type: CareerStepType;
  action: CareerStepAction;
  title: string;
  detail: string;
  fixtureId?: string;
  calendarEvent?: PlayerCalendarEvent;
}

export interface ResolvedManagerStep {
  mode: 'manager';
  type: ManagerStepType;
  action: CareerStepAction;
  title: string;
  detail: string;
  fixtureId?: string;
  phase?: ManagerCalendarPhase;
}

export type ResolvedNextStep = ResolvedCareerStep | ResolvedManagerStep;

export interface CareerStepContext {
  pendingPromotion?: boolean;
}

function playerMatchStep(save: SaveGame, fixtureId: string): ResolvedCareerStep {
  const fixture = save.fixtures[fixtureId];
  const decision = careerSelectionDecision(save, fixture?.format ?? 'T20', fixtureId);
  if (decision.selected) {
    const energyCost = fixture ? fixtureEnergyCost(fixture) : 0;
    const needsEnergy = save.wallet.energy < energyCost;
    return {
      mode: 'career',
      type: CareerStepType.MATCHDAY_SELECTED,
      action: needsEnergy ? 'REFILL_ENERGY' : 'PLAY_MATCH',
      title: needsEnergy ? 'Restore match energy' : 'Matchday: selected',
      detail: needsEnergy ? `You need ${energyCost} energy for this fixture.` : decision.reason,
      fixtureId,
    };
  }
  const rested =
    decision.reason.startsWith('Rested') ||
    decision.reason.startsWith('Unavailable') ||
    decision.reason.includes('condition');
  return {
    mode: 'career',
    type: rested ? CareerStepType.MATCHDAY_RESTED : CareerStepType.MATCHDAY_BENCHED,
    action: 'SIMULATE_MATCH',
    title: rested ? 'Matchday: resting' : 'Matchday: benched',
    detail: decision.reason,
    fixtureId,
  };
}

function resolvePlayerStep(save: SaveGame, context: CareerStepContext): ResolvedCareerStep {
  if (context.pendingPromotion) {
    return {
      mode: 'career',
      type: CareerStepType.CAREER_PROMOTION_CEREMONY,
      action: 'ACKNOWLEDGE_PROMOTION',
      title: 'Career promotion',
      detail: 'Acknowledge the new level before continuing.',
    };
  }

  const storyCount = save.story?.pendingEventIds.length ?? 0;
  if (storyCount > 0) {
    return {
      mode: 'career',
      type: CareerStepType.STORY_EVENT_REQUIRED,
      action: 'OPEN_STORY',
      title: storyCount === 1 ? 'Career decision waiting' : `${storyCount} decisions waiting`,
      detail: 'Resolve this moment before the calendar advances.',
    };
  }

  const calendarEvent = currentPlayerCalendarEvent(save);
  if (calendarEvent?.kind === 'MATCH' && calendarEvent.fixtureId) {
    return playerMatchStep(save, calendarEvent.fixtureId);
  }
  if (calendarEvent) {
    if (calendarEvent.kind === 'TRANSFER_WINDOW') {
      return {
        mode: 'career',
        type: CareerStepType.OFFSEASON_TRANSFER,
        action: 'RESOLVE_CALENDAR',
        title: calendarEvent.title,
        detail: calendarEvent.detail,
        calendarEvent,
      };
    }
    return {
      mode: 'career',
      type: CareerStepType.TRAINING_MANDATORY,
      action: calendarEvent.kind === 'TRAINING' ? 'OPEN_TRAINING' : 'RESOLVE_CALENDAR',
      title: calendarEvent.title,
      detail: calendarEvent.detail,
      calendarEvent,
    };
  }

  const fixtureId = nextUserFixtureId(save);
  if (fixtureId) return playerMatchStep(save, fixtureId);

  if (seasonComplete(save)) {
    return {
      mode: 'career',
      type: CareerStepType.SEASON_WRAPUP,
      action: 'ADVANCE_SEASON',
      title: 'Season review ready',
      detail: 'Review the completed campaign and begin the next season.',
    };
  }

  if ((save.currentMonth ?? 1) >= 6 && (save.currentMonth ?? 1) <= 8) {
    return {
      mode: 'career',
      type: CareerStepType.OFFSEASON_TRANSFER,
      action: 'OPEN_TRANSFERS',
      title: 'Off-season window',
      detail: 'Contracts, transfers and recovery are available before the next campaign.',
    };
  }

  return {
    mode: 'career',
    type: CareerStepType.TRAINING_MANDATORY,
    action: 'OPEN_TRAINING',
    title: 'Training week',
    detail: 'Choose a focused paid session, or continue when you want to save your coins.',
  };
}

function resolveManagerStep(save: SaveGame): ResolvedManagerStep {
  if (save.managerJobOffer) {
    return {
      mode: 'manager',
      type: ManagerStepType.JOB_OFFER_REQUIRED,
      action: 'OPEN_JOB_OFFER',
      title: `${save.managerJobOffer.clubName} job offer`,
      detail: 'Accept or decline the offer before advancing the calendar.',
    };
  }
  if (save.flags?.sacked) {
    return {
      mode: 'manager',
      type: ManagerStepType.JOB_SEARCH,
      action: 'OPEN_JOB_SEARCH',
      title: 'Choose your next club',
      detail: 'Take a new appointment to continue your manager career.',
    };
  }
  const pressCount = save.managerStory?.pendingEventIds.length ?? 0;
  if (pressCount > 0) {
    return {
      mode: 'manager',
      type: ManagerStepType.PRESS_REQUIRED,
      action: 'OPEN_PRESS',
      title: pressCount === 1 ? 'Press duty waiting' : `${pressCount} press duties waiting`,
      detail: 'Complete the required media event before matchday.',
    };
  }
  const fixtureId = nextUserFixtureId(save);
  if (fixtureId) {
    const fixture = save.fixtures[fixtureId];
    const controlledTeamId = fixture?.managerPhase
      ? managerControlledTeamId(save, fixture.managerPhase)
      : save.userTeamId;
    const opponentId =
      fixture?.homeTeamId === controlledTeamId ? fixture.awayTeamId : fixture?.homeTeamId;
    return {
      mode: 'manager',
      type: ManagerStepType.MATCHDAY,
      action: 'PLAY_MATCH',
      title: opponentId ? `Matchday v ${save.teams[opponentId]?.name ?? 'opposition'}` : 'Matchday',
      detail: 'Review the XI, briefing and tactics before continuing.',
      fixtureId,
      phase: fixture?.managerPhase,
    };
  }
  const progress = save.managerCalendar ? managerPhaseProgress(save) : undefined;
  if (progress?.phase === 'OFF_SEASON') {
    return {
      mode: 'manager',
      type: ManagerStepType.OFFSEASON,
      action: 'ADVANCE_SEASON',
      title: 'Transfer Market & Contracts Window',
      detail: 'Complete club business, then begin the next campaign.',
      phase: progress.phase,
    };
  }
  if (progress) {
    return {
      mode: 'manager',
      type: ManagerStepType.CALENDAR_ADVANCE,
      action: 'ADVANCE_MANAGER_CALENDAR',
      title: progress.unlocked ? `Advance ${progress.label}` : `Simulate ${progress.label}`,
      detail: progress.unlocked
        ? 'Simulate other clubs until your next required fixture.'
        : 'This locked competition runs in the background.',
      phase: progress.phase,
    };
  }
  return {
    mode: 'manager',
    type: ManagerStepType.SEASON_WRAPUP,
    action: 'ADVANCE_SEASON',
    title: 'Season review ready',
    detail: 'Close the completed campaign and continue.',
  };
}

/** The sole resolver used by both career hubs to expose one required next action. */
export function resolveNextCareerStep(
  save: SaveGame,
  context: CareerStepContext = {},
): ResolvedNextStep {
  return save.mode === 'manager' ? resolveManagerStep(save) : resolvePlayerStep(save, context);
}
