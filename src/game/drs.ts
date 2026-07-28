import { CareerPathLevel, Competition, Format, GameMode } from '../domain/types';

export interface DrsMatchContext {
  mode?: GameMode;
  careerPathLevel?: CareerPathLevel;
  intl?: boolean;
  format?: Format;
  competition?: Competition;
  explicitEnabled?: boolean;
}

export function drsAvailableForMatch(ctx: DrsMatchContext): boolean {
  if (ctx.mode !== 'career') return false;
  if (ctx.explicitEnabled) return true;
  if (ctx.careerPathLevel === 'SCHOOL' || ctx.careerPathLevel === 'U19') return false;
  if (ctx.intl) return true;
  if (ctx.competition === 'INTL_TOURNAMENT' || ctx.competition === 'BILATERAL_SERIES') return true;
  if (ctx.competition === 'U19_WORLDCUP') return false;
  return ctx.careerPathLevel === 'DOMESTIC' || ctx.careerPathLevel === 'INTERNATIONAL';
}

export function isReviewableDismissal(type?: string): boolean {
  return type === 'LBW' || type === 'CAUGHT' || type === 'RUN_OUT';
}
