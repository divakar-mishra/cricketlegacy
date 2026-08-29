import {
  NEWSPAPER_TEMPLATES,
  type NewspaperPlaceholder,
  type NewspaperTemplateCategory,
} from '../newspaperTemplates';
import {
  hasRawNewspaperPlaceholder,
  renderNewspaperTemplate,
  type NewspaperFactMap,
} from '../../game/newspaperContent';

const COMPLETE_FACTS: Record<NewspaperPlaceholder, string> = {
  PLAYER: 'Aarav Sen',
  TEAM: 'Delhi Under-19',
  OPPONENT: 'Mumbai Under-19',
  RUNS: '125',
  BALLS: '102',
  WICKETS: '5',
  PERFORMANCE_LINE: '125 from 102 and 5 wickets',
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
  STAGE: 'Semi-Final',
  SEASON: '2026',
  FROM_LEVEL: 'Under-19',
  TO_LEVEL: 'Domestic Professional',
  POSITION: '4th',
  GROUP_SIZE: '5',
  MILESTONE: '1,000 career runs',
  RECORD: 'highest ODI score',
  COUNT: '1,000',
};

const EXPECTED_COUNTS: Record<NewspaperTemplateCategory, number> = {
  CENTURY_STANDARD: 8,
  CENTURY_CHASE: 8,
  FIFTY_WIN: 8,
  FIFTY_LOSS: 8,
  WICKET_SPELL: 8,
  FIVE_WICKET: 8,
  ALL_ROUND: 8,
  CLOSE_WIN: 8,
  CLOSE_LOSS: 8,
  PLAYER_OF_MATCH: 8,
  TROPHY: 10,
  PROMOTION: 10,
  ELIMINATION: 10,
  MILESTONE_RECORD: 10,
};

const FORBIDDEN_UNVERIFIED_COPY = [
  /\bpartnership\b/i,
  /\bunbeaten\b|\bnot out\b/i,
  /\bcrowd\b|\bsupporters?\b/i,
  /\bquote(?:d|s)?\b/i,
  /\binjur(?:y|ed)\b/i,
  /\bselectors?\b/i,
  /boundary count/i,
  /powerplay|middle overs|death overs|new ball|opening spell|late innings|early wickets/i,
];

function placeholdersIn(copy: string): string[] {
  return [...copy.matchAll(/\[([A-Z_]+)\]/g)].map((match) => match[1]);
}

describe('newspaper template catalogue', () => {
  it('contains exactly 120 immutable, uniquely identified templates in the approved groups', () => {
    expect(NEWSPAPER_TEMPLATES).toHaveLength(120);
    expect(new Set(NEWSPAPER_TEMPLATES.map((template) => template.id))).toHaveProperty('size', 120);
    expect(Object.isFrozen(NEWSPAPER_TEMPLATES)).toBe(true);

    for (const [category, count] of Object.entries(EXPECTED_COUNTS)) {
      expect(NEWSPAPER_TEMPLATES.filter((template) => template.category === category)).toHaveLength(
        count,
      );
    }
    for (const template of NEWSPAPER_TEMPLATES) {
      expect(template.id).toMatch(
        /^(?:CS|CC|FW|FL|WS|WH|AR|CW|CL|PM)-0[1-8]$|^(?:TR|PC|EX|MR)-(?:0[1-9]|10)$/,
      );
      expect(Object.isFrozen(template)).toBe(true);
      expect(Object.isFrozen(template.requiredPlaceholders)).toBe(true);
    }
  });

  it('derives every required-fact declaration from the actual final copy', () => {
    for (const template of NEWSPAPER_TEMPLATES) {
      const actual = new Set([
        ...placeholdersIn(template.headline),
        ...placeholdersIn(template.deck),
        ...placeholdersIn(template.body),
      ]);
      expect([...template.requiredPlaceholders]).toEqual([...actual].sort());
    }
  });

  it('renders all 120 templates without raw placeholders and keeps headline, deck and body distinct', () => {
    for (const template of NEWSPAPER_TEMPLATES) {
      const rendered = renderNewspaperTemplate(template, COMPLETE_FACTS);
      expect(rendered).not.toBeNull();
      if (!rendered) continue;
      expect(hasRawNewspaperPlaceholder(rendered.headline)).toBe(false);
      expect(hasRawNewspaperPlaceholder(rendered.deck)).toBe(false);
      expect(hasRawNewspaperPlaceholder(rendered.body)).toBe(false);
      expect(new Set([rendered.headline, rendered.deck, rendered.body]).size).toBe(3);
    }
  });

  it('rejects every template whenever any one of its required facts is missing', () => {
    for (const template of NEWSPAPER_TEMPLATES) {
      for (const missing of template.requiredPlaceholders) {
        const facts: NewspaperFactMap = { ...COMPLETE_FACTS };
        delete facts[missing];
        expect(renderNewspaperTemplate(template, facts)).toBeNull();
      }
    }
  });

  it('contains no copy that invents unsupported match facts or innings phases', () => {
    for (const template of NEWSPAPER_TEMPLATES) {
      const copy = `${template.headline}\n${template.deck}\n${template.body}`;
      for (const forbidden of FORBIDDEN_UNVERIFIED_COPY) {
        expect({ templateId: template.id, copy }).not.toEqual(
          expect.objectContaining({ copy: expect.stringMatching(forbidden) }),
        );
      }
    }
  });
});
