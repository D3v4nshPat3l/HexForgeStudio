import {
  createAdler32,
  createBLAKE3,
  createCRC32,
  createMD5,
  createRIPEMD160,
  createSHA1,
  createSHA256,
  createSHA512,
  createXXHash64,
  type IHasher
} from "hash-wasm";
import type { ByteSource } from "../byte-source";
import { readChunks } from "../byte-source";
import type { HashResult, ProgressEvent } from "../types";

const factories: Record<string, () => Promise<IHasher>> = {
  "ADLER-32": createAdler32,
  BLAKE3: createBLAKE3,
  "CRC-32": createCRC32,
  MD5: createMD5,
  "RIPEMD-160": createRIPEMD160,
  "SHA-1": createSHA1,
  "SHA-256": createSHA256,
  "SHA-512": createSHA512,
  XXHASH64: createXXHash64
};

export const DEFAULT_HASHES = ["MD5", "SHA-1", "SHA-256", "SHA-512", "BLAKE3", "CRC-32"];

export async function calculateHashes(
  source: ByteSource,
  algorithms = DEFAULT_HASHES,
  chunkSize = 4 * 1024 * 1024,
  onProgress?: (progress: ProgressEvent) => void
): Promise<HashResult[]> {
  const normalized = [...new Set(algorithms.map((name) => name.toUpperCase()))];
  const hashers = await Promise.all(normalized.map(async (name) => {
    const factory = factories[name];
    if (!factory) throw new Error(`Unsupported hash algorithm: ${name}`);
    return { name, hasher: await factory() };
  }));

  for (const { hasher } of hashers) hasher.init();
  for await (const { offset, bytes } of readChunks(source, chunkSize)) {
    for (const { hasher } of hashers) hasher.update(bytes);
    onProgress?.({ stage: "hashes", completed: offset + bytes.length, total: source.size });
  }

  return hashers.map(({ name, hasher }) => ({ algorithm: name, value: hasher.digest("hex") }));
}
