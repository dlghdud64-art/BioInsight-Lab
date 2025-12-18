import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * Analytics 이벤트 추적 API
 * PRD 14.4 이벤트(Analytics) 설계 초안 기반
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, properties } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json(
        { error: "Event name is required" },
        { status: 400 }
      );
    }

    // 세션 정보 가져오기 (선택사항)
    const session = await auth();
    const userId = session?.user?.id || properties?.user_id || null;

    // 이벤트 데이터 저장
    try {
      // ActivityLog 모델 사용
      if (db && db.activityLog) {
        // 이벤트 타입을 ActivityType으로 매핑
        const activityTypeMap: Record<string, string> = {
          search_run: "SEARCH_PERFORMED",
          result_add_to_compare: "PRODUCT_COMPARED",
          result_add_to_list: "QUOTE_CREATED",
          compare_open: "PRODUCT_COMPARED",
          compare_remove_item: "PRODUCT_COMPARED",
          list_open: "QUOTE_VIEWED",
          list_export_tsv: "QUOTE_VIEWED",
          list_export_csv: "QUOTE_VIEWED",
          list_export_xlsx: "QUOTE_VIEWED",
          list_save: "QUOTE_CREATED",
          list_load: "QUOTE_VIEWED",
          share_link_create: "QUOTE_SHARED",
          share_link_open: "QUOTE_VIEWED",
          rfq_create: "QUOTE_CREATED",
        };

        const activityType = activityTypeMap[event] || "SEARCH_PERFORMED";

        await db.activityLog.create({
          data: {
            userId: userId || undefined,
            activityType: activityType as any,
            entityType: "analytics_event",
            entityId: event,
            metadata: properties || {},
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
            userAgent: request.headers.get("user-agent") || null,
          },
        });
      } else {
        // ActivityLog 모델이 없으면 콘솔에만 로그
        console.log("[Analytics Event]", {
          event,
          properties,
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (dbError) {
      // DB 에러는 조용히 무시 (Analytics는 앱 동작에 영향을 주지 않아야 함)
      console.debug("Analytics DB error:", dbError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Analytics 에러는 앱 동작에 영향을 주지 않아야 함
    console.debug("Analytics tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 }
    );
  }
}

