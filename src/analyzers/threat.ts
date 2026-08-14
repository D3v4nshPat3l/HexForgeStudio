import { summarizeCapabilities } from "./capabilities";
import type {
  CapabilityHit,
  FormatMatch,
  IocReport,
  ObfuscationAnalysis,
  PeAnalysis,
  Severity,
  SuspiciousRegion,
  ThreatAssessment,
  ThreatBand,
  ThreatFinding
} from "../types";

/**
 * Threat scoring.
 *
 * Individual signals are converted into weighted findings, the weights are summed
 * per category, and each category is capped so no single noisy signal can dominate
 * the total. The result is an ordinal triage aid, not a verdict: a high score means
 * "look at this first", never "this is malware".
 */

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Per-category ceilings. The sum exceeds 100 so the final score is clamped after aggregation. */
const CATEGORY_CAPS: Record<string, number> = {
  "Anti-analysis": 22,
  "Code execution": 26,
  "Obfuscation": 22,
  "Persistence": 14,
  "Credential & surveillance": 22,
  "Destructive": 26,
  "Network": 14,
  "Structure": 18,
  "Content": 12
};

interface Signal {
  finding: Omit<ThreatFinding, "weight">;
  weight: number;
}

export interface ThreatInput {
  filename: string;
  size: number;
  detectedType: FormatMatch[];
  wholeFileEntropy: number;
  suspiciousRegions: SuspiciousRegion[];
  capabilities: CapabilityHit[];
  iocs: IocReport;
  obfuscation: ObfuscationAnalysis;
  pe?: PeAnalysis | undefined;
}

/** Maps a capability category onto the scoring category and its per-hit weight. */
const CAPABILITY_WEIGHTS: Record<string, { category: string; base: number; perExtra: number; max: number }> = {
  "Anti-debugging": { category: "Anti-analysis", base: 7, perExtra: 1.2, max: 14 },
  "Virtualization / sandbox evasion": { category: "Anti-analysis", base: 8, perExtra: 1.4, max: 16 },
  "Timing / execution stalling": { category: "Anti-analysis", base: 3, perExtra: 0.4, max: 6 },
  "Code injection": { category: "Code execution", base: 10, perExtra: 1.5, max: 20 },
  "Privilege escalation": { category: "Code execution", base: 6, perExtra: 1, max: 12 },
  "Persistence": { category: "Persistence", base: 6, perExtra: 1, max: 12 },
  "Credential access": { category: "Credential & surveillance", base: 10, perExtra: 1.5, max: 18 },
  "Keylogging / surveillance": { category: "Credential & surveillance", base: 9, perExtra: 1.4, max: 16 },
  "Network / command and control": { category: "Network", base: 4, perExtra: 0.5, max: 9 },
  Cryptography: { category: "Content", base: 2, perExtra: 0.3, max: 5 },
  "Destructive / ransomware": { category: "Destructive", base: 14, perExtra: 2, max: 24 },
  "Discovery / reconnaissance": { category: "Content", base: 2, perExtra: 0.3, max: 5 },
  "Defence evasion": { category: "Anti-analysis", base: 9, perExtra: 1.4, max: 16 },
  "Scripting / interpreter staging": { category: "Code execution", base: 6, perExtra: 1, max: 13 }
};

function severityFor(weight: number): Severity {
  if (weight >= 14) return "critical";
  if (weight >= 8) return "high";
  if (weight >= 4) return "medium";
  if (weight >= 1.5) return "low";
  return "info";
}

function bandFor(score: number): ThreatBand {
  if (score >= 85) return "Critical";
  if (score >= 68) return "High";
  if (score >= 48) return "Elevated";
  if (score >= 28) return "Moderate";
  if (score >= 12) return "Low";
  return "Minimal";
}

function collectSignals(input: ThreatInput): Signal[] {
  const signals: Signal[] = [];
  const isExecutable = input.detectedType.some((match) => ["pe", "elf", "macho-32-be", "macho-32-le", "macho-64-be", "macho-64-le", "macho-fat", "dex", "java-class", "uefi-pe"].includes(match.id));

  // --- Capability groups -----------------------------------------------------
  for (const summary of summarizeCapabilities(input.capabilities)) {
    const rule = CAPABILITY_WEIGHTS[summary.category];
    if (!rule) continue;
    const weight = Math.min(rule.max, rule.base + (summary.count - 1) * rule.perExtra);
    const offsets = input.capabilities.filter((hit) => hit.category === summary.category).slice(0, 12).map((hit) => hit.offset);
    const indicators = [...new Set(input.capabilities.filter((hit) => hit.category === summary.category).map((hit) => hit.indicator))].slice(0, 8);
    signals.push({
      weight,
      finding: {
        id: `capability:${summary.category}`,
        title: `${summary.category} indicators present`,
        category: rule.category,
        severity: summary.severity,
        detail: `${summary.count} matching literal${summary.count === 1 ? "" : "s"} found, including ${indicators.join(", ")}.`,
        offsets,
        recommendation: "Confirm the referenced symbols are genuinely imported and reachable before treating this as behaviour; string presence alone does not prove execution."
      }
    });
  }

  // --- Obfuscation and anti-analysis ----------------------------------------
  const bestXor = input.obfuscation.xorCandidates[0];
  if (bestXor) {
    const weight = Math.min(16, 8 + bestXor.confidence * 8);
    signals.push({
      weight,
      finding: {
        id: "obfuscation:xor",
        title: "Single-byte XOR encoding detected",
        category: "Obfuscation",
        severity: "high",
        detail: `Key 0x${bestXor.key.toString(16).toUpperCase().padStart(2, "0")} at ${Math.round(bestXor.confidence * 100)}% confidence — ${bestXor.evidence}.`,
        offsets: [bestXor.offset],
        recommendation: "Decode the region with the recovered key and re-run identification against the plaintext result."
      }
    });
  }

  if (input.obfuscation.packerHints.length > 0) {
    signals.push({
      weight: Math.min(14, 7 + input.obfuscation.packerHints.length * 2),
      finding: {
        id: "obfuscation:packer",
        title: "Packer or protector artefacts present",
        category: "Obfuscation",
        severity: "high",
        detail: `Markers consistent with ${input.obfuscation.packerHints.join(", ")}.`,
        offsets: [],
        recommendation: "Unpack in an isolated environment before static conclusions; packed sections hide the real import table and code."
      }
    });
  }

  const shellcodeHigh = input.obfuscation.shellcode.filter((item) => item.severity === "high");
  if (shellcodeHigh.length > 0) {
    signals.push({
      weight: Math.min(18, 9 + shellcodeHigh.length * 1.5),
      finding: {
        id: "obfuscation:shellcode",
        title: "Position-independent code patterns detected",
        category: "Code execution",
        severity: "critical",
        detail: `${shellcodeHigh.length} high-confidence pattern${shellcodeHigh.length === 1 ? "" : "s"} including ${[...new Set(shellcodeHigh.map((item) => item.pattern))].slice(0, 4).join(", ")}.`,
        offsets: shellcodeHigh.slice(0, 12).map((item) => item.offset),
        recommendation: "Disassemble the flagged offsets. GetPC stubs and manual PEB walks are rare in benign data files."
      }
    });
  } else if (input.obfuscation.shellcode.length > 0) {
    signals.push({
      weight: 3,
      finding: {
        id: "obfuscation:shellcode-weak",
        title: "Low-confidence code-like patterns",
        category: "Code execution",
        severity: "low",
        detail: `${input.obfuscation.shellcode.length} weaker pattern match${input.obfuscation.shellcode.length === 1 ? "" : "es"} such as sleds or syscall gates.`,
        offsets: input.obfuscation.shellcode.slice(0, 8).map((item) => item.offset),
        recommendation: "Treat as context only; these byte sequences occur naturally in compiled code and compressed data."
      }
    });
  }

  if (input.obfuscation.embeddedExecutables.length > 0) {
    const count = input.obfuscation.embeddedExecutables.length;
    signals.push({
      weight: Math.min(16, 8 + count * 1.5),
      finding: {
        id: "structure:embedded-executable",
        title: "Executable header embedded at a non-zero offset",
        category: "Structure",
        severity: "high",
        detail: `${count} embedded executable header${count === 1 ? "" : "s"} found, first at 0x${(input.obfuscation.embeddedExecutables[0]?.offset ?? 0).toString(16).toUpperCase()}.`,
        offsets: input.obfuscation.embeddedExecutables.slice(0, 12).map((item) => item.offset),
        recommendation: "Carve each embedded image out and analyse it separately; a nested executable is a common dropper structure."
      }
    });
  }

  const strongCliffs = input.obfuscation.entropyCliffs.filter((cliff) => Math.abs(cliff.delta) >= 3.5);
  if (strongCliffs.length > 0) {
    signals.push({
      weight: Math.min(9, 3 + strongCliffs.length * 0.8),
      finding: {
        id: "obfuscation:entropy-cliff",
        title: "Abrupt entropy transitions",
        category: "Obfuscation",
        severity: "medium",
        detail: `${strongCliffs.length} boundar${strongCliffs.length === 1 ? "y" : "ies"} where entropy shifts by 3.5 bits/byte or more, the largest at 0x${(strongCliffs[0]?.offset ?? 0).toString(16).toUpperCase()}.`,
        offsets: strongCliffs.slice(0, 12).map((cliff) => cliff.offset),
        recommendation: "Inspect each boundary; sharp transitions usually separate code from an appended encrypted or compressed blob."
      }
    });
  }

  // --- Entropy ---------------------------------------------------------------
  const highRegions = input.suspiciousRegions.filter((region) => region.severity === "high");
  if (input.wholeFileEntropy >= 7.9 && input.size > 4096) {
    signals.push({
      weight: isExecutable ? 12 : 5,
      finding: {
        id: "entropy:whole-file",
        title: "Whole-file entropy is near the theoretical maximum",
        category: "Obfuscation",
        severity: isExecutable ? "high" : "medium",
        detail: `${input.wholeFileEntropy.toFixed(4)} bits/byte across ${input.size.toLocaleString()} bytes.`,
        offsets: [0],
        recommendation: isExecutable
          ? "An executable this uniform is normally packed or encrypted. Unpack before drawing conclusions."
          : "Expected for already-compressed or encrypted container formats; corroborate with the detected type before escalating."
      }
    });
  } else if (highRegions.length > 0 && isExecutable) {
    signals.push({
      weight: Math.min(10, 4 + highRegions.length * 0.5),
      finding: {
        id: "entropy:regions",
        title: "High-entropy regions inside an executable",
        category: "Obfuscation",
        severity: "medium",
        detail: `${highRegions.length} window${highRegions.length === 1 ? "" : "s"} above 7.75 bits/byte, first at 0x${(highRegions[0]?.offset ?? 0).toString(16).toUpperCase()}.`,
        offsets: highRegions.slice(0, 12).map((region) => region.offset),
        recommendation: "Compare against the section table; high entropy confined to a resource or overlay is less notable than a packed code section."
      }
    });
  }

  // --- PE structure ----------------------------------------------------------
  if (input.pe?.valid) {
    const sections = input.pe.sections ?? [];
    const writableExecutable = sections.filter((section) => (section.characteristics & 0x20000000) !== 0 && (section.characteristics & 0x80000000) !== 0);
    if (writableExecutable.length > 0) {
      signals.push({
        weight: 12,
        finding: {
          id: "pe:wx-section",
          title: "Writable and executable PE section",
          category: "Structure",
          severity: "high",
          detail: `Section${writableExecutable.length === 1 ? "" : "s"} ${writableExecutable.map((section) => section.name).join(", ")} carry both write and execute permissions.`,
          offsets: writableExecutable.map((section) => section.rawOffset),
          recommendation: "W+X sections are a hallmark of self-modifying or unpacking code. Trace what writes into the section at runtime."
        }
      });
    }

    const packedSections = sections.filter((section) => (section.entropy ?? 0) >= 7.6 && (section.characteristics & 0x20000000) !== 0);
    if (packedSections.length > 0) {
      signals.push({
        weight: Math.min(12, 6 + packedSections.length * 2),
        finding: {
          id: "pe:packed-section",
          title: "High-entropy executable section",
          category: "Obfuscation",
          severity: "high",
          detail: `${packedSections.map((section) => `${section.name} (${(section.entropy ?? 0).toFixed(3)})`).join(", ")}.`,
          offsets: packedSections.map((section) => section.rawOffset),
          recommendation: "Executable code should not be this uniform. Dump the section after it is unpacked in memory."
        }
      });
    }

    const zeroRaw = sections.filter((section) => section.rawSize === 0 && section.virtualSize > 0);
    if (zeroRaw.length > 0) {
      signals.push({
        weight: 6,
        finding: {
          id: "pe:virtual-only-section",
          title: "Section with virtual size but no raw data",
          category: "Structure",
          severity: "medium",
          detail: `${zeroRaw.map((section) => section.name).join(", ")} reserve memory that is not backed by file content.`,
          offsets: zeroRaw.map((section) => section.rawOffset),
          recommendation: "Common in packers that allocate space for decompressed code; verify against the entry-point section."
        }
      });
    }

    const nonStandard = sections.filter((section) => !/^[.$]?[A-Za-z][\w.$]*$/.test(section.name) || section.name.length === 0);
    if (nonStandard.length > 0) {
      signals.push({
        weight: 4,
        finding: {
          id: "pe:odd-section-name",
          title: "Unusual PE section names",
          category: "Structure",
          severity: "low",
          detail: `${nonStandard.map((section) => JSON.stringify(section.name)).join(", ")} do not follow standard toolchain naming.`,
          offsets: nonStandard.map((section) => section.rawOffset),
          recommendation: "Cross-reference the names against known packer signatures."
        }
      });
    }

    if (input.pe.timestamp !== undefined) {
      const compiled = input.pe.timestamp * 1000;
      const now = Date.now();
      if (compiled > now + 86_400_000) {
        signals.push({
          weight: 5,
          finding: {
            id: "pe:future-timestamp",
            title: "PE compile timestamp is in the future",
            category: "Structure",
            severity: "medium",
            detail: `Header reports ${new Date(compiled).toISOString()}.`,
            offsets: [],
            recommendation: "Timestamps are trivially forged; treat as a tampering indicator rather than a reliable date."
          }
        });
      } else if (input.pe.timestamp === 0) {
        signals.push({
          weight: 3,
          finding: {
            id: "pe:zero-timestamp",
            title: "PE compile timestamp is zeroed",
            category: "Structure",
            severity: "low",
            detail: "The TimeDateStamp field is zero, which reproducible builds and timestamp-stripping tools both produce.",
            offsets: [],
            recommendation: "Benign for reproducible builds; note it alongside other tampering indicators."
          }
        });
      }
    }

    for (const warning of input.pe.warnings.slice(0, 6)) {
      signals.push({
        weight: 2.5,
        finding: {
          id: `pe:warning:${warning.slice(0, 32)}`,
          title: "PE structural warning",
          category: "Structure",
          severity: "low",
          detail: warning,
          offsets: [],
          recommendation: "Structural anomalies can indicate hand-modified headers or a truncated sample."
        }
      });
    }
  }

  // --- Type / extension mismatch --------------------------------------------
  const best = input.detectedType[0];
  const extension = input.filename.includes(".") ? `.${input.filename.split(".").pop()?.toLowerCase() ?? ""}` : "";
  if (best && extension && best.confidence >= 0.9 && !best.extensions.includes(extension) && best.extensions.length > 0) {
    const masquerading = isExecutable && /\.(?:pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|txt|mp3|mp4|zip)$/i.test(extension);
    signals.push({
      weight: masquerading ? 16 : 5,
      finding: {
        id: "structure:extension-mismatch",
        title: masquerading ? "Executable content disguised by its file extension" : "File extension disagrees with detected type",
        category: "Structure",
        severity: masquerading ? "critical" : "medium",
        detail: `Content identifies as ${best.name} (${Math.round(best.confidence * 100)}%), which normally uses ${best.extensions.join(", ")}, but the filename ends in ${extension}.`,
        offsets: [0],
        recommendation: masquerading
          ? "An executable wearing a document or media extension is a standard delivery technique. Treat the sample as hostile until proven otherwise."
          : "Verify whether the extension was renamed deliberately or is simply an uncommon variant."
      }
    });
  }

  // --- Indicators of compromise ---------------------------------------------
  const criticalIocs = input.iocs.items.filter((item) => item.severity === "critical");
  const highIocs = input.iocs.items.filter((item) => item.severity === "high");

  if (criticalIocs.length > 0) {
    signals.push({
      weight: Math.min(20, 10 + criticalIocs.length * 2),
      finding: {
        id: "ioc:critical",
        title: "Critical indicators of compromise",
        category: "Destructive",
        severity: "critical",
        detail: `${criticalIocs.length} indicator${criticalIocs.length === 1 ? "" : "s"}: ${criticalIocs.slice(0, 3).map((item) => `${item.type} — ${item.value.slice(0, 80)}`).join(" | ")}.`,
        offsets: criticalIocs.slice(0, 12).map((item) => item.offset),
        recommendation: "Extract each indicator for blocking and hunting. Encoded command lines and wallet addresses rarely appear in benign software."
      }
    });
  }

  if (highIocs.length > 0) {
    signals.push({
      weight: Math.min(12, 4 + highIocs.length * 0.8),
      finding: {
        id: "ioc:high",
        title: "Notable network or execution indicators",
        category: "Network",
        severity: "high",
        detail: `${highIocs.length} indicator${highIocs.length === 1 ? "" : "s"} including ${[...new Set(highIocs.map((item) => item.type))].slice(0, 5).join(", ")}.`,
        offsets: highIocs.slice(0, 12).map((item) => item.offset),
        recommendation: "Resolve and reputation-check each host offline before permitting the sample to run."
      }
    });
  }

  const wallets = input.iocs.items.filter((item) => item.type === "wallet");
  if (wallets.length > 0) {
    signals.push({
      weight: Math.min(14, 8 + wallets.length * 2),
      finding: {
        id: "ioc:wallet",
        title: "Cryptocurrency addresses embedded",
        category: "Destructive",
        severity: "critical",
        detail: `${wallets.length} wallet-shaped string${wallets.length === 1 ? "" : "s"} found.`,
        offsets: wallets.slice(0, 8).map((item) => item.offset),
        recommendation: "Hard-coded wallets appear in ransomware notes, clipper malware, and coin miners. Validate the address format before acting."
      }
    });
  }

  // --- Content shape ---------------------------------------------------------
  if (input.detectedType.length === 0 && input.size > 1024) {
    signals.push({
      weight: 4,
      finding: {
        id: "content:unidentified",
        title: "No format could be identified",
        category: "Content",
        severity: "low",
        detail: "Neither a byte signature nor a content heuristic matched, which fits encrypted payloads, raw memory dumps, and proprietary containers alike.",
        offsets: [0],
        recommendation: "Check for an XOR key or container wrapper before assuming the data is random."
      }
    });
  }

  const base64Blobs = input.iocs.items.filter((item) => item.type === "base64");
  if (base64Blobs.length >= 3) {
    signals.push({
      weight: Math.min(8, 3 + base64Blobs.length * 0.4),
      finding: {
        id: "content:base64",
        title: "Multiple large Base64-encoded blobs",
        category: "Obfuscation",
        severity: "medium",
        detail: `${base64Blobs.length} encoded blobs of 40 characters or more.`,
        offsets: base64Blobs.slice(0, 10).map((item) => item.offset),
        recommendation: "Decode the largest blobs; embedded payloads and configuration data are routinely Base64-wrapped."
      }
    });
  }

  return signals;
}

export function assessThreat(input: ThreatInput): ThreatAssessment {
  const signals = collectSignals(input);
  const categoryTotals: Record<string, number> = {};

  for (const signal of signals) {
    const category = signal.finding.category;
    categoryTotals[category] = (categoryTotals[category] ?? 0) + signal.weight;
  }

  const categoryScores: Record<string, number> = {};
  let total = 0;
  for (const [category, value] of Object.entries(categoryTotals)) {
    const capped = Math.min(value, CATEGORY_CAPS[category] ?? 15);
    categoryScores[category] = Math.round(capped * 10) / 10;
    total += capped;
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));
  const band = bandFor(score);

  const findings: ThreatFinding[] = signals
    .map((signal) => ({ ...signal.finding, weight: Math.round(signal.weight * 10) / 10 }))
    .sort((left, right) => SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] || right.weight - left.weight);

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const highCount = findings.filter((finding) => finding.severity === "high").length;

  const summary = findings.length === 0
    ? "No scored indicators were raised. The file presents no static signals from the current rule set, which is not the same as a clean verdict."
    : `${findings.length} scored indicator${findings.length === 1 ? "" : "s"} across ${Object.keys(categoryScores).length} categor${Object.keys(categoryScores).length === 1 ? "y" : "ies"}` +
      `${criticalCount > 0 ? `, including ${criticalCount} critical` : ""}${highCount > 0 ? `${criticalCount > 0 ? " and" : ", including"} ${highCount} high-severity` : ""}. ` +
      `Composite score ${score}/100 places this sample in the ${band.toLowerCase()} triage band.`;

  return { score, band, findings, categoryScores, summary };
}

export { severityFor, bandFor };
