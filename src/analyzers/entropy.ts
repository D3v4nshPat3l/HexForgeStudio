import type { ByteSource } from "../byte-source";
import { readChunks } from "../byte-source";
import type { EntropyRegion, ProgressEvent } from "../types";

export function calculateEntropyFromCounts(counts: Uint32Array, total: number): number {
  if (total === 0) return 0;
  let entropy = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const count = counts[i] ?? 0;
    if (count === 0) continue;
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export async function calculateWholeFileEntropy(
  source: ByteSource,
  chunkSize: number,
  onProgress?: (progress: ProgressEvent) => void
): Promise<number> {
  const counts = new Uint32Array(256);
  let total = 0;
  for await (const { offset, bytes } of readChunks(source, chunkSize)) {
    for (let i = 0; i < bytes.length; i += 1) {
      const value = bytes[i] ?? 0;
      counts[value] = (counts[value] ?? 0) + 1;
    }
    total += bytes.length;
    onProgress?.({ stage: "entropy", completed: offset + bytes.length, total: source.size });
  }
  return calculateEntropyFromCounts(counts, total);
}

export async function calculateEntropyRegions(
  source: ByteSource,
  windowSize = 64 * 1024,
  step = windowSize,
  maxRegions = 8192
): Promise<EntropyRegion[]> {
  const regions: EntropyRegion[] = [];
  if (source.size === 0) return regions;
  const safeStep = Math.max(1, step);
  for (let offset = 0; offset < source.size && regions.length < maxRegions; offset += safeStep) {
    const bytes = await source.read(offset, Math.min(windowSize, source.size - offset));
    const counts = new Uint32Array(256);
    for (let i = 0; i < bytes.length; i += 1) {
      const value = bytes[i] ?? 0;
      counts[value] = (counts[value] ?? 0) + 1;
    }
    regions.push({ offset, length: bytes.length, entropy: calculateEntropyFromCounts(counts, bytes.length) });
  }
  return regions;
}
