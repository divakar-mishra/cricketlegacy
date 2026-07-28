import fs from 'fs';
import path from 'path';

const loginSource = fs.readFileSync(path.join(__dirname, '..', 'LoginScreen.tsx'), 'utf8');

describe('Login daily gate copy', () => {
  it('lets already signed-in users refresh the daily verification window', () => {
    expect(loginSource).toContain('Verify online session');
    expect(loginSource).toContain('onVerifyDailyGate');
    expect(loginSource).toContain("navigation.replace('MainMenu')");
  });

  it('keeps offline-expiry copy explicit', () => {
    expect(loginSource).toContain('Reconnect to refresh the 24-hour play window');
    expect(loginSource).toContain('Normal career play can continue offline');
  });
});
