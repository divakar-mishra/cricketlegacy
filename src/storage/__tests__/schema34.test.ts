import type { NewspaperStory } from '../../domain/types';
import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { runMigrations } from '../migrate';
import { synchronizeSchema34State } from '../schema34';

function legacyStory(overrides: Partial<NewspaperStory> = {}): NewspaperStory {
  return {
    id: 'paper-legacy',
    matchId: 'match-legacy',
    createdAt: 1234,
    season: 2026,
    kind: 'MATCH',
    format: 'ODI',
    edition: 'THE CRICKET CHRONICLE | SEASON 2026',
    kicker: 'PLAYER OF THE MATCH',
    headline: 'AARAV STANDS TALL',
    subheadline: '125 from 102 in a winning cause.',
    body: 'This exact historical copy must remain unchanged.',
    playerName: 'Aarav Sen',
    opponentName: 'Mumbai Under-19',
    result: 'WIN',
    runs: 125,
    balls: 102,
    wickets: 0,
    ...overrides,
  };
}

describe('schema 34 newspaper migration', () => {
  it('migrates v33 while preserving every field and byte of legacy rendered copy', () => {
    const story = legacyStory();
    const before = JSON.stringify(story);
    const migrated = runMigrations({
      schemaVersion: 33,
      id: 'legacy-save',
      experience: { mediaScrapbook: [JSON.parse(before)] },
    })!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(JSON.stringify(migrated.experience?.mediaScrapbook?.[0])).toBe(before);
    expect(migrated.experience?.mediaScrapbook?.[0]).not.toHaveProperty('templateId');
    expect(migrated.experience?.mediaScrapbook?.[0]).not.toHaveProperty('newspaperCategory');
    expect(migrated.experience?.mediaScrapbook?.[0]).not.toHaveProperty('headlineFamily');
  });

  it('retains valid generated metadata and verified score-panel facts', () => {
    const generated = legacyStory({
      templateId: 'CC-04',
      newspaperCategory: 'CENTURY_CHASE',
      headlineFamily: 'PLAYER_PERFORMANCE',
      teamName: 'Delhi Under-19',
      teamScore: '251/5',
      opponentScore: '250/8',
      resultLine: 'Delhi Under-19 beat Mumbai Under-19 by 5 wickets',
      competitionName: 'Under-19 One-Day Cup',
      venueName: 'National Cricket Ground',
    });
    const migrated = runMigrations({
      schemaVersion: 33,
      id: 'generated-save',
      experience: { mediaScrapbook: [generated] },
    })!;

    expect(migrated.experience?.mediaScrapbook?.[0]).toEqual(generated);
  });

  it('drops only invalid new optional metadata and never rewrites rendered history', () => {
    const story = legacyStory() as NewspaperStory & Record<string, unknown>;
    story.templateId = 'CC-99';
    story.newspaperCategory = 'NOT_A_CATEGORY' as NewspaperStory['newspaperCategory'];
    story.headlineFamily = 'NOT_A_FAMILY' as NewspaperStory['headlineFamily'];
    story.teamName = '   ';
    story.teamScore = 251 as unknown as string;
    story.opponentScore = '';
    story.resultLine = 'Delhi Under-19 won';
    const renderedBefore = {
      edition: story.edition,
      kicker: story.kicker,
      headline: story.headline,
      subheadline: story.subheadline,
      body: story.body,
    };

    synchronizeSchema34State({ experience: { mediaScrapbook: [story] } } as never);

    expect(story).not.toHaveProperty('templateId');
    expect(story).not.toHaveProperty('newspaperCategory');
    expect(story).not.toHaveProperty('headlineFamily');
    expect(story).not.toHaveProperty('teamName');
    expect(story).not.toHaveProperty('teamScore');
    expect(story).not.toHaveProperty('opponentScore');
    expect(story.resultLine).toBe('Delhi Under-19 won');
    expect({
      edition: story.edition,
      kicker: story.kicker,
      headline: story.headline,
      subheadline: story.subheadline,
      body: story.body,
    }).toEqual(renderedBefore);
  });

  it('is idempotent after a JSON reload', () => {
    const raw = {
      schemaVersion: 33,
      id: 'reload-save',
      experience: {
        mediaScrapbook: [
          legacyStory({
            templateId: 'TR-10',
            newspaperCategory: 'TROPHY',
            headlineFamily: 'EVENT_RESULT',
          }),
          legacyStory({ id: 'paper-oldest', matchId: 'match-oldest' }),
        ],
      },
    };
    const first = runMigrations(JSON.parse(JSON.stringify(raw)))!;
    const firstJson = JSON.stringify(first);
    const second = runMigrations(JSON.parse(firstJson))!;
    synchronizeSchema34State(second);
    synchronizeSchema34State(second);

    expect(JSON.stringify(second)).toBe(firstJson);
    expect(second.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });
});
