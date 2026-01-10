import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { parseFileBuffer } from "@/lib/file-parser";
import { fileCache, cleanupFileCache } from "@/lib/cache/file-cache";

const logger = createLogger("purchases/import/preview");

export interface PreviewResponse {
  columns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  filename: string;
  fileId: string; // Temporary ID for later commit
}

export async function POST(request: NextRequest) {
  try {
    cleanupFileCache();

    const scopeKey = request.headers.get("x-guest-key");
    if (!scopeKey) {
      logger.warn("Missing x-guest-key header");
      throw new Error("x-guest-key header is required");
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new Error("No file provided");
    }

    // Validate file type
    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      throw new Error("Invalid file type. Only CSV and XLSX files are supported.");
    }

    logger.info(`Previewing file: ${filename} for scopeKey: ${scopeKey}`);

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file to rows
    const parseResult = parseFileBuffer(buffer, filename);
    if (parseResult.errors.length > 0) {
      throw new Error(`File parsing failed: ${parseResult.errors.join(", ")}`);
    }

    const { rows } = parseResult;
    if (rows.length === 0) {
      throw new Error("File contains no data rows");
    }

    // Extract columns from first row
    const columns = Object.keys(rows[0]);

    // Get sample rows (first 20)
    const sampleRows = rows.slice(0, 20);

    // Generate file ID for cache
    const fileId = `${scopeKey}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Store parsed data in cache
    fileCache.set(fileId, {
      userId: session.user.id,
      rows,
      filename,
      timestamp: Date.now(),
    });

    logger.info(`Preview generated for ${filename}: ${rows.length} rows, ${columns.length} columns`);

    const response: PreviewResponse = {
      columns,
      sampleRows,
      totalRows: rows.length,
      filename,
      fileId,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "purchases/import/preview");
  }
}
