import { CAREER_GUIDES } from '../../content/careerGuides';
import fs from 'node:fs';
import path from 'node:path';
import {
  firstGuideStep,
  guideAction,
  guidePlacement,
  guideSkipKey,
  guideScrollRange,
  guideStepKey,
  subscribeGuideActions,
} from '../coachGuide';

describe('contextual career guide invariants', () => {
  it('starts coaching only after the user chooses Player or Manager mode', () => {
    for (const screen of ['MainMenuScreen.tsx', 'NewGameScreen.tsx']) {
      const source = fs.readFileSync(path.join(__dirname, '../../screens', screen), 'utf8');
      expect(source).not.toContain("chapter: 'common.menu'");
      expect(source).not.toContain("chapter: 'common.mode'");
    }
    expect(CAREER_GUIDES['player.identity']).toHaveLength(3);
    expect(CAREER_GUIDES['player.attributes']).toHaveLength(1);
    for (const chapter of ['player.identity', 'player.attributes', 'player.club', 'player.review', 'manager.creation'] as const) {
      expect(CAREER_GUIDES[chapter].length).toBeLessThanOrEqual(3);
      for (const step of CAREER_GUIDES[chapter]) expect(step.body.split(/\s+/).length).toBeLessThanOrEqual(40);
    }
    expect(CAREER_GUIDES['player.identity'].map(step => step.target)).toEqual([
      'identity-basics', 'appearance', 'role-and-styles',
    ]);
    expect(CAREER_GUIDES['player.identity'].every(step => step.required)).toBe(true);
    expect(CAREER_GUIDES['manager.creation']).toHaveLength(1);
  });
  it('locks short fields and bounds scrolling inside tall options, including content edges', () => {
    expect(guideScrollRange(200, 48, 400, 1200)).toEqual({ min: 188, max: 188 });
    expect(guideScrollRange(200, 800, 400, 1200)).toEqual({ min: 188, max: 612 });
    expect(guideScrollRange(0, 48, 400, 1200)).toEqual({ min: 0, max: 0 });
    expect(guideScrollRange(1400, 800, 400, 1500)).toEqual({ min: 1388, max: 1500 });
    expect(guideScrollRange(0, 48, 400, 0)).toEqual({ min: 0, max: 0 });
    const partlyScrolled = guidePlacement({ x: 24, y: -300, width: 280, height: 400 }, 360, 550, 230, 24);
    expect(partlyScrolled.rect.y).toBe(24);
    expect(partlyScrolled.rect.y + partlyScrolled.rect.height).toBe(104);
  });
  it('remembers completed controls independently for each career chapter', () => {
    const steps = CAREER_GUIDES['player.home'];
    const first = guideStepKey('player.home', steps[0].target);
    expect(firstGuideStep('player.home', steps, [])).toBe(0);
    expect(firstGuideStep('player.home', steps, [first])).toBe(1);
    expect(firstGuideStep('manager.training', CAREER_GUIDES['manager.training'], [first])).toBe(0);
    expect(
      firstGuideStep(
        'player.home',
        steps,
        steps.map((s) => guideStepKey('player.home', s.target)),
      ),
    ).toBe(steps.length);
    expect(guideSkipKey('player.attributes')).not.toBe(guideSkipKey('manager.training'));
  });
  it('uses unique measurable targets in every chapter and explicit events for actions', () => {
    for (const steps of Object.values(CAREER_GUIDES)) {
      expect(new Set(steps.map((step) => step.target)).size).toBe(steps.length);
      for (const step of steps) {
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.body.trim().length).toBeGreaterThan(0);
      }
    }
    expect(CAREER_GUIDES['player.attributes'].map(step => step.target)).toEqual([
      'attribute-setup',
    ]);
    expect(CAREER_GUIDES['player.attributes'][0]).not.toHaveProperty('action');
    expect(CAREER_GUIDES['player.attributes'][0].body).toContain('Use + / −');
    expect(CAREER_GUIDES['player.attributes'][0].body).toContain('leave points unspent');
  });
  it('does not treat elapsed time or unrelated controls as guide actions', () => {
    const listener = jest.fn();
    const release = subscribeGuideActions(listener);
    expect(listener).not.toHaveBeenCalled();
    guideAction('attribute-increased');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('attribute-increased');
    release();
    guideAction('attribute-increased');
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it.each([320, 360, 430, 768])('keeps the card off its actual control at width %i', (width) => {
    for (const y of [32, 200, 450, 650]) {
      const p = guidePlacement(
        { x: 24, y, width: Math.min(width - 48, 300), height: 40 },
        width,
        800,
        230,
        24,
        24,
      );
      expect(p.rect.x).toBeGreaterThanOrEqual(0);
      expect(p.rect.x + p.rect.width).toBeLessThanOrEqual(width);
      expect(p.cardY).toBeGreaterThanOrEqual(24);
      expect(p.cardY + Math.min(230, p.maxHeight)).toBeLessThanOrEqual(764);
      if (p.side === 'above') expect(p.cardY + Math.min(230, p.maxHeight)).toBeLessThan(p.rect.y);
      else expect(p.cardY).toBeGreaterThan(p.rect.y + p.rect.height);
    }
  });
  it('explains Manager automatic training separately from Player paid sessions', () => {
    expect(CAREER_GUIDES['manager.training'].map((s) => s.body).join(' ')).toContain(
      'after actual fixtures',
    );
    expect(CAREER_GUIDES['player.training'].map((s) => s.body).join(' ')).toContain(
      'never press Train',
    );
  });
});
