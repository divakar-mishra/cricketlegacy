const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Re-signing changes the executable's signature blob/Info hash, not its code.
// Compare every file-backed Mach-O section instead of its whole-file signature.
function nativeSectionHashes(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0xfeedfacf, 'Expected thin 64-bit Mach-O');
  const result = {};
  let command = 32;
  for (let index = 0; index < bytes.readUInt32LE(16); index++) {
    const size = bytes.readUInt32LE(command + 4);
    assert(size >= 8 && command + size <= bytes.length, 'Invalid Mach-O command');
    if (bytes.readUInt32LE(command) === 0x19) {
      for (let section = command + 72, count = bytes.readUInt32LE(command + 64); count > 0; count--, section += 80) {
        assert(section + 80 <= command + size, 'Invalid section bounds');
        const name = bytes.subarray(section, section + 16).toString().replace(/\0.*$/, '');
        const segment = bytes.subarray(section + 16, section + 32).toString().replace(/\0.*$/, '');
        const type = bytes.readUInt32LE(section + 64) & 0xff;
        if ([1, 0xc, 0x12].includes(type)) continue; // zero-filled, not in file
        const offset = bytes.readUInt32LE(section + 48);
        const length = Number(bytes.readBigUInt64LE(section + 40));
        assert(offset + length <= bytes.length, 'Invalid section data bounds');
        result[segment + '/' + name] = crypto.createHash('sha256').update(bytes.subarray(offset, offset + length)).digest('hex');
      }
    }
    command += size;
  }
  assert(Object.keys(result).length > 0, 'No native sections');
  return result;
}
module.exports = { nativeSectionHashes };
