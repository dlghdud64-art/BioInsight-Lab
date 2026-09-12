import { NextRequest, NextResponse } from "next/server";
import { noOrganizationResponse } from "@/lib/organizations/no-organization";
import { auth } from "@/auth";
import { db } from "@/lib/db";
// §cas-hazard-classification P3b — 수기/API 입고 시 CAS→casNo 저장 + 정적 위험분류.
import { buildProductHazardFields } from "@/lib/safety/product-hazard-fields";
import { getAuthUser } from "@/lib/auth/mobile-jwt";
import {
  buildInventoryDisposalPriority,
  summarizeInventoryDisposalPriorities,
} from "@/lib/inventory/disposal-readiness";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { enforcePlanLimit, PlanLimitError, assertTrackingModeAllowed, TrackingModePlanError } from "@/lib/billing/enforce-plan-limit";
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";

// 재고 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // §11.236 — Session type drift (NextAuth Session vs getAuthUser narrow). cast.
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 검색/필터 파라미터
    const search   = searchParams.get("search")?.trim()   || null; // 다중 필드 검색어
    const status   = searchParams.get("status")           || null; // "low" | "expired" | "expiring"
    const location = searchParams.get("location")?.trim() || null; // 보관 위치 부분 일치
    const category = searchParams.get("category")         || null; // ProductCategory enum 값
    // §product-detail §3-1 (B1, 2026-08-09) — 제품 단위 재고 조회.
    //   제품 상세의 "우리 조직 재고" 블록이 productId 로 정확 조회한다.
    //   ⚠️ `inventory/lookup` 은 catalogNumber/productName 텍스트로 `{ inventoryId }` 하나만
    //   돌려주는 스마트입고 매칭 헬퍼라 이 용도에 쓸 수 없다(실측 SCOPING §1).
    //   ownerCondition(조직/사용자 스코프)은 그대로 적용 — 남의 조직 재고가 새지 않는다.
    const productId = searchParams.get("productId")?.trim() || null;

    // 하위 호환: lowStock=true 는 status=low 와 동일하게 처리
    const lowStock =
      searchParams.get("lowStock") === "true" || status === "low";

    // -----------------------------------------------------------------------
    // #api-inventory-organization-scope-auto — auto organization scope.
    //   queryString 없을 때도 user 가 속한 모든 organization 의 ProductInventory
    //   가 자동 노출 (조직 멤버 collaboration 정합 + pilot row 가시성). explicit
    //   `?organizationId=` queryString 은 그대로 single-org 우선 (override) 보존.
    //   { userId: user.id } 분기 보존 (legacy single-user row 호환).
    // -----------------------------------------------------------------------
    const memberships = await db.organizationMember.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    // §11.236 — Prisma select return implicit any narrow.
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);

    const ownerCondition: any = {
      OR: [
        { userId: user.id },
        ...(organizationId
          ? [{ organizationId }]
          : orgIds.map((id: string) => ({ organizationId: id }))),
      ],
    };

    // -----------------------------------------------------------------------
    // AND 필터 목록 동적 구성
    // -----------------------------------------------------------------------
    const andFilters: any[] = [];

    // 1. 다중 필드 부분 일치 검색 (product 관계 필드 OR)
    //    대상: name(시약명), nameEn(영문명), catalogNumber(카탈로그 번호),
    //          lotNumber(로트 번호), brand(브랜드)
    //    + notes(비고): 운영자가 lotNo 등을 notes에 기록하는 경우 포함
    if (search) {
      andFilters.push({
        OR: [
          {
            product: {
              OR: [
                { name:          { contains: search, mode: "insensitive" } },
                { nameEn:        { contains: search, mode: "insensitive" } },
                { catalogNumber: { contains: search, mode: "insensitive" } },
                { lotNumber:     { contains: search, mode: "insensitive" } },
                { brand:         { contains: search, mode: "insensitive" } },
              ],
            },
          },
          // 재고 비고(notes)에서도 검색 (lotNo 등 메모 포함)
          { notes: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    // 2. 보관 위치 부분 일치 (대소문자 무시)
    if (location) {
      andFilters.push({
        location: { contains: location, mode: "insensitive" },
      });
    }

    // 3. 카테고리 필터 (product.category 정확 일치, ProductCategory enum)
    if (category) {
      andFilters.push({
        product: { category },
      });
    }

    // 4. 재고 상태 필터
    // NOTE: lowStock 필터는 Prisma에서 필드 간 비교(lte: field)를 지원하지 않으므로
    //       DB 조회 후 JS 사이드에서 필터링합니다 (아래 postFilter 참조).
    if (lowStock) {
      // DB 레벨에서는 사전 필터링하지 않음 — JS에서 후처리
    } else if (status === "expired") {
      // 유통기한 만료
      andFilters.push({ expiryDate: { lt: new Date() } });
    } else if (status === "expiring") {
      // 30일 이내 유통기한 만료 예정
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      andFilters.push({
        expiryDate: { gte: new Date(), lt: in30Days },
      });
    }

    // -----------------------------------------------------------------------
    // 최종 where 조건 조합
    // -----------------------------------------------------------------------
    const where: any = {
      ...ownerCondition,
      ...(productId ? { productId } : {}), // §product-detail §3-1 — 제품 단위 스코프
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };
    // §pricing-refresh P4b — 아카이브분(archivedAt 세팅) 조회 숨김. env 미설정 시 전부 null=영향 0.
    where.archivedAt = null;

    const inventories = await db.productInventory.findMany({
      where,
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
        // 다중 Lot 표시를 위한 입고 이력 포함 (Lot 번호 + 유효기한만 조회)
        restockRecords: {
          select: {
            id: true,
            lotNumber: true,
            expiryDate: true,
            quantity: true,
            restockedAt: true,
          },
          orderBy: { restockedAt: "desc" },
        },
      },
      orderBy: {
        currentQuantity: "asc",
      },
    });

    // lowStock 필터: JS 사이드 후처리 (Prisma 필드 간 비교 미지원)
    const filtered = lowStock
      ? inventories.filter((inv: any) => {
          if (inv.safetyStock != null) {
            return inv.currentQuantity <= inv.safetyStock;
          }
          return inv.currentQuantity <= 0;
        })
      : inventories;

    const inventoriesWithDisposalPriority = filtered.map((inventory: any) => ({
      ...inventory,
      disposalPriority: buildInventoryDisposalPriority(inventory),
    }));

    return NextResponse.json({
      inventories: inventoriesWithDisposalPriority,
      disposalPrioritySummary: summarizeInventoryDisposalPriorities(filtered),
    });
  } catch (error) {
    console.error("Error fetching inventories:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventories" },
      { status: 500 }
    );
  }
}

// 재고 생성
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* §invite-flow Phase 2-8 — 한도를 **호출자가 정한 조직**의 플랜으로 잰다.
     *   auth 직후·`enforceAction`(:238) 앞이라 기존 선제 차단 배치는 그대로다.
     *
     * 🛑 §inventory-org-session-authority (호영님 2026-09-10 P0) — **조직 출처는 여기 하나다.**
     *   이전 판본은 같은 핸들러 안에서 조직을 **두 곳**에서 읽었다:
     *     한도 판정 → 세션(이 줄)
     *     저장      → `body.organizationId` (멤버십 검증 0)
     *   후자가 cross-tenant **write** 다 — 남의 조직 id 를 실으면 그 조직 재고로 들어갔다.
     *   오늘 아침 OCR 5라우트에 내린 (C′) 판정과 같다: **세션이 유일한 권위**다.
     *   "지금 클라이언트가 안 보낸다" 는 방어가 아니다 — API 가 열려 있으면 열려 있는 것이다.
     *
     * 🔑 관대한 `resolveActiveOrganizationId` 가 아니라 mutation resolver 를 쓴다
     *   (§invite-flow P2-5). hint 를 **안 받으므로** 실패 사유는 `no_organization` 뿐이다.
     *
     * 🛑 §inventory-org-required (호영님 2026-09-11) — **재고는 조직의 것이다. 개인 재고는 제품 개념이 아니다.**
     *   이전 판본은 no_organization 을 "개인 재고" 로 흘렸다(729c73cc 에서 내가 넣은 fallback).
     *   그 결과 조직에 속하지 않은 행이 생기고(prod BCP 1행 · ownerlessCount 1) 조직 지표에서 빠졌다.
     *   이제 422 로 거절하되 막다른 길로 끝내지 않는다 — 조직 만들기·참여 경로를 응답에 싣는다
     *   (smart-receiving 의 NO_ORGANIZATION 과 같은 코드). 거절은 한도 판정·enforceAction **앞**이다. */
    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
    });
    if (!orgResolution.ok) {
      return noOrganizationResponse("재고를 등록할");
    }
    const activeOrganizationId = orgResolution.organizationId;

    // §pricing-refresh P2 — Free 재고 품목 한도 enforce(grandfather/유료/env미설정은 통과). 초과 시 429+안내.
    try {
      await enforcePlanLimit(session.user.id, "inventory", activeOrganizationId);
    } catch (e) {
      if (e instanceof PlanLimitError) {
        return NextResponse.json(
          { error: e.message, code: e.code, limit: e.limit, used: e.used },
          { status: 429 },
        );
      }
      throw e;
    }

    const body = await request.json();
    const productId = body.productId || 'unknown';

    // §pricing-enforce-p2 — LOT/GMP_STRICT 는 Pro 플랜만(서버 게이트, lock 획득 전). 미허용 plan 403 품위 안내.
    if (body.trackingMode === "LOT" || body.trackingMode === "GMP_STRICT") {
      try {
        await assertTrackingModeAllowed(session.user.id, body.trackingMode);
      } catch (e) {
        if (e instanceof TrackingModePlanError) {
          return NextResponse.json(
            { error: e.message, code: e.code, mode: e.mode },
            { status: 403 },
          );
        }
        throw e;
      }
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'inventory_create',
      targetEntityType: 'inventory',
      targetEntityId: productId,
      sourceSurface: 'inventory-api',
      routePath: '/api/inventory',
    });
    if (!enforcement.allowed) return enforcement.deny();
    const {
      productId: rawProductId,
      // 수기 입력 시 클라이언트가 전달하는 제품 메타 정보 (Find-or-Create 에 사용)
      productName,
      brand,
      catalogNumber,
      manufacturer,
      category: clientCategory,
      currentQuantity,
      unit,
      safetyStock,
      minOrderQty,
      location,
      expiryDate,
      notes,
      autoReorderEnabled,
      autoReorderThreshold,
      /* 🛑 §inventory-org-session-authority — `organizationId` 를 **여기서 받지 않는다.**
       *   무시하는 것으로는 부족하다: 받아 두면 다음 사람이 배선한다.
       *   조직은 위 `activeOrganizationId`(세션) 하나뿐이다. */
      // §11.326 — 라벨 추출 규격(통 1개 함량). 입고 수량과 분리, Product 마스터에 저장.
      packSize,
      packUnit,
      // §cas-hazard-classification P3b — CAS(선택). 수기/스캔/API import 경로 공용.
      casNumber,
      // 아래 필드는 스키마에 없으므로 notes에 병합 처리
      lotNumber,
      testPurpose,
      trackingMode, // §inventory-phaseB P3-UI-b — 추적 모드(QUANTITY/LOT/GMP_STRICT).
      // §scan-cat-guard — Cat.No. 없이 신규 등록 override(기본 false = 서버 방어).
      allowMissingCatalog,
    } = body;

    // productId가 없거나 "manual-" 접두사(수기 임시 ID)인 경우 수기 입력으로 판별
    const isManual =
      !rawProductId ||
      (typeof rawProductId === "string" && rawProductId.startsWith("manual-"));

    // 수기 입력 시 품목명은 필수
    if (isManual && !productName?.trim()) {
      return enforcement.reject(400, { error: "수기 입력 시 품목명(productName)은 필수입니다." });
    }

    // notes에 testPurpose 병합 (lotNumber는 전용 DB 컬럼으로 저장)
    const mergedNotes = [
      notes,
      testPurpose ? `[시험항목: ${testPurpose}]` : null,
    ]
      .filter(Boolean)
      .join("\n") || null;

    // 공통 재고 데이터 (productId 제외)
    const inventoryData = {
      /* §inventory-org-session-authority — 소유 2축(호영님 2026-09-10 판정):
       *   `userId` = 행위자 · `organizationId` = 스코프. 세션에서만 온다.
       *   🔑 옛 XOR(`userId: activeOrganizationId ? null : …`)은 한도 주체가 미정이던 때의 보류였다.
       *     e6ba7456(§plan-limit-subject)로 사용량이 조직 기준이 됐고, §inventory-org-required 로
       *     조직 없는 등록이 422 가 됐으므로 이제 행위자를 그대로 남긴다(smart-receiving 과 같은 2축). */
      userId: session.user.id,
      organizationId: activeOrganizationId,
      currentQuantity: parseFloat(String(currentQuantity)) || 0,
      unit: unit || "ea",
      safetyStock:
        safetyStock !== undefined && safetyStock !== null && safetyStock !== ""
          ? parseFloat(String(safetyStock))
          : null,
      minOrderQty:
        minOrderQty !== undefined && minOrderQty !== null && minOrderQty !== ""
          ? parseFloat(String(minOrderQty))
          : null,
      location: location || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      lotNumber: lotNumber?.trim() || null,
      // §inventory-phaseB P3-UI-b — 화이트리스트(임의 값 차단) + 기본 QUANTITY(회귀 0).
      trackingMode: trackingMode === "LOT" || trackingMode === "GMP_STRICT" ? trackingMode : "QUANTITY",
      notes: mergedNotes,
      autoReorderEnabled: Boolean(autoReorderEnabled),
      autoReorderThreshold:
        autoReorderThreshold !== undefined &&
        autoReorderThreshold !== null &&
        autoReorderThreshold !== ""
          ? parseFloat(String(autoReorderThreshold))
          : null,
    };

    const inventoryInclude = {
      product: {
        include: {
          vendors: {
            include: { vendor: true },
            take: 1,
            orderBy: { priceInKRW: "asc" },
          },
        },
      },
    } as const;

    // -----------------------------------------------------------------------
    // 수기 입력 경로: Find-or-Create Product → Create Inventory (트랜잭션)
    // -----------------------------------------------------------------------
    if (isManual) {
      const resolvedBrand = (brand || manufacturer || "").trim() || null;
      const resolvedCatalog = (catalogNumber || "").trim() || null;
      const resolvedName = productName.trim();

      // §scan-cat-guard (호영님 2026-07-03) — Cat.No.(품목 유일 식별키) 없이 신규 Product 생성 방어.
      //   Cat 미지정 + override 미승인 + 이름 매칭 기존 품목 없음 → 신규 create 보류(422).
      //   (이름 매칭 기존 품목 있으면 재사용 → 통과). UI 우회·직접 API 호출도 차단(defense-in-depth).
      if (!resolvedCatalog && !allowMissingCatalog) {
        const nameMatch = await db.product.findFirst({
          where: { name: { equals: resolvedName, mode: "insensitive" } },
          select: { id: true },
        });
        if (!nameMatch) {
          return enforcement.reject(422, {
              error:
                "식별 정보(Cat.No.)가 없어 신규 품목을 등록할 수 없습니다 — Cat.No.를 입력하거나 확인 후 진행하세요.",
              code: "catalog_required",
            });
        }
      }

      const inventory = await db.$transaction(async (tx: any) => {
        // 1. 동일 품목명+카탈로그번호로 기존 제품 검색 (중복 생성 방지)
        const existingProduct = await tx.product.findFirst({
          where: {
            name: { equals: resolvedName, mode: "insensitive" },
            ...(resolvedCatalog
              ? { catalogNumber: { equals: resolvedCatalog, mode: "insensitive" } }
              : {}),
          },
          select: { id: true },
        });

        // 2. 없으면 새 제품 마스터 생성
        const product = existingProduct
          ? existingProduct
          : await tx.product.create({
              data: {
                name: resolvedName,
                brand: resolvedBrand,
                catalogNumber: resolvedCatalog,
                manufacturer: resolvedBrand, // manufacturer 컬럼도 동일 값으로 저장
                category: clientCategory ?? "REAGENT", // 미지정 시 기본값 REAGENT
                // §11.326 — 라벨 규격(통 1개 함량). 입고 수량과 분리.
                packSize: typeof packSize === "number" ? packSize : null,
                packUnit: packUnit ?? null,
                // §cas-hazard-classification P3b — casNo + 정적 위험분류(hazardCodes/pictograms) 저장.
                ...buildProductHazardFields(casNumber),
              },
              select: { id: true },
            });

        // 3. 중복 재고 확인 (동일 user/org + product)
        const duplicateCheck = activeOrganizationId
          ? await tx.productInventory.findFirst({
              where: { organizationId: activeOrganizationId, productId: product.id },
            })
          : await tx.productInventory.findFirst({
              where: { userId: session.user.id, productId: product.id },
            });

        if (duplicateCheck) {
          // 트랜잭션 내에서 에러를 throw하면 롤백 처리됨
          throw Object.assign(new Error("이미 등록된 재고입니다. 수정 기능을 이용해 주세요."), {
            statusCode: 409,
          });
        }

        // 4. 재고 생성 (Find-or-Create 된 productId 사용)
        return await tx.productInventory.create({
          data: { productId: product.id, ...inventoryData },
          include: inventoryInclude,
        });
      });

      return NextResponse.json({ inventory }, { status: 201 });
    }

    // -----------------------------------------------------------------------
    // 기존 경로: productId로 직접 조회 후 재고 생성
    // -----------------------------------------------------------------------
    const resolvedProductId = rawProductId as string;

    const product = await db.product.findUnique({ where: { id: resolvedProductId } });
    if (!product) {
      return enforcement.reject(404, { error: "존재하지 않는 제품입니다." });
    }

    // 중복 재고 확인 (동일 user/org + product)
    const existing = activeOrganizationId
      ? await db.productInventory.findFirst({
          where: { organizationId: activeOrganizationId, productId: resolvedProductId },
        })
      : await db.productInventory.findFirst({
          where: { userId: session.user.id, productId: resolvedProductId },
        });

    if (existing) {
      return enforcement.reject(409, { error: "이미 등록된 재고입니다. 수정 기능을 이용해 주세요." });
    }

    const inventory = await db.productInventory.create({
      data: { productId: resolvedProductId, ...inventoryData },
      include: inventoryInclude,
    });

    enforcement.complete({ organizationId: activeOrganizationId });
    return NextResponse.json({ inventory }, { status: 201 });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error creating inventory:", error);
    const status = error?.statusCode ?? 500;
    return NextResponse.json(
      { error: error.message || "재고 등록에 실패했습니다." },
      { status }
    );
  }
}