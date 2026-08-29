import type { NewspaperStory } from '../../domain/types';
import {
  newspaperArticleLabel,
  newspaperEditionDetail,
  newspaperFacts,
  newspaperFooter,
  newspaperScorePanel,
} from '../newspaperPresentation';

function story(overrides: Partial<NewspaperStory> = {}): NewspaperStory {
  return {
    id: 'paper-1',
    matchId: 'match-1',
    createdAt: 1,
    season: 2026,
    kind: 'MATCH',
    format: 'ODI',
    edition: 'THE CRICKET CHRONICLE | SEASON 2026',
    kicker: 'PLAYER OF THE MATCH',
    headline: 'AARAV STANDS TALL',
    subheadline: '125 from 102 in a winning cause.',
    body: 'A match report.',
    playerName: 'Aarav',
    opponentName: 'Mumbai Under-19',
    result: 'WIN',
    runs: 125,
    balls: 102,
    wickets: 0,
    ...overrides,
  };
}

describe('newspaper presentation', () => {
  it('separates the publication masthead from the persisted edition label', () => {
    expect(newspaperEditionDetail(story())).toBe('SEASON 2026');
    expect(newspaperEditionDetail(story({ edition: '' }))).toBe('SEASON 2026');
  });

  it('keeps meaningful match facts and omits zero-value statistics', () => {
    expect(newspaperFacts(story()).map((fact) => fact.label)).toEqual(['125 (102)', 'ODI']);
    expect(
      newspaperFacts(story({ runs: 0, balls: 0, wickets: 5 })).map((fact) => fact.label),
    ).toEqual(['5 WKT', 'ODI']);
  });

  it('builds the correct compact fact strip for special editions', () => {
    expect(
      newspaperFacts(
        story({ kind: 'TROPHY', trophyNames: ['U19 World Cup'], runs: 0, balls: 0 }),
      ).map((fact) => fact.label),
    ).toEqual(['U19 WORLD CUP']);

    expect(
      newspaperFacts(
        story({
          kind: 'PROMOTION',
          promotionFrom: 'U19',
          promotionTo: 'DOMESTIC',
          runs: 0,
          balls: 0,
        }),
      ).map((fact) => fact.label),
    ).toEqual(['U19', '→', 'DOMESTIC']);
  });

  it('retains result context in the footer', () => {
    expect(newspaperFooter(story())).toBe('MUMBAI UNDER-19 | WIN | SEASON 2026');
  });

  it('shows the score panel only when both verified totals and the result line exist', () => {
    const verified = story({
      teamName: 'Delhi Under-19',
      teamScore: '251/5',
      opponentScore: '250/8',
      resultLine: 'Delhi Under-19 beat Mumbai Under-19 by 5 wickets',
    });
    expect(newspaperScorePanel(verified)).toEqual({
      teamName: 'Delhi Under-19',
      teamScore: '251/5',
      opponentName: 'Mumbai Under-19',
      opponentScore: '250/8',
      resultLine: 'Delhi Under-19 beat Mumbai Under-19 by 5 wickets',
    });
    expect(newspaperScorePanel({ ...verified, teamScore: undefined })).toBeNull();
    expect(newspaperScorePanel({ ...verified, opponentScore: undefined })).toBeNull();
    expect(newspaperScorePanel({ ...verified, resultLine: undefined })).toBeNull();
  });

  it('gives special editions distinct article labels', () => {
    expect(newspaperArticleLabel(story({ kind: 'TROPHY' }))).toBe('THE TITLE');
    expect(newspaperArticleLabel(story({ kind: 'PROMOTION' }))).toBe('CAREER PROMOTION');
    expect(newspaperArticleLabel(story({ kind: 'ELIMINATION' }))).toBe('THE CAMPAIGN');
    expect(newspaperArticleLabel(story({ kind: 'MILESTONE' }))).toBe('THE MILESTONE');
  });
});
