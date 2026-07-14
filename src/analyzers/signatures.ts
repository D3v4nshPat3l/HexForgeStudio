import type { ByteSource } from "../byte-source";
import { readChunks } from "../byte-source";
import type { FormatMatch, SignatureHit } from "../types";

interface SignatureDefinition {
  id: string;
  name: string;
  extensions: string[];
  mime?: string;
  pattern: number[];
  mask?: number[];
  offset?: number;
  scan?: boolean;
  confidence?: number;
  reason?: string;
}

const ASCII = (value: string): number[] => Array.from(value, (character) => character.charCodeAt(0));

export const BUILTIN_SIGNATURES: SignatureDefinition[] = [
  { id: "cr2", name: "Canon RAW 2 image", extensions: [".cr2"], mime: "image/x-canon-cr2", pattern: [0x49,0x49,0x2A,0x00,0x10,0x00,0x00,0x00,0x43,0x52,0x02,0x00], offset: 0, confidence: 0.99 },
  { id: "bmp", name: "Windows bitmap", extensions: [".bmp", ".dib"], mime: "image/bmp", pattern: ASCII("BM"), offset: 0, confidence: 0.98, scan: true },
  { id: "7z", name: "7-Zip archive", extensions: [".7z"], mime: "application/x-7z-compressed", pattern: [0x37,0x7A,0xBC,0xAF,0x27,0x1C], offset: 0, confidence: 0.99, scan: true },
  { id: "rar4", name: "RAR archive v1.5–4.x", extensions: [".rar"], mime: "application/vnd.rar", pattern: [0x52,0x61,0x72,0x21,0x1A,0x07,0x00], offset: 0, confidence: 0.99, scan: true },
  { id: "rar5", name: "RAR archive v5+", extensions: [".rar"], mime: "application/vnd.rar", pattern: [0x52,0x61,0x72,0x21,0x1A,0x07,0x01,0x00], offset: 0, confidence: 0.99, scan: true },
  { id: "tiff-le", name: "TIFF image (little-endian)", extensions: [".tif", ".tiff"], mime: "image/tiff", pattern: [0x49,0x49,0x2A,0x00], offset: 0, confidence: 0.99 },
  { id: "tiff-be", name: "TIFF image (big-endian)", extensions: [".tif", ".tiff"], mime: "image/tiff", pattern: [0x4D,0x4D,0x00,0x2A], offset: 0, confidence: 0.99 },
  { id: "ico", name: "Windows icon", extensions: [".ico"], mime: "image/x-icon", pattern: [0,0,1,0], offset: 0, confidence: 0.99 },
  { id: "psd", name: "Adobe Photoshop document", extensions: [".psd"], mime: "image/vnd.adobe.photoshop", pattern: ASCII("8BPS"), offset: 0, confidence: 0.99 },
  { id: "jp2", name: "JPEG 2000 JP2", extensions: [".jp2"], mime: "image/jp2", pattern: [0,0,0,0x0C,0x6A,0x50,0x20,0x20,0x0D,0x0A,0x87,0x0A], offset: 0, confidence: 0.99 },
  { id: "isobmff", name: "ISO Base Media file", extensions: [".mp4", ".m4a", ".mov", ".heic", ".avif"], pattern: [0,0,0,0,0x66,0x74,0x79,0x70], mask: [0,0,0,0,255,255,255,255], offset: 0, confidence: 0.9 },
  { id: "j2k", name: "JPEG 2000 codestream", extensions: [".j2k", ".j2c"], mime: "image/j2c", pattern: [0xFF,0x4F,0xFF,0x51], offset: 0, confidence: 0.97 },
  { id: "exr", name: "OpenEXR image", extensions: [".exr"], mime: "image/x-exr", pattern: [0x76,0x2F,0x31,0x01], offset: 0, confidence: 0.99 },
  { id: "bzip2", name: "BZIP2 compressed data", extensions: [".bz2"], mime: "application/x-bzip2", pattern: ASCII("BZh"), offset: 0, confidence: 0.99 },
  { id: "xz", name: "XZ compressed data", extensions: [".xz"], mime: "application/x-xz", pattern: [0xFD,0x37,0x7A,0x58,0x5A,0x00], offset: 0, confidence: 0.99 },
  { id: "cab", name: "Microsoft Cabinet archive", extensions: [".cab"], mime: "application/vnd.ms-cab-compressed", pattern: ASCII("MSCF"), offset: 0, confidence: 0.99 },
  { id: "vhdx", name: "Microsoft VHDX disk image", extensions: [".vhdx"], pattern: ASCII("vhdxfile"), offset: 0, confidence: 0.99 },
  { id: "qcow2", name: "QEMU QCOW2 disk image", extensions: [".qcow2"], pattern: [0x51,0x46,0x49,0xFB], offset: 0, confidence: 0.99 },
  { id: "wav", name: "WAVE audio", extensions: [".wav"], mime: "audio/wav", pattern: [...ASCII("RIFF"),0,0,0,0,...ASCII("WAVE")], mask: [255,255,255,255,0,0,0,0,255,255,255,255], offset: 0, confidence: 0.99 },
  { id: "flac", name: "FLAC audio", extensions: [".flac"], mime: "audio/flac", pattern: ASCII("fLaC"), offset: 0, confidence: 0.99 },
  { id: "ogg", name: "Ogg container", extensions: [".ogg", ".oga", ".ogv", ".ogx"], mime: "application/ogg", pattern: ASCII("OggS"), offset: 0, confidence: 0.99 },
  { id: "aac-adif", name: "AAC ADIF audio", extensions: [".aac"], mime: "audio/aac", pattern: ASCII("ADIF"), offset: 0, confidence: 0.97 },
  { id: "aac-adts", name: "AAC ADTS audio", extensions: [".aac"], mime: "audio/aac", pattern: [0xFF,0xF0], mask: [0xFF,0xF6], offset: 0, confidence: 0.9 },
  { id: "aiff", name: "AIFF/AIFC audio", extensions: [".aiff", ".aif", ".aifc"], mime: "audio/aiff", pattern: [...ASCII("FORM"),0,0,0,0,0x41,0x49,0x46,0], mask: [255,255,255,255,0,0,0,0,255,255,255,0], offset: 0, confidence: 0.97 },
  { id: "midi", name: "Standard MIDI file", extensions: [".mid", ".midi"], mime: "audio/midi", pattern: ASCII("MThd"), offset: 0, confidence: 0.99 },
  { id: "avi", name: "AVI video", extensions: [".avi"], mime: "video/x-msvideo", pattern: [...ASCII("RIFF"),0,0,0,0,...ASCII("AVI ")], mask: [255,255,255,255,0,0,0,0,255,255,255,255], offset: 0, confidence: 0.99 },
  { id: "ebml", name: "EBML container (Matroska/WebM family)", extensions: [".mkv", ".webm"], pattern: [0x1A,0x45,0xDF,0xA3], offset: 0, confidence: 0.94 },
  { id: "mpeg-ps", name: "MPEG program stream", extensions: [".mpeg", ".mpg", ".vob"], mime: "video/mpeg", pattern: [0,0,1,0xBA], offset: 0, confidence: 0.96 },
  { id: "mpeg-video", name: "MPEG elementary video", extensions: [".mpeg", ".mpg", ".m1v", ".m2v"], mime: "video/mpeg", pattern: [0,0,1,0xB3], offset: 0, confidence: 0.94 },
  { id: "flv", name: "Flash Video", extensions: [".flv"], mime: "video/x-flv", pattern: ASCII("FLV"), offset: 0, confidence: 0.99 },
  { id: "asf-wmv", name: "ASF/WMV container", extensions: [".wmv", ".asf", ".wma"], pattern: [0x30,0x26,0xB2,0x75,0x8E,0x66,0xCF,0x11,0xA6,0xD9,0x00,0xAA,0x00,0x62,0xCE,0x6C], offset: 0, confidence: 0.99 },
  { id: "macho-32-be", name: "Mach-O 32-bit", extensions: [], pattern: [0xFE,0xED,0xFA,0xCE], offset: 0, confidence: 0.99 },
  { id: "macho-32-le", name: "Mach-O 32-bit reversed", extensions: [], pattern: [0xCE,0xFA,0xED,0xFE], offset: 0, confidence: 0.99 },
  { id: "macho-64-be", name: "Mach-O 64-bit", extensions: [], pattern: [0xFE,0xED,0xFA,0xCF], offset: 0, confidence: 0.99 },
  { id: "macho-64-le", name: "Mach-O 64-bit reversed", extensions: [], pattern: [0xCF,0xFA,0xED,0xFE], offset: 0, confidence: 0.99 },
  { id: "macho-fat", name: "Mach-O universal binary", extensions: [], pattern: [0xCA,0xFE,0xBA,0xBE], offset: 0, confidence: 0.96 },
  { id: "java-class", name: "Java class file", extensions: [".class"], mime: "application/java-vm", pattern: [0xCA,0xFE,0xBA,0xBE], offset: 0, confidence: 0.9, reason: "CAFEBABE; distinguish from Mach-O universal by validating following fields." },
  { id: "dex", name: "Android DEX", extensions: [".dex"], pattern: [0x64,0x65,0x78,0x0A,0x30,0x33], offset: 0, confidence: 0.96 },
  { id: "chm", name: "Compiled HTML Help", extensions: [".chm"], mime: "application/vnd.ms-htmlhelp", pattern: ASCII("ITSF"), offset: 0, confidence: 0.99 },
  { id: "djvu", name: "DjVu document", extensions: [".djvu", ".djv"], mime: "image/vnd.djvu", pattern: ASCII("AT&TFORM"), offset: 0, confidence: 0.99 },
  { id: "postscript", name: "PostScript/EPS", extensions: [".ps", ".eps"], mime: "application/postscript", pattern: ASCII("%!PS"), offset: 0, confidence: 0.98 },
  { id: "pdf", name: "PDF document", extensions: [".pdf"], mime: "application/pdf", pattern: ASCII("%PDF-"), offset: 0, confidence: 0.99, scan: true },
  { id: "png", name: "PNG image", extensions: [".png"], mime: "image/png", pattern: [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A], offset: 0, confidence: 0.99, scan: true },
  { id: "jpeg", name: "JPEG image", extensions: [".jpg", ".jpeg"], mime: "image/jpeg", pattern: [0xFF,0xD8,0xFF], offset: 0, confidence: 0.98, scan: true },
  { id: "gif87", name: "GIF87a image", extensions: [".gif"], mime: "image/gif", pattern: ASCII("GIF87a"), offset: 0, confidence: 0.99, scan: true },
  { id: "gif89", name: "GIF89a image", extensions: [".gif"], mime: "image/gif", pattern: ASCII("GIF89a"), offset: 0, confidence: 0.99, scan: true },
  { id: "zip", name: "ZIP-compatible container", extensions: [".zip", ".epub", ".ods", ".odp", ".docx", ".xlsx", ".pptx"], mime: "application/zip", pattern: [0x50,0x4B,0x03,0x04], offset: 0, confidence: 0.88, scan: true },
  { id: "gzip", name: "GZIP compressed data", extensions: [".gz", ".tgz"], mime: "application/gzip", pattern: [0x1F,0x8B,0x08], offset: 0, confidence: 0.99, scan: true },
  { id: "elf", name: "ELF executable/object", extensions: [".elf", ".so", ".o"], pattern: [0x7F,0x45,0x4C,0x46], offset: 0, confidence: 0.99, scan: true },
  { id: "pe", name: "DOS/Windows executable container", extensions: [".exe", ".dll", ".sys", ".efi"], pattern: [0x4D,0x5A], offset: 0, confidence: 0.86, scan: true },
  { id: "uimage", name: "U-Boot legacy image", extensions: [".uimg", ".img"], pattern: [0x27,0x05,0x19,0x56], offset: 0, confidence: 0.99 },
  { id: "mp3-id3", name: "MP3 with ID3 tag", extensions: [".mp3"], mime: "audio/mpeg", pattern: ASCII("ID3"), offset: 0, confidence: 0.96 },
  { id: "mp3-frame", name: "MP3/MPEG audio frame", extensions: [".mp3"], mime: "audio/mpeg", pattern: [0xFF,0xE0], mask: [0xFF,0xE0], offset: 0, confidence: 0.86 }
];

function matchesAt(bytes: Uint8Array, offset: number, definition: SignatureDefinition): boolean {
  const mask = definition.mask;
  if (offset < 0 || offset + definition.pattern.length > bytes.length) return false;
  for (let i = 0; i < definition.pattern.length; i += 1) {
    const expected = definition.pattern[i] ?? 0;
    const actual = bytes[offset + i] ?? 0;
    const appliedMask = mask?.[i] ?? 0xFF;
    if ((actual & appliedMask) !== (expected & appliedMask)) return false;
  }
  return true;
}

async function detectSpecialCases(source: ByteSource, filename: string): Promise<FormatMatch[]> {
  const results: FormatMatch[] = [];
  const lowerName = filename.toLowerCase();
  const headLength = Math.min(source.size, 1024 * 1024);
  const head = await source.read(0, headLength);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head).replace(/^\uFEFF/, "").trimStart();

  if (/^<\?xml\b|^<[A-Za-z_][\w:.-]*(?:\s|>)/.test(text)) {
    results.push({ id: "xml", name: "XML document", extensions: [".xml"], mime: "application/xml", confidence: /^<\?xml/.test(text) ? 0.98 : 0.82, reason: "XML declaration or well-formed-looking root tag", offsets: [0] });
  }
  if (/^<svg\b/i.test(text) || /^<\?xml[\s\S]{0,500}<svg\b/i.test(text)) {
    results.push({ id: "svg", name: "Scalable Vector Graphics", extensions: [".svg"], mime: "image/svg+xml", confidence: 0.98, reason: "SVG root element", offsets: [0] });
  }
  if (/^<!doctype\s+html\b|^<html\b/i.test(text)) {
    results.push({ id: "html", name: "HTML document", extensions: [".html", ".htm"], mime: "text/html", confidence: 0.98, reason: "HTML doctype/root element", offsets: [0] });
  }
  try {
    if (text.length > 1 && (text.startsWith("{") || text.startsWith("["))) {
      JSON.parse(text);
      results.push({ id: "json", name: "JSON document", extensions: [".json"], mime: "application/json", confidence: 0.97, reason: "Content parses as JSON", offsets: [0] });
    }
  } catch { /* not JSON */ }

  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4B) {
    if (text.includes("application/epub+zip")) results.push({ id: "epub", name: "EPUB publication", extensions: [".epub"], mime: "application/epub+zip", confidence: 0.99, reason: "EPUB mimetype entry found inside ZIP container", offsets: [0] });
    if (text.includes("application/vnd.oasis.opendocument.spreadsheet")) results.push({ id: "ods", name: "OpenDocument Spreadsheet", extensions: [".ods"], mime: "application/vnd.oasis.opendocument.spreadsheet", confidence: 0.99, reason: "ODS mimetype entry found inside ZIP container", offsets: [0] });
    if (text.includes("application/vnd.oasis.opendocument.presentation")) results.push({ id: "odp", name: "OpenDocument Presentation", extensions: [".odp"], mime: "application/vnd.oasis.opendocument.presentation", confidence: 0.99, reason: "ODP mimetype entry found inside ZIP container", offsets: [0] });
  }

  if (/^:[0-9A-Fa-f]{8}[0-9A-Fa-f]{2}/.test(text)) results.push({ id: "intel-hex", name: "Intel HEX firmware image", extensions: [".hex", ".ihx"], mime: "text/plain", confidence: 0.97, reason: "Intel HEX record syntax", offsets: [0] });
  if (/^S[0-9][0-9A-Fa-f]{4,}/.test(text)) results.push({ id: "srec", name: "Motorola S-record firmware image", extensions: [".srec", ".s19", ".s28", ".s37"], mime: "text/plain", confidence: 0.97, reason: "Motorola S-record syntax", offsets: [0] });

  if (/\.csv$/i.test(lowerName)) {
    const lines = text.split(/\r?\n/).slice(0, 20).filter(Boolean);
    const widths = lines.map((line) => (line.match(/,/g) ?? []).length);
    const stable = widths.length >= 2 && widths[0]! > 0 && widths.every((width) => width === widths[0]);
    if (stable) results.push({ id: "csv", name: "Comma-separated values", extensions: [".csv"], mime: "text/csv", confidence: 0.82, reason: "Consistent comma-delimited columns in sampled lines", offsets: [0] });
  }

  const rawExtensionNames: Record<string, string> = { ".nef": "Nikon Electronic Format RAW image", ".arw": "Sony Alpha RAW image", ".dng": "Digital Negative RAW image", ".orf": "Olympus RAW image", ".rw2": "Panasonic RAW image", ".raf": "Fujifilm RAW image", ".cr3": "Canon RAW 3 image" };
  if (rawExtensionNames[lowerName.slice(lowerName.lastIndexOf("."))] && (head[0] === 0x49 || head[0] === 0x4D || lowerName.endsWith(".raf") || lowerName.endsWith(".cr3"))) {
    const extension = lowerName.slice(lowerName.lastIndexOf("."));
    results.push({ id: `raw-${extension.slice(1)}`, name: rawExtensionNames[extension]!, extensions: [extension], confidence: 0.82, reason: "RAW subtype inferred from extension and compatible container header; vendor formats often share TIFF/ISO-BMFF structures", offsets: [0] });
  }

  const printable = head.length === 0 ? 1 : head.reduce((count, byte) => count + ((byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) ? 1 : 0), 0) / head.length;
  if (printable > 0.95 && !results.some((item) => ["xml", "html", "json", "csv"].includes(item.id))) {
    results.push({ id: "text", name: "Plain text", extensions: [".txt"], mime: "text/plain", confidence: Math.min(0.93, printable), reason: `${Math.round(printable * 100)}% printable bytes in sample`, offsets: [0] });
  }

  if (source.size >= 0x8060) {
    for (const offset of [0x8001, 0x8801, 0x9001]) {
      const bytes = await source.read(offset, 5);
      if (new TextDecoder().decode(bytes) === "CD001") {
        results.push({ id: "iso9660", name: "ISO 9660 optical disc image", extensions: [".iso"], confidence: 0.99, reason: `CD001 volume descriptor at 0x${offset.toString(16)}`, offsets: [offset] });
        break;
      }
    }
  }
  if (source.size >= 512) {
    const tail = await source.read(Math.max(0, source.size - 512), Math.min(512, source.size));
    const tailText = new TextDecoder("latin1").decode(tail);
    const koly = tailText.indexOf("koly");
    if (koly >= 0) results.push({ id: "dmg", name: "Apple DMG disk image", extensions: [".dmg"], confidence: 0.98, reason: "UDIF koly trailer", offsets: [source.size - tail.length + koly] });
    const conectix = tailText.indexOf("conectix");
    if (conectix >= 0) results.push({ id: "vhd", name: "Microsoft VHD disk image", extensions: [".vhd"], confidence: 0.98, reason: "VHD conectix footer", offsets: [source.size - tail.length + conectix] });
  }
  if (source.size > 265) {
    const tar = await source.read(257, 6);
    const marker = new TextDecoder("latin1").decode(tar);
    if (marker.startsWith("ustar")) results.push({ id: "tar", name: "TAR archive", extensions: [".tar"], mime: "application/x-tar", confidence: 0.99, reason: "ustar marker at offset 257", offsets: [257] });
  }
  if (source.size >= 0x2C) {
    const firmwareMarker = await source.read(0x28, 4);
    if (new TextDecoder("latin1").decode(firmwareMarker) === "_FVH") {
      results.push({ id: "uefi-fv", name: "UEFI firmware volume", extensions: [".fd", ".fv", ".bin", ".rom"], confidence: 0.99, reason: "UEFI firmware volume _FVH signature at offset 0x28", offsets: [0x28] });
    }
  }
  if (source.size > 0x206) {
    const kernelMarker = await source.read(0x202, 4);
    if (new TextDecoder("latin1").decode(kernelMarker) === "HdrS") {
      results.push({ id: "linux-bzimage", name: "Linux x86 bzImage kernel", extensions: [".bin", ".img"], confidence: 0.98, reason: "HdrS setup header marker at offset 0x202", offsets: [0x202] });
    }
  }
  return results;
}

export async function identifyFile(source: ByteSource, filename = ""): Promise<FormatMatch[]> {
  const maxHeader = Math.max(...BUILTIN_SIGNATURES.filter((item) => (item.offset ?? 0) === 0).map((item) => item.pattern.length), 64);
  const header = await source.read(0, Math.min(maxHeader, source.size));
  const matches: FormatMatch[] = [];
  for (const definition of BUILTIN_SIGNATURES) {
    const fixedOffset = definition.offset ?? 0;
    if (fixedOffset !== 0 || !matchesAt(header, 0, definition)) continue;
    matches.push({
      id: definition.id,
      name: definition.name,
      extensions: definition.extensions,
      ...(definition.mime ? { mime: definition.mime } : {}),
      confidence: definition.confidence ?? 0.9,
      reason: definition.reason ?? `Matched ${definition.pattern.length}-byte signature at file start`,
      offsets: [0]
    });
  }
  matches.push(...await detectSpecialCases(source, filename));

  const extension = filename.includes(".") ? `.${filename.split(".").pop()?.toLowerCase() ?? ""}` : "";
  if (extension === ".efi" && matches.some((item) => item.id === "pe")) {
    matches.push({ id: "uefi-pe", name: "UEFI Portable Executable image", extensions: [".efi"], confidence: 0.97, reason: "PE/COFF structure with .efi filename", offsets: [0] });
  }
  for (const match of matches) {
    if (extension && match.extensions.includes(extension)) match.confidence = Math.min(1, match.confidence + 0.02);
  }
  return matches.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

export async function scanEmbeddedSignatures(
  source: ByteSource,
  scanLimit = source.size,
  chunkSize = 2 * 1024 * 1024,
  maxHits = 5000
): Promise<SignatureHit[]> {
  const definitions = BUILTIN_SIGNATURES.filter((item) => item.scan);
  const maxPattern = Math.max(...definitions.map((item) => item.pattern.length));
  const hits: SignatureHit[] = [];
  let previous = new Uint8Array(0);
  const end = Math.min(source.size, scanLimit);

  for await (const { offset, bytes } of readChunks(source, chunkSize, 0, end)) {
    const combined = new Uint8Array(previous.length + bytes.length);
    combined.set(previous, 0);
    combined.set(bytes, previous.length);
    const baseOffset = offset - previous.length;

    for (let index = 0; index < combined.length; index += 1) {
      for (const definition of definitions) {
        if (!matchesAt(combined, index, definition)) continue;
        const absoluteOffset = baseOffset + index;
        if (absoluteOffset < 0) continue;
        hits.push({ id: definition.id, name: definition.name, offset: absoluteOffset, length: definition.pattern.length, extensions: definition.extensions, confidence: definition.confidence ?? 0.9 });
        if (hits.length >= maxHits) return deduplicateHits(hits);
      }
    }
    previous = combined.slice(Math.max(0, combined.length - maxPattern + 1));
  }
  return deduplicateHits(hits);
}

function deduplicateHits(hits: SignatureHit[]): SignatureHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.id}:${hit.offset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.offset - b.offset || b.confidence - a.confidence);
}
