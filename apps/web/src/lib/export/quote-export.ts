/**
 * Export utilities for Quote data (TSV/CSV)
 */

export interface QuoteExportItem {
  lineNumber?: number | null;
  name?: string | null;
  brand?: string | null;
  catalogNumber?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice?: number | null;
  lineTotal?: number | null;
  currency?: string | null;
  notes?: string | null;
}

export interface QuoteExportData {
  title: string;
  description?: string | null;
  status: string;
  currency: string;
  totalAmount?: number | null;
  items: QuoteExportItem[];
  createdAt: Date | string;
}

/**
 * Convert quote data to TSV format
 */
export function exportToTSV(data: QuoteExportData): string {
  const lines: string[] = [];

  // Header info
  lines.push(`Quote Title:\t${data.title}`);
  if (data.description) {
    lines.push(`Description:\t${data.description}`);
  }
  lines.push(`Status:\t${data.status}`);
  lines.push(`Currency:\t${data.currency}`);
  lines.push(`Total Amount:\t${data.totalAmount || 0}`);
  lines.push(`Created At:\t${new Date(data.createdAt).toLocaleString()}`);
  lines.push(""); // Empty line

  // Table header
  const headers = [
    "Line No.",
    "Product Name",
    "Brand",
    "Catalog No.",
    "Unit",
    "Quantity",
    "Unit Price",
    "Line Total",
    "Notes",
  ];
  lines.push(headers.join("\t"));

  // Table rows
  data.items.forEach((item) => {
    const row = [
      item.lineNumber?.toString() || "",
      item.name || "",
      item.brand || "",
      item.catalogNumber || "",
      item.unit || "ea",
      item.quantity.toString(),
      item.unitPrice?.toString() || "",
      item.lineTotal?.toString() || "",
      item.notes || "",
    ];
    lines.push(row.join("\t"));
  });

  return lines.join("\n");
}

/**
 * Convert quote data to CSV format
 * Uses RFC 4180 CSV standard with proper escaping
 */
export function exportToCSV(data: QuoteExportData): string {
  const lines: string[] = [];

  // Helper function to escape CSV values
  const escapeCsv = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = value.toString();
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Header info
  lines.push(`Quote Title,${escapeCsv(data.title)}`);
  if (data.description) {
    lines.push(`Description,${escapeCsv(data.description)}`);
  }
  lines.push(`Status,${escapeCsv(data.status)}`);
  lines.push(`Currency,${escapeCsv(data.currency)}`);
  lines.push(`Total Amount,${escapeCsv(data.totalAmount)}`);
  lines.push(`Created At,${escapeCsv(new Date(data.createdAt).toLocaleString())}`);
  lines.push(""); // Empty line

  // Table header
  const headers = [
    "Line No.",
    "Product Name",
    "Brand",
    "Catalog No.",
    "Unit",
    "Quantity",
    "Unit Price",
    "Line Total",
    "Notes",
  ];
  lines.push(headers.map(escapeCsv).join(","));

  // Table rows
  data.items.forEach((item) => {
    const row = [
      item.lineNumber,
      item.name,
      item.brand,
      item.catalogNumber,
      item.unit || "ea",
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      item.notes,
    ];
    lines.push(row.map(escapeCsv).join(","));
  });

  return lines.join("\n");
}

/**
 * Trigger download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export quote as TSV and trigger download
 */
export function exportQuoteAsTSV(data: QuoteExportData) {
  const tsv = exportToTSV(data);
  const filename = `quote-${data.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.tsv`;
  downloadFile(tsv, filename, "text/tab-separated-values");
}

/**
 * Export quote as CSV and trigger download
 */
export function exportQuoteAsCSV(data: QuoteExportData) {
  const csv = exportToCSV(data);
  const filename = `quote-${data.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-${Date.now()}.csv`;
  downloadFile(csv, filename, "text/csv");
}
