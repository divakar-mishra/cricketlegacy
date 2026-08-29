import fs from 'fs';
import path from 'path';
import { fieldRestriction, isFieldSettingLegal, legalFieldSetting } from '../intent';

describe('limited-overs field restrictions', () => {
  it('allows no more than two fielders outside during a T20 powerplay', () => {
    expect(fieldRestriction('T20', 0)).toMatchObject({ phase: 'POWERPLAY', maxOutside: 2 });
    expect(isFieldSettingLegal('ATTACKING', 'T20', 5)).toBe(true);
    expect(isFieldSettingLegal('BALANCED', 'T20', 5)).toBe(false);
    expect(legalFieldSetting('DEFENSIVE', 'T20', 2)).toBe('ATTACKING');
  });

  it('uses four outside in ODI middle overs and five at the death', () => {
    expect(fieldRestriction('ODI', 20).maxOutside).toBe(4);
    expect(fieldRestriction('ODI', 45).maxOutside).toBe(5);
  });

  it('does not impose a circle restriction in Tests', () => {
    expect(fieldRestriction('TEST', 0)).toMatchObject({
      phase: 'UNRESTRICTED',
      maxOutside: 9,
    });
    expect(isFieldSettingLegal('SWEEPER', 'TEST', 0)).toBe(true);
  });

  it('normalizes the field by over in both watched and background innings', () => {
    const liveSource = fs.readFileSync(path.join(__dirname, '..', 'liveInnings.ts'), 'utf8');
    const simulatedSource = fs.readFileSync(
      path.join(__dirname, '..', 'simulateInnings.ts'),
      'utf8',
    );

    expect(liveSource).toContain(
      'legalFieldSetting(this.input.fieldSetting, this.format, this.overIndex)',
    );
    expect(simulatedSource).toContain('legalFieldSetting(input.fieldSetting, input.format, over)');
    expect(legalFieldSetting('BALANCED', 'T20', 0)).toBe('ATTACKING');
    expect(legalFieldSetting('BALANCED', 'T20', 10)).toBe('BALANCED');
  });
});
