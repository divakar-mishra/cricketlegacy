/* Isolated PostgreSQL test; never connects to the configured/live Supabase project.
 * Supply a temporary @electric-sql/pglite install path as argv[2]. */
/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');
const ROOT = path.resolve(__dirname, '..');
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const GUEST = '33333333-3333-4333-8333-333333333333';
function existingFunction(name) {
  const source = fs.readFileSync(path.join(ROOT, 'supabase/migrations/202608200002_premium_save_sponsor_backend.sql'), 'utf8');
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('$$;', start) + 3);
}
(async () => {
  const db = new PGlite();
  let checks = 0;
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, is_anonymous boolean not null);
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
      $$;
      create table public.account_deletion_write_blocks (user_id uuid primary key);
      insert into auth.users values ('${OWNER}',false),('${OTHER}',false),('${GUEST}',true);
      grant usage on schema public, auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
    `);
    for (const name of ['premium_sponsor_lock_account_for_write', 'assert_premium_sponsor_account_mutable', 'enforce_account_deletion_write_block']) {
      await db.exec(existingFunction(name));
    }
    await db.exec(fs.readFileSync(path.join(ROOT, 'supabase/migrations/202610110001_account_career_backups.sql'), 'utf8'));
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
    await db.exec('set role authenticated');
    const write = async (id, revision, json, checksum = '123abcd', deleted = false, owner = OWNER, mode = 'career') => {
      const result = await db.query('select public.write_account_career_backup($1,$2,$3,1,$4,$5,$6,$7) as result',
        [owner,id,mode,revision,json,checksum,deleted]);
      return result.rows[0].result;
    };
    const payload = (id, coins = 123) => JSON.stringify({ id, mode: 'career', schemaVersion: 45,
      wallet: { coins, gems: 5 }, entitlements: { removeAdsUntil: 123456 }, flags: { 'iap:tx:already-paid': true } });
    const first = payload('career-a');
    assert.deepEqual(await write('career-a',0,first), { status: 'SAVED', revision: 1 }); checks++;
    assert.deepEqual(await write('career-a',0,first), { status: 'SAVED', revision: 1 }); checks++; // lost ACK retry
    assert.deepEqual(await write('career-a',0,payload('career-a',999)), { status: 'CONFLICT', revision: 1 }); checks++;
    assert.deepEqual(await write('career-a',1,payload('career-a',100)), { status: 'SAVED', revision: 2 }); checks++;
    assert.deepEqual(await write('career-a',1,payload('career-a',200)), { status: 'CONFLICT', revision: 2 }); checks++;
    const listed = await db.query('select * from public.list_account_career_backups($1)', [OWNER]);
    assert.equal(listed.rows.length,1); assert.equal(Number(listed.rows[0].revision),2); checks++;
    const read = await db.query('select public.read_account_career_backup($1,$2,2) as snapshot', [OWNER,'career-a']);
    assert.equal(read.rows[0].snapshot,payload('career-a',100)); checks++;
    const staleRead = await db.query('select public.read_account_career_backup($1,$2,1) as snapshot', [OWNER,'career-a']);
    assert.equal(staleRead.rows[0].snapshot,null); checks++;
    await assert.rejects(() => db.query('select * from public.account_career_backups'), /permission denied/); checks++;
    await assert.rejects(() => write('wrong',0,payload('not-wrong')), /does not match/); checks++;
    await assert.rejects(() => write('wrong-mode',0,payload('wrong-mode'),'a',false,OWNER,'manager'), /does not match/); checks++;
    await assert.rejects(() => db.query('select * from public.list_account_career_backups($1)', [OTHER]), /signed-in account/); checks++;
    await assert.rejects(() => write('career-a',2,first,'a',false,OTHER), /signed-in account/); checks++;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OTHER]);
    const otherRows = await db.query('select * from public.list_account_career_backups($1)', [OTHER]);
    assert.equal(otherRows.rows.length,0); checks++;
    await assert.rejects(() => write('career-a',2,first), /signed-in account/); checks++;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [GUEST]);
    await assert.rejects(() => write('guest-save',0,payload('guest-save'),'a',false,GUEST), /signed-in account/); checks++;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [OWNER]);
    assert.deepEqual(await write('career-a',2,null,null,true), { status: 'DELETED', revision: 3 }); checks++;
    assert.deepEqual(await write('career-a',2,first), { status: 'DELETED', revision: 3 }); checks++; // no resurrection
    assert.deepEqual(await write('never-uploaded',0,null,null,true), { status: 'DELETED', revision: 1 }); checks++;
    assert.deepEqual(await write('never-uploaded',0,payload('never-uploaded')), { status: 'DELETED', revision: 1 }); checks++;
    await db.exec('reset role');
    const tombstone = await db.query('select save_json,checksum from public.account_career_backups where save_id=$1', ['career-a']);
    assert.deepEqual(tombstone.rows[0], { save_json: null, checksum: null }); checks++;
    await db.query('insert into public.account_deletion_write_blocks values ($1)', [OWNER]);
    await db.exec('set role authenticated');
    await assert.rejects(() => write('late-save',0,payload('late-save')), /being deleted/); checks++;
    await assert.rejects(() => db.query('select * from public.list_account_career_backups($1)', [OWNER]), /being deleted/); checks++;
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [OWNER]);
    assert.equal((await db.query('select count(*)::int as n from public.account_career_backups')).rows[0].n,0); checks++;
    console.log(`PASS: ${checks} isolated PostgreSQL backup/access/deletion checks; no live backend used.`);
  } finally { await db.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
