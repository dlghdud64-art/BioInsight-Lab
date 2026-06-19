import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthUser } from "@/lib/auth/mobile-jwt";
import { createQuote } from "@/lib/api/quotes";
import { sendQuoteConfirmationToUser, sendQuoteNotificationToVendors, sendQuoteReceivedEmail } from "@/lib/email";
import { db, isPrismaAvailable } from "@/lib/db";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType } from "@prisma/client";
import { generateShareToken } from "@/lib/api/share-token";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { enforcePlanLimit, PlanLimitError } from "@/lib/billing/enforce-plan-limit";
// #quote-payload-zod-schema — §11.203 silent assumption 후속 안전장치.
// payload validation 의 single source. invalid payload → structured 400
// + 운영자 친화 한국어 메시지 + enforcement.fail() (§11.21 lock 정합).
import {
  quoteCreatePayloadSchema,
  formatQuoteValidationError,
} from "@/lib/validation/quote-create-schema";

// 견적 요청 생성
export async function POST(request: NextRequest) {
  // body와 session을 try 블록 밖에서 선언하여 catch 블록에서도 접근 가능하도록 수정
  let body: any = {};
  let session: any = null;
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // §pricing-refresh P2 — Free RFQ 한도 enforce(grandfather/유료/env미설정은 통과). 초과 시 429+안내.
    try {
      await enforcePlanLimit(session.user.id, "quotes");
    } catch (e) {
      if (e instanceof PlanLimitError) {
        return NextResponse.json(
          { error: e.message, code: e.code, limit: e.limit, used: e.used },
          { status: 429 },
        );
      }
      throw e;
    }

    // ── Security enforcement ──
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'quote_request_create',
      targetEntityType: 'quote',
      targetEntityId: 'new',
      sourceSurface: 'quote-creation-api',
      routePath: '/api/quotes',
    });
    if (!enforcement.allowed) return enforcement.deny();

    body = await request.json();

    // #quote-payload-zod-schema — §11.203 silent assumption 후속.
    // hand-rolled validation (빈 items 체크 만) 을 zod schema 로 swap.
    // caller drift 즉시 catch (예: items[].quantity 가 string 으로 와도
    // 즉시 400 + 운영자 친화 메시지 + enforcement.fail()).
    const parseResult = quoteCreatePayloadSchema.safeParse(body);
    if (!parseResult.success) {
      const formatted = formatQuoteValidationError(parseResult.error);
      enforcement?.fail();
      return NextResponse.json(
        { error: formatted.error, message: formatted.message, details: formatted.details },
        { status: 400 },
      );
    }
    const validated = parseResult.data;
    const {
      title,
      message,
      vendorMessages, // 벤더별 개별 메시지: { [vendorId]: string }
      deliveryDate,
      deliveryLocation,
      specialNotes,
      items, // 새로운 형식: [{ productId, vendorId, quantity, notes }]
      productIds, // 기존 형식 (하위 호환성)
      quantities,
      notes,
      organizationId: clientOrganizationId,
    } = validated;

    // 서버 세션 기반 organizationId 결정 (P2003 방지: 실제 Organization 존재 여부까지 검증)
    let serverOrgId: string | null = null;
    try {
      const clientOrgId = (typeof clientOrganizationId === "string" ? clientOrganizationId.trim() : null) || null;
      if (clientOrgId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: clientOrgId },
          select: { organizationId: true },
        });
        serverOrgId = membership?.organizationId ?? null;
      }
      if (!serverOrgId) {
        const firstMembership = await db.organizationMember.findFirst({
          where: { userId: session.user.id },
          orderBy: { createdAt: "asc" },
          select: { organizationId: true },
        });
        serverOrgId = firstMembership?.organizationId ?? null;
      }
      // organizationId가 있으면 실제 Organization 테이블에 존재하는지 확인 (P2003 방지)
      if (serverOrgId) {
        const orgExists = await db.organization.findUnique({
          where: { id: serverOrgId },
          select: { id: true },
        });
        if (!orgExists) {
          console.warn(`[quotes/POST] Organization ${serverOrgId} not found in DB. Setting to null.`);
          serverOrgId = null;
        }
      }
    } catch (orgErr: any) {
      console.warn("[quotes/POST] organizationId lookup failed, proceeding without org:", orgErr?.message);
      serverOrgId = null;
    }

    // items가 있으면 새로운 형식, 없으면 기존 형식
    // §11.239 — quantities / notes 는 legacy form 의 Record<string, ...> payload.
    // implicit any index sig 차단 — 명시 cast.
    const legacyQuantities = (quantities as Record<string, number> | undefined) ?? undefined;
    const legacyNotes = (notes as Record<string, string> | undefined) ?? undefined;
    const quoteItems = items || (productIds ? productIds.map((pid: string, idx: number) => ({
      productId: pid,
      vendorId: null, // 기존 형식은 vendorId 없음
      quantity: legacyQuantities?.[pid] || 1,
      notes: legacyNotes?.[pid] || "",
    })) : []);

    // title 자동 생성: 클라이언트가 빈 값으로 보내도 서버에서 fallback
    const resolvedTitle = (title && typeof title === "string" && title.trim())
      ? title.trim()
      : `견적 요청 — ${quoteItems.length}개 품목`;

    if (quoteItems.length === 0) {
      return NextResponse.json(
        { error: "견적 요청에 최소 1개 이상의 품목이 필요합니다." },
        { status: 400 }
      );
    }

    // 벤더별로 그룹화
    const vendorGroups = new Map<string, typeof quoteItems>();
    quoteItems.forEach((item: any) => {
      const vendorId = item.vendorId || "unknown";
      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, []);
      }
      vendorGroups.get(vendorId)!.push(item);
    });

    // 각 벤더별로 견적 생성 + 공유 링크 생성
    // shareToken은 루프 내부에서 벤더별로 독립 생성 → P2002(Unique Constraint) 방지
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    type QuoteWithShare = { quote: any; shareToken: string | null; shareUrl: string | null };
    const quoteResults: QuoteWithShare[] = [];

    for (const [vendorId, items] of vendorGroups.entries()) {
      const productIds = items.map((item: any) => item.productId);
      const quantities = Object.fromEntries(items.map((item: any) => [item.productId, item.quantity || 1]));
      const itemNotes = Object.fromEntries(items.map((item: any) => [item.productId, item.notes || ""]));
      // §11.239 — map → filter chain tuple narrow. `as [string, any]` 로 ([string,any])[] 정합.
      const vendorIds = Object.fromEntries(
        items
          .map((item: any) => [item.productId, item.vendorId] as [string, any])
          .filter(([, vid]) => vid)
      );

      // 벤더별 제목 생성
      const vendorTitle = vendorId !== "unknown"
        ? `${resolvedTitle} (${items.length}건)`
        : resolvedTitle;

      // 벤더별 메시지 생성 (개별 메시지가 있으면 우선 사용)
      const vendorProductCount = items.length;
      const vendorTotalAmount = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);

      let vendorMessage = "";
      if (vendorMessages && vendorMessages[vendorId]) {
        // 벤더별 개별 메시지가 있으면 사용 (이미 공통 메시지와 합쳐져 있음)
        vendorMessage = vendorMessages[vendorId];
        // 품목 정보 추가
        vendorMessage += `\n\n품목 수: ${vendorProductCount}개\n예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}`;
      } else if (message) {
        // 공통 메시지만 있는 경우
        vendorMessage = message.replace(/\d+건/g, `${vendorProductCount}건`)
                 .replace(/품목 수: \d+개/g, `품목 수: ${vendorProductCount}개`)
                 .replace(/예상 금액: ₩[\d,]+/g, `예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}`)
                 .replace(/예상 총액: ₩[\d,]+/g, `예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}`);
      } else {
        // 기본 메시지
        vendorMessage = `안녕하세요.\n\n아래 품목 ${vendorProductCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${vendorProductCount}개\n예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
      }

      // §11.203 — snapshot fields 보존 forward (createQuote 의 itemsDetailed
      //   path 통과). RequestWizardModal payload 가 catalog/search ref ID 와
      //   snapshot 정보 (name / catalogNumber / specification) 를 같이 보냄.
      //   itemsDetailed 가 있으면 createQuote 가 productId DB 검증 후 nullable
      //   QuoteListItem 으로 저장 — 비-canonical productId 도 안전.
      //   legacy productIds path 호환성 유지 (productIds 만 들어오는 caller 0 깨짐).
      const itemsDetailed = items.map((item: any, idx: number) => ({
        productId: item.productId ?? null,
        productName: item.name ?? item.productName ?? undefined,
        vendorName: item.vendorName ?? undefined,
        brand: item.brand ?? undefined,
        catalogNumber: item.catalogNumber ?? undefined,
        lineNumber: item.lineNumber ?? idx + 1,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? undefined,
        currency: item.currency ?? "KRW",
        lineTotal: item.lineTotal ?? undefined,
        notes: item.notes ?? undefined,
      }));

      const quote = await createQuote({
        userId: session.user.id,
        organizationId: serverOrgId ?? undefined,
        title: vendorTitle,
        message: vendorMessage,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        deliveryLocation,
        specialNotes,
        productIds,
        quantities,
        notes: itemNotes,
        vendorIds,
        itemsDetailed,
      });

      // 벤더별 공유 링크 생성: token을 루프 내부에서 매번 새로 생성 (P2002 방지)
      let quoteShareToken: string | null = null;
      let quoteShareUrl: string | null = null;
      try {
        const token = generateShareToken();
        const share = await db.quoteShare.create({
          data: { quoteId: quote.id, shareToken: token, enabled: true },
        });
        quoteShareToken = share.shareToken;
        quoteShareUrl = `${appUrl}/share/${share.shareToken}`;
      } catch (shareErr) {
        console.error("[quotes/POST] QuoteShare 생성 실패 (견적은 정상 생성됨):", shareErr);
      }

      quoteResults.push({ quote, shareToken: quoteShareToken, shareUrl: quoteShareUrl });
    }

    // 첫 번째 견적을 메인으로 사용 (하위 호환성)
    const quote = quoteResults[0]?.quote;

    // 관련 벤더 이메일 수집
    const vendorIds = Array.from(vendorGroups.keys()).filter(id => id !== "unknown");
    const productVendors = await db.productVendor.findMany({
      where: {
        vendorId: {
          in: vendorIds,
        },
        productId: {
          in: quoteItems.map((item: any) => item.productId),
        },
      },
      include: {
        vendor: true,
      },
    });

    const vendorEmails = Array.from(
      new Set(
        productVendors
          .map((pv: any) => pv.vendor.email)
          .filter((email: any): email is string => !!email)
      )
    );

    // 리드당 과금 처리 (비동기, 실패해도 견적은 생성됨)
    if (vendorIds.length > 0) {
      fetch("/api/vendor/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          vendorIds,
        }),
      }).catch((error) => {
        console.error("Failed to process billing:", error);
      });
    }

    // 이메일 발송 (비동기, 실패해도 견적은 생성됨)
    // 1. 기존 SendGrid 기반 이메일 (하위 호환성)
    Promise.all([
      sendQuoteConfirmationToUser(
        session.user.email || "",
        session.user.name || "사용자",
        quote.title,
        quote.id
      ),
      vendorEmails.length > 0 && sendQuoteNotificationToVendors(vendorEmails as string[], quote.title, quote.id),
    ]).catch((error) => {
      console.error("Failed to send quote emails (SendGrid):", error);
    });

    // 2. 새로운 Resend + React Email 기반 이메일 발송
    const totalAmount = quoteItems.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
    sendQuoteReceivedEmail({
      to: session.user.email || "",
      customerName: session.user.name || "고객",
      quoteNumber: quote.id.slice(-8).toUpperCase(),
      requestDate: new Date().toLocaleDateString("ko-KR"),
      itemCount: quoteItems.length,
      totalAmount: totalAmount > 0 ? `₩${totalAmount.toLocaleString("ko-KR")}` : undefined,
    }).catch((error) => {
      console.error("Failed to send quote received email (Resend):", error);
    });

    // 액티비티 로그 기록 (비동기, 실패해도 견적은 생성됨)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_CREATED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: serverOrgId || quote.organizationId || undefined,
      metadata: {
        title: quote.title,
        itemCount: quote.items?.length || 0,
        totalAmount: quote.items?.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0) || 0,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    // 공유 링크는 벤더별 루프 내에서 이미 생성됨 → 첫 번째 결과 추출 (하위 호환성)
    const shareToken = quoteResults[0]?.shareToken ?? null;
    const shareUrl = quoteResults[0]?.shareUrl ?? null;

    enforcement.complete({
      beforeState: { action: 'quote_request_create' },
      afterState: { quoteId: quote.id, quoteCount: quoteResults.length },
    });

    return NextResponse.json({ quote, shareToken, shareUrl }, { status: 201 });
  } catch (error: any) {
    enforcement?.fail();
    // 상세 에러 로깅 (Prisma 에러 코드/메타 포함)
    console.error("[quotes/POST] Error creating quote:", {
      message: error?.message,
      code: error?.code,          // Prisma: P2002, P2003 등
      meta: error?.meta,          // Prisma: 실패 필드명 등
      stack: error?.stack,
    });

    // ── 에러 발생 시 항상 실제 에러를 반환한다 ──
    // 이전에는 isDemoMode() 조건으로 dummy 201을 반환했으나,
    // 이는 프론트엔드가 성공으로 오판하여 워크큐에 데이터가 안 뜨는 원인이었다.
    // demo fallback 제거: 실패하면 실패로 응답한다.

    // §11.203 — payload validation failures → structured 400 (not raw 500).
    //   "No valid products" 같은 client-side payload 결함은 운영자가 다시
    //   시도 가능한 검증 실패. infrastructure 결함 (Prisma P2003/P2002 외)
    //   만 500 으로 유지.
    const isClientValidationError =
      error?.message?.includes("No valid products") ||
      error?.message?.includes("최소 1개 이상");
    if (isClientValidationError) {
      return NextResponse.json(
        {
          error: "QUOTE_SUBMIT_VALIDATION_FAILED",
          message:
            "요청 품목 정보가 부족해 견적 요청을 생성할 수 없습니다. 검색에서 품목을 다시 선택해 주세요.",
          _debug: { message: error?.message },
        },
        { status: 400 }
      );
    }

    // 클라이언트에 의미있는 에러 메시지 반환
    let clientMessage = "견적 생성에 실패했습니다.";
    if (error?.code === "P2003" || error?.message?.includes("Foreign key")) {
      clientMessage = "존재하지 않는 제품 또는 조직 정보가 포함되어 있습니다.";
    } else if (error?.code === "P2002") {
      clientMessage = "이미 동일한 견적이 존재합니다.";
    } else if (error?.message?.includes("organizationId") || error?.message?.includes("userId")) {
      clientMessage = "조직 또는 사용자 정보가 올바르지 않습니다.";
    }

    return NextResponse.json(
      {
        error: clientMessage,
        // 디버깅용: 실제 에러 메시지 포함 (추후 확인 후 제거)
        _debug: { message: error?.message, code: error?.code },
      },
      { status: 500 }
    );
  }
}

// 사용자의 견적 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    // §11.239 — Session.user.name nullable drift cast (§11.236 패턴 정합).
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized", quotes: [] }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get("status") || "all";
    const sortBy = searchParams.get("sortBy") || "newest";

    // 사용자가 속한 조직 ID 목록 조회 (실패해도 userId 조건으로 폴백)
    let userOrgIds: string[] = [];
    try {
      const memberships = await db.organizationMember.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      userOrgIds = memberships.map((m: any) => m.organizationId).filter(Boolean);
    } catch (orgErr: any) {
      console.warn("[quotes/GET] organizationMember lookup failed:", orgErr?.message);
    }

    // userId 또는 소속 조직의 organizationId 로 OR 조회
    // → organizationId만 저장된 견적도 목록에 포함 (누락 방지)
    const ownerCondition: Record<string, unknown> = {
      OR: [
        { userId: user.id },
        ...(userOrgIds.length > 0 ? [{ organizationId: { in: userOrgIds } }] : []),
      ],
    };

    // §pricing-refresh P4b — 아카이브분(archivedAt 세팅) 조회 숨김. env 미설정 시 전부 null=영향 0.
    const baseWhere: Record<string, unknown> =
      statusFilter && statusFilter !== "all"
        ? { AND: [ownerCondition, { status: statusFilter }] }
        : ownerCondition;
    const where: Record<string, unknown> = { ...baseWhere, archivedAt: null };

    const orderBy: Record<string, string> =
      sortBy === "oldest"
        ? { createdAt: "asc" }
        : { createdAt: "desc" };

    // #supplier-resolution-quote-vendor-email — vendor email forward chain.
    //   resolveSuppliers (apps/web/src/components/quotes/dispatch/resolve-suppliers.ts)
    //   가 3 source 사용:
    //     1. recent_rfq → vendorRequests[].vendorEmail
    //     2. supplier_book → items[].product.vendors[].vendor.email
    //     3. ai_recommended → quote.vendor (top-level, 본 forward 와 무관)
    //   기존 include 에 vendors join + select 누락 → resolveSuppliers 가 빈 array
    //   → preflight hardBlocked → batch dispatch 차단. canonical truth path
    //   (Product.vendors → ProductVendor.vendor → Vendor.email) 그대로 forward.
    //
    // §11.218 카드 구분자 (card disambiguation) — requester forward.
    //   같은 품목 다른 quote 의 sub-context 노출 (요청자 / 부서). user.name +
    //   organization.name 추가 forward — UI (QuoteCard) 가 displayTitle 아래
    //   sub-context 라벨 노출.
    const quotes = await db.quote.findMany({
      where,
      orderBy,
      include: {
        items: {
          orderBy: { lineNumber: "asc" },
          include: {
            product: {
              include: {
                vendors: {
                  include: {
                    vendor: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          include: {
            vendor: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        vendorRequests: {
          select: {
            id: true,
            status: true,
            vendorEmail: true,
            vendorName: true,
            respondedAt: true,
            createdAt: true,
          },
        },
        // §11.218 — requester / organization forward (card disambiguation).
        user: {
          select: { id: true, name: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    type MappedProductVendor = {
      vendor: { id: string; name: string; email: string | null } | null;
    };
    type MappedItem = {
      id: string;
      name?: string | null;
      quantity: number;
      product?: ({ id: string; name: string; vendors?: MappedProductVendor[] }) | null;
    };
    type MappedResponse = {
      id: string;
      totalPrice?: number | null;
      createdAt: Date;
      vendor?: { name: string } | null;
    };
    type MappedVendorRequest = {
      id: string;
      status: string;
      vendorEmail?: string | null;
      vendorName?: string | null;
      respondedAt?: Date | null;
      createdAt?: Date;
    };
    type MappedUser = { id: string; name: string | null; email: string | null } | null;
    type MappedOrganization = { id: string; name: string } | null;
    type MappedQuote = {
      id: string;
      title: string;
      description?: string | null;
      status: string;
      createdAt: Date;
      items?: MappedItem[];
      responses?: MappedResponse[];
      vendorRequests?: MappedVendorRequest[];
      // §11.218 — requester / organization forward.
      user?: MappedUser;
      organization?: MappedOrganization;
    };

    const mapped = quotes.map((q: MappedQuote) => ({
      id: q.id,
      title: q.title,
      description: q.description ?? null,
      status: q.status,
      createdAt: q.createdAt.toISOString(),
      deliveryDate: null,
      deliveryLocation: null,
      // §11.218 카드 구분자 — requester forward (UI sub-context).
      user: q.user
        ? { id: q.user.id, name: q.user.name, email: q.user.email }
        : null,
      organization: q.organization
        ? { id: q.organization.id, name: q.organization.name }
        : null,
      items: (q.items || []).map((item: MappedItem) => ({
        id: item.id,
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              // #supplier-resolution-quote-vendor-email — supplier_book forward.
              vendors: (item.product.vendors || []).map((pv: MappedProductVendor) => ({
                vendor: pv.vendor
                  ? { id: pv.vendor.id, name: pv.vendor.name, email: pv.vendor.email }
                  : null,
              })),
            }
          : { id: "", name: item.name || "(품목)", vendors: [] },
        quantity: item.quantity,
      })),
      responses: (q.responses || []).map((r: MappedResponse) => ({
        id: r.id,
        vendor: { name: r.vendor?.name || "" },
        totalPrice: r.totalPrice ?? undefined,
        createdAt: r.createdAt.toISOString(),
      })),
      // #supplier-resolution-quote-vendor-email — recent_rfq forward.
      vendorRequests: (q.vendorRequests || []).map((vr: MappedVendorRequest) => ({
        id: vr.id,
        status: vr.status,
        vendorEmail: vr.vendorEmail ?? null,
        vendorName: vr.vendorName ?? null,
        respondedAt: vr.respondedAt ? vr.respondedAt.toISOString() : null,
        createdAt: vr.createdAt ? vr.createdAt.toISOString() : null,
      })),
    }));

    return NextResponse.json({ quotes: mapped });
  } catch (error: any) {
    console.error("[quotes/GET] Error fetching quotes:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: "견적 목록 조회에 실패했습니다.", quotes: [] },
      { status: 500 }
    );
  }
}