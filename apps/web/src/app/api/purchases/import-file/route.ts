import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { parseFileBuffer, transformPurchaseRow } from "@/lib/file-parser";

const logger = createLogger("purchases/import-file");

// 파일 업로드 제한 상수 (DoS 방지)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (10MB에서 축소)
const MAX_ROWS = 10000; // 최대 행 수 제한

// Zod schema for purchase row validation (same as JSON import)
const PurchaseRowSchema = z.object({
  purchasedAt: z.string().min(1, "purchasedAt is required"),
  vendorName: z.string().min(1, "vendorName is required"),
  category: z.string().optional(),
  itemName: z.string().min(1, "itemName is required"),
  catalogNumber: z.string().optional(),
  unit: z.string().optional(),
  qty: z.number().int().positive("qty must be positive"),
  unitPrice: z.number().int().optional(),
  amount: z.number().int().optional(),
  currency: z.string().default("KRW"),
});

interface ImportResult {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorSample: Array<{ row: number; errors: string[] }>;
  records?: any[];
}

function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2})$/,
    /^(\d{4})\.(\d{2})\.(\d{2})$/,
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  throw new Error(`Invalid date format: ${dateStr}`);
}

export async function POST(request: NextRequest) {
  try {
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

    // 파일 크기 제한 (DoS 방지)
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds limit. Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    logger.info(`Processing file import: ${filename} (${file.size} bytes) for scopeKey: ${scopeKey}`);

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

    // 행 수 제한 (DoS 방지)
    if (rows.length > MAX_ROWS) {
      throw new Error(
        `Too many rows. Maximum allowed: ${MAX_ROWS}. Your file has ${rows.length} rows.`
      );
    }

    // Create import job
    const importJob = await db.importJob.create({
      data: {
        scopeKey,
        type: "purchase",
        filename,
        status: "PROCESSING",
        totalRows: rows.length,
        startedAt: new Date(),
      },
    });

    logger.info(`Created import job ${importJob.id} with ${rows.length} rows`);

    const result: ImportResult = {
      jobId: importJob.id,
      totalRows: rows.length,
      successRows: 0,
      errorRows: 0,
      errorSample: [],
    };

    const successRecords: any[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        // Transform row to standard format
        const transformed = transformPurchaseRow(row);

        // Validate with Zod
        const validated = PurchaseRowSchema.parse(transformed);

        // Ensure either amount or unitPrice is provided
        if (!validated.amount && !validated.unitPrice) {
          throw new Error("Either amount or unitPrice is required");
        }

        const amount = validated.amount || (validated.unitPrice! * validated.qty);
        const purchasedAt = parseDate(validated.purchasedAt);

        // Create purchase record
        const record = await db.purchaseRecord.create({
          data: {
            scopeKey,
            purchasedAt,
            vendorName: validated.vendorName,
            category: validated.category || null,
            itemName: validated.itemName,
            catalogNumber: validated.catalogNumber || null,
            unit: validated.unit || null,
            qty: validated.qty,
            unitPrice: validated.unitPrice || null,
            amount,
            currency: validated.currency,
            source: "import",
          },
        });

        successRecords.push(record);
        result.successRows++;
      } catch (error: any) {
        result.errorRows++;
        const errors: string[] = [];

        if (error instanceof z.ZodError) {
          errors.push(...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`));
        } else {
          errors.push(error.message || "Unknown error");
        }

        if (result.errorSample.length < 10) {
          result.errorSample.push({ row: rowNumber, errors });
        }

        logger.debug(`Row ${rowNumber} validation failed`, { errors });
      }
    }

    // Update import job with results
    const finalStatus =
      result.errorRows === 0
        ? "COMPLETED"
        : result.successRows === 0
        ? "FAILED"
        : "PARTIAL";

    await db.importJob.update({
      where: { id: importJob.id },
      data: {
        status: finalStatus,
        successRows: result.successRows,
        errorRows: result.errorRows,
        errorSample: result.errorSample,
        result: {
          totalRows: result.totalRows,
          successRows: result.successRows,
          errorRows: result.errorRows,
        },
        completedAt: new Date(),
      },
    });

    logger.info(
      `Import job ${importJob.id} completed: ${result.successRows} success, ${result.errorRows} errors`
    );

    return NextResponse.json({
      ...result,
      records: successRecords.slice(0, 10), // Return first 10 records as sample
    });
  } catch (error) {
    return handleApiError(error, "purchases/import-file");
  }
}
