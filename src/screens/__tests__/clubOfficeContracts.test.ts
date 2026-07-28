import fs from 'fs';
import path from 'path';

const clubOffice = fs.readFileSync(path.join(__dirname, '..', 'ClubOfficeScreen.tsx'), 'utf8');

describe('ClubOffice contract actions', () => {
  it('exposes explicit renew, release, and wait choices for expiring contracts', () => {
    expect(clubOffice).toContain('label="Renew 2yr"');
    expect(clubOffice).toContain('label="Release"');
    expect(clubOffice).toContain('label="Wait"');
    expect(clubOffice).toContain('const releasePlayer = useCareer((s) => s.releasePlayer)');
    expect(clubOffice).toContain('onPress={() => doRenew(p.id, p.name)}');
    expect(clubOffice).toContain('onPress={() => doRelease(p.id, p.name)}');
    expect(clubOffice).toContain('onPress={() => doWait(p.name)}');
    expect(clubOffice).toContain('Decision deferred');
    expect(clubOffice).toContain('moved to the free-agent market');
  });
});
