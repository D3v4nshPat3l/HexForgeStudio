import { FileByteSource } from "./byte-source";
import { calculateEntropyRegions, calculateWholeFileEntropy } from "./analyzers/entropy";
import { calculateHashes, DEFAULT_HASHES } from "./analyzers/hashes";
import { analyzePe } from "./analyzers/pe";
import { identifyFile, scanEmbeddedSignatures } from "./analyzers/signatures";
import { extractStrings } from "./analyzers/strings";
import { analyzeFormatDetails } from "./analyzers/format-details";
import { extractIocs } from "./analyzers/iocs";
import { detectCapabilities } from "./analyzers/capabilities";
import { analyzeObfuscation, calculateByteHistogram } from "./analyzers/obfuscation";
import { assessThreat } from "./analyzers/threat";
import type { AnalysisOptions, FileAnalysis, IocReport, ObfuscationAnalysis, ProgressEvent, SuspiciousRegion } from "./types";

const ANALYSIS_VERSION = "3.0.0";

const EMPTY_IOCS: IocReport = {
  items: [],
  counts: { url: 0, ipv4: 0, ipv6: 0, domain: 0, email: 0, registry: 0, path: 0, base64: 0, guid: 0, wallet: 0, command: 0, "user-agent": 0 },
  truncated: false
};

const EMPTY_OBFUSCATION: ObfuscationAnalysis = {
  xorCandidates: [], entropyCliffs: [], shellcode: [], cryptoConstants: [], embeddedExecutables: [], packerHints: [], scanLimited: false
};

export async function analyzeFile(
  file: File,
  options: AnalysisOptions = {},
  onProgress?: (progress: ProgressEvent) => void
): Promise<FileAnalysis> {
  const source = new FileByteSource(file);
  const chunkSize = options.chunkSize ?? 4 * 1024 * 1024;
  onProgress?.({ stage: "identify", completed: 0, total: 1 });
  const detectedType = await identifyFile(source, file.name);
  onProgress?.({ stage: "identify", completed: 1, total: 1 });

  // Aim for roughly 256 entropy windows regardless of file size, because a fixed 64 KiB
  // window collapses a small file to one useless sample. The 4 KiB floor matters: Shannon
  // entropy over n samples is bounded by log2(n), so windows much below this can never
  // reach the 7.35/7.75 suspicion thresholds and would silently suppress every region.
  const MIN_ENTROPY_WINDOW = 4096;
  const requestedWindow = options.entropyWindowSize ?? 64 * 1024;
  const entropyWindow = Math.min(requestedWindow, Math.max(MIN_ENTROPY_WINDOW, Math.ceil(source.size / 256)));
  // The step is clamped to the window as well: a caller-supplied step larger than the
  // adapted window would otherwise skip most of a small file and yield one sample.
  const entropyStep = Math.max(1, Math.min(options.entropyStep ?? entropyWindow, entropyWindow));

  const [hashes, wholeFileEntropy, byteHistogram, entropyRegions, strings, signatureHits] = await Promise.all([
    calculateHashes(source, options.calculateHashes ?? DEFAULT_HASHES, chunkSize, onProgress),
    calculateWholeFileEntropy(source, chunkSize, onProgress),
    calculateByteHistogram(source, chunkSize),
    calculateEntropyRegions(source, entropyWindow, entropyStep),
    extractStrings(source, { minLength: options.stringMinLength ?? 4, maxResults: options.stringMaxResults ?? 10000, chunkSize }, onProgress),
    scanEmbeddedSignatures(source, options.signatureScanLimit ?? Math.min(source.size, 512 * 1024 * 1024), Math.min(chunkSize, 4 * 1024 * 1024))
  ]);

  const suspiciousRegions: SuspiciousRegion[] = [];
  for (const region of entropyRegions) {
    if (region.entropy >= 7.75) {
      suspiciousRegions.push({ ...region, reason: "Very high entropy; compressed, encrypted, or packed content is possible", severity: "high" });
    } else if (region.entropy >= 7.35) {
      suspiciousRegions.push({ ...region, reason: "High entropy; compressed or encoded content is possible", severity: "medium" });
    } else if (region.entropy <= 0.08 && region.length >= 4096) {
      suspiciousRegions.push({ ...region, reason: "Near-uniform region; padding, sparse data, or erased flash content is possible", severity: "low" });
    }
  }

  const details = await analyzeFormatDetails(source, detectedType, file.name, file.type);

  let pe;
  if (detectedType.some((match) => match.id === "pe")) pe = await analyzePe(source);

  onProgress?.({ stage: "security", completed: 0, total: 1, message: "Threat and indicator analysis" });
  let iocs = EMPTY_IOCS;
  let capabilities: FileAnalysis["capabilities"] = [];
  let obfuscation = EMPTY_OBFUSCATION;
  if (!options.skipSecurity) {
    iocs = extractIocs(strings, options.maxIocs ?? 4000);
    capabilities = detectCapabilities(strings);
    obfuscation = await analyzeObfuscation(source, entropyRegions, signatureHits, options.securityScanLimit ?? 6 * 1024 * 1024);
  }
  const threat = assessThreat({
    filename: file.name,
    size: file.size,
    detectedType,
    wholeFileEntropy,
    suspiciousRegions,
    capabilities,
    iocs,
    obfuscation,
    pe
  });
  onProgress?.({ stage: "security", completed: 1, total: 1 });

  return {
    filename: file.name,
    size: file.size,
    lastModified: file.lastModified,
    detectedType,
    hashes,
    wholeFileEntropy,
    entropyRegions,
    byteHistogram,
    strings,
    signatureHits,
    suspiciousRegions,
    details,
    ...(pe ? { pe } : {}),
    iocs,
    capabilities,
    obfuscation,
    threat,
    analysisVersion: ANALYSIS_VERSION,
    analyzedAt: new Date().toISOString()
  };
}

export interface AutoAnalysisBinding {
  fileInput: HTMLInputElement;
  onResult: (analysis: FileAnalysis, file: File) => void;
  onProgress?: (progress: ProgressEvent, file: File) => void;
  onError?: (error: Error, file?: File) => void;
  options?: AnalysisOptions;
}

export function attachAutomaticAnalysis(binding: AutoAnalysisBinding): () => void {
  let generation = 0;
  const listener = async (): Promise<void> => {
    const files = Array.from(binding.fileInput.files ?? []);
    const currentGeneration = ++generation;
    for (const file of files) {
      try {
        const analysis = await analyzeFile(file, binding.options, (progress) => {
          if (currentGeneration === generation) binding.onProgress?.(progress, file);
        });
        if (currentGeneration !== generation) return;
        binding.onResult(analysis, file);
        window.dispatchEvent(new CustomEvent("hex-tool:analysis", { detail: { file, analysis } }));
      } catch (error) {
        binding.onError?.(error instanceof Error ? error : new Error(String(error)), file);
      }
    }
  };
  binding.fileInput.addEventListener("change", listener);
  return () => {
    generation += 1;
    binding.fileInput.removeEventListener("change", listener);
  };
}
