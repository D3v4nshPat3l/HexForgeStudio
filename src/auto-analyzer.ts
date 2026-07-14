import { FileByteSource } from "./byte-source";
import { calculateEntropyRegions, calculateWholeFileEntropy } from "./analyzers/entropy";
import { calculateHashes, DEFAULT_HASHES } from "./analyzers/hashes";
import { analyzePe } from "./analyzers/pe";
import { identifyFile, scanEmbeddedSignatures } from "./analyzers/signatures";
import { extractStrings } from "./analyzers/strings";
import { analyzeFormatDetails } from "./analyzers/format-details";
import type { AnalysisOptions, FileAnalysis, ProgressEvent, SuspiciousRegion } from "./types";

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

  const [hashes, wholeFileEntropy, entropyRegions, strings, signatureHits] = await Promise.all([
    calculateHashes(source, options.calculateHashes ?? DEFAULT_HASHES, chunkSize, onProgress),
    calculateWholeFileEntropy(source, chunkSize, onProgress),
    calculateEntropyRegions(source, options.entropyWindowSize ?? 64 * 1024, options.entropyStep ?? 64 * 1024),
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

  return {
    filename: file.name,
    size: file.size,
    lastModified: file.lastModified,
    detectedType,
    hashes,
    wholeFileEntropy,
    entropyRegions,
    strings,
    signatureHits,
    suspiciousRegions,
    details,
    ...(pe ? { pe } : {}),
    analysisVersion: "2.0.0",
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
