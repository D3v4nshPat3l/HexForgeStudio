import type { ByteSource } from "../byte-source";
import { toHex } from "../byte-source";
import type { FormatMatch } from "../types";

const text = (bytes: Uint8Array, encoding = "latin1"): string => new TextDecoder(encoding).decode(bytes).replace(/\0+$/g, "").trim();
const u16be = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const u16le = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u32be = (b: Uint8Array, o: number): number => (((b[o] ?? 0) * 0x1000000) + ((b[o + 1] ?? 0) << 16) + ((b[o + 2] ?? 0) << 8) + (b[o + 3] ?? 0)) >>> 0;
const u32le = (b: Uint8Array, o: number): number => ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>> 0;
const hex = (value: number): string => `0x${value.toString(16).toUpperCase()}`;

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Unknown";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
}

async function jpegDetails(source: ByteSource): Promise<Record<string, string>> {
  const b = await source.read(0, Math.min(source.size, 2 * 1024 * 1024));
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xFF) { p += 1; continue; }
    const marker = b[p + 1] ?? 0;
    p += 2;
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) continue;
    const length = u16be(b, p);
    if (length < 2 || p + length > b.length) break;
    if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)) {
      return {
        "JPEG coding": marker === 0xC2 ? "Progressive DCT" : "Baseline/extended sequential",
        Dimensions: `${u16be(b, p + 5)} × ${u16be(b, p + 3)}`,
        "Bits per component": String(b[p + 2] ?? 0),
        Components: String(b[p + 7] ?? 0)
      };
    }
    p += length;
  }
  return {};
}

export async function analyzeFormatDetails(source: ByteSource, matches: FormatMatch[], filename: string, mime = ""): Promise<Record<string, string>> {
  const details: Record<string, string> = {};
  const ids = new Set(matches.map((m) => m.id));
  const head = await source.read(0, Math.min(source.size, 4 * 1024 * 1024));
  details["File extension"] = filename.includes(".") ? `.${filename.split(".").pop()?.toLowerCase() ?? ""}` : "None";
  details["Browser MIME"] = mime || "Not provided";
  details["First 32 bytes"] = toHex(head.slice(0, 32));
  if (source.size > 32) details["Last 16 bytes"] = toHex(await source.read(Math.max(0, source.size - 16), Math.min(16, source.size)));

  if (ids.has("png") && head.length >= 29) {
    details.Dimensions = `${u32be(head, 16)} × ${u32be(head, 20)}`;
    details["Bit depth"] = String(head[24] ?? 0);
    const colors: Record<number, string> = {0:"Grayscale",2:"Truecolor",3:"Indexed",4:"Grayscale + alpha",6:"Truecolor + alpha"};
    details["Color type"] = colors[head[25] ?? -1] ?? String(head[25] ?? 0);
    details.Interlace = (head[28] ?? 0) === 1 ? "Adam7" : "None";
  }
  if ((ids.has("gif87") || ids.has("gif89")) && head.length >= 13) {
    details.Version = text(head.slice(3, 6));
    details.Dimensions = `${u16le(head, 6)} × ${u16le(head, 8)}`;
    details["Global color table"] = (head[10]! & 0x80) ? "Present" : "Absent";
  }
  if (ids.has("jpeg")) Object.assign(details, await jpegDetails(source));
  if ((ids.has("tiff-le") || ids.has("tiff-be")) && head.length >= 8) {
    const little = ids.has("tiff-le");
    details["Byte order"] = little ? "Little-endian (Intel)" : "Big-endian (Motorola)";
    details["First IFD offset"] = hex(little ? u32le(head, 4) : u32be(head, 4));
  }
  if (ids.has("ico") && head.length >= 6) details["Image count"] = String(u16le(head, 4));
  if (ids.has("psd") && head.length >= 26) {
    details.Version = String(u16be(head, 4));
    details.Channels = String(u16be(head, 12));
    details.Dimensions = `${u32be(head, 18)} × ${u32be(head, 14)}`;
    details["Bit depth"] = String(u16be(head, 22));
    const modes: Record<number,string> = {0:"Bitmap",1:"Grayscale",2:"Indexed",3:"RGB",4:"CMYK",7:"Multichannel",8:"Duotone",9:"Lab"};
    details["Color mode"] = modes[u16be(head, 24)] ?? String(u16be(head, 24));
  }
  if (ids.has("exr") && head.length >= 8) details.Version = String(u32le(head, 4) & 0xFF);
  if (ids.has("jp2") && head.length >= 24) details.Brand = text(head.slice(20, 24));

  if ((ids.has("wav") || ids.has("avi")) && head.length >= 12) {
    details["RIFF form"] = text(head.slice(8, 12));
    details["Declared RIFF size"] = `${u32le(head, 4) + 8} bytes`;
    if (ids.has("wav")) {
      const fmt = text(head).indexOf("fmt ");
      if (fmt >= 0 && fmt + 24 <= head.length) {
        const channels = u16le(head, fmt + 10);
        const rate = u32le(head, fmt + 12);
        const byteRate = u32le(head, fmt + 16);
        details.Channels = String(channels);
        details["Sample rate"] = `${rate.toLocaleString()} Hz`;
        details["Bits per sample"] = String(u16le(head, fmt + 22));
        if (byteRate > 0) details["Approx. duration"] = formatDuration(source.size / byteRate);
      }
    }
  }
  if (ids.has("flac") && head.length >= 42) {
    const minBlock = u16be(head, 8);
    const maxBlock = u16be(head, 10);
    const packed = head.slice(18, 26);
    const value = packed.reduce((n, byte) => (n << 8n) | BigInt(byte), 0n);
    const sampleRate = Number((value >> 44n) & 0xFFFFFn);
    const channels = Number((value >> 41n) & 0x7n) + 1;
    const bits = Number((value >> 36n) & 0x1Fn) + 1;
    const samples = Number(value & 0xFFFFFFFFFn);
    details["Block size"] = `${minBlock}–${maxBlock} samples`;
    details.Channels = String(channels);
    details["Sample rate"] = `${sampleRate.toLocaleString()} Hz`;
    details["Bits per sample"] = String(bits);
    if (sampleRate > 0) details.Duration = formatDuration(samples / sampleRate);
  }
  if (ids.has("ogg") && head.length >= 27) {
    details.Version = String(head[4] ?? 0);
    details["Header type"] = hex(head[5] ?? 0);
    details["Stream serial"] = hex(u32le(head, 14));
    details["Page sequence"] = String(u32le(head, 18));
  }
  if (ids.has("midi") && head.length >= 14) {
    details.Format = String(u16be(head, 8));
    details.Tracks = String(u16be(head, 10));
    details.Division = hex(u16be(head, 12));
  }
  if (ids.has("aiff") && head.length >= 12) details["FORM type"] = text(head.slice(8, 12));
  if (ids.has("ebml")) {
    const sample = text(head);
    details.Container = sample.toLowerCase().includes("webm") ? "WebM" : sample.toLowerCase().includes("matroska") ? "Matroska" : "EBML";
  }

  if (ids.has("zip")) {
    const sample = text(head);
    if (sample.includes("application/epub+zip")) details["ZIP subtype"] = "EPUB publication";
    else if (sample.includes("application/vnd.oasis.opendocument.spreadsheet")) details["ZIP subtype"] = "OpenDocument Spreadsheet (ODS)";
    else if (sample.includes("application/vnd.oasis.opendocument.presentation")) details["ZIP subtype"] = "OpenDocument Presentation (ODP)";
    else if (sample.includes("word/")) details["ZIP subtype"] = "Office Open XML Word document";
    else if (sample.includes("xl/")) details["ZIP subtype"] = "Office Open XML spreadsheet";
    else if (sample.includes("ppt/")) details["ZIP subtype"] = "Office Open XML presentation";
    else details["ZIP subtype"] = "Generic ZIP-compatible container";
  }
  if (ids.has("tar") && head.length >= 512) {
    details["First entry"] = text(head.slice(0, 100)) || "Empty/unnamed";
    details["TAR variant"] = text(head.slice(257, 265)) || "Legacy";
  }
  if (ids.has("iso9660") && source.size > 0x8050) {
    const pvd = await source.read(0x8000, 2048);
    details["System identifier"] = text(pvd.slice(8, 40));
    details["Volume identifier"] = text(pvd.slice(40, 72));
    details["Logical block size"] = String(u16le(pvd, 128));
  }
  if (ids.has("bzip2") && head.length >= 4) details["Block size"] = `${head[3] ? String.fromCharCode(head[3]) : "?"} × 100 KiB`;
  if (ids.has("xz") && head.length >= 8) details["Stream flags"] = toHex(head.slice(6, 8));

  if (ids.has("elf") && head.length >= 20) {
    const little = head[5] === 1;
    const machine = little ? u16le(head, 18) : u16be(head, 18);
    const machines: Record<number,string> = {3:"x86",8:"MIPS",20:"PowerPC",40:"ARM",62:"x86-64",183:"AArch64",243:"RISC-V"};
    details.Class = head[4] === 2 ? "ELF64" : "ELF32";
    details.Endianness = little ? "Little-endian" : "Big-endian";
    details.Architecture = machines[machine] ?? `Machine ${machine}`;
    details["Object type"] = String(little ? u16le(head, 16) : u16be(head, 16));
  }
  if (["macho-32-be","macho-32-le","macho-64-be","macho-64-le","macho-fat"].some((id) => ids.has(id)) && head.length >= 12) {
    const little = ids.has("macho-32-le") || ids.has("macho-64-le");
    const cpu = little ? u32le(head, 4) : u32be(head, 4);
    const cpus: Record<number,string> = {7:"x86",12:"ARM",0x01000007:"x86-64",0x0100000c:"ARM64"};
    details.Architecture = cpus[cpu] ?? hex(cpu);
    details["Mach-O kind"] = ids.has("macho-fat") ? "Universal/Fat" : ids.has("macho-64-be") || ids.has("macho-64-le") ? "64-bit" : "32-bit";
  }
  if (ids.has("java-class") && head.length >= 8) {
    const major = u16be(head, 6);
    details["Class version"] = `${major}.${u16be(head, 4)}`;
    details["Approx. Java release"] = major >= 45 ? `Java ${major - 44}` : "Pre-Java 1.1";
  }
  if (ids.has("dex") && head.length >= 8) details["DEX version"] = text(head.slice(4, 7));
  if (ids.has("pdf")) {
    const firstLine = text(head.slice(0, Math.min(32, head.length))).split(/\r?\n/)[0] ?? "";
    details["PDF version"] = firstLine.replace("%PDF-", "") || "Unknown";
    const sample = text(head);
    details.Encrypted = sample.includes("/Encrypt") ? "Possibly (encryption dictionary found)" : "Not observed in sampled bytes";
  }
  if (ids.has("qcow2") && head.length >= 24) {
    details.Version = String(u32be(head, 4));
    details["Backing file offset"] = hex(u32be(head, 8));
    details["Cluster bits"] = String(u32be(head, 20));
  }
  if (ids.has("vhdx") && head.length >= 16) details.Signature = text(head.slice(0, 8));
  if (ids.has("dmg")) details.Container = "Apple UDIF disk image";
  if (ids.has("vhd")) details.Container = "Microsoft Virtual Hard Disk";
  if (ids.has("linux-bzimage")) details["Kernel image"] = "x86 Linux boot protocol image";
  if (ids.has("uimage") && head.length >= 64) {
    details["Header CRC"] = hex(u32be(head, 4));
    details.Timestamp = new Date(u32be(head, 8) * 1000).toISOString();
    details["Payload size"] = `${u32be(head, 12).toLocaleString()} bytes`;
    details.Name = text(head.slice(32, 64));
  }
  if (ids.has("xml") || ids.has("html") || ids.has("json") || ids.has("csv") || ids.has("text")) {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(head);
    details["Sampled characters"] = decoded.length.toLocaleString();
    details["Sampled lines"] = decoded.split(/\r?\n/).length.toLocaleString();
    details["Line endings"] = decoded.includes("\r\n") ? "CRLF" : decoded.includes("\n") ? "LF" : decoded.includes("\r") ? "CR" : "No line break observed";
  }
  return details;
}
