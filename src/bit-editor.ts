export function getBit(byte: number, bitIndex: number): 0 | 1 {
  validate(byte, bitIndex);
  return ((byte >>> bitIndex) & 1) as 0 | 1;
}

export function setBit(byte: number, bitIndex: number, value: boolean): number {
  validate(byte, bitIndex);
  return value ? (byte | (1 << bitIndex)) : (byte & ~(1 << bitIndex));
}

export function toggleBit(byte: number, bitIndex: number): number {
  validate(byte, bitIndex);
  return byte ^ (1 << bitIndex);
}

export function byteToBits(byte: number): string {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new RangeError("Byte must be 0..255.");
  return byte.toString(2).padStart(8, "0");
}

export function bitsToByte(bits: string): number {
  const normalized = bits.replace(/\s+/g, "");
  if (!/^[01]{8}$/.test(normalized)) throw new Error("Expected exactly eight bits.");
  return Number.parseInt(normalized, 2);
}

function validate(byte: number, bitIndex: number): void {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new RangeError("Byte must be 0..255.");
  if (!Number.isInteger(bitIndex) || bitIndex < 0 || bitIndex > 7) throw new RangeError("Bit index must be 0..7.");
}
