import { jsPDF } from "jspdf";
import type { FileAnalysis } from "../types";

export interface PdfReportOptions {
  title?: string;
  userNotes?: string;
  includeStrings?: number;
  includeSignatures?: number;
  includeEntropyRegions?: number;
  analystName?: string;
  caseId?: string;
}

export function buildPdfReport(analysis: FileAnalysis, options: PdfReportOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = 54;
  let pageNumber = 1;

  const footer = (): void => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Generated locally • Analysis version ${analysis.analysisVersion}`, margin, pageHeight - 24);
    doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  };
  const newPage = (): void => {
    footer();
    doc.addPage();
    pageNumber += 1;
    y = 48;
  };
  const ensure = (height: number): void => { if (y + height > pageHeight - 42) newPage(); };
  const heading = (text: string, level = 1): void => {
    const size = level === 1 ? 16 : 12;
    ensure(size + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20);
    doc.text(text, margin, y);
    y += size + 10;
  };
  const line = (label: string, value: string): void => {
    const labelWidth = 118;
    const wrapped = doc.splitTextToSize(value || "—", contentWidth - labelWidth) as string[];
    const height = Math.max(16, wrapped.length * 11 + 3);
    ensure(height);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(70);
    doc.text(label, margin, y);
    doc.setFont("courier", "normal");
    doc.setTextColor(20);
    doc.text(wrapped, margin + labelWidth, y);
    y += height;
  };
  const paragraph = (text: string): void => {
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    ensure(lines.length * 11 + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30);
    doc.text(lines, margin, y);
    y += lines.length * 11 + 8;
  };
  const divider = (): void => {
    ensure(14);
    doc.setDrawColor(215);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  doc.setFillColor(31, 41, 55);
  doc.rect(0, 0, pageWidth, 112, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(options.title ?? "Binary File Analysis Report", margin, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(analysis.filename, margin, 70);
  doc.text(new Date(analysis.analyzedAt).toLocaleString(), margin, 88);
  if (options.caseId?.trim()) doc.text(`Case / Project: ${options.caseId.trim()}`, pageWidth - margin, 70, { align: "right" });
  if (options.analystName?.trim()) doc.text(`Analyst: ${options.analystName.trim()}`, pageWidth - margin, 88, { align: "right" });
  y = 140;

  heading("File summary");
  line("Filename", analysis.filename);
  line("Size", `${analysis.size.toLocaleString()} bytes`);
  line("Detected type", analysis.detectedType.map((item) => `${item.name} (${Math.round(item.confidence * 100)}%)`).join("; ") || "Unknown");
  line("Entropy", `${analysis.wholeFileEntropy.toFixed(5)} bits/byte`);
  line("Modified", new Date(analysis.lastModified).toLocaleString());
  line("Analyst", options.analystName?.trim() || "Not provided");
  line("Case / Project ID", options.caseId?.trim() || "Not provided");

  heading("Technical details");
  for (const [label, value] of Object.entries(analysis.details)) line(label, value);

  heading("Hashes");
  for (const hash of analysis.hashes) line(hash.algorithm, hash.value);

  heading("Detection evidence");
  for (const match of analysis.detectedType.slice(0, 25)) {
    line(match.name, `${Math.round(match.confidence * 100)}% • ${match.reason} • offsets ${match.offsets.map((offset) => `0x${offset.toString(16)}`).join(", ")}`);
  }
  if (analysis.detectedType.length === 0) paragraph("No known byte signature or content heuristic matched.");

  heading("Embedded signatures");
  const signatureLimit = options.includeSignatures ?? 100;
  for (const hit of analysis.signatureHits.slice(0, signatureLimit)) {
    line(`0x${hit.offset.toString(16).toUpperCase()}`, `${hit.name} • ${Math.round(hit.confidence * 100)}%`);
  }
  if (analysis.signatureHits.length > signatureLimit) paragraph(`${analysis.signatureHits.length - signatureLimit} additional signature hits omitted from the PDF.`);
  if (analysis.signatureHits.length === 0) paragraph("No embedded signatures were found within the configured scan range.");

  heading("Entropy and suspicious regions");
  paragraph(`Whole-file Shannon entropy: ${analysis.wholeFileEntropy.toFixed(5)} bits/byte. High entropy may be caused by normal compression, encryption, packed executable sections, or encrypted content; it is not proof of malware.`);
  for (const region of analysis.suspiciousRegions.slice(0, options.includeEntropyRegions ?? 100)) {
    line(`0x${region.offset.toString(16).toUpperCase()}`, `${region.reason}; entropy ${region.entropy.toFixed(4)}; length ${region.length.toLocaleString()} bytes; severity ${region.severity}`);
  }
  if (analysis.suspiciousRegions.length === 0) paragraph("No regions crossed the current suspicious-region thresholds.");

  if (analysis.pe?.valid) {
    heading("PE analysis");
    line("Architecture", analysis.pe.architecture ?? "Unknown");
    line("Subsystem", analysis.pe.subsystem ?? "Unknown");
    line("Entry point", analysis.pe.entryPoint === undefined ? "Unknown" : `0x${analysis.pe.entryPoint.toString(16).toUpperCase()}`);
    line("Image base", analysis.pe.imageBase ?? "Unknown");
    line("Sections", String(analysis.pe.sectionCount ?? 0));
    for (const section of analysis.pe.sections ?? []) {
      line(section.name, `RVA 0x${section.virtualAddress.toString(16)} • raw 0x${section.rawOffset.toString(16)} • size ${section.rawSize} • entropy ${section.entropy?.toFixed(4) ?? "n/a"}`);
    }
    for (const warning of analysis.pe.warnings) paragraph(`Warning: ${warning}`);
  }

  heading("Extracted strings");
  const stringLimit = options.includeStrings ?? 250;
  for (const item of analysis.strings.slice(0, stringLimit)) {
    const sanitized = item.value.replace(/[\r\n\t]+/g, " ").slice(0, 500);
    line(`0x${item.offset.toString(16).toUpperCase()} ${item.encoding}`, sanitized);
  }
  if (analysis.strings.length > stringLimit) paragraph(`${analysis.strings.length - stringLimit} additional strings omitted from the PDF.`);
  if (analysis.strings.length === 0) paragraph("No strings met the extraction threshold.");

  heading("User notes");
  paragraph(options.userNotes?.trim() || "No user notes were supplied.");
  divider();
  paragraph("Interpretation note: file-type matches and suspicious-region flags are analytical indicators. Validate important conclusions with a format-specific parser or forensic tool before relying on them.");

  footer();
  return doc;
}

export function savePdfReport(analysis: FileAnalysis, options: PdfReportOptions = {}): void {
  const safeName = analysis.filename.replace(/[^a-z0-9._-]+/gi, "_");
  buildPdfReport(analysis, options).save(`${safeName}.analysis.pdf`);
}
