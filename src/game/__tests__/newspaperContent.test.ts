import type { NewspaperStory, SaveGame } from '../../domain/types';
import { newspaperTemplatesFor } from '../../content/newspaperTemplates';
import {
  hasRawNewspaperPlaceholder,
  newspaperPossessive,
  normalizeNewspaperHeadline,
  renderNewspaperTemplate,
  selectNewspaperTemplate,
  type NewspaperFactMap,
} from '../newspaperContent';

const COMPLETE_FACTS: NewspaperFactMap = {
  PLAYER: 'Aarav Sen',
  TEAM: 'Delhi Under-19',
  OPPONENT: 'Mumbai Under-19',
  RUNS: '78',
  BALLS: '65',
  WICKETS: '3',
  PERFORMANCE_LINE: '78 from 65 and 3 wickets',
  TEAM_SCORE: '251/5',
  OPPONENT_SCORE: '250/8',
  TARGET: '251',
  MARGIN: '5 wickets',
  OUTCOME_LINE: 'Delhi Under-19 beat Mumbai Under-19 by 5 wickets',
  FORMAT: 'ODI',
  COMPETITION: 'Under-19 One-Day Cup',
  VENUE: 'National Cricket Ground',
  TROPHY: 'Under-19 One-Day Cup',
  TOURNAMENT: 'U19 World Cup',
  STAGE: 'Group Stage',
  SEASON: '2026',
  FROM_LEVEL: 'Under-19',
  TO_LEVEL: 'Domestic Professional',
  POSITION: '4th',
  GROUP_SIZE: '5',
  MILESTONE: '1,000 career runs',
  RECORD: 'highest ODI score',
  COUNT: '1,000',
};

function saveWithHistory(history: NewspaperStory[] = []): SaveGame {
  return {
    id: 'newspaper-selector-save',
    experience: { mediaScrapbook: history },
  } as SaveGame;
}

function historyStory(
  id: string,
  templateId?: string,
  headlineFamily?: NewspaperStory['headlineFamily'],
  headline = id,
): NewspaperStory {
  return {
    id,
    matchId: `match-${id}`,
    createdAt: Number(id.replace(/\D/g, '')) || 1,
    season: 2026,
    kind: 'MATCH',
    templateId,
    newspaperCategory: templateId?.startsWith('FW-') ? 'FIFTY_WIN' : undefined,
    headlineFamily,
    format: 'ODI',
    edition: 'THE CRICKET CHRONICLE | SEASON 2026',
    kicker: 'MATCH REPORT',
    headline,
    subheadline: 'Archived deck',
    body: 'Archived body',
    playerName: 'Aarav Sen',
    opponentName: 'Mumbai Under-19',
    result: 'WIN',
    runs: 50,
    balls: 45,
    wickets: 0,
  };
}

describe('newspaper template renderer and selector', () => {
  it('selects the same copy deterministically across repeated calls and JSON reloads', () => {
    const save = saveWithHistory();
    const first = selectNewspaperTemplate(save, 'match-100', 'FIFTY_WIN', COMPLETE_FACTS);
    const second = selectNewspaperTemplate(save, 'match-100', 'FIFTY_WIN', COMPLETE_FACTS);
    const reloaded = selectNewspaperTemplate(
      JSON.parse(JSON.stringify(save)),
      'match-100',
      'FIFTY_WIN',
      COMPLETE_FACTS,
    );

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(reloaded).toEqual(first);
  });

  it('avoids each of the five most recent exact template IDs while alternatives exist', () => {
    const templates = newspaperTemplatesFor('FIFTY_WIN');
    const history = templates
      .slice(0, 5)
      .map((template, index) =>
        historyStory(`history-${index}`, template.id, template.headlineFamily),
      );
    const selected = selectNewspaperTemplate(
      saveWithHistory(history),
      'match-history',
      'FIFTY_WIN',
      COMPLETE_FACTS,
    );

    expect(selected).not.toBeNull();
    expect(history.map((story) => story.templateId)).not.toContain(selected?.template.id);
  });

  it('avoids the last three headline families when another family is eligible', () => {
    const recentPlayerFamily = [1, 2, 3].map((index) =>
      historyStory(`family-${index}`, `FW-0${index}`, 'PLAYER_PERFORMANCE'),
    );
    const selected = selectNewspaperTemplate(
      saveWithHistory(recentPlayerFamily),
      'close-match',
      'CLOSE_WIN',
      COMPLETE_FACTS,
    );

    expect(selected?.template.headlineFamily).toBe('TEAM_RESULT');
  });

  it('relaxes family history before exact history, but never relaxes fact eligibility', () => {
    const onlyEligibleFacts: NewspaperFactMap = {
      PLAYER: 'Aarav Sen',
      OUTCOME_LINE: 'Delhi Under-19 beat Mumbai Under-19 by 5 wickets',
    };
    const history = [historyStory('single', 'PM-02', 'PLAYER_RECOGNITION')];
    const selected = selectNewspaperTemplate(
      saveWithHistory(history),
      'single-eligible-match',
      'PLAYER_OF_MATCH',
      onlyEligibleFacts,
    );

    expect(selected?.template.id).toBe('PM-02');
    expect(hasRawNewspaperPlaceholder(selected?.headline ?? '')).toBe(false);
    expect(
      newspaperTemplatesFor('PLAYER_OF_MATCH')
        .filter((template) => template.id !== 'PM-02')
        .every((template) => renderNewspaperTemplate(template, onlyEligibleFacts) === null),
    ).toBe(true);
  });

  it('avoids an immediately repeated rendered headline even on a legacy story', () => {
    const initial = selectNewspaperTemplate(
      saveWithHistory(),
      'duplicate-headline-match',
      'FIFTY_WIN',
      COMPLETE_FACTS,
    )!;
    const history = [historyStory('legacy', undefined, undefined, initial.headline)];
    const replacement = selectNewspaperTemplate(
      saveWithHistory(history),
      'duplicate-headline-match',
      'FIFTY_WIN',
      COMPLETE_FACTS,
    )!;

    expect(normalizeNewspaperHeadline(replacement.headline)).not.toBe(
      normalizeNewspaperHeadline(initial.headline),
    );
  });

  it('formats possessives safely for names already ending in s', () => {
    expect(newspaperPossessive('James')).toBe('James’');
    expect(newspaperPossessive('Aarav')).toBe('Aarav’s');

    const template = newspaperTemplatesFor('FIFTY_LOSS').find(
      (candidate) => candidate.id === 'FL-01',
    )!;
    const rendered = renderNewspaperTemplate(template, { ...COMPLETE_FACTS, PLAYER: 'James' });
    expect(rendered?.headline).toBe('James’ RESISTANCE GOES UNREWARDED');
    expect(rendered?.headline).not.toContain('James’s');
  });
});
