import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(__dirname, '../../..');

describe('generated QA artifact isolation', () => {
  it('typechecks application source without compiling generated workspaces or evidence', () => {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
    expect(parsed.errors).toEqual([]);
    expect(parsed.fileNames).toContain(path.join(root, 'App.tsx'));
    expect(parsed.fileNames).toContain(path.join(root, 'src/state/careerStore.ts'));
    for (const file of parsed.fileNames) {
      const relative = path.relative(root, file);
      expect(relative).not.toMatch(/^(output|test-artifacts|node_modules)\//);
    }
  });

  it('runs app tests without discovering duplicated suites in generated QA folders', () => {
    const config = jest.requireActual('../../../jest.config.js') as {
      testPathIgnorePatterns: string[];
    };
    const ignored = (relative: string) => config.testPathIgnorePatterns.some(pattern =>
      new RegExp(pattern.replace('<rootDir>', root)).test(path.join(root, relative)));
    expect(ignored('output/ios-simulator/workspace/src/game/__tests__/careerStep.test.ts')).toBe(true);
    expect(ignored('test-artifacts/workspace/src/game/__tests__/careerStep.test.ts')).toBe(true);
    expect(ignored('node_modules/example/src/__tests__/example.test.ts')).toBe(true);
    expect(ignored('src/game/__tests__/careerStep.test.ts')).toBe(false);
  });
});
