import type { NewspaperStory } from '../domain/types';

export interface NewspaperFact {
  key: string;
  label: string;
  accent?: boolean;
  unboxed?: boolean;
}

export function newspaperDeskLabel(story: NewspaperStory): string {
  switch (story.kind) {
    case 'TROPHY':
      return 'CHAMPIONS EDITION';
    case 'PROMOTION':
      return 'SELECTION NEWS';
    case 'MILESTONE':
      return 'RECORD BOOK';
    case 'ELIMINATION':
      return 'TOURNAMENT REVIEW';
    default:
      return 'MATCH REPORT';
  }
}

export interface NewspaperScorePanel {
  teamName: string;
  teamScore: string;
  opponentName: string;
  opponentScore: string;
  resultLine: string;
}

/** Keep the masthead and edition separate without changing persisted story copy. */
export function newspaperEditionDetail(story: NewspaperStory): string {
  return (
    story.edition.replace(/^THE CRICKET CHRONICLE\s*\|\s*/i, '').trim() || `SEASON ${story.season}`
  );
}

/** A score panel is truthful only when both completed totals and the result exist. */
export function newspaperScorePanel(story: NewspaperStory): NewspaperScorePanel | null {
  if (!story.teamName || !story.teamScore || !story.opponentScore || !story.resultLine) {
    return null;
  }
  return {
    teamName: story.teamName,
    teamScore: story.teamScore,
    opponentName: story.opponentName,
    opponentScore: story.opponentScore,
    resultLine: story.resultLine,
  };
}

export function newspaperArticleLabel(story: NewspaperStory): string {
  if (story.kind === 'TROPHY') return 'THE TITLE';
  if (story.kind === 'PROMOTION') return 'CAREER PROMOTION';
  if (story.kind === 'ELIMINATION') return 'THE CAMPAIGN';
  if (story.kind === 'MILESTONE') return 'THE MILESTONE';
  return 'THE MATCH';
}

/** Replace vague copy persisted by early builds without rewriting the save. */
export function newspaperArticleBody(story: NewspaperStory): string {
  if (
    story.kind === 'PROMOTION' &&
    /decision recognises|resets the task|previous level/i.test(story.body)
  ) {
    const from = story.promotionFrom ?? 'the previous level';
    const to = story.promotionTo ?? story.opponentName;
    return `${story.playerName} earned promotion from ${from} to ${to}. The next fixtures will be played at the new level.`;
  }
  if (
    story.kind !== 'PROMOTION' &&
    /verified|completed (?:victory|scorecard|result|batting|bowling)|scorecard records|recorded (?:a|alongside|within)|records? (?:a|the) .*completed/i.test(
      story.body,
    )
  ) {
    const team = story.teamName ?? 'the side';
    const opponent = story.opponentName || 'the opposition';
    const outcome = story.resultLine ? ` as ${story.resultLine}` : '';
    if (story.runs >= 50 && story.wickets >= 3) {
      return `${story.playerName} shaped the contest in both innings, scoring ${story.runs} and taking ${story.wickets} wickets against ${opponent}. The all-round display gave ${team} influence with bat and ball${outcome}.`;
    }
    if (story.runs >= 100) {
      return `${story.playerName} made ${story.runs} from ${story.balls} balls, an innings that became the centre of ${team}’s batting against ${opponent}${outcome}.`;
    }
    if (story.runs >= 50) {
      return `${story.playerName} turned a start into substance with ${story.runs} from ${story.balls} balls against ${opponent}. The half-century gave ${team} a telling contribution${outcome}.`;
    }
    if (story.wickets >= 5) {
      return `${story.playerName} repeatedly broke through the ${opponent} batting order, finishing with ${story.wickets} wickets. The haul placed one bowler at the centre of the contest${outcome}.`;
    }
    if (story.wickets >= 3) {
      return `${story.playerName} claimed ${story.wickets} wickets against ${opponent}, giving ${team} repeated openings through the innings${outcome}.`;
    }
    return story.resultLine
      ? `${story.playerName} played a notable part in the contest against ${opponent}, with ${story.resultLine}.`
      : `${story.playerName} supplied the defining individual contribution in ${team}’s meeting with ${opponent}.`;
  }
  return story.body;
}

/** Select only facts that carry information; zero-value match stats add visual noise. */
export function newspaperFacts(story: NewspaperStory): NewspaperFact[] {
  if (story.kind === 'TROPHY') {
    return (story.trophyNames ?? ['Champions']).map((trophy, index) => ({
      key: `trophy-${index}-${trophy}`,
      label: trophy.toUpperCase(),
      accent: true,
    }));
  }
  if (story.kind === 'ELIMINATION') {
    return [
      { key: 'exit', label: 'TOURNAMENT EXIT', accent: true },
      { key: 'format', label: story.format },
    ];
  }
  if (story.kind === 'PROMOTION') {
    return [
      { key: 'from', label: story.promotionFrom ?? 'CAREER' },
      { key: 'arrow', label: '→', accent: true, unboxed: true },
      { key: 'to', label: story.promotionTo ?? story.opponentName },
    ];
  }
  if (story.kind === 'MILESTONE') {
    return [{ key: 'milestone', label: story.competitionName ?? 'CAREER MILESTONE', accent: true }];
  }

  const facts: NewspaperFact[] = [];
  if (story.runs > 0) facts.push({ key: 'runs', label: `${story.runs} (${story.balls})` });
  if (story.wickets > 0) facts.push({ key: 'wickets', label: `${story.wickets} WKT` });
  facts.push({ key: 'format', label: story.format });
  return facts;
}

export function newspaperFooter(story: NewspaperStory): string {
  if (story.kind === 'TROPHY') return `CHAMPIONS | SEASON ${story.season}`;
  if (story.kind === 'ELIMINATION') {
    return `${(story.competitionName ?? story.opponentName).toUpperCase()} | SEASON ${story.season}`;
  }
  if (story.kind === 'PROMOTION') {
    return `NEW LEVEL | ${story.opponentName.toUpperCase()} | SEASON ${story.season}`;
  }
  if (story.kind === 'MILESTONE') {
    return `CAREER RECORD | ${story.competitionName?.toUpperCase() ?? story.format} | SEASON ${story.season}`;
  }
  if (story.result === 'NEUTRAL') {
    return `${story.opponentName.toUpperCase()} | SEASON ${story.season}`;
  }
  return `${story.opponentName.toUpperCase()} | ${story.result} | SEASON ${story.season}`;
}
