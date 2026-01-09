import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { fileCache } from "@/lib/cache/file-cache";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { auth } from "@/auth";

const logger = createLogger("inventory/import/commit");

// Commit request schema
const CommitRequestSchema = z.object({
  fileId: z.string().min(1, "fileId 필수"),
  createProducts: z.boolean().default(false), // 제품이 없으면 자동 생성 여부
});

interface CommitResult {
  success: boolean;
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  errors: Array<{ row: number; reason: string }>;
  summary: {
    newProducts: number;
    newInventories: number;
    updatedInventories: number;
  };
}

/**
 * POST /api/inventory/import/commit
 * 캐시된 데이터를 실제 DB에 저장
 *
 * 전략:
 * 1. Product 먼저 조회/생성
 * 2. ProductInventory upsert (업데이트 또는 생성)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    // 요청 검증
    const { fileId, createProducts } = CommitRequestSchema.parse(body);

    // 캐시에서 데이터 조회
    const cachedData = fileCache.get(fileId);
    if (!cachedData) {
      return NextResponse.json(
        { error: "파일 데이터를 찾을 수 없습니다. 다시 업로드해주세요." },
        { status: 404 }
      );
    }

    // 권한 확인 (업로드한 사용자와 동일한지)
    if (cachedData.userId !== userId) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const { rows, filename } = cachedData;

    logger.info(`Committing ${rows.length} inventory rows from ${filename}`);

    const result: CommitResult = {
      success: false,
      totalRows: rows.length,
      successRows: 0,
      errorRows: 0,
      skippedRows: 0,
      errors: [],
      summary: {
        newProducts: 0,
        newInventories: 0,
        updatedInventories: 0,
      },
    };

    // 🔥 Bulk Processing with Transaction
    await db.$transaction(async (tx) => {
      for (const row of rows) {
        const rowNumber = row._rowNumber || 0;

        try {
          // 1. Product 조회 또는 생성
          let product = null;

          if (row.catalogNumber) {
            // 카탈로그 번호로 먼저 검색
            product = await tx.product.findFirst({
              where: {
                catalogNumber: row.catalogNumber,
              },
            });
          }

          if (!product && row.productName) {
            // 제품명으로 검색 (정확히 일치)
            product = await tx.product.findFirst({
              where: {
                name: row.productName,
                brand: row.brand || undefined,
              },
            });
          }

          // 제품이 없고 자동 생성 옵션이 켜져있으면 생성
          if (!product && createProducts) {
            product = await tx.product.create({
              data: {
                name: row.productName,
                brand: row.brand || null,
                catalogNumber: row.catalogNumber || null,
                category: "REAGENT", // 기본값
                description: `엑셀 임포트로 자동 생성됨 (${filename})`,
              },
            });
            result.summary.newProducts++;
            logger.info(`Created new product: ${product.name}`);
          }

          if (!product) {
            // 제품을 찾을 수 없고 자동 생성도 안 함
            result.skippedRows++;
            result.errors.push({
              row: rowNumber,
              reason: `제품을 찾을 수 없음: ${row.productName} (createProducts=false)`,
            });
            continue;
          }

          // 2. ProductInventory upsert
          // 기존 인벤토리가 있으면 수량 업데이트, 없으면 생성
          const existingInventory = await tx.productInventory.findFirst({
            where: {
              userId,
              productId: product.id,
            },
          });

          if (existingInventory) {
            // 기존 인벤토리 업데이트 (수량 누적)
            await tx.productInventory.update({
              where: { id: existingInventory.id },
              data: {
                currentQuantity: existingInventory.currentQuantity + row.quantity,
                location: row.location || existingInventory.location,
                notes: row.notes
                  ? `${existingInventory.notes || ""}\n[${new Date().toISOString()}] ${row.notes}`.trim()
                  : existingInventory.notes,
              },
            });
            result.summary.updatedInventories++;
            logger.debug(`Updated inventory for product ${product.id}: +${row.quantity}`);
          } else {
            // 새 인벤토리 생성
            await tx.productInventory.create({
              data: {
                userId,
                productId: product.id,
                currentQuantity: row.quantity,
                unit: row.unit,
                location: row.location,
                notes: row.notes || null,
                expiryDate: row.purchasedAt ? new Date(row.purchasedAt.getTime() + 365 * 24 * 60 * 60 * 1000) : null, // 1년 후
              },
            });
            result.summary.newInventories++;
            logger.debug(`Created new inventory for product ${product.id}: ${row.quantity} ${row.unit}`);
          }

          result.successRows++;
        } catch (error: any) {
          result.errorRows++;
          result.errors.push({
            row: rowNumber,
            reason: error.message || "알 수 없는 에러",
          });
          logger.error(`Row ${rowNumber} processing failed:`, error);
        }
      }
    });

    // 캐시 정리
    fileCache.delete(fileId);

    result.success = result.errorRows === 0;

    logger.info(
      `Import completed: ${result.successRows} success, ${result.errorRows} errors, ${result.skippedRows} skipped`
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "inventory/import/commit");
  }
}
