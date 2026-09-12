/* eslint-disable @typescript-eslint/no-require-imports -- load native modules only at the storage boundary */
import type { SaveGame } from '../domain/types';
import { serializeSaveEnvelope, unwrapSave } from './integrity';

interface KeyRecord {
  key: string;
  sealed: boolean;
}
export interface EncryptedSave {
  __env: 2;
  algorithm: 'AES-256-GCM';
  data: string;
}
const keyName = (context: string) => `cricket.save.v2.${context.replace(/:/g, '.')}`;
const aad = (context: string) => new TextEncoder().encode(`cricket-legacy:save:v2:${context}`);

// Keep only immutable ciphertext and identity, never a mutable gameplay save.
// Two entries cover the active primary and backup; nothing survives restart.
const verifiedCopies: { context: string; key: string; data: string; id: string }[] = [];
function rememberVerified(context: string, key: string, data: string, id: string): void {
  verifiedCopies.unshift({ context, key, data, id });
  verifiedCopies.length = Math.min(verifiedCopies.length, 2);
}

/** Verify an on-disk backup candidate without decoding unchanged known bytes again. */
export async function verifySaveIdentity(
  raw: unknown,
  context: string,
): Promise<Pick<SaveGame, 'id'> | null> {
  if (raw === null) return null;
  if (typeof raw === 'object' && (raw as EncryptedSave).__env === 2) {
    const envelope = raw as EncryptedSave;
    // Always re-read the keystore: a cache hit must not conceal key loss/change.
    const record = await readKey(context);
    if (record && envelope.algorithm === 'AES-256-GCM' && typeof envelope.data === 'string') {
      const known = verifiedCopies.find((copy) => copy.context === context &&
        copy.key === record.key && copy.data === envelope.data);
      if (known) return { id: known.id };
    }
  }
  const save = await openSave(raw, context);
  return save ? { id: save.id } : null;
}

function encryptedBytes(base64: string): Uint8Array {
  // Expo Crypto 57.0.2's Android fromCombined bridge requires Uint8Array,
  // although the cross-platform JS signature also accepts base64 strings.
  // Decode only the transport encoding: keep the stored ciphertext/key intact.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// Native modules are loaded only at the persistence boundary, not by pure engine tests.
async function readKey(context: string): Promise<KeyRecord | null> {
  const store: typeof import('expo-secure-store') = require('expo-secure-store');
  const raw = await store.getItemAsync(keyName(context));
  if (raw === null) return null;
  const record = JSON.parse(raw) as KeyRecord;
  if (!/^[a-f0-9]{64}$/i.test(record.key) || typeof record.sealed !== 'boolean') {
    throw new Error('Save protection key is unavailable. Nothing has been reset.');
  }
  return record;
}

async function storeKey(context: string, record: KeyRecord): Promise<void> {
  const store: typeof import('expo-secure-store') = require('expo-secure-store');
  await store.setItemAsync(keyName(context), JSON.stringify(record), {
    keychainAccessible: store.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function openSave(raw: unknown, context: string): Promise<SaveGame | null> {
  if (raw === null) return null;
  const record = await readKey(context);
  if (typeof raw === 'object' && (raw as EncryptedSave).__env === 2) {
    const envelope = raw as EncryptedSave;
    if (!record || envelope.algorithm !== 'AES-256-GCM' || typeof envelope.data !== 'string') {
      throw new Error('Encrypted save or device key is unavailable.');
    }
    const data = envelope.data;
    const crypto: typeof import('expo-crypto') = require('expo-crypto');
    const key = await crypto.AESEncryptionKey.import(record.key, 'hex');
    const plaintext = await crypto.aesDecryptAsync(
      crypto.AESSealedData.fromCombined(encryptedBytes(data)),
      key,
      { additionalData: aad(context) },
    );
    const save = unwrapSave(JSON.parse(new TextDecoder().decode(plaintext)));
    if (!save) throw new Error('Invalid decrypted save.');
    rememberVerified(context, record.key, data, save.id);
    return save;
  }
  // Once migrated, replacing ciphertext with a recomputed old checksum is rejected.
  if (record?.sealed) throw new Error('Unencrypted replacement of a protected save rejected.');
  return unwrapSave(raw);
}

export async function sealSave(save: SaveGame, context: string): Promise<EncryptedSave> {
  const crypto: typeof import('expo-crypto') = require('expo-crypto');
  let record = await readKey(context);
  if (!record) {
    const key = await crypto.AESEncryptionKey.generate(crypto.AESKeySize.AES256);
    record = { key: await key.encoded('hex'), sealed: false };
    // Store the device-generated key BEFORE committing any encrypted data.
    await storeKey(context, record);
  }
  const key = await crypto.AESEncryptionKey.import(record.key, 'hex');
  const plaintext = serializeSaveEnvelope(save);
  const saveId = save.id;
  const encrypted = await crypto.aesEncryptAsync(
    new TextEncoder().encode(plaintext),
    key,
    { additionalData: aad(context), nonce: { length: 12 }, tagLength: 16 },
  );
  const data = await encrypted.combined('base64');
  rememberVerified(context, record.key, data, saveId);
  return { __env: 2, algorithm: 'AES-256-GCM', data };
}

export async function markSaveSealed(context: string): Promise<void> {
  const record = await readKey(context);
  if (!record) throw new Error('Save key missing; cannot finish migration.');
  if (!record.sealed) await storeKey(context, { ...record, sealed: true });
}

export async function deleteSaveKey(context: string): Promise<void> {
  for (let index = verifiedCopies.length - 1; index >= 0; index -= 1) {
    if (verifiedCopies[index].context === context) verifiedCopies.splice(index, 1);
  }
  const store: typeof import('expo-secure-store') = require('expo-secure-store');
  await store.deleteItemAsync(keyName(context));
}
