import { Conditions, Format } from '../domain/types';
import { Rng } from './rng';

export type TossChoice = 'BAT' | 'BOWL';
export type TossCall = 'HEADS' | 'TAILS';

export interface TossDecision {
  winnerTeamId: string;
  coinFace: TossCall;
  userCall?: TossCall;
  userCanCall: boolean;
  choice: TossChoice;
  battingFirstTeamId: string;
  fieldingFirstTeamId: string;
  userMayChoose: boolean;
  reason: string;
}

function aiChoice(format: Format, conditions: Conditions, roll: number): TossChoice {
  let bowlScore = format === 'TEST' ? -0.2 : 0.12;
  if (conditions.pitch === 'GREEN') bowlScore += 0.34;
  if (conditions.pitch === 'CRACKED') bowlScore += 0.06;
  if (conditions.pitch === 'FLAT') bowlScore -= 0.24;
  if (conditions.pitch === 'DRY' || conditions.pitch === 'DUSTY') bowlScore -= 0.1;
  if (conditions.weather === 'OVERCAST') bowlScore += 0.34;
  if (conditions.weather === 'HUMID') bowlScore += 0.2;
  bowlScore += (roll - 0.5) * 0.5;
  return bowlScore > 0 ? 'BOWL' : 'BAT';
}

/**
 * Resolve a toss using exactly two RNG draws. Consuming both draws regardless
 * of the user's choice keeps live and instant simulations deterministic.
 */
export function resolveToss(params: {
  rng: Rng;
  format: Format;
  conditions: Conditions;
  homeTeamId: string;
  awayTeamId: string;
  userTeamId?: string;
  userCall?: TossCall;
  userChoice?: TossChoice;
}): TossDecision {
  const coinFace: TossCall = params.rng() < 0.5 ? 'HEADS' : 'TAILS';
  const choiceRoll = params.rng();
  const userCanCall = Boolean(params.userTeamId);
  const userCall = userCanCall ? (params.userCall ?? 'HEADS') : undefined;
  const userWonCall = Boolean(params.userTeamId && userCall === coinFace);
  const winnerTeamId = params.userTeamId
    ? userWonCall
      ? params.userTeamId
      : params.userTeamId === params.homeTeamId
        ? params.awayTeamId
        : params.homeTeamId
    : coinFace === 'HEADS'
      ? params.homeTeamId
      : params.awayTeamId;
  const loserTeamId =
    winnerTeamId === params.homeTeamId ? params.awayTeamId : params.homeTeamId;
  const userMayChoose = winnerTeamId === params.userTeamId;
  const choice =
    userMayChoose && params.userChoice
      ? params.userChoice
      : aiChoice(params.format, params.conditions, choiceRoll);
  const battingFirstTeamId = choice === 'BAT' ? winnerTeamId : loserTeamId;
  return {
    winnerTeamId,
    coinFace,
    userCall,
    userCanCall,
    choice,
    battingFirstTeamId,
    fieldingFirstTeamId:
      battingFirstTeamId === params.homeTeamId ? params.awayTeamId : params.homeTeamId,
    userMayChoose,
    reason:
      choice === 'BOWL'
        ? 'Conditions and chase value favour bowling first.'
        : 'The surface and match format favour setting a total.',
  };
}
