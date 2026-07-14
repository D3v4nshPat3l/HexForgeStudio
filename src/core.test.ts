import { describe, expect, it } from "vitest";
import { FileByteSource } from "./byte-source";
import { identifyFile } from "./analyzers/signatures";
import { analyzeFormatDetails } from "./analyzers/format-details";
import { extractStrings } from "./analyzers/strings";
import { searchBytes } from "./analyzers/search";
import { compareFiles } from "./compare";
import { analyzeFile } from "./auto-analyzer";
import { buildPdfReport } from "./report/pdf-report";

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
