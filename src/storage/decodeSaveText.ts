// Expo's UTF-8 decoder can do substantial synchronous JS work for a whole
// career. Keep its standard streaming semantics, but give input/rendering a
// macrotask between bounded pieces. Never modify the authenticated bytes.
const DECODE_CHUNK_BYTES = 16 * 1024;

export async function decodeSaveText(bytes: Uint8Array): Promise<string> {
  const decoder = new TextDecoder();
  const pieces: string[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += DECODE_CHUNK_BYTES) {
    const end = Math.min(offset + DECODE_CHUNK_BYTES, bytes.byteLength);
    pieces.push(decoder.decode(bytes.subarray(offset, end), { stream: true }));
    if (end < bytes.byteLength) {
      // Promise.resolve() would only yield to microtasks, still starving input.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  pieces.push(decoder.decode()); // Flush a partial final character exactly once.
  return pieces.join('');
}
