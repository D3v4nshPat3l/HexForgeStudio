import { describe, expect, it } from "vitest";
import { FileByteSource } from "./byte-source";
import { identifyFile } from "./analyzers/signatures";
import { analyzeFormatDetails } from "./analyzers/format-details";
import { extractStrings } from "./analyzers/strings";
import { searchBytes } from "./analyzers/search";
import { compareFiles } from "./compare";
import { analyzeFile } from "./auto-analyzer";
import { buildPdfReport } from "./report/pdf-report";
import { extractIocs } from "./analyzers/iocs";
import { detectCapabilities, summarizeCapabilities } from "./analyzers/capabilities";
import { analyzeObfuscation } from "./analyzers/obfuscation";
import { assessThreat } from "./analyzers/threat";
import type { ExtractedString } from "./types";

function fileOf(bytes: Uint8Array, name: string, type = "application/octet-stream"): File {
  return new File([bytes.slice().buffer as ArrayBuffer], name, { type, lastModified: 1_700_000_000_000 });
}

describe("binary analysis", () => {
  it("identifies and describes PNG files", async () => {
    const bytes = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0x0d,0x49,0x48,0x44,0x52,0,0,0,2,0,0,0,3,8,6,0,0,0]);
    const file = fileOf(bytes, "sample.png", "image/png");
    const source = new FileByteSource(file);
    const matches = await identifyFile(source, file.name);
    expect(matches[0]?.id).toBe("png");
    const details = await analyzeFormatDetails(source, matches, file.name, file.type);
    expect(details.Dimensions).toBe("2 × 3");
    expect(details["Color type"]).toContain("Truecolor");
  });

  it("extracts large ASCII and odd-aligned UTF-16 strings without stack spreading", async () => {
    const prefix = new Uint8Array(2 * 1024 * 1024).fill(0);
    const ascii = new TextEncoder().encode("STACK_SAFE_STRING");
    const utf = Uint8Array.from([0, 0x48,0,0x65,0,0x6c,0,0x6c,0,0x6f,0]);
    const file = fileOf(new Uint8Array([...prefix, ...ascii, 0, ...utf]), "strings.bin");
    const results = await extractStrings(new FileByteSource(file), { minLength: 5, maxResults: 100 });
    expect(results.some((item) => item.value.includes("STACK_SAFE_STRING"))).toBe(true);
    expect(results.some((item) => item.value === "Hello" && item.encoding === "UTF-16BE")).toBe(true);
  });

  it("supports wildcard and case-insensitive search", async () => {
    const source = new FileByteSource(fileOf(new TextEncoder().encode("AbCd--PK\u0003\u0004"), "search.bin"));
    const textResults = await searchBytes(source, { mode: "text", value: "abcd", caseSensitive: false });
    expect(textResults[0]?.offset).toBe(0);
    const hexResults = await searchBytes(source, { mode: "hex", value: "50 4B ?? 04" });
    expect(hexResults[0]?.offset).toBe(6);
  });

  it("compares binary files in ranges", async () => {
    const left = new FileByteSource(fileOf(Uint8Array.from([1,2,3,4,5]), "left.bin"));
    const right = new FileByteSource(fileOf(Uint8Array.from([1,9,3,8,5]), "right.bin"));
    const differences = await compareFiles(left, right);
    expect(differences.length).toBe(2);
    expect(differences[0]?.offset).toBe(1);
  });

  it("recognizes the requested fixed-signature format families", async () => {
    const cases: Array<[string, string, number[]]> = [
      ["tiff-le", "a.tiff", [0x49,0x49,0x2A,0x00]], ["ico", "a.ico", [0,0,1,0]],
      ["psd", "a.psd", [0x38,0x42,0x50,0x53]], ["jp2", "a.jp2", [0,0,0,0x0C,0x6A,0x50,0x20,0x20,0x0D,0x0A,0x87,0x0A]],
      ["exr", "a.exr", [0x76,0x2F,0x31,0x01]], ["bzip2", "a.bz2", [0x42,0x5A,0x68,0x39]],
      ["xz", "a.xz", [0xFD,0x37,0x7A,0x58,0x5A,0]], ["cab", "a.cab", [0x4D,0x53,0x43,0x46]],
      ["wav", "a.wav", [0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x41,0x56,0x45]],
      ["flac", "a.flac", [0x66,0x4C,0x61,0x43]], ["ogg", "a.ogg", [0x4F,0x67,0x67,0x53]],
      ["aac-adif", "a.aac", [0x41,0x44,0x49,0x46]], ["midi", "a.mid", [0x4D,0x54,0x68,0x64]],
      ["avi", "a.avi", [0x52,0x49,0x46,0x46,0,0,0,0,0x41,0x56,0x49,0x20]],
      ["ebml", "a.mkv", [0x1A,0x45,0xDF,0xA3]], ["mpeg-ps", "a.mpg", [0,0,1,0xBA]],
      ["flv", "a.flv", [0x46,0x4C,0x56]], ["asf-wmv", "a.wmv", [0x30,0x26,0xB2,0x75,0x8E,0x66,0xCF,0x11,0xA6,0xD9,0,0xAA,0,0x62,0xCE,0x6C]],
      ["macho-64-le", "a.bin", [0xCF,0xFA,0xED,0xFE]], ["java-class", "a.class", [0xCA,0xFE,0xBA,0xBE,0,0,0,0x3D]],
      ["dex", "a.dex", [0x64,0x65,0x78,0x0A,0x30,0x33,0x35,0]], ["chm", "a.chm", [0x49,0x54,0x53,0x46]],
      ["djvu", "a.djvu", [0x41,0x54,0x26,0x54,0x46,0x4F,0x52,0x4D]], ["postscript", "a.ps", [0x25,0x21,0x50,0x53]],
      ["mp3-frame", "a.mp3", [0xFF,0xFB,0x90,0x64]]
    ];
    for (const [id, name, bytes] of cases) {
      const matches = await identifyFile(new FileByteSource(fileOf(Uint8Array.from(bytes), name)), name);
      expect(matches.some((match) => match.id === id), `${name} should match ${id}`).toBe(true);
    }
  });

  it("generates a multi-section PDF after automatic analysis", async () => {
    const bytes = new TextEncoder().encode('{"name":"HexForge","enabled":true,"message":"Readable string data"}');
    const analysis = await analyzeFile(fileOf(bytes, "sample.json", "application/json"), { stringMaxResults: 100 });
    expect(analysis.detectedType.some((match) => match.id === "json")).toBe(true);
    expect(analysis.hashes.length).toBeGreaterThanOrEqual(4);
    const report = buildPdfReport(analysis, { userNotes: "Test note", includeStrings: 20 });
    const arrayBuffer = report.output("arraybuffer");
    expect(arrayBuffer.byteLength).toBeGreaterThan(1000);
  });
});

function stringOf(value: string, offset = 0): ExtractedString {
  return { offset, byteLength: value.length, encoding: "ASCII", value };
}

describe("indicator extraction", () => {
  it("classifies URLs, addresses, registry keys, and wallets with severities", () => {
    const report = extractIocs([
      stringOf("Fetching https://updates.example.com/payload.exe now", 100),
      stringOf("callback 203.0.113.44:8080 fallback 192.168.1.10", 200),
      stringOf("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Updater", 300),
      stringOf("send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", 400),
      stringOf("contact operator@mail.example.org", 500)
    ]);

    const url = report.items.find((item) => item.type === "url");
    expect(url?.value).toBe("https://updates.example.com/payload.exe");
    expect(url?.severity).toBe("high");

    const routable = report.items.find((item) => item.type === "ipv4" && item.value.startsWith("203."));
    expect(routable?.severity).toBe("medium");
    const priv = report.items.find((item) => item.type === "ipv4" && item.value.startsWith("192.168."));
    expect(priv?.severity).toBe("info");

    expect(report.items.find((item) => item.type === "registry")?.severity).toBe("high");
    expect(report.items.some((item) => item.type === "wallet")).toBe(true);
    expect(report.counts.email).toBe(1);
  });

  it("flags encoded PowerShell and shadow-copy deletion as critical commands", () => {
    const report = extractIocs([
      stringOf("powershell.exe -nop -w hidden -enc SQBFAFgAKABOAGUAdwAtAE8AYgBqAGUAYwB0AA==", 0),
      stringOf("vssadmin delete shadows /all /quiet", 900)
    ]);
    const commands = report.items.filter((item) => item.type === "command");
    expect(commands.length).toBeGreaterThanOrEqual(2);
    expect(commands.every((item) => item.severity === "critical" || item.severity === "high")).toBe(true);
  });

  it("rejects version numbers and low-variety runs that resemble indicators", () => {
    const report = extractIocs([
      stringOf("product version 1.2.3.4 build", 0),
      stringOf(`prefix ${"A".repeat(64)} suffix`, 100)
    ]);
    expect(report.counts.ipv4).toBe(0);
    expect(report.counts.base64).toBe(0);
  });
});

describe("capability detection", () => {
  it("tags injection and anti-debugging literals with their categories", () => {
    const hits = detectCapabilities([
      stringOf("IsDebuggerPresent", 16),
      stringOf("VirtualAllocEx WriteProcessMemory CreateRemoteThread", 64),
      stringOf("harmless configuration text", 256)
    ]);
    const categories = summarizeCapabilities(hits).map((group) => group.category);
    expect(categories).toContain("Anti-debugging");
    expect(categories).toContain("Code injection");
    expect(hits.find((hit) => hit.indicator === "IsDebuggerPresent")?.offset).toBe(16);
  });
});

describe("obfuscation analysis", () => {
  it("recovers a single-byte XOR key that reveals an MZ/PE image", async () => {
    const plain = new Uint8Array(4096);
    plain.set(new TextEncoder().encode("MZ\x90\x00"), 0);
    plain.set(new TextEncoder().encode("This program cannot be run in DOS mode"), 78);
    plain.set(new TextEncoder().encode("PE\0\0"), 200);
    const key = 0x5a;
    const encoded = plain.map((byte) => byte ^ key);

    const result = await analyzeObfuscation(new FileByteSource(fileOf(encoded, "encoded.bin")), [], []);
    expect(result.xorCandidates[0]?.key).toBe(key);
    expect(result.xorCandidates[0]?.confidence).toBeGreaterThan(0.5);
  });

  it("detects AES constants and long NOP sleds", async () => {
    const bytes = new Uint8Array(2048);
    bytes.set([0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76], 512);
    bytes.fill(0x90, 1024, 1024 + 64);

    const result = await analyzeObfuscation(new FileByteSource(fileOf(bytes, "constants.bin")), [], []);
    expect(result.cryptoConstants.some((hit) => hit.algorithm.includes("AES"))).toBe(true);
    expect(result.shellcode.some((item) => item.pattern === "NOP sled")).toBe(true);
  });

  it("reports embedded executable headers found beyond offset zero", async () => {
    const result = await analyzeObfuscation(
      new FileByteSource(fileOf(new Uint8Array(64), "container.bin")),
      [],
      [
        { id: "pe", name: "DOS/Windows executable container", offset: 0, length: 2, extensions: [".exe"], confidence: 0.86 },
        { id: "pe", name: "DOS/Windows executable container", offset: 4096, length: 2, extensions: [".exe"], confidence: 0.86 }
      ]
    );
    expect(result.embeddedExecutables).toHaveLength(1);
    expect(result.embeddedExecutables[0]?.offset).toBe(4096);
  });
});

describe("threat scoring", () => {
  const baseInput = {
    filename: "sample.bin",
    size: 4096,
    detectedType: [],
    wholeFileEntropy: 4,
    suspiciousRegions: [],
    capabilities: [],
    iocs: extractIocs([]),
    obfuscation: { xorCandidates: [], entropyCliffs: [], shellcode: [], cryptoConstants: [], embeddedExecutables: [], packerHints: [], scanLimited: false }
  };

  it("returns a minimal band when nothing is raised", () => {
    const assessment = assessThreat({ ...baseInput, size: 100 });
    expect(assessment.findings).toHaveLength(0);
    expect(assessment.band).toBe("Minimal");
    expect(assessment.score).toBe(0);
  });

  it("escalates when injection, packing, and critical indicators combine", () => {
    const assessment = assessThreat({
      ...baseInput,
      detectedType: [{ id: "pe", name: "DOS/Windows executable container", extensions: [".exe"], confidence: 0.86, reason: "MZ", offsets: [0] }],
      wholeFileEntropy: 7.95,
      capabilities: detectCapabilities([stringOf("VirtualAllocEx WriteProcessMemory CreateRemoteThread"), stringOf("IsDebuggerPresent")]),
      iocs: extractIocs([stringOf("vssadmin delete shadows /all")]),
      obfuscation: { ...baseInput.obfuscation, packerHints: ["UPX"], xorCandidates: [{ key: 0x41, confidence: 0.8, offset: 0, evidence: "decodes to an MZ header" }] }
    });
    expect(assessment.score).toBeGreaterThan(48);
    expect(["Elevated", "High", "Critical"]).toContain(assessment.band);
    expect(assessment.findings.some((finding) => finding.severity === "critical")).toBe(true);
  });

  it("caps each category so one noisy signal cannot dominate the score", () => {
    const assessment = assessThreat({
      ...baseInput,
      capabilities: detectCapabilities(Array.from({ length: 60 }, (_, index) => stringOf("IsDebuggerPresent CheckRemoteDebuggerPresent NtQueryInformationProcess", index * 128)))
    });
    expect(assessment.categoryScores["Anti-analysis"]).toBeLessThanOrEqual(22);
    expect(assessment.score).toBeLessThanOrEqual(100);
  });

  it("treats an executable wearing a document extension as critical", () => {
    const assessment = assessThreat({
      ...baseInput,
      filename: "invoice.pdf",
      detectedType: [{ id: "pe", name: "DOS/Windows executable container", extensions: [".exe", ".dll"], confidence: 0.95, reason: "MZ header", offsets: [0] }]
    });
    const finding = assessment.findings.find((item) => item.id === "structure:extension-mismatch");
    expect(finding?.severity).toBe("critical");
  });
});

describe("forensic dossier", () => {
  it("produces a paginated dossier with a contents page and charts", async () => {
    const payload = new TextEncoder().encode(
      "MZ\x90\x00 IsDebuggerPresent VirtualAllocEx CreateRemoteThread " +
      "https://malicious.example.tk/stage2.exe 203.0.113.7 " +
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Persist " +
      "powershell.exe -nop -w hidden -enc QQBCAEMA"
    );
    const analysis = await analyzeFile(fileOf(payload, "dropper.pdf"), { stringMaxResults: 500 });

    expect(analysis.threat.findings.length).toBeGreaterThan(0);
    expect(analysis.byteHistogram).toHaveLength(256);
    expect(analysis.iocs.items.length).toBeGreaterThan(0);

    const report = buildPdfReport(analysis, {
      analystName: "A. Examiner",
      caseId: "CASE-001",
      classification: "INTERNAL USE ONLY",
      hexExcerpt: { offset: 0, bytes: [...payload.slice(0, 64)] }
    });
    expect(report.internal.pages.length - 1).toBeGreaterThan(6);
    expect(report.output("arraybuffer").byteLength).toBeGreaterThan(10_000);
  });
});
