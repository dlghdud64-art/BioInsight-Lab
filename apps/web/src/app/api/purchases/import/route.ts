import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";

const logger = createLogger("purchases/import");

// Zod schema for purchase row validation
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

type PurchaseRow = z.infer<typeof PurchaseRowSchema>;

interface ImportResult {
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

    const body = await request.json();
    const { rows } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      logger.warn("Invalid rows input", { rows });
      throw new Error("rows array is required and must not be empty");
    }

    logger.info(`Importing ${rows.length} purchase rows for scopeKey: ${scopeKey}`);

    const result: ImportResult = {
      totalRows: rows.length,
      successRows: 0,
      errorRows: 0,
      errorSample: [],
    };

    const successRecords: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;

      try {
        const validated = PurchaseRowSchema.parse(row);

        // Ensure either amount or unitPrice is provided
        if (!validated.amount && !validated.unitPrice) {
          throw new Error("Either amount or unitPrice is required");
        }

        const amount = validated.amount || (validated.unitPrice! * validated.qty);
        const purchasedAt = parseDate(validated.purchasedAt);

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

    logger.info(`Import completed: ${result.successRows} success, ${result.errorRows} errors`);

    return NextResponse.json({
      ...result,
      records: successRecords.slice(0, 10),
    });
  } catch (error) {
    return handleApiError(error, "purchases/import");
  }
}
