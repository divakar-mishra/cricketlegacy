import { decodeSaveText } from '../decodeSaveText';

describe('yielding protected-save UTF-8 decoding', () => {
  it('preserves JSON, Unicode and multibyte characters across chunk boundaries', async () => {
    const text = JSON.stringify({ name: 'a'.repeat(16_373) + '🏏 नाम 日本語',
      later: 'न'.repeat(20_000), coins: 123, escaped: '\u0000\n"' });
    const bytes = new TextEncoder().encode(text);
    const before = bytes.slice();
    const decoded = await decodeSaveText(bytes);
    expect(decoded).toBe(text);
    expect(JSON.parse(decoded)).toEqual(JSON.parse(text));
    expect(bytes).toEqual(before);
  });

  it('matches standard BOM and invalid/truncated UTF-8 handling, including view offsets', async () => {
    const data = new Uint8Array(16_400).fill(0x61);
    data.set([0xef, 0xbb, 0xbf], 0);
    data.set([0xf0, 0x9f, 0x8f, 0x8f], 16_382);
    data.set([0xe0, 0xff, 0xc0, 0xe2], 16_396);
    const surrounding = new Uint8Array(data.length + 20).fill(0x7a);
    surrounding.set(data, 7);
    const view = surrounding.subarray(7, 7 + data.length);
    expect(await decodeSaveText(view)).toBe(new TextDecoder().decode(view));
    expect(await decodeSaveText(new Uint8Array())).toBe('');
  });

  it('yields to an input-like timer before a large decode completes', async () => {
    const order: string[] = [];
    setTimeout(() => order.push('input'), 0);
    const text = 'x'.repeat(80_000);
    const result = await decodeSaveText(new TextEncoder().encode(text));
    order.push('decoded');
    expect(order).toEqual(['input', 'decoded']);
    expect(result).toBe(text);
  });

  it('never feeds the decoder an unbounded whole-career buffer', async () => {
    const decode = jest.spyOn(TextDecoder.prototype, 'decode');
    try {
      await decodeSaveText(new Uint8Array(70_000).fill(0x61));
      const sizes = decode.mock.calls.map(([input]) => input?.byteLength ?? 0);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(16 * 1024);
      expect(sizes.filter(size => size > 0)).toHaveLength(5);
      expect(decode.mock.calls.at(-1)?.[0]).toBeUndefined();
    } finally { decode.mockRestore(); }
  });
});
