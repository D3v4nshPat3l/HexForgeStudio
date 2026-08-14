export type SourceLanguage = "c" | "cpp" | "rust" | "python" | "javascript" | "typescript" | "java" | "go" | "csharp";

function hex(byte: number): string { return `0x${byte.toString(16).padStart(2, "0").toUpperCase()}`; }
function wrap(items: string[], width = 12, indent = "  "): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += width) lines.push(`${indent}${items.slice(i, i + width).join(", ")}`);
  return lines.join(",\n");
}

export function exportAsSourceCode(bytes: Uint8Array, language: SourceLanguage, variableName = "data"): string {
  const values = Array.from(bytes, hex);
  const body = wrap(values);
  switch (language) {
    case "c": return `const unsigned char ${variableName}[] = {\n${body}\n};\nconst unsigned long ${variableName}_len = ${bytes.length};\n`;
    case "cpp": return `#include <array>\n#include <cstdint>\n\nconstexpr std::array<std::uint8_t, ${bytes.length}> ${variableName} = {\n${body}\n};\n`;
    case "rust": return `pub const ${variableName.toUpperCase()}: [u8; ${bytes.length}] = [\n${body}\n];\n`;
    case "python": return `${variableName} = bytes([\n${body}\n])\n`;
    case "javascript": return `const ${variableName} = new Uint8Array([\n${body}\n]);\n`;
    case "typescript": return `export const ${variableName}: Uint8Array = new Uint8Array([\n${body}\n]);\n`;
    case "java": return `byte[] ${variableName} = new byte[] {\n${wrap(values.map((item) => `(byte) ${item}`))}\n};\n`;
    case "go": return `var ${variableName} = []byte{\n${body}\n}\n`;
    case "csharp": return `byte[] ${variableName} = new byte[] {\n${body}\n};\n`;
  }
}
