export type MatchSpeed = 1 | 2 | 4;

export const MATCH_SPEED_OPTIONS: { speed: MatchSpeed; label: string }[] = [
  { speed: 1, label: '1×' },
  { speed: 2, label: '2×' },
  { speed: 4, label: '4×' },
];

export interface DeliveryDelayInput {
  speed: MatchSpeed;
  userBatting: boolean;
  keyHighlightsMode?: boolean;
  keyBall?: boolean;
  inningsBreak?: boolean;
  wicketOrMilestone?: boolean;
}

export function deliveryDelayMs(input: DeliveryDelayInput): number {
  if (input.keyHighlightsMode && !input.keyBall) return 45;

  const base = input.userBatting ? 2600 : 1800;
  let linger = base;
  if (input.inningsBreak) linger = 3800;
  else if (input.wicketOrMilestone) linger = 3300;

  const readabilityFactor = input.speed === 2 ? 1.2 : 1;
  return Math.round((linger * readabilityFactor) / input.speed);
}
