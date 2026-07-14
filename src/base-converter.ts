const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function convertBase(value: string, fromBase: number, toBase: number): string {
  validateBase(fromBase);
  validateBase(toBase);
  const normalized = value.trim();
  if (!normalized) throw new Error("Value is empty.");
  const negative = normalized.startsWith("-");
  const body = negative ? normalized.slice(1) : normalized;
  let number = 0n;
  for (const character of body) {
    const digit = DIGITS.indexOf(character);
    if (digit < 0 || digit >= fromBase) throw new Error(`Digit '${character}' is invalid in base ${fromBase}.`);
    number = number * BigInt(fromBase) + BigInt(digit);
  }
  if (number === 0n) return "0";
  let output = "";
  const base = BigInt(toBase);
  while (number > 0n) {
    const remainder = Number(number % base);
    output = (DIGITS[remainder] ?? "0") + output;
    number /= base;
  }
  return negative ? `-${output}` : output;
}

function validateBase(base: number): void {
  if (!Number.isInteger(base) || base < 2 || base > DIGITS.length) throw new RangeError(`Base must be between 2 and ${DIGITS.length}.`);
}
