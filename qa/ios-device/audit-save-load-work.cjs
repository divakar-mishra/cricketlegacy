/* global __dirname */
// Regression audit: evaluate the real orchestration with synthetic in-memory
// adapters. Never import a native module, read a user save, or contact a backend.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const observed = new Map();
function source(file) {
  const text = fs.readFileSync(file, 'utf8');
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  if (observed.has(file)) assert.equal(hash, observed.get(file), 'Concurrent source edit; rerun audit');
  observed.set(file, hash);
  return text;
}
function evaluate(file, dependencies) {
  const exports = {};
  const context = vm.createContext({ exports, module: { exports }, console,
    performance, structuredClone, setTimeout, clearTimeout,
    require(name) {
      assert(Object.hasOwn(dependencies, name), `Refuse unmocked dependency: ${name}`);
      return dependencies[name];
    },
  });
  vm.runInContext(ts.transpileModule(source(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, context, { filename: file });
  return exports;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function storeFactory(initializer) {
  let state = initializer();
  const hook = selector => selector ? selector(state) : state;
  hook.getState = () => state;
  hook.setState = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  hook.subscribe = () => () => {};
  return hook;
}
function harness(base, options = {}) {
  const integrity = evaluate(path.join(base, 'src/storage/integrity.ts'), {});
  const modern = source(path.join(base, 'src/storage/saveGames.ts')).includes('listSlotSummaries');
  const summary = modern ? evaluate(path.join(base, 'src/storage/saveSummary.ts'), {
    '../domain/types': evaluate(path.join(base, 'src/domain/types.ts'), {}),
    '../game/saveMeta': evaluate(path.join(base, 'src/game/saveMeta.ts'), {}),
    '../game/vip': { hasModeVip: () => false },
  }) : undefined;
  const journalHelpers = modern ? evaluate(path.join(base, 'src/storage/accountBackupJournal.ts'), { './storage': {} }) : undefined;
  const rows = new Map();
  const bindings = [];
  for (const [mode, count] of [['career', 6], ['manager', 4]]) {
    for (let slot = 1; slot <= count; slot++) {
      const save = { id: `synthetic-${mode}-${slot}`, mode, schemaVersion: 42,
        createdAt: 1, updatedAt: 2, entitlements: {}, wallet: { coins: 1, gems: 0 } };
      const raw = { __env: 2, data: `synthetic-ciphertext-${mode}-${slot}`, fixture: save };
      rows.set(`sg:${mode}:${slot}`, raw);
      rows.set(`sg:${mode}:${slot}:bak`, raw);
      if (modern && !options.cold) rows.set(`sg:summary:v1:${mode}:${slot}`,
        { fixture: summary.summarizeSave(save, raw.data.slice(-32)) });
      const checksum = integrity.checksumOf(JSON.stringify(save));
      bindings.push({ saveId: save.id, ownerId: 'synthetic-owner', mode, slot, revision: 3, generation: 1,
        pending: false, deleted: false, confirmedAt: 1,
        localSaveToken: modern && !options.cold ? raw.data.slice(-32) : undefined,
        localSaveTokenBinding: modern && !options.cold ? JSON.stringify(['synthetic-owner', mode, slot, save.id, 1, 3, checksum, null]) : undefined,
        checksum });
    }
  }
  const counts = { storedCopyReads: 0, nonemptyCopyOpens: 0, sealedMarkerChecks: 0,
    vipArchiveCalls: 0, metadataReads: 0, summaryOpens: 0, summaryWrites: 0, occupancyChecks: 0, backupSessions: 0 };
  let writes = 0;
  const noWrite = async () => { writes++; throw new Error('Audit must not write'); };
  const journal = {
    backupBindings: async () => bindings,
    backupOwner: () => 'synthetic-owner', backupWriteVersion: () => 0,
    hasConfirmedContentHash: () => false,
    hasCheckedLocalSnapshot: journalHelpers?.hasCheckedLocalSnapshot,
    markBackupDirty: noWrite, bindRecoveredSave: noWrite, deleteAccountBackup: noWrite,
    reportBackupWriteFailure() {}, confirmBackup: noWrite, confirmUnchangedBackup: noWrite,
    noteBackupSnapshot: async (binding, token) => {
      binding.localSaveToken = token;
      binding.localSaveTokenBinding = JSON.stringify([binding.ownerId, binding.mode, binding.slot, binding.saveId,
        binding.generation, binding.revision, binding.checksum ?? null, binding.localChecksum ?? null]);
    },
    setBackupHooks() {}, setBackupOwner() {},
  };
  const storage = {
    getJSONStrict: async key => {
      if (key.startsWith('sg:summary:')) counts.metadataReads++;
      else counts.storedCopyReads++;
      if (key === options.blockKey) {
        options.entered.resolve();
        await options.release.promise;
      }
      return rows.has(key) ? structuredClone(rows.get(key)) : null;
    },
    getJSON: async () => { counts.metadataReads++; return { mode: 'career', slot: 1 }; },
    hasStoredValue: async key => { counts.occupancyChecks++; return rows.has(key); },
    setJSON: async (key, value) => {
      if (!key.startsWith('sg:summary:')) return noWrite();
      counts.summaryWrites++;
      rows.set(key, structuredClone(value));
    }, removeKey: noWrite,
  };
  const saves = evaluate(path.join(base, 'src/storage/saveGames.ts'), {
    '../diagnostics/inputDiagnostics': { traceInputWork() {} },
    '../game/seasonPass': { isSeasonPassActive: () => false },
    '../services/vipArchive': { syncVipArchive: async () => { counts.vipArchiveCalls++; } },
    '../services/purchaseRecovery': { assertNoPendingPurchaseForSlot: async () => {} },
    './saveEncryption': {
      openSave: async raw => {
        if (!raw) return null;
        counts.nonemptyCopyOpens++;
        return structuredClone(raw.fixture);
      },
      markSaveSealed: async () => { counts.sealedMarkerChecks++; },
      sealSaveSummary: async value => ({ fixture: structuredClone(value) }),
      openSaveSummary: async raw => { if (raw) counts.summaryOpens++; return raw?.fixture ?? null; },
      deleteSaveKey: noWrite, sealSave: noWrite, verifySaveIdentity: noWrite,
    },
    './migrate': { runMigrations: save => save }, './storage': storage,
    './accountBackupJournal': journal,
    './saveSummary': summary, './integrity': integrity,
  });
  const auth = storeFactory(() => ({ user: { provider: 'google', remoteId: 'synthetic-owner' } }));
  const recovery = evaluate(path.join(base, 'src/services/accountRecovery.ts'), {
    zustand: { create: storeFactory }, '../storage/integrity': integrity,
    '../storage/accountBackupJournal': journal, '../storage/saveGames': saves,
    '../storage/saveSummary': summary,
    './auth': { useAuth: auth }, './accountCareerCloud': {
      openAccountCareerSession: async () => {
        counts.backupSessions++;
        if (options.holdFirstSession && counts.backupSessions === 1) {
          options.entered.resolve();
          await options.release.promise;
        }
        return { list: async () => [], close() {}, fetch: noWrite, upload: noWrite };
      },
      prepareAccountCareer: noWrite, removeAccountCareer: noWrite,
    },
  });
  return { saves, recovery, counts, rows, modern, writes: () => writes };
}
async function audit(base) {
  const cases = {};
  let h = harness(base);
  const list = instance => instance.modern ? instance.saves.listSlotSummaries('career') : instance.saves.listSlots('career');
  const last = instance => instance.modern ? instance.saves.getLastPlayedSummary() : instance.saves.getLastPlayed();
  await list(h);
  assert.equal(h.counts.nonemptyCopyOpens, h.modern ? 0 : 12);
  cases.playerList = { ...h.counts };

  h = harness(base);
  await Promise.all([list(h), list(h)]);
  assert.equal(h.counts.nonemptyCopyOpens, h.modern ? 0 : 24);
  cases.twoConcurrentPlayerLists = { ...h.counts };

  h = harness(base);
  await Promise.all([h.recovery.syncAccountCareers(false), list(h), last(h)]);
  assert.equal(h.counts.nonemptyCopyOpens, h.modern ? 0 : 34);
  assert.equal(h.recovery.useAccountBackup.getState().phase, 'confirmed');
  assert.equal(h.writes(), 0);
  cases.backupPlusPlayerListPlusContinue = { ...h.counts, backupRefresh: h.recovery.useAccountBackup.getState().refresh };

  const entered = deferred(), release = deferred();
  h = harness(base, { holdFirstSession: true, entered, release });
  const first = h.recovery.syncAccountCareers(false);
  await entered.promise;
  const second = h.recovery.syncAccountCareers(false);
  const third = h.recovery.syncAccountCareers(false);
  assert.notEqual(first, second);
  assert.equal(second, third);
  release.resolve();
  await Promise.all([first, second, third]);
  assert.equal(h.counts.backupSessions, 2);
  assert.equal(h.counts.nonemptyCopyOpens, h.modern ? 0 : 40);
  assert.equal(h.writes(), 0);
  cases.requestDuringRunningBackup = { ...h.counts, queuedRequestsCoalesce: true, activePassAndFollowupCoalesce: false };

  if (h.modern) {
    h = harness(base, { cold: true });
    await Promise.all([h.recovery.syncAccountCareers(false), list(h), last(h)]);
    assert.equal(h.counts.nonemptyCopyOpens, 20); // one initial bootstrap for ten worlds, not repeat scans
    assert.equal(h.recovery.useAccountBackup.getState().phase, 'confirmed');
    cases.coldBackupPlusPlayerListPlusContinue = { ...h.counts };
    h = harness(base, { cold: true });
    await Promise.all([list(h), list(h)]);
    assert.equal(h.counts.nonemptyCopyOpens, 12);
    cases.twoConcurrentColdPlayerLists = { ...h.counts };
  } else {
  const lastEntered = deferred(), lastRelease = deferred();
  h = harness(base, { blockKey: 'sg:career:6', entered: lastEntered, release: lastRelease });
  let published = false;
  const pending = h.saves.listSlots('career').then(result => { published = true; return result; });
  await lastEntered.promise;
  assert.equal(published, false);
  assert.equal(h.counts.nonemptyCopyOpens, 10);
  const opensBeforeFinalSlot = h.counts.nonemptyCopyOpens;
  lastRelease.resolve();
  await pending;
  cases.listWaitsForLastSlot = { completedCopyOpensBeforeLastSlot: opensBeforeFinalSlot,
    resultPublishedBeforeLastSlot: false, finalCopyOpens: h.counts.nonemptyCopyOpens };
  }

  h = harness(base);
  if (h.saves.findCreationSlot) {
    h.rows.delete('sg:career:2'); h.rows.delete('sg:career:2:bak');
    assert.equal(await h.saves.findCreationSlot('career', 2), 2);
    assert.equal(h.counts.nonemptyCopyOpens, 0);
    cases.standardCreationSelection = { available: true, ...h.counts };
  } else cases.standardCreationSelection = { available: false, reason: 'Earlier snapshot predates occupancy optimization' };
  return cases;
}
(async () => {
  const result = { interpretation: 'Actual source orchestration, mocked boundaries and synthetic 6 Player/4 Manager saves with both copies; operation counts, NOT device timings, AES performance or actual user data.',
    currentSource: await audit(root) };
  const prior = path.join(root, 'output/ios-device/input-qa-2026-10-24-build4/workspace');
  if (fs.existsSync(prior)) result.lastObservedIphoneBuild4 = await audit(prior);
  for (const file of observed.keys()) source(file);
  result.sourceFingerprints = Object.fromEntries([...observed].map(([file, hash]) => [path.relative(root, file), hash]));
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
