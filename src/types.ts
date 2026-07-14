export interface ProgressEvent {
  stage: string;
  completed: number;
  total: number;
  message?: string;
}

export interface HashResult {
  algorithm: string;
  value: string;
}

export interface FormatMatch {
  id: string;
  name: string;
  extensions: string[];
  mime?: string;
  confidence: number;
  reason: string;
  offsets: number[];
}

export interface ExtractedString {
  offset: number;
  byteLength: number;
  encoding: "ASCII" | "UTF-8" | "UTF-16LE" | "UTF-16BE";
  value: string;
}

export interface EntropyRegion {
  offset: number;
  length: number;
  entropy: number;
}

export interface SuspiciousRegion extends EntropyRegion {
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface SignatureHit {
  id: string;
  name: string;
  offset: number;
  length: number;
  extensions: string[];
  confidence: number;
}

export interface PeSection {
  name: string;
  virtualAddress: number;
  virtualSize: number;
  rawOffset: number;
  rawSize: number;
  characteristics: number;
  entropy?: number;
}

export interface PeAnalysis {
  valid: boolean;
  architecture?: string;
  timestamp?: number;
  subsystem?: string;
  entryPoint?: number;
  imageBase?: string;
  sectionCount?: number;
  characteristics?: number;
  sections?: PeSection[];
  warnings: string[];
}

export interface AnalysisOptions {
  chunkSize?: number;
  stringMinLength?: number;
  stringMaxResults?: number;
  entropyWindowSize?: number;
  entropyStep?: number;
  signatureScanLimit?: number;
  calculateHashes?: string[];
}

export interface FileAnalysis {
  filename: string;
  size: number;
  lastModified: number;
  detectedType: FormatMatch[];
  hashes: HashResult[];
  wholeFileEntropy: number;
  entropyRegions: EntropyRegion[];
  strings: ExtractedString[];
  signatureHits: SignatureHit[];
  suspiciousRegions: SuspiciousRegion[];
  details: Record<string, string>;
  pe?: PeAnalysis;
  analysisVersion: string;
  analyzedAt: string;
}

export interface SearchQuery {
  mode: "hex" | "text" | "regex" | "uint" | "int" | "float";
  value: string;
  encoding?: "utf-8" | "utf-16le" | "utf-16be";
  endian?: "little" | "big";
  byteWidth?: 1 | 2 | 4 | 8;
  caseSensitive?: boolean;
  startOffset?: number;
  endOffset?: number;
  maxResults?: number;
}

export interface SearchResult {
  offset: number;
  length: number;
  previewHex: string;
}

export interface DifferenceRange {
  offset: number;
  leftLength: number;
  rightLength: number;
  leftHex: string;
  rightHex: string;
}
