import type { ByteSource } from "./byte-source";
import { toHex } from "./byte-source";
import type { DifferenceRange } from "./types";

export async function compareFiles(
  left: ByteSource,
  right: ByteSource,
  options: { chunkSize?: number; maxRanges?: number; contextBytes?: number } = {}
): Promise<DifferenceRange[]> {
  const chunkSize = options.chunkSize ?? 4 * 1024 * 1024;
  const maxRanges = options.maxRanges ?? 10000;
  const context = options.contextBytes ?? 32;
  const maximum = Math.max(left.size, right.size);
  const differences: DifferenceRange[] = [];
  let openStart: number | undefined;
  let openEnd = 0;

  const flush = async (): Promise<void> => {
    if (openStart === undefined) return;
    const length = openEnd - openStart;
    const previewLength = Math.min(length, context);
    const leftBytes = openStart < left.size ? await left.read(openStart, Math.min(previewLength, left.size - openStart)) : new Uint8Array();
    const rightBytes = openStart < right.size ? await right.read(openStart, Math.min(previewLength, right.size - openStart)) : new Uint8Array();
    differences.push({ offset: openStart, leftLength: Math.min(length, Math.max(0, left.size - openStart)), rightLength: Math.min(length, Math.max(0, right.size - openStart)), leftHex: toHex(leftBytes), rightHex: toHex(rightBytes) });
    openStart = undefined;
  };

  for (let offset = 0; offset < maximum; offset += chunkSize) {
    const length = Math.min(chunkSize, maximum - offset);
    const leftBytes = offset < left.size ? await left.read(offset, Math.min(length, left.size - offset)) : new Uint8Array();
    const rightBytes = offset < right.size ? await right.read(offset, Math.min(length, right.size - offset)) : new Uint8Array();
    for (let index = 0; index < length; index += 1) {
      const same = index < leftBytes.length && index < rightBytes.length && leftBytes[index] === rightBytes[index];
      if (!same) {
        if (openStart === undefined) openStart = offset + index;
        openEnd = offset + index + 1;
      } else if (openStart !== undefined) {
        await flush();
        if (differences.length >= maxRanges) return differences;
      }
    }
  }
  await flush();
  return differences;
}
