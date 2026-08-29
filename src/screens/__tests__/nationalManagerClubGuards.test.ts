import fs from 'fs';
import path from 'path';

const screensDir = path.join(__dirname, '..');
const readScreen = (name: string) =>
  fs.readFileSync(path.join(screensDir, `${name}Screen.tsx`), 'utf8');

describe('National Manager club-operation guards', () => {
  const screens = [
    {
      name: 'ClubOffice',
      guard: "save.managerCareerLevel === 'NATIONAL'",
      normalContent: 'const team = save.teams[save.userTeamId];',
    },
    {
      name: 'Academy',
      guard: "save.managerCareerLevel === 'NATIONAL'",
      normalContent: 'const prospects = academyProspects(save);',
    },
    {
      name: 'StaffRecruitment',
      guard: "save.managerCareerLevel === 'NATIONAL'",
      normalContent: 'const team = save.teams[save.userTeamId];',
    },
    {
      name: 'Transfers',
      guard: "save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL'",
      normalContent: 'const team = save.teams[save.userTeamId];',
    },
    {
      name: 'TransferDeadlineDay',
      guard: "save?.mode === 'manager' && save.managerCareerLevel === 'NATIONAL'",
      normalContent: 'if (save && !deadlineActive)',
    },
  ] as const;

  it.each(screens)(
    'returns before $name club operations are rendered',
    ({ name, guard, normalContent }) => {
      const source = readScreen(name);
      const guardIndex = source.indexOf(guard);
      const normalContentIndex = source.indexOf(normalContent);

      expect(guardIndex).toBeGreaterThan(-1);
      expect(normalContentIndex).toBeGreaterThan(guardIndex);
      expect(source).toContain('Club operations paused');
      expect(source).not.toContain(
        'Your retained club remains unchanged while you manage the national side.',
      );
    },
  );

  it.each(screens)('$name keeps a back route in the read-only state', ({ name, guard }) => {
    const source = readScreen(name);
    const guardIndex = source.indexOf(guard);
    const guardEnd = source.indexOf('\n  }', guardIndex);
    const guardBlock = source.slice(guardIndex, guardEnd);

    expect(guardBlock).toContain('onBack={() => navigation.goBack()}');
  });
});
