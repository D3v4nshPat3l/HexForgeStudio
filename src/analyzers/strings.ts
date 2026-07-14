import type { ByteSource } from "../byte-source";
import { readChunks } from "../byte-source";
import type { ExtractedString, ProgressEvent } from "../types";

export interface StringExtractionOptions {
  minLength?: number;
  maxResults?: number;
  chunkSize?: number;
  includeUtf16?: boolean;
}

function isPrintableAscii(byte: number): boolean {
  return byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126);
}

function pushResult(
  output: ExtractedString[],
  offset: number,
  byteLength: number,
  encoding: ExtractedString["encoding"],
  chars: string[],
  minLength: number,
  maxResults: number
): void {
  if (chars.length < minLength || output.length >= maxResults) return;
  output.push({ offset, byteLength, encoding, value: chars.join("") });
}

export async function extractStrings(
  source: ByteSource,
  options: StringExtractionOptions = {},
  onProgress?: (progress: ProgressEvent) => void
): Promise<ExtractedString[]> {
  const minLength = Math.max(2, options.minLength ?? 4);
  const maxResults = Math.max(1, options.maxResults ?? 10000);
  const chunkSize = Math.max(64 * 1024, options.chunkSize ?? 2 * 1024 * 1024);
  const includeUtf16 = options.includeUtf16 ?? true;
  const output: ExtractedString[] = [];

  let asciiStart = 0;
  let asciiChars: string[] = [];
  let absolute = 0;

  for await (const { offset, bytes } of readChunks(source, chunkSize)) {
    absolute = offset;
    for (let i = 0; i < bytes.length; i += 1) {
      const byte = bytes[i] ?? 0;
      const currentOffset = offset + i;
      if (isPrintableAscii(byte)) {
        if (asciiChars.length === 0) asciiStart = currentOffset;
        asciiChars.push(String.fromCharCode(byte));
      } else {
        pushResult(output, asciiStart, asciiChars.length, "ASCII", asciiChars, minLength, maxResults);
        asciiChars = [];
      }
      if (output.length >= maxResults) break;
    }
    absolute = offset + bytes.length;
    onProgress?.({ stage: "strings", completed: absolute, total: source.size });
    if (output.length >= maxResults) break;
  }
  pushResult(output, asciiStart, asciiChars.length, "ASCII", asciiChars, minLength, maxResults);

  if (!includeUtf16 || output.length >= maxResults) return output;

  for (const endian of ["LE", "BE"] as const) {
    for (const alignment of [0, 1] as const) {
      let chars: string[] = [];
      let start = 0;
      let carry: number | undefined;
      let carryOffset = 0;

      for await (const { offset, bytes } of readChunks(source, chunkSize, alignment)) {
        let index = 0;
        if (carry !== undefined && bytes.length > 0) {
          const first = bytes[0] ?? 0;
          const low = endian === "LE" ? carry : first;
          const high = endian === "LE" ? first : carry;
          const code = low | (high << 8);
          if (code >= 32 && code <= 126) {
            if (chars.length === 0) start = carryOffset;
            chars.push(String.fromCharCode(code));
          } else {
            pushResult(output, start, chars.length * 2, `UTF-16${endian}`, chars, minLength, maxResults);
            chars = [];
          }
          index = 1;
          carry = undefined;
        }

        for (; index + 1 < bytes.length; index += 2) {
          const a = bytes[index] ?? 0;
          const b = bytes[index + 1] ?? 0;
          const low = endian === "LE" ? a : b;
          const high = endian === "LE" ? b : a;
          const code = low | (high << 8);
          const currentOffset = offset + index;
          if (code >= 32 && code <= 126) {
            if (chars.length === 0) start = currentOffset;
            chars.push(String.fromCharCode(code));
          } else {
            pushResult(output, start, chars.length * 2, `UTF-16${endian}`, chars, minLength, maxResults);
            chars = [];
          }
          if (output.length >= maxResults) break;
        }

        if (index < bytes.length) {
          carry = bytes[index];
          carryOffset = offset + index;
        }
        onProgress?.({ stage: `strings-utf16${endian.toLowerCase()}`, completed: offset + bytes.length, total: source.size });
        if (output.length >= maxResults) break;
      }
      pushResult(output, start, chars.length * 2, `UTF-16${endian}`, chars, minLength, maxResults);
      if (output.length >= maxResults) break;
    }
    if (output.length >= maxResults) break;
  }

  const unique = new Map<string, ExtractedString>();
  for (const item of output) unique.set(`${item.offset}:${item.byteLength}:${item.encoding}:${item.value}`, item);
  output.length = 0;
  output.push(...unique.values());

  output.sort((a, b) => a.offset - b.offset || a.encoding.localeCompare(b.encoding));
  return output;
}
