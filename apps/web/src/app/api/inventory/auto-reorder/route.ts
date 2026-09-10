import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createQuote } from "@/lib/api/quotes";
// §inventory-org-session-authority — 쓰기의 조직은 세션에서만 온다(§invite-flow P2-5).
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";

// 자동 재주문 실행 API
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'order',
      // §enforcement-handle-close-sweep (inventory) — 'unknown' **유지**. 이 라우트는 조직의
      //   미달 재고 전체를 훑어 견적을 만드는 배치라 targetEntityType('order') 에 해당하는
      //   대상 엔티티가 호출 시점에 없다(주문은 이 호출의 결과물). 억지 id 를 넣으면
      //   per-call unique 가 되어 double-submit 보호가 사라진다 — 'unknown' 은 전역 공용 키가
      //   아니라 userId 폴백(§11.369-3 deriveConcurrencyKey)이라 per-user 보호가 유지된다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/inventory/auto-reorder',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    /* 🛑 §inventory-org-session-authority (호영님 2026-09-10 P0) — `organizationId` 를
     *   body 에서 **받지 않는다.** 이전 판본은 그 값을 두 곳에 그대로 넣었다:
     *     읽기 `productInventory.findMany({ OR: [..., { organizationId }] })` → 남의 조직 재고 노출
     *     쓰기 `createQuote({ organizationId })`                              → 남의 조직에 견적 생성
     *   멤버십 검증은 어디에도 없었다. 조직의 권위 있는 출처는 세션 하나다.
     *   🔑 이 라우트는 검출기가 처음에 "쓰기X" 로 분류했다 — 쓰기가 `createQuote` **헬퍼를
     *     통과**하기 때문이다(절차 A: 테이블 이름이 아니라 쓰는 심볼로 찾는다). */
    const { dryRun = false } = body;
    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
    });
    const activeOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

    // 자동 재주문이 활성화된 재고 조회
    // #api-inventory-read-org-scope-auto — auto organization scope (M2 mirror).
    //   user 가 속한 모든 organization 의 자동 재주문 inventory 가 자동 노출 —
    //   조직 멤버 collaboration 정합 + pilot row 가시성.
    // 🛑 "explicit organizationId body 는 single-org override 보존" 이라는 옛 문장은
    //   §inventory-org-session-authority(2026-09-10)로 **더 이상 참이 아니다** — 그 override 가
    //   곧 cross-tenant read 였다. 주석을 지우지 않고 무효를 적는다(다음 사람이 되살리지 않게).
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    // §11.236 — Prisma select implicit any narrow.
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const inventories = await db.productInventory.findMany({
      where: {
        autoReorderEnabled: true,
        /* 🔑 읽기 축은 **내가 속한 조직 전량**이다 — 그건 구조상 안전하다(전부 내 것).
         *   body override 를 없앴으므로 남의 조직이 이 OR 에 들어올 방법이 없다. */
        OR: [
          { userId: session.user.id },
          ...orgIds.map((id: string) => ({ organizationId: id })),
        ],
      },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
              take: 1,
              orderBy: {
                priceInKRW: "asc",
              },
            },
          },
        },
        usageRecords: {
          orderBy: {
            usageDate: "desc",
          },
          take: 30,
        },
      },
    });

    // 재주문이 필요한 항목 필터링
    const reorderItems = inventories
      .map((inventory: any) => {
        const currentQty = inventory.currentQuantity;
        const threshold = inventory.autoReorderThreshold || inventory.safetyStock || 0;

        // 임계값 이하인 경우 재주문 필요
        if (currentQty <= threshold) {
          // 사용량 추정
          let estimatedMonthlyUsage = 0;
          if (inventory.usageRecords.length > 0) {
            // 타입 에러 수정: sum과 record 파라미터에 타입 명시
            const totalUsage = inventory.usageRecords.reduce(
              (sum: number, record: any) => sum + record.quantity,
              0
            );
            const days = Math.max(
              1,
              Math.floor(
                (Date.now() -
                  inventory.usageRecords[inventory.usageRecords.length - 1].usageDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            );
            estimatedMonthlyUsage = (totalUsage / days) * 30;
          }

          // 재주문 수량 계산
          const recommendedQty = Math.max(
            inventory.minOrderQty || 1,
            Math.ceil(threshold + estimatedMonthlyUsage - currentQty)
          );

          return {
            inventoryId: inventory.id,
            productId: inventory.productId,
            quantity: recommendedQty,
            product: inventory.product,
          };
        }
        return null;
      })
      // 타입 에러 수정: item 파라미터에 타입 명시
      .filter((item: any): item is NonNullable<typeof item> => item !== null);

    if (reorderItems.length === 0) {
      enforcement.fail();
      return NextResponse.json({
        message: "재주문이 필요한 항목이 없습니다.",
        items: [],
      });
    }

    if (dryRun) {
      // ⚠️ 정상 완료 경로인데 fail() 이다 — **버그 아님. complete() 로 바꾸지 말 것.**
      //   dryRun 은 생성 없이 결과만 반환한다. complete() 를 부르면 실제로 만들지 않은
      //   재발주 견적을 "생성 완료"로 감사에 남기게 된다 = 거짓 감사.
      //   fail() = lock 해제(audit 미기록).
      enforcement.fail();
      // 드라이런 모드: 실제로 생성하지 않고 결과만 반환
      return NextResponse.json({
        message: `${reorderItems.length}개 항목이 재주문 대상입니다.`,
        // 타입 에러 수정: map 함수의 item 파라미터에 타입 명시
        items: reorderItems.map((item: any) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unit: item.inventoryId, // 실제로는 unit을 가져와야 함
        })),
      });
    }

    // 실제 재주문: 품목 리스트 생성
    const quote = await createQuote({
      userId: session.user.id,
      // createQuote 의 계약은 `string | undefined` 다 — null 을 받지 않는다(tsc 실측).
      organizationId: activeOrganizationId ?? undefined,
      title: `자동 재주문 - ${new Date().toLocaleDateString("ko-KR")}`,
      message: `재고가 안전 재고 이하로 떨어져 자동으로 생성된 재주문 리스트입니다.`,
      // 타입 에러 수정: item 파라미터에 타입 명시
      productIds: reorderItems.map((item: any) => item.productId),
      quantities: Object.fromEntries(
        reorderItems.map((item: any) => [item.productId, item.quantity])
      ),
      notes: Object.fromEntries(
        reorderItems.map((item: any) => [
          item.productId,
          `자동 재주문 (재고: ${item.inventoryId})`,
        ])
      ),
    });

    enforcement.complete({
      beforeState: { organizationId: activeOrganizationId, quoteId: null },
      afterState: { organizationId: activeOrganizationId, quoteId: quote.id, itemCount: reorderItems.length },
    });

    return NextResponse.json({
      message: `${reorderItems.length}개 항목으로 재주문 리스트가 생성되었습니다.`,
      quoteId: quote.id,
      items: reorderItems,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error executing auto-reorder:", error);
    return NextResponse.json(
      { error: error.message || "자동 재주문 실행에 실패했습니다." },
      { status: 500 }
    );
  }
}
