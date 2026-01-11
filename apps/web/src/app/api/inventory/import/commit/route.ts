import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { fileCache } from "@/lib/cache/file-cache";

const logger = createLogger("inventory/import/commit");

// Column mapping schema
const ColumnMappingSchema = z.object({
  productName: z.string().min(1, "제품명 컬럼 매핑 필요"),
  catalogNumber: z.string().optional(),
  currentQuantity: z.string().min(1, "재고 수량 컬럼 매핑 필요"),
  unit: z.string().optional(),
  safetyStock: z.string().optional(),
  minOrderQty: z.string().optional(),
  location: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

// Inventory row schema
const InventoryRowSchema = z.object({
  productName: z.string().min(1, "productName is required"),
  catalogNumber: z.string().optional(),
  currentQuantity: z.number().nonnegative("currentQuantity must be non-negative"),
  unit: z.string().optional(),
  safetyStock: z.number().nonnegative().optional(),
  minOrderQty: z.number().nonnegative().optional(),
  location: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

interface CommitRequest {
  fileId: string;
  columnMapping: Record<string, string>;
  excludedRows?: number[]; // 제외할 행 번호들
  editedRows?: Record<number, Record<string, any>>; // 수정된 행 데이터
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

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

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

  return null;
}

/**
 * Find or create product by name and catalogNumber
 */
async function findOrCreateProduct(
  productName: string,
  catalogNumber?: string
): Promise<string> {
  // Try to find existing product
  if (catalogNumber) {
    const existingByCatalog = await db.product.findFirst({
      where: {
        catalogNumber: {
          equals: catalogNumber,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingByCatalog) {
      return existingByCatalog.id;
    }
  }

  // Try to find by name
  const existingByName = await db.product.findFirst({
    where: {
      name: {
        equals: productName,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingByName) {
    return existingByName.id;
  }

  // Create new product
  const newProduct = await db.product.create({
    data: {
      name: productName,
      catalogNumber: catalogNumber || null,
      category: "REAGENT", // Default category
    },
    select: { id: true },
  });

  return newProduct.id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CommitRequest = await request.json();
    const { fileId, columnMapping, excludedRows = [], editedRows = {} } = body;

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

    logger.info(`Committing inventory import for ${filename}: ${rows.length} rows`);

    // Create import job
    const importJob = await db.importJob.create({
      data: {
        scopeKey: session.user.id,
        workspaceId: null,
        type: "inventory",
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
      const rowNumber = i + 1;

      // Skip excluded rows
      if (excludedRows.includes(rowNumber)) {
        result.errorRows++;
        continue;
      }

      try {
        // Use edited row data if available, otherwise use original row
        // Note: editedRows contains data keyed by row number, but we need to map it back to the original row structure
        let rowData = rows[i];
        if (editedRows[rowNumber]) {
          // Merge edited data with original row, preserving column names
          rowData = { ...rows[i], ...editedRows[rowNumber] };
        }

        // Map columns to standard fields
        const mappedRow: any = {};
        for (const [standardField, csvColumn] of Object.entries(validatedMapping)) {
          if (csvColumn && rowData[csvColumn] !== undefined) {
            mappedRow[standardField] = rowData[csvColumn];
          }
        }

        // Parse numbers
        if (mappedRow.currentQuantity) {
          mappedRow.currentQuantity = parseNumber(mappedRow.currentQuantity);
        }
        if (mappedRow.safetyStock) {
          mappedRow.safetyStock = parseNumber(mappedRow.safetyStock);
        }
        if (mappedRow.minOrderQty) {
          mappedRow.minOrderQty = parseNumber(mappedRow.minOrderQty);
        }

        // Parse date
        if (mappedRow.expiryDate) {
          const parsedDate = parseDate(mappedRow.expiryDate);
          mappedRow.expiryDate = parsedDate ? parsedDate.toISOString() : null;
        } else {
          mappedRow.expiryDate = null;
        }

        // Validate with Zod
        const validated = InventoryRowSchema.parse(mappedRow);

        // Find or create product
        const productId = await findOrCreateProduct(
          validated.productName,
          validated.catalogNumber
        );

        // Check if inventory already exists for this product and user
        const existingInventory = await db.productInventory.findFirst({
          where: {
            userId: session.user.id,
            productId,
          },
        });

        let record;
        if (existingInventory) {
          // Update existing inventory
          record = await db.productInventory.update({
            where: { id: existingInventory.id },
            data: {
              currentQuantity: validated.currentQuantity,
              unit: validated.unit || existingInventory.unit || "ea",
              safetyStock: validated.safetyStock ?? existingInventory.safetyStock,
              minOrderQty: validated.minOrderQty ?? existingInventory.minOrderQty,
              location: validated.location ?? existingInventory.location,
              expiryDate: validated.expiryDate
                ? new Date(validated.expiryDate)
                : existingInventory.expiryDate,
              notes: validated.notes ?? existingInventory.notes,
            },
          });
        } else {
          // Create new inventory
          record = await db.productInventory.create({
            data: {
              userId: session.user.id,
              productId,
              currentQuantity: validated.currentQuantity,
              unit: validated.unit || "ea",
              safetyStock: validated.safetyStock ?? null,
              minOrderQty: validated.minOrderQty ?? null,
              location: validated.location || null,
              expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
              notes: validated.notes || null,
            },
          });
        }

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
    return handleApiError(error, "inventory/import/commit");
  }
}

