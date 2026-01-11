import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { fileCache } from "@/lib/cache/file-cache";
import { getScope, getScopeKey } from "@/lib/auth/scope";

const logger = createLogger("purchases/import/commit");

// Column mapping schema
const ColumnMappingSchema = z.object({
  purchasedAt: z.string().min(1, "구매일 컬럼 매핑 필요"),
  vendorName: z.string().min(1, "벤더 컬럼 매핑 필요"),
  category: z.string().optional(),
  itemName: z.string().min(1, "품목명 컬럼 매핑 필요"),
  catalogNumber: z.string().optional(),
  unit: z.string().optional(),
  qty: z.string().min(1, "수량 컬럼 매핑 필요"),
  unitPrice: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
});

// Purchase row schema (same as regular import)
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

interface CommitRequest {
  fileId: string;
  columnMapping: Record<string, string>;
}

interface ImportResult {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorSample: Array<{ row: number; errors: string[] }>;
  records?: any[];
}

function parseNumber(value: any): number | undefined {
  if (typeof value === "number") return value;
  if (!value) return undefined;

  const str = String(value).trim();
  if (!str) return undefined;

  const cleaned = str.replace(/[,\s]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
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
    // Get scope (workspace or guest)
    const scope = await getScope(request);
    const scopeKey = getScopeKey(scope);

    const body: CommitRequest = await request.json();
    const { fileId, columnMapping } = body;

    if (!fileId) {
      throw new Error("fileId is required");
    }

    // Validate column mapping
    const validatedMapping = ColumnMappingSchema.parse(columnMapping);

    // Retrieve cached file data
    const cachedData = fileCache.get(fileId);
    if (!cachedData) {
      throw new Error("File data not found or expired. Please upload the file again.");
    }

    const { rows, filename } = cachedData;

    logger.info(`Committing import for ${filename}: ${rows.length} rows`, {
      scope: scope.type,
      workspaceId: scope.workspaceId,
    });

    // Create import job
    const importJob = await db.importJob.create({
      data: {
        scopeKey,
        workspaceId: scope.workspaceId || null,
        type: "purchase",
        filename,
        status: "PROCESSING",
        totalRows: rows.length,
        startedAt: new Date(),
      },
    });

    logger.info(`Created import job ${importJob.id}`);

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
        // Map columns to standard fields
        const mappedRow: any = {};
        for (const [standardField, csvColumn] of Object.entries(validatedMapping)) {
          if (csvColumn) {
            mappedRow[standardField] = row[csvColumn];
          }
        }

        // Parse numbers
        if (mappedRow.qty) {
          mappedRow.qty = parseNumber(mappedRow.qty);
        }
        if (mappedRow.unitPrice) {
          mappedRow.unitPrice = parseNumber(mappedRow.unitPrice);
        }
        if (mappedRow.amount) {
          mappedRow.amount = parseNumber(mappedRow.amount);
        }

        // Set default currency
        if (!mappedRow.currency) {
          mappedRow.currency = "KRW";
        }

        // Validate with Zod
        const validated = PurchaseRowSchema.parse(mappedRow);

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
            workspaceId: scope.workspaceId || null,
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
          errors.push(...error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`));
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
          columnMapping: validatedMapping,
        },
        completedAt: new Date(),
      },
    });

    // Clean up cache
    fileCache.delete(fileId);

    logger.info(
      `Import job ${importJob.id} completed: ${result.successRows} success, ${result.errorRows} errors`
    );

    return NextResponse.json({
      ...result,
      records: successRecords.slice(0, 10), // Return first 10 records as sample
    });
  } catch (error) {
    return handleApiError(error, "purchases/import/commit");
  }
}
