import fs from 'fs';
import path from 'path';

const loginSource = fs.readFileSync(path.join(__dirname, '..', 'LoginScreen.tsx'), 'utf8');

describe('Login offline-first copy', () => {
  it('does not present account verification as a launch requirement', () => {
    expect(loginSource).toContain('label="Play as Guest"');
    expect(loginSource).not.toContain('Accounts are optional');
    expect(loginSource).not.toContain('Verify online session');
    expect(loginSource).not.toContain('onVerifyDailyGate');
  });

  it('makes local-only persistence and offline guest play explicit', () => {
    expect(loginSource).toContain('Guest saves stay on this device');
    expect(loginSource).toMatch(/Cloud save is\s+not available in this build/);
  });

  it('warns that deleting local data also destroys save-bound sponsor ownership', () => {
    expect(loginSource).toContain('Permanent per-save sponsors are deleted with their saves');
    expect(loginSource).toContain('cannot be transferred or recovered');
  });
});
