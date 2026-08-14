import type { ByteSource } from "../byte-source";
import { readChunks } from "../byte-source";
import type {
  CryptoConstantHit,
  EntropyCliff,
  EntropyRegion,
  ObfuscationAnalysis,
  PatternIndicator,
  SignatureHit,
  XorCandidate
} from "../types";

/**
 * Byte-level obfuscation and anti-analysis detection.
 *
 * Everything here operates on bounded samples: a head window, a tail window, and a
 * set of evenly spaced probes across the file. That keeps the cost flat regardless
 * of file size, at the cost of being able to miss indicators in unsampled regions
 * (reported through `scanLimited`).
 */

const PROBE_SIZE = 256 * 1024;
const MAX_PROBES = 24;

/** Well-known constant tables. A match strongly suggests the named primitive is compiled in. */
const CRYPTO_CONSTANTS: Array<{ name: string; algorithm: string; bytes: number[] }> = [
  { name: "AES forward S-box", algorithm: "AES / Rijndael", bytes: [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76] },
  { name: "AES inverse S-box", algorithm: "AES / Rijndael", bytes: [0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb] },
  { name: "MD5 initial state", algorithm: "MD5", bytes: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10] },
  { name: "SHA-1 initial state", algorithm: "SHA-1", bytes: [0x67, 0x45, 0x23, 0x01, 0xef, 0xcd, 0xab, 0x89, 0x98, 0xba, 0xdc, 0xfe, 0x10, 0x32, 0x54, 0x76] },
  { name: "SHA-256 round constants", algorithm: "SHA-256", bytes: [0x42, 0x8a, 0x2f, 0x98, 0x71, 0x37, 0x44, 0x91, 0xb5, 0xc0, 0xfb, 0xcf, 0xe9, 0xb5, 0xdb, 0xa5] },
  { name: "SHA-512 round constants", algorithm: "SHA-512", bytes: [0x42, 0x8a, 0x2f, 0x98, 0xd7, 0x28, 0xae, 0x22, 0x71, 0x37, 0x44, 0x91, 0x23, 0xef, 0x65, 0xcd] },
  { name: "CRC-32 table head", algorithm: "CRC-32 (IEEE)", bytes: [0x00, 0x00, 0x00, 0x00, 0x96, 0x30, 0x07, 0x77, 0x2c, 0x61, 0x0e, 0xee, 0xba, 0x51, 0x09, 0x99] },
  { name: "Blowfish P-array", algorithm: "Blowfish", bytes: [0x24, 0x3f, 0x6a, 0x88, 0x85, 0xa3, 0x08, 0xd3, 0x13, 0x19, 0x8a, 0x2e, 0x03, 0x70, 0x73, 0x44] },
  { name: "ChaCha/Salsa sigma", algorithm: "ChaCha20 / Salsa20", bytes: [0x65, 0x78, 0x70, 0x61, 0x6e, 0x64, 0x20, 0x33, 0x32, 0x2d, 0x62, 0x79, 0x74, 0x65, 0x20, 0x6b] },
  { name: "Base64 standard alphabet", algorithm: "Base64", bytes: [0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50] },
  { name: "Tiny Encryption Algorithm delta", algorithm: "TEA / XTEA", bytes: [0x37, 0x79, 0xb9, 0x9e] },
  { name: "MD4/RIPEMD magic", algorithm: "MD4 / RIPEMD", bytes: [0x99, 0x79, 0x82, 0x5a, 0x1e, 0xf6, 0x9d, 0x6e] }
];

/** Section names and literals emitted by common packers and protectors. */
const PACKER_MARKERS: Array<{ marker: string; label: string }> = [
  { marker: "UPX0", label: "UPX" },
  { marker: "UPX1", label: "UPX" },
  { marker: "UPX!", label: "UPX" },
  { marker: "$Info: This file is packed with the UPX", label: "UPX (banner)" },
  { marker: "ASPack", label: "ASPack" },
  { marker: ".aspack", label: "ASPack" },
  { marker: ".adata", label: "ASPack" },
  { marker: "PEC2", label: "PECompact" },
  { marker: "PECompact2", label: "PECompact" },
  { marker: "Themida", label: "Themida / WinLicense" },
  { marker: ".themida", label: "Themida / WinLicense" },
  { marker: "WinLicen", label: "Themida / WinLicense" },
  { marker: "VMProtect", label: "VMProtect" },
  { marker: ".vmp0", label: "VMProtect" },
  { marker: ".vmp1", label: "VMProtect" },
  { marker: "Enigma", label: "Enigma Protector" },
  { marker: ".enigma", label: "Enigma Protector" },
  { marker: "MPRESS1", label: "MPRESS" },
  { marker: "MPRESS2", label: "MPRESS" },
  { marker: ".petite", label: "Petite" },
  { marker: "PELOCKnt", label: "PELock" },
  { marker: ".nsp0", label: "NsPack" },
  { marker: ".packed", label: "Generic packer section" },
  { marker: "kkrunchy", label: "kkrunchy" },
  { marker: "Obsidium", label: "Obsidium" },
  { marker: ".boom", label: "The Boomerang" },
  { marker: "ConfuserEx", label: "ConfuserEx (.NET)" },
  { marker: "DotNetGuard", label: ".NET protector" },
  { marker: "SmartAssembly", label: "SmartAssembly (.NET)" },
  { marker: "Eziriz", label: ".NET Reactor" },
  { marker: "pyimod00_crypto", label: "PyInstaller" },
  { marker: "PyInstaller", label: "PyInstaller" },
  { marker: "_MEIPASS", label: "PyInstaller" },
  { marker: "py2exe", label: "py2exe" },
  { marker: "Nuitka", label: "Nuitka" },
  { marker: "!This program cannot be run in DOS mode", label: "" }
];

/** Byte sequences that commonly appear at the start of position-independent payloads. */
const SHELLCODE_PATTERNS: Array<{ bytes: number[]; mask?: number[]; name: string; description: string; severity: PatternIndicator["severity"] }> = [
  { bytes: [0xe8, 0x00, 0x00, 0x00, 0x00, 0x5b], name: "CALL $+5 / POP EBX", description: "Classic GetPC stub used by position-independent shellcode to locate itself.", severity: "high" },
  { bytes: [0xe8, 0x00, 0x00, 0x00, 0x00, 0x58], name: "CALL $+5 / POP EAX", description: "GetPC stub variant recovering the instruction pointer into EAX.", severity: "high" },
  { bytes: [0xe8, 0x00, 0x00, 0x00, 0x00, 0x5d], name: "CALL $+5 / POP EBP", description: "GetPC stub variant recovering the instruction pointer into EBP.", severity: "high" },
  { bytes: [0xd9, 0x74, 0x24, 0xf4], name: "FNSTENV GetPC", description: "Floating-point FNSTENV trick used to obtain the instruction pointer without a CALL.", severity: "high" },
  { bytes: [0xd9, 0xee, 0xd9, 0x74, 0x24, 0xf4], name: "FLDZ / FNSTENV GetPC", description: "FPU-based GetPC stub frequently produced by shellcode encoders.", severity: "high" },
  { bytes: [0x64, 0xa1, 0x30, 0x00, 0x00, 0x00], name: "FS:[0x30] PEB access", description: "Reads the Process Environment Block directly, typical of import-resolving shellcode.", severity: "high" },
  { bytes: [0x65, 0x48, 0x8b, 0x04, 0x25, 0x60, 0x00, 0x00, 0x00], name: "GS:[0x60] PEB access (x64)", description: "64-bit Process Environment Block access used to walk loaded modules manually.", severity: "high" },
  { bytes: [0x64, 0x8b, 0x35, 0x30, 0x00, 0x00, 0x00], name: "FS:[0x30] PEB access variant", description: "Alternate Process Environment Block dereference.", severity: "high" },
  { bytes: [0x31, 0xc0, 0x50, 0x68], name: "XOR EAX / PUSH string", description: "Stack-string construction pattern common in hand-written shellcode.", severity: "medium" },
  { bytes: [0xeb, 0x00, 0xeb], name: "Short jump chain", description: "Chained short jumps sometimes used as junk-code obfuscation.", severity: "low" },
  { bytes: [0xcd, 0x80], name: "INT 0x80", description: "Legacy Linux syscall gate; unusual inside data-oriented files.", severity: "medium" },
  { bytes: [0x0f, 0x05], name: "SYSCALL", description: "Direct syscall instruction, often used to bypass userland API hooks.", severity: "medium" },
  { bytes: [0x0f, 0x34], name: "SYSENTER", description: "Direct kernel transition instruction.", severity: "medium" }
];

function indexOfSequence(haystack: Uint8Array, needle: number[], from = 0): number {
  const first = needle[0] ?? 0;
  const limit = haystack.length - needle.length;
  for (let index = from; index <= limit; index += 1) {
    if (haystack[index] !== first) continue;
    let matched = true;
    for (let offset = 1; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) { matched = false; break; }
    }
    if (matched) return index;
  }
  return -1;
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

/**
 * Collects head, tail, and evenly spaced interior probes so that a fixed amount of
 * data is examined no matter how large the file is.
 */
async function collectProbes(source: ByteSource, budget: number): Promise<{ probes: Array<{ offset: number; bytes: Uint8Array }>; limited: boolean }> {
  const probes: Array<{ offset: number; bytes: Uint8Array }> = [];
  if (source.size === 0) return { probes, limited: false };
  if (source.size <= budget) {
    return { probes: [{ offset: 0, bytes: await source.read(0, source.size) }], limited: false };
  }

  const probeCount = Math.max(2, Math.min(MAX_PROBES, Math.floor(budget / PROBE_SIZE)));
  const stride = source.size / probeCount;
  for (let index = 0; index < probeCount; index += 1) {
    const offset = Math.min(source.size - 1, Math.floor(index * stride));
    const length = Math.min(PROBE_SIZE, source.size - offset);
    if (length <= 0) continue;
    probes.push({ offset, bytes: await source.read(offset, length) });
  }
  const tailOffset = Math.max(0, source.size - PROBE_SIZE);
  if (!probes.some((probe) => probe.offset === tailOffset)) {
    probes.push({ offset: tailOffset, bytes: await source.read(tailOffset, source.size - tailOffset) });
  }
  return { probes, limited: true };
}

/**
 * Single-byte XOR key recovery.
 *
 * For every non-zero key the head sample is decoded and scored on whether it starts
 * to look like a recognisable artefact: an MZ/PE header, an ELF header, or a high
 * proportion of printable text. Only keys clearing a confidence floor are reported.
 */
function detectXorKeys(sample: Uint8Array, sampleOffset: number): XorCandidate[] {
  const candidates: XorCandidate[] = [];
  if (sample.length < 64) return candidates;
  const window = sample.subarray(0, Math.min(sample.length, 64 * 1024));

  for (let key = 1; key <= 0xff; key += 1) {
    let printable = 0;
    let nulls = 0;
    for (let index = 0; index < window.length; index += 1) {
      const value = (window[index] ?? 0) ^ key;
      if (value === 0) nulls += 1;
      else if (value === 9 || value === 10 || value === 13 || (value >= 32 && value <= 126)) printable += 1;
    }
    const printableRatio = printable / window.length;
    const evidence: string[] = [];
    let confidence = 0;

    const header = [(window[0] ?? 0) ^ key, (window[1] ?? 0) ^ key, (window[2] ?? 0) ^ key, (window[3] ?? 0) ^ key];
    if (header[0] === 0x4d && header[1] === 0x5a) { confidence += 0.55; evidence.push("decodes to an MZ header"); }
    if (header[0] === 0x7f && header[1] === 0x45 && header[2] === 0x4c && header[3] === 0x46) { confidence += 0.6; evidence.push("decodes to an ELF header"); }
    if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) { confidence += 0.5; evidence.push("decodes to a ZIP local header"); }
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) { confidence += 0.5; evidence.push("decodes to a PNG header"); }

    const decoded = new Uint8Array(window.length);
    for (let index = 0; index < window.length; index += 1) decoded[index] = (window[index] ?? 0) ^ key;
    if (indexOfSequence(decoded, [0x54, 0x68, 0x69, 0x73, 0x20, 0x70, 0x72, 0x6f, 0x67, 0x72, 0x61, 0x6d]) >= 0) {
      confidence += 0.35;
      evidence.push('reveals the DOS stub text "This program"');
    }
    if (indexOfSequence(decoded, [0x50, 0x45, 0x00, 0x00]) >= 0 && confidence > 0) {
      confidence += 0.15;
      evidence.push("reveals a PE\\0\\0 signature");
    }

    if (printableRatio > 0.9 && nulls / window.length < 0.02) {
      confidence += 0.3;
      evidence.push(`${Math.round(printableRatio * 100)}% printable after decoding`);
    }

    if (confidence >= 0.4) {
      candidates.push({ key, confidence: Math.min(0.99, confidence), offset: sampleOffset, evidence: evidence.join("; ") });
    }
  }
  return candidates.sort((left, right) => right.confidence - left.confidence).slice(0, 6);
}

/** Adjacent entropy windows whose values jump sharply, marking a structural boundary. */
function detectEntropyCliffs(regions: EntropyRegion[], threshold = 3.0, maxResults = 60): EntropyCliff[] {
  const cliffs: EntropyCliff[] = [];
  for (let index = 1; index < regions.length && cliffs.length < maxResults; index += 1) {
    const previous = regions[index - 1];
    const current = regions[index];
    if (!previous || !current) continue;
    const delta = current.entropy - previous.entropy;
    if (Math.abs(delta) >= threshold) {
      cliffs.push({ offset: current.offset, before: previous.entropy, after: current.entropy, delta });
    }
  }
  return cliffs.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

function detectShellcode(probes: Array<{ offset: number; bytes: Uint8Array }>, maxResults = 120): PatternIndicator[] {
  const indicators: PatternIndicator[] = [];
  const seen = new Set<string>();

  for (const probe of probes) {
    for (const definition of SHELLCODE_PATTERNS) {
      let cursor = 0;
      let found = indexOfSequence(probe.bytes, definition.bytes, cursor);
      let perPattern = 0;
      while (found >= 0 && perPattern < 4 && indicators.length < maxResults) {
        const absolute = probe.offset + found;
        const key = `${definition.name}:${absolute}`;
        if (!seen.has(key)) {
          seen.add(key);
          indicators.push({ offset: absolute, pattern: definition.name, description: definition.description, severity: definition.severity });
        }
        perPattern += 1;
        cursor = found + 1;
        found = indexOfSequence(probe.bytes, definition.bytes, cursor);
      }
    }

    // NOP and INT3 sleds: long runs of a single filler byte inside otherwise varied data.
    for (const [filler, label] of [[0x90, "NOP sled"], [0xcc, "INT3 sled"]] as Array<[number, string]>) {
      let run = 0;
      for (let index = 0; index < probe.bytes.length && indicators.length < maxResults; index += 1) {
        if (probe.bytes[index] === filler) {
          run += 1;
          continue;
        }
        if (run >= 32) {
          const absolute = probe.offset + index - run;
          const key = `${label}:${absolute}`;
          if (!seen.has(key)) {
            seen.add(key);
            indicators.push({ offset: absolute, pattern: label, description: `${run}-byte run of 0x${filler.toString(16).toUpperCase()}, a landing pad pattern associated with exploit payloads.`, severity: run >= 128 ? "high" : "medium" });
          }
        }
        run = 0;
      }
    }
  }
  return indicators.sort((left, right) => left.offset - right.offset);
}

function detectCryptoConstants(probes: Array<{ offset: number; bytes: Uint8Array }>): CryptoConstantHit[] {
  const hits: CryptoConstantHit[] = [];
  const seen = new Set<string>();
  for (const probe of probes) {
    for (const constant of CRYPTO_CONSTANTS) {
      const found = indexOfSequence(probe.bytes, constant.bytes);
      if (found < 0) continue;
      if (seen.has(constant.name)) continue;
      seen.add(constant.name);
      hits.push({ name: constant.name, algorithm: constant.algorithm, offset: probe.offset + found });
    }
  }
  return hits.sort((left, right) => left.offset - right.offset);
}

function detectPackers(probes: Array<{ offset: number; bytes: Uint8Array }>): string[] {
  const labels = new Set<string>();
  for (const probe of probes) {
    const text = latin1(probe.bytes);
    for (const { marker, label } of PACKER_MARKERS) {
      if (label && text.includes(marker)) labels.add(label);
    }
  }
  return [...labels].sort();
}

/** Executable headers found anywhere other than offset zero. */
function findEmbeddedExecutables(signatureHits: SignatureHit[]): Array<{ offset: number; name: string }> {
  const executableIds = new Set(["pe", "elf", "macho-32-be", "macho-32-le", "macho-64-be", "macho-64-le", "macho-fat", "dex", "java-class"]);
  return signatureHits
    .filter((hit) => hit.offset > 0 && executableIds.has(hit.id))
    .slice(0, 200)
    .map((hit) => ({ offset: hit.offset, name: hit.name }));
}

export async function analyzeObfuscation(
  source: ByteSource,
  entropyRegions: EntropyRegion[],
  signatureHits: SignatureHit[],
  scanBudget = 6 * 1024 * 1024
): Promise<ObfuscationAnalysis> {
  const { probes, limited } = await collectProbes(source, scanBudget);
  const head = probes[0]?.bytes ?? new Uint8Array(0);

  return {
    xorCandidates: detectXorKeys(head, probes[0]?.offset ?? 0),
    entropyCliffs: detectEntropyCliffs(entropyRegions),
    shellcode: detectShellcode(probes),
    cryptoConstants: detectCryptoConstants(probes),
    embeddedExecutables: findEmbeddedExecutables(signatureHits),
    packerHints: detectPackers(probes),
    scanLimited: limited
  };
}

/** Full-file byte frequency table, used for the report histogram and distribution checks. */
export async function calculateByteHistogram(source: ByteSource, chunkSize = 4 * 1024 * 1024): Promise<number[]> {
  const counts = new Uint32Array(256);
  for await (const { bytes } of readChunks(source, chunkSize)) {
    for (let index = 0; index < bytes.length; index += 1) {
      const value = bytes[index] ?? 0;
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return Array.from(counts);
}
