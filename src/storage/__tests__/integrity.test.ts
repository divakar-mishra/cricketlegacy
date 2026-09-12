import { SaveGame } from '../../domain/types';
import { checksumOf, isEnvelope, serializeSaveEnvelope, unwrapSave, wrapSave } from '../integrity';

const fakeSave = (id = 's1'): SaveGame => ({ schemaVersion: 5, id } as unknown as SaveGame);

describe('save integrity', () => {
  it('serializes the existing envelope format identically with one save traversal', () => {
    const save = { ...fakeSave(), text: 'Cricket 🏏 नाम "quoted"\n',
      nested: { absent: undefined, values: [null, 1, 'a'] }, history: 'x'.repeat(700_000) };
    expect(serializeSaveEnvelope(save)).toBe(JSON.stringify(wrapSave(save)));
    expect(unwrapSave(JSON.parse(serializeSaveEnvelope(save)))).toEqual(JSON.parse(JSON.stringify(save)));
  });
  it('wraps and unwraps a save round-trip', () => {
    const save = fakeSave();
    const env = wrapSave(save);
    expect(isEnvelope(env)).toBe(true);
    expect(unwrapSave(env)).toEqual(save);
  });

  it('detects corruption via checksum mismatch', () => {
    const env = wrapSave(fakeSave());
    (env.save as unknown as { id: string }).id = 'tampered'; // mutate after checksum
    expect(unwrapSave(env)).toBeNull();
  });

  it('accepts a legacy raw save (pre-envelope)', () => {
    const raw = fakeSave('legacy');
    expect(unwrapSave(raw)).toEqual(raw);
  });

  it('rejects junk', () => {
    expect(unwrapSave(null)).toBeNull();
    expect(unwrapSave('nope')).toBeNull();
    expect(unwrapSave({ foo: 1 })).toBeNull();
  });

  it('checksum is stable and content-sensitive', () => {
    const a = checksumOf({ x: 1 });
    const b = checksumOf({ x: 1 });
    const c = checksumOf({ x: 2 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
