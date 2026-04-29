import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * §11.102 #admin-order-bulk-status
 *
 * POST /api/admin/orders/bulk-status
 * Body: { orderIds: string[], status: OrderStatus, notes?: string,
 *         deliveryDefaults?: { lotNumber?, expiryDate?, location?,
 *         receivedAt? } }
 *
 * 단일 PATCH /api/admin/orders/[id]/status 의 thin wrapper —
 * 여러 order 에 대해 순차 호출 + 결과 집계.
 *
 * 설계 결정:
 *   - 별도 transaction 묶지 않음 — 한 order 의 transition 실패가
 *     다른 order 정상 transition 을 막지 않도록. 부분 실패 시
 *     successCount / failedItems 로 운영자에게 명확히 알림.
 *   - DELIVERED 전환은 §11.59 deliveryDefaults forward — 모든 order
 *     에 동일 deliveryDefaults 적용 (각 order 별 lot/location 다를 시
 *     UI 에서 single-item 사용 권장).
 *   - admin role 체크는 underlying single-item endpoint 가 강제 —
 *     본 엔드포인트는 thin wrapper, 자체 enforcement 0.
 */

interface BulkStatusBody {
  orderIds: string[];
  status: string;
  notes?: string;
  deliveryDefaults?: {
    lotNumber?: string;
    expiryDate?: string;
    location?: string;
    receivedAt?: string;
  };
}

interface BulkResult {
  successCount: number;
  failedItems: Array<{ orderId: string; error: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as BulkStatusBody;
    const { orderIds, status, notes, deliveryDefaults } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "orderIds 배열이 비어 있습니다." },
        { status: 400 }
      );
    }
    if (orderIds.length > 50) {
      return NextResponse.json(
        { error: "한 번에 최대 50건까지 처리할 수 있습니다." },
        { status: 400 }
      );
    }
    if (!status) {
      return NextResponse.json(
        { error: "status 가 필요합니다." },
        { status: 400 }
      );
    }

    // single-item endpoint 를 sequential 호출 (transaction 분리 — 부분 실패 허용)
    const result: BulkResult = {
      successCount: 0,
      failedItems: [],
    };

    // forward host + cookie 로 같은 session 유지
    const baseUrl = req.nextUrl.origin;
    const cookie = req.headers.get("cookie") ?? "";
    const csrfToken = req.headers.get("x-csrf-token") ?? "";

    for (const orderId of orderIds) {
      try {
        const res = await fetch(`${baseUrl}/api/admin/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            cookie,
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({ status, notes, deliveryDefaults }),
        });
        if (res.ok) {
          result.successCount += 1;
        } else {
          const errBody = await res.json().catch(() => ({}));
          result.failedItems.push({
            orderId,
            error: errBody?.error ?? `HTTP ${res.status}`,
          });
        }
      } catch (err: any) {
        result.failedItems.push({
          orderId,
          error: err?.message ?? "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[admin/orders/bulk-status] error:", error);
    return NextResponse.json(
      { error: "Bulk status 전환에 실패했습니다." },
      { status: 500 }
    );
  }
}
