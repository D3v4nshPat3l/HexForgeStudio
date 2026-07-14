export interface ByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export class FileByteSource implements ByteSource {
  public readonly size: number;

  constructor(private readonly file: Blob) {
    this.size = file.size;
  }

  async read(offset: number, length: number): Promise<Uint8Array> {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)) {
      throw new RangeError("Offset and length must be safe integers.");
    }
    if (offset < 0 || length < 0 || offset > this.size) {
      throw new RangeError("Invalid byte range.");
    }
    const end = Math.min(this.size, offset + length);
    return new Uint8Array(await this.file.slice(offset, end).arrayBuffer());
  }
}

export async function* readChunks(
  source: ByteSource,
  chunkSize = 4 * 1024 * 1024,
  start = 0,
  end = source.size
): AsyncGenerator<{ offset: number; bytes: Uint8Array }> {
  if (chunkSize <= 0) throw new RangeError("chunkSize must be positive.");
  for (let offset = start; offset < end; offset += chunkSize) {
    const length = Math.min(chunkSize, end - offset);
    yield { offset, bytes: await source.read(offset, length) };
  }
}

export function toHex(bytes: Uint8Array, separator = " "): string {
  const table = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, "0").toUpperCase());
  const parts = new Array<string>(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    parts[index] = table[bytes[index] ?? 0] ?? "00";
  }
  return parts.join(separator);
}
