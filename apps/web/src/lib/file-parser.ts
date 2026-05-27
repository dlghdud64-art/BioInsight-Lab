import * as XLSX from "xlsx";
import { createLogger } from "./logger";

const logger = createLogger("file-parser");

export interface ParsedRow {
  [key: string]: any;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalRows: number;
  errors: string[];
}

/**
 * Parse CSV/XLSX file buffer to JSON rows
 * Supports both CSV and XLSX formats
 */
export function parseFileBuffer(
  buffer: Buffer,
  filename: string
): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("No sheets found in file");
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row as keys
    const rows: ParsedRow[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Keep values as strings for date parsing
      defval: undefined, // Use undefined for empty cells
    });

    logger.info(`Parsed ${rows.length} rows from ${filename}`);

    return {
      rows,
      totalRows: rows.length,
      errors: [],
    };
  } catch (error: any) {
    logger.error("Failed to parse file", error);
    return {
      rows: [],
      totalRows: 0,
      errors: [error.message || "Unknown parsing error"],
    };
  }
}

/**
 * Normalize column names to match expected schema
 * Handles common variations in column names
 */
export function normalizeColumnNames(row: ParsedRow): ParsedRow {
  const normalized: ParsedRow = {};

  const columnMap: Record<string, string[]> = {
    purchasedAt: ["purchasedAt", "purchased_at", "date", "purchase_date", "구매일", "구매일자"],
    vendorName: ["vendorName", "vendor_name", "vendor", "supplier", "공급사", "벤더"],
    category: ["category", "카테고리", "분류"],
    itemName: ["itemName", "item_name", "item", "product", "product_name", "품목", "제품명"],
    catalogNumber: ["catalogNumber", "catalog_number", "cat_no", "catno", "catalog", "카탈로그번호"],
    unit: ["unit", "단위"],
    qty: ["qty", "quantity", "수량", "amount_qty"],
    unitPrice: ["unitPrice", "unit_price", "price", "단가"],
    amount: ["amount", "total", "total_amount", "금액", "총액"],
    currency: ["currency", "통화"],
  };

  for (const [key, value] of Object.entries(row)) {
    // Find matching standard key
    let standardKey = key;
    for (const [stdKey, variations] of Object.entries(columnMap)) {
      if (variations.some(v => v.toLowerCase() === key.toLowerCase())) {
        standardKey = stdKey;
        break;
      }
    }

    normalized[standardKey] = value;
  }

  return normalized;
}

/**
 * Convert string value to number, handling various formats
 */
export function parseNumber(value: any): number | undefined {
  if (typeof value === "number") return value;
  if (!value) return undefined;

  const str = String(value).trim();
  if (!str) return undefined;

  // Remove common separators (commas, spaces)
  const cleaned = str.replace(/[,\s]/g, "");

  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Validate and transform row for purchase import
 */
export function transformPurchaseRow(row: ParsedRow): any {
  const normalized = normalizeColumnNames(row);

  return {
    purchasedAt: normalized.purchasedAt,
    vendorName: normalized.vendorName,
    category: normalized.category,
    itemName: normalized.itemName,
    catalogNumber: normalized.catalogNumber,
    unit: normalized.unit,
    qty: parseNumber(normalized.qty),
    unitPrice: parseNumber(normalized.unitPrice),
    amount: parseNumber(normalized.amount),
    currency: normalized.currency || "KRW",
  };
}
