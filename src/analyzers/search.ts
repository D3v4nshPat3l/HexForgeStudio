import type { ByteSource } from "../byte-source";
import { readChunks, toHex } from "../byte-source";
import type { SearchQuery, SearchResult } from "../types";

interface Pattern { bytes: Uint8Array; mask: Uint8Array; }

function parseHexPattern(input: string): Pattern {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) throw new Error("Hex search pattern is empty.");
  const bytes = new Uint8Array(tokens.length);
  const mask = new Uint8Array(tokens.length);
  tokens.forEach((token, index) => {
    if (token === "?" || token === "??") {
      bytes[index] = 0;
      mask[index] = 0;
      return;
    }
    if (!/^[0-9a-fA-F]{2}$/.test(token)) throw new Error(`Invalid hex token: ${token}`);
    bytes[index] = Number.parseInt(token, 16);
    mask[index] = 0xFF;
  });
  return { bytes, mask };
}

function encodeText(value: string, encoding: SearchQuery["encoding"]): Uint8Array {
  if (!encoding || encoding === "utf-8") return new TextEncoder().encode(value);
  const output = new Uint8Array(value.length * 2);
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (encoding === "utf-16le") {
      output[i * 2] = code & 0xFF;
      output[i * 2 + 1] = code >>> 8;
    } else {
      output[i * 2] = code >>> 8;
      output[i * 2 + 1] = code & 0xFF;
    }
  }
  return output;
}

function encodeNumber(query: SearchQuery): Uint8Array {
  const width = query.byteWidth ?? 4;
  const little = (query.endian ?? "little") === "little";
  const buffer = new ArrayBuffer(width);
  const view = new DataView(buffer);
  if (query.mode === "float") {
    const value = Number(query.value);
    if (!Number.isFinite(value)) throw new Error("Invalid floating-point number.");
    if (width === 4) view.setFloat32(0, value, little);
    else if (width === 8) view.setFloat64(0, value, little);
    else throw new Error("Floating-point search supports 4 or 8 bytes.");
  } else {
    const value = BigInt(query.value);
    if (query.mode === "int") {
      if (width === 1) view.setInt8(0, Number(value));
      else if (width === 2) view.setInt16(0, Number(value), little);
      else if (width === 4) view.setInt32(0, Number(value), little);
      else if (width === 8) view.setBigInt64(0, value, little);
    } else {
      if (width === 1) view.setUint8(0, Number(value));
      else if (width === 2) view.setUint16(0, Number(value), little);
      else if (width === 4) view.setUint32(0, Number(value), little);
      else if (width === 8) view.setBigUint64(0, value, little);
    }
  }
  return new Uint8Array(buffer);
}

function compilePattern(query: SearchQuery): Pattern {
  if (query.mode === "hex") return parseHexPattern(query.value);
  if (query.mode === "text") {
    const bytes = encodeText(query.caseSensitive === false ? query.value.toLowerCase() : query.value, query.encoding);
    return { bytes, mask: new Uint8Array(bytes.length).fill(0xFF) };
  }
  if (query.mode === "regex") throw new Error("Regex search is handled separately.");
  const bytes = encodeNumber(query);
  return { bytes, mask: new Uint8Array(bytes.length).fill(0xFF) };
}

function patternMatches(data: Uint8Array, offset: number, pattern: Pattern, asciiCaseInsensitive = false): boolean {
  if (offset + pattern.bytes.length > data.length) return false;
  for (let i = 0; i < pattern.bytes.length; i += 1) {
    const mask = pattern.mask[i] ?? 0xFF;
    let actual = data[offset + i] ?? 0;
    let expected = pattern.bytes[i] ?? 0;
    if (asciiCaseInsensitive) {
      if (actual >= 0x41 && actual <= 0x5A) actual += 0x20;
      if (expected >= 0x41 && expected <= 0x5A) expected += 0x20;
    }
    if ((actual & mask) !== (expected & mask)) return false;
  }
  return true;
}

export async function searchBytes(source: ByteSource, query: SearchQuery): Promise<SearchResult[]> {
  const start = Math.max(0, query.startOffset ?? 0);
  const end = Math.min(source.size, query.endOffset ?? source.size);
  const maxResults = Math.max(1, query.maxResults ?? 10000);
  if (end < start) throw new RangeError("Search end is before start.");

  if (query.mode === "regex") {
    const limit = Math.min(end - start, 64 * 1024 * 1024);
    if (limit < end - start) throw new Error("Regex text search is limited to 64 MiB. Use byte/text search for larger ranges.");
    const bytes = await source.read(start, limit);
    const text = new TextDecoder(query.encoding === "utf-16le" ? "utf-16le" : "utf-8").decode(bytes);
    const flags = query.caseSensitive === false ? "giu" : "gu";
    const regex = new RegExp(query.value, flags);
    const results: SearchResult[] = [];
    for (const match of text.matchAll(regex)) {
      const characterOffset = match.index ?? 0;
      const prefix = new TextEncoder().encode(text.slice(0, characterOffset));
      const matched = new TextEncoder().encode(match[0]);
      const absolute = start + prefix.length;
      results.push({ offset: absolute, length: matched.length, previewHex: toHex(matched.slice(0, 64)) });
      if (results.length >= maxResults) break;
    }
    return results;
  }

  const pattern = compilePattern(query);
  if (pattern.bytes.length === 0) throw new Error("Search pattern is empty.");
  const chunkSize = 4 * 1024 * 1024;
  let previous = new Uint8Array(0);
  const results: SearchResult[] = [];

  for await (const { offset, bytes } of readChunks(source, chunkSize, start, end)) {
    const combined = new Uint8Array(previous.length + bytes.length);
    combined.set(previous);
    combined.set(bytes, previous.length);
    const baseOffset = offset - previous.length;
    for (let index = 0; index <= combined.length - pattern.bytes.length; index += 1) {
      if (!patternMatches(combined, index, pattern, query.mode === "text" && query.caseSensitive === false)) continue;
      const absolute = baseOffset + index;
      if (absolute < start || absolute + pattern.bytes.length > end) continue;
      results.push({ offset: absolute, length: pattern.bytes.length, previewHex: toHex(combined.slice(index, index + Math.min(pattern.bytes.length, 64))) });
      if (results.length >= maxResults) return results;
    }
    previous = combined.slice(Math.max(0, combined.length - pattern.bytes.length + 1));
  }
  return results;
}
