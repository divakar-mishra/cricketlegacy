import fs from 'fs';
import path from 'path';

const loginSource = fs.readFileSync(path.join(__dirname, '..', 'LoginScreen.tsx'), 'utf8');

describe('Login offline-first copy', () => {
  it('offers a server-backed existing-account login without a purchase bypass', () => {
    expect(loginSource).toContain('auth.signInEmail(email, password)');
    expect(loginSource).toContain('secureTextEntry');
    expect(loginSource).toContain('setPassword(\'\')');
    expect(loginSource).toContain('This does not create an account or unlock purchases.');
    expect(loginSource).not.toContain('signUp(');
  });
  it('does not present account verification as a launch requirement', () => {
    expect(loginSource).toContain('label="Play as Guest"');
    expect(loginSource).toContain('label="Continue with Google"');
    expect(loginSource).toContain("auth.signInGoogle()");
    expect(loginSource).not.toContain("soon('Google')");
    expect(loginSource).not.toContain('Accounts are optional');
    expect(loginSource).not.toContain('Verify online session');
    expect(loginSource).not.toContain('onVerifyDailyGate');
  });

  it('lets a remote guest link Google without deleting local saves', () => {
    expect(loginSource).toContain("label={user.remoteId ? 'Link Google account'");
    expect(loginSource).toContain("user.provider === 'guest'");
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
