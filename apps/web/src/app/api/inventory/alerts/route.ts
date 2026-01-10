import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { batchEstimateInventoryStatus, generateAlertMessage } from "@/lib/inventory/time-based-estimation";

/**
 * GET /api/inventory/alerts
 *
 * 사용자의 모든 인벤토리를 분석하여 재고 부족 알림 목록을 반환합니다.
 *
 * Response:
 * {
 *   alerts: [
 *     {
 *       inventoryId: string,
 *       productName: string,
 *       catalogNumber: string,
 *       alertLevel: "INFO" | "WARNING" | "CRITICAL",
 *       message: string,
 *       estimatedPercentage: number,
 *       nextPurchaseDue: Date,
 *       daysSinceLastPurchase: number,
 *       averageCycleDays: number,
 *     }
 *   ],
 *   summary: {
 *     total: number,
 *     critical: number,
 *     warning: number,
 *     info: number,
 *   }
 * }
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 인증 검증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. 모든 인벤토리 조회 (IN_STOCK 상태만)
    const inventories = await db.userInventory.findMany({
      where: {
        userId,
        status: {
          in: ["IN_STOCK", "LOW_STOCK"], // OUT_OF_STOCK은 이미 알고 있으므로 제외
        },
      },
      select: {
        id: true,
        productName: true,
        catalogNumber: true,
        brand: true,
        quantity: true,
        unit: true,
        receivedAt: true,
      },
      orderBy: {
        receivedAt: "desc",
      },
    });

    if (inventories.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          alerts: [],
          summary: {
            total: 0,
            critical: 0,
            warning: 0,
            info: 0,
          },
        },
      });
    }

    // 3. 시간 기반 추정 (배치 처리)
    const estimationMap = await db.$transaction(async (tx) => {
      return await batchEstimateInventoryStatus(tx, userId, inventories);
    });

    // 4. 알림 생성 (WARNING, CRITICAL만)
    const alerts: Array<{
      inventoryId: string;
      productName: string;
      catalogNumber: string | null;
      brand: string | null;
      quantity: number;
      unit: string | null;
      alertLevel: "INFO" | "WARNING" | "CRITICAL";
      message: string;
      estimatedPercentage: number;
      nextPurchaseDue: Date | null;
      daysSinceLastPurchase: number;
      averageCycleDays: number;
      confidence: "HIGH" | "MEDIUM" | "LOW";
    }> = [];

    const summary = {
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
    };

    for (const inventory of inventories) {
      const estimation = estimationMap.get(inventory.id);
      if (!estimation) continue;

      // NONE 알림은 제외
      if (estimation.alertLevel === "NONE") continue;

      const message = generateAlertMessage(estimation, inventory.productName);
      if (!message) continue;

      alerts.push({
        inventoryId: inventory.id,
        productName: inventory.productName,
        catalogNumber: inventory.catalogNumber,
        brand: inventory.brand,
        quantity: inventory.quantity,
        unit: inventory.unit,
        alertLevel: estimation.alertLevel,
        message,
        estimatedPercentage: estimation.estimatedPercentage,
        nextPurchaseDue: estimation.nextPurchaseDue,
        daysSinceLastPurchase: estimation.daysSinceLastPurchase,
        averageCycleDays: estimation.averageCycleDays,
        confidence: estimation.confidence,
      });

      summary.total += 1;
      if (estimation.alertLevel === "CRITICAL") {
        summary.critical += 1;
      } else if (estimation.alertLevel === "WARNING") {
        summary.warning += 1;
      } else if (estimation.alertLevel === "INFO") {
        summary.info += 1;
      }
    }

    // 5. 알림 우선순위 정렬 (CRITICAL > WARNING > INFO)
    alerts.sort((a, b) => {
      const levelOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return levelOrder[a.alertLevel] - levelOrder[b.alertLevel];
    });

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
      },
    });

  } catch (error) {
    console.error("[Inventory Alerts GET] Error:", error);
    return NextResponse.json(
      { error: "알림 조회 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
