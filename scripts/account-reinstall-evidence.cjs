/* global __dirname */
/* Read-only live QA evidence, scoped to an explicitly supplied test account.
 * Never writes cloud state or exports complete saves, identities or credentials.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const email = process.env.QA_BACKUP_EMAIL;
const label = process.argv[2];
if (!email || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(email)) throw new Error('Set QA_BACKUP_EMAIL to the authorized test account.');
if (!label || !/^[a-z0-9_-]+$/.test(label)) throw new Error('Supply a safe evidence label.');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'test-artifacts/account-cloud-reinstall-2026-10-11');
const ref = fs.readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim();
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('No validated linked project.');
const token = fs.readFileSync(path.join(os.homedir(), '.supabase/access-token'), 'utf8').trim();
const hash = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
function checksum(value) {
  const text = JSON.stringify(value);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
async function main() {
  const query = `select b.save_id,b.mode,b.slot,b.revision,b.deleted,b.checksum,b.save_json
    from public.account_career_backups b join auth.users u on u.id=b.user_id
    where lower(u.email)=lower('${email}') and not u.is_anonymous order by b.mode,b.slot`;
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(20000),
  });
  const rows = await response.json();
  if (!response.ok || !Array.isArray(rows)) throw new Error(`Read-only backup evidence failed (HTTP ${response.status}).`);
  const careers = rows.map(({ save_json: json, ...row }) => {
    const save = json ? JSON.parse(json) : null;
    if (save && checksum(json) !== row.checksum) throw new Error('Cloud checksum mismatch.');
    return {
      ...row, sha256: json ? hash(json) : null, bytes: json?.length ?? 0,
      schemaVersion: save?.schemaVersion, wallet: save?.wallet, premiumWallet: save?.premiumWallet,
      premiumInventory: save?.premiumInventory, entitlements: save?.entitlements,
      firstPurchaseDone: save?.firstPurchaseDone ?? false,
      purchaseMarkerCount: Object.keys(save?.flags ?? {}).filter(key => key.startsWith('purchaseToken:')).length,
      grantMarkersSha256: hash(save?.flags ?? {}),
      playerName: save?.players?.[save?.userPlayerId]?.name,
      teamName: save?.teams?.[save?.userTeamId]?.name,
      createdAt: save?.createdAt, updatedAt: save?.updatedAt,
    };
  });
  const evidence = { checkedAtUtc: new Date().toISOString(), label, projectRef: ref, readOnly: true, careers };
  fs.mkdirSync(output, { recursive: true });
  const destination = path.join(output, `cloud-${label}.json`);
  fs.writeFileSync(destination, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ evidence: path.relative(root, destination), careerCount: careers.length, careers: careers.map(c => ({
    id: c.save_id, mode: c.mode, slot: c.slot, revision: c.revision, coins: c.wallet?.coins,
    gems: c.wallet?.gems, tokens: c.premiumInventory, entitlements: c.entitlements,
    purchaseMarkerCount: c.purchaseMarkerCount, sha256: c.sha256,
  })) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
