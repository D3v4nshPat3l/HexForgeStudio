import type { ByteSource } from "../byte-source";
import type { PeAnalysis, PeSection } from "../types";
import { calculateEntropyFromCounts } from "./entropy";

const MACHINE: Record<number, string> = {
  0x014c: "x86",
  0x8664: "x86-64",
  0x01c0: "ARM",
  0x01c4: "ARM Thumb-2",
  0xaa64: "ARM64",
  0x0200: "Intel Itanium"
};

const SUBSYSTEM: Record<number, string> = {
  1: "Native",
  2: "Windows GUI",
  3: "Windows Console",
  7: "POSIX Console",
  9: "Windows CE GUI",
  10: "EFI Application",
  11: "EFI Boot Service Driver",
  12: "EFI Runtime Driver",
  13: "EFI ROM",
  14: "Xbox",
  16: "Windows Boot Application"
};

function ascii(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte === 0 ? "" : String.fromCharCode(byte);
  return output;
}

export async function analyzePe(source: ByteSource): Promise<PeAnalysis> {
  const warnings: string[] = [];
  if (source.size < 64) return { valid: false, warnings: ["File is too small for a PE image."] };
  const dos = await source.read(0, 64);
  if (dos[0] !== 0x4D || dos[1] !== 0x5A) return { valid: false, warnings: ["Missing DOS MZ signature."] };
  const dosView = new DataView(dos.buffer, dos.byteOffset, dos.byteLength);
  const peOffset = dosView.getUint32(0x3C, true);
  if (peOffset + 24 > source.size) return { valid: false, warnings: ["PE header offset is outside the file."] };

  const fixed = await source.read(peOffset, 24);
  if (ascii(fixed.slice(0, 4)) !== "PE") return { valid: false, warnings: ["Missing PE\\0\\0 signature."] };
  const view = new DataView(fixed.buffer, fixed.byteOffset, fixed.byteLength);
  const machine = view.getUint16(4, true);
  const sectionCount = view.getUint16(6, true);
  const timestamp = view.getUint32(8, true);
  const optionalSize = view.getUint16(20, true);
  const characteristics = view.getUint16(22, true);
  if (sectionCount > 96) warnings.push(`Unusually high section count: ${sectionCount}.`);
  if (peOffset + 24 + optionalSize + sectionCount * 40 > source.size) warnings.push("Section table extends beyond the file.");

  const optional = await source.read(peOffset + 24, Math.min(optionalSize, source.size - peOffset - 24));
  const optionalView = new DataView(optional.buffer, optional.byteOffset, optional.byteLength);
  const magic = optional.length >= 2 ? optionalView.getUint16(0, true) : 0;
  const is64 = magic === 0x20B;
  const is32 = magic === 0x10B;
  if (!is32 && !is64) warnings.push(`Unknown optional-header magic 0x${magic.toString(16)}.`);
  const entryPoint = optional.length >= 20 ? optionalView.getUint32(16, true) : undefined;
  let imageBase: string | undefined;
  if (is64 && optional.length >= 32) imageBase = `0x${optionalView.getBigUint64(24, true).toString(16)}`;
  else if (is32 && optional.length >= 32) imageBase = `0x${optionalView.getUint32(28, true).toString(16)}`;
  const subsystem = optional.length >= 70 ? SUBSYSTEM[optionalView.getUint16(68, true)] ?? `Unknown (${optionalView.getUint16(68, true)})` : undefined;

  const sections: PeSection[] = [];
  const tableOffset = peOffset + 24 + optionalSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = tableOffset + index * 40;
    if (offset + 40 > source.size) break;
    const raw = await source.read(offset, 40);
    const sectionView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const name = ascii(raw.slice(0, 8)) || `<section-${index}>`;
    const virtualSize = sectionView.getUint32(8, true);
    const virtualAddress = sectionView.getUint32(12, true);
    const rawSize = sectionView.getUint32(16, true);
    const rawOffset = sectionView.getUint32(20, true);
    const sectionCharacteristics = sectionView.getUint32(36, true);
    let entropy: number | undefined;
    if (rawSize > 0 && rawOffset < source.size) {
      const sample = await source.read(rawOffset, Math.min(rawSize, source.size - rawOffset, 8 * 1024 * 1024));
      const counts = new Uint32Array(256);
      for (const byte of sample) counts[byte] = (counts[byte] ?? 0) + 1;
      entropy = calculateEntropyFromCounts(counts, sample.length);
      if (entropy > 7.6) warnings.push(`Section ${name} has very high entropy (${entropy.toFixed(3)}), which may indicate compression or encryption.`);
      const executable = (sectionCharacteristics & 0x20000000) !== 0;
      const writable = (sectionCharacteristics & 0x80000000) !== 0;
      if (executable && writable) warnings.push(`Section ${name} is both writable and executable.`);
    }
    sections.push({ name, virtualAddress, virtualSize, rawOffset, rawSize, characteristics: sectionCharacteristics, ...(entropy === undefined ? {} : { entropy }) });
  }

  return {
    valid: true,
    architecture: MACHINE[machine] ?? `Unknown machine 0x${machine.toString(16)}`,
    timestamp,
    ...(subsystem ? { subsystem } : {}),
    ...(entryPoint === undefined ? {} : { entryPoint }),
    ...(imageBase ? { imageBase } : {}),
    sectionCount,
    characteristics,
    sections,
    warnings
  };
}
