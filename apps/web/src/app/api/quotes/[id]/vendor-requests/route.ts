import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOrCreateGuestKey } from "@/lib/api/guest-key";
import { generateVendorRequestToken } from "@/lib/api/vendor-request-token";
import { sendEmail } from "@/lib/email/sender";
import {
  generateVendorQuoteRequestEmail,
  generateVendorQuoteReminderEmail,
} from "@/lib/email/vendor-request-templates";
import { z } from "zod";

/**
 * §11.228b #reminder-enhancement — 호영님 v2 P0 메일 리마인더 강화 (3 sub-항목):
 *   (1) Template 강화 — isReminder=true 시 generateVendorQuoteReminderEmail
 *       (escalation tone + daysSinceRequest)
 *   (2) Reason 입력 — BatchReminderSheet Textarea 보강 (client layer)
 *   (3) Rate-limit — 같은 quote + vendorEmail 의 가장 최근 createdAt 기준 24h
 *       cooldown. schema 변경 0, QuoteVendorRequest.createdAt 으로 lookup.
 */
const REMINDER_COOLDOWN_HOURS = 24;
const REMINDER_COOLDOWN_MS = REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;

/**
 * §11.229c #vendor-email-domain-validation — 호영님 P0 vendor.email 도메인 검증 강화.
 *   RFC 5322 기본 검증 (z.email) 외에:
 *     (a) RFC 6761 invalid TLD (.test/.invalid/.example/.localhost) 차단
 *     (b) bare IP 주소 (user@127.0.0.1 등) 차단 — 도메인 이름 강제
 *   server zod schema level 검증 — client bypass 0 (canonical truth).
 */
const INVALID_TLDS = new Set(["test", "invalid", "example", "localhost"]);
const BARE_IP_REGEX = /^[^@]+@\d+\.\d+\.\d+\.\d+$/;
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// Schema for POST /api/quotes/:id/vendor-requests
const VendorSchema = z.object({
  // §11.229c — email 도메인 검증 강화. z.email RFC 5322 + TLD blacklist + bare IP 차단.
  email: z.string()
    .email("Invalid email address")
    .refine((email) => {
      const tld = email.split(".").pop()?.toLowerCase();
      return !!tld && !INVALID_TLDS.has(tld);
    }, "테스트/예제 도메인 (.test/.invalid/.example/.localhost) 은 사용할 수 없습니다")
    .refine((email) => !BARE_IP_REGEX.test(email),
      "도메인 이름 대신 IP 주소를 사용할 수 없습니다"),
  name: z.string().optional(),
  // #vendor-email-seed-pilot — vendor.id forward (pilot 분기용).
  // optional — caller 가 보유한 경우만 전달. 미전달 시 sendEmail 의 pilot 분기 0.
  id: z.string().optional(),
});

const CreateVendorRequestsSchema = z.object({
  vendors: z.array(VendorSchema).min(1, "At least one vendor required"),
  message: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
  // §11.228b — client BatchReminderSheet 가 true 로 전송 시 Reminder template
  //   분기 + 24h cooldown check 적용. initial dispatch flow 영향 0 (default false).
  isReminder: z.boolean().optional().default(false),
});

/**
 * Helper function to check quote access.
 *
 * #quote-vendor-requests-organization-scope — 3-source priority:
 *   1. user owner — quote.userId === session.user.id (기존)
 *   2. organization member — quote.organizationId 가 user 의
 *      OrganizationMember.organizationId 와 매칭 (NEW, multi-user
 *      collaboration 정합). LabAxis 가 organization 단위 운영 — 같은 조직
 *      member 가 만든 다른 user 의 quote 도 dispatch 가능해야 함.
 *   3. guest key — quote.guestKey 매칭 (기존)
 */
async function checkQuoteAccess(quoteId: string, request: NextRequest) {
  const session = await auth();
  const headerGuestKey = request.headers.get("X-Guest-Key");

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: {
        orderBy: {
          lineNumber: "asc",
        },
      },
    },
  });

  if (!quote) {
    return { allowed: false, quote: null, error: "Quote not found", status: 404 };
  }

  // #quote-vendor-requests-organization-scope — organization member 매칭.
  //   같은 조직 내 다른 user 의 quote 도 dispatch 가능. user-level ownership /
  //   guest key 보존 (3-source priority chain).
  let isOrgMember = false;
  if (session?.user?.id && quote.organizationId) {
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: quote.organizationId,
      },
      select: { id: true },
    });
    isOrgMember = !!membership;
  }

  // Check if user has access (3 source priority).
  const hasAccess =
    (session?.user?.id && quote.userId === session.user.id) ||
    isOrgMember ||
    (quote.guestKey && (quote.guestKey === headerGuestKey || quote.guestKey === (await getOrCreateGuestKey())));

  if (!hasAccess) {
    return { allowed: false, quote: null, error: "Forbidden", status: 403 };
  }

  return { allowed: true, quote, error: null, status: 200 };
}

/**
 * POST /api/quotes/:id/vendor-requests
 * Create vendor quote requests and send emails
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const { id } = await params;
    const { allowed, quote, error, status } = await checkQuoteAccess(id, request);

    if (!allowed || !quote) {
      return NextResponse.json({ error }, { status });
    }

    // ── Security enforcement ──
    // #quote-vendor-requests-organization-scope post-fix —
    //   userId / userRole 을 session 에서 forward (이전 `quote.userId` /
    //   `undefined` drift 차단). enforceAction 의 actor 는 logged-in user
    //   (호영님 ADMIN → ops_admin) 이지 quote owner 가 아님.
    //   `userRole: undefined` 시 mapUserRole(undefined) → ['requester'] →
    //   `quote_request_resend: ['buyer', 'ops_admin']` 매칭 fail → 403.
    const session = await auth();

    // §11.314-a — body 를 enforceAction 앞에서 parse (isReminder 분기로 action 결정).
    //   root cause (호영님 §11.308 확인요청): 이전 action 'quote_request_resend'
    //   하드코딩 → quote_request_resend: ['buyer','ops_admin'] 이라 requester
    //   (연구원, RESEARCHER→requester) 403 → "견적 요청 실패".
    //   fix (호영님 옵션 A): 첫 발송 = quote_request_submit (requester 허용),
    //   리마인더(isReminder=true) = quote_request_resend (재발송 거버넌스 유지).
    const body = await request.json();
    const validation = CreateVendorRequestsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { vendors, message, expiresInDays, isReminder } = validation.data;

    enforcement = enforceAction({
      userId: session?.user?.id ?? quote.userId,
      userRole: session?.user?.role,
      action: isReminder ? 'quote_request_resend' : 'quote_request_submit',
      targetEntityType: 'quote',
      targetEntityId: id,
      sourceSurface: 'vendor-requests-api',
      routePath: '/api/quotes/[id]/vendor-requests',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // §11.228b — Rate-limit cooldown check (24h 내 같은 quote+vendor 차단).
    //   isReminder=true 인 경우만 적용 — initial dispatch 는 cooldown 미적용.
    //   각 vendor 마다 가장 최근 createdAt 의 quoteVendorRequest 조회 후 24h 이내면 429.
    let effectiveVendors = vendors;
    /**
     * §11.228b — 이전 발송 createdAt (Reminder template 의 daysSinceRequest 계산용).
     *   같은 quote+vendor 의 가장 오래된 createdAt = 최초 발송 시점 기준.
     *   isReminder=false 또는 lookup 실패 시 undefined.
     */
    const firstRequestAtByEmail = new Map<string, Date>();
    if (isReminder) {
      const now = Date.now();
      const rateLimitedVendors: Array<{ email: string; hoursRemaining: number }> = [];
      for (const vendor of vendors) {
        const lastRequest = await db.quoteVendorRequest.findFirst({
          where: { quoteId: id, vendorEmail: vendor.email },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        if (lastRequest) {
          const elapsedMs = now - new Date(lastRequest.createdAt).getTime();
          if (elapsedMs < REMINDER_COOLDOWN_MS) {
            const hoursRemaining = Math.ceil((REMINDER_COOLDOWN_MS - elapsedMs) / (60 * 60 * 1000));
            rateLimitedVendors.push({ email: vendor.email, hoursRemaining });
          }
        }
        // daysSinceRequest 계산용 — 같은 quote+vendor 의 가장 오래된 createdAt
        const firstRequest = await db.quoteVendorRequest.findFirst({
          where: { quoteId: id, vendorEmail: vendor.email },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        if (firstRequest) {
          firstRequestAtByEmail.set(vendor.email, new Date(firstRequest.createdAt));
        }
      }
      if (rateLimitedVendors.length === vendors.length) {
        // 모든 vendor 가 cooldown 안 — 전면 차단 (429)
        return NextResponse.json(
          {
            error: "RATE_LIMIT_EXCEEDED",
            message: `최근 ${REMINDER_COOLDOWN_HOURS}시간 이내 발송된 vendor 입니다. 잠시 후 다시 시도해주세요.`,
            cooldownHours: REMINDER_COOLDOWN_HOURS,
            rateLimitedVendors,
          },
          { status: 429 },
        );
      }
      // 부분 cooldown — 차단된 vendor 제외 후 진행
      if (rateLimitedVendors.length > 0) {
        const rateLimitedEmails = new Set(rateLimitedVendors.map((v) => v.email));
        effectiveVendors = vendors.filter((v) => !rateLimitedEmails.has(v.email));
      }
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Create snapshot of current quote state
    const snapshot = {
      quoteId: quote.id,
      title: quote.title,
      createdAt: quote.createdAt.toISOString(),
      items: quote.items.map((item: any) => ({
        quoteItemId: item.id,
        lineNumber: item.lineNumber,
        productName: item.name || "",
        brand: item.brand || "",
        catalogNumber: item.catalogNumber || "",
        quantity: item.quantity,
        unit: item.unit || "ea",
        currentPrice: item.price || null,
        packSize: item.packSize || null,
        notes: item.notes || null,
      })),
    };

    // Create vendor requests
    const createdRequests = [];
    const emailResults = [];

    for (const vendor of effectiveVendors) {
      // Generate unique token
      const token = generateVendorRequestToken();

      // Create vendor request with snapshot
      const vendorRequest = await db.quoteVendorRequest.create({
        data: {
          quoteId: id,
          vendorEmail: vendor.email,
          vendorName: vendor.name || null,
          message: message || null,
          token,
          status: "SENT",
          expiresAt,
          snapshot,
        },
      });

      createdRequests.push({
        id: vendorRequest.id,
        vendorEmail: vendorRequest.vendorEmail,
        vendorName: vendorRequest.vendorName,
        token: vendorRequest.token,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/vendor/${vendorRequest.token}`,
        status: vendorRequest.status,
        expiresAt: vendorRequest.expiresAt,
        createdAt: vendorRequest.createdAt,
      });

      // §11.228b — isReminder=true 분기 — Reminder template (escalation tone +
      //   daysSinceRequest). isReminder=false 또는 daysSinceRequest 계산 불가 시
      //   기존 initial template 그대로 (canonical lock).
      let emailTemplate;
      if (isReminder) {
        const firstAt = firstRequestAtByEmail.get(vendor.email);
        const daysSinceRequest = firstAt
          ? Math.max(1, Math.floor((Date.now() - firstAt.getTime()) / (24 * 60 * 60 * 1000)))
          : 1;
        emailTemplate = generateVendorQuoteReminderEmail({
          vendorName: vendor.name,
          quoteTitle: quote.title,
          itemCount: quote.items.length,
          message: message,
          responseUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/vendor/${vendorRequest.token}`,
          expiresAt,
          daysSinceRequest,
        });
      } else {
        emailTemplate = generateVendorQuoteRequestEmail({
          vendorName: vendor.name,
          quoteTitle: quote.title,
          itemCount: quote.items.length,
          message: message,
          responseUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/vendor/${vendorRequest.token}`,
          expiresAt,
        });
      }
      try {

        // #vendor-email-seed-pilot — vendor.id forward (pilot 분기용).
        // pilot vendor 면 sender.ts 가 SMTP skip + audit-only.
        await sendEmail({
          to: vendor.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
          vendorId: vendor.id,
        });

        emailResults.push({ email: vendor.email, success: true });
        console.log(`Vendor request email sent to ${vendor.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${vendor.email}:`, emailError);
        emailResults.push({
          email: vendor.email,
          success: false,
          error: emailError instanceof Error ? emailError.message : "Unknown error",
        });
      }
    }

    // 활동 로그: 이메일 발송 기록
    // #quote-vendor-requests-organization-scope post-fix — 위 enforceAction
    //   에서 이미 const session = await auth() 선언 (line 110). 중복 선언
    //   제거 (tsc duplicate identifier error 차단).
    const { ipAddress, userAgent } = extractRequestMeta(request);
    const actorRole = session?.user?.id
      ? await getActorRole(session.user.id, quote.organizationId)
      : null;

    const successCount = emailResults.filter((r: any) => r.success).length;
    const failCount = emailResults.filter((r: any) => !r.success).length;

    // 이메일이 1건 이상 성공했으면 quote 상태를 SENT로 전환
    if (successCount > 0 && quote.status === "PENDING") {
      await db.quote.update({
        where: { id },
        data: { status: "SENT" },
      });
    }

    if (successCount > 0) {
      await createActivityLog({
        activityType: "EMAIL_SENT",
        entityType: "QUOTE",
        entityId: id,
        taskType: "VENDOR_EMAIL_DRAFT",
        afterStatus: "SENT",
        userId: session?.user?.id || null,
        organizationId: quote.organizationId,
        actorRole,
        metadata: {
          vendorCount: vendors.length,
          emailsSent: successCount,
          emailsFailed: failCount,
          vendorEmails: vendors.map((v: { email: string }) => v.email),
        },
        ipAddress,
        userAgent,
      });
    }

    enforcement.complete({
      beforeState: { vendorCount: quote.id },
      afterState: { emailsSent: successCount, emailsFailed: failCount, requestCount: createdRequests.length },
    });

    return NextResponse.json({
      createdRequests,
      emailResults,
      summary: {
        total: vendors.length,
        emailsSent: successCount,
        emailsFailed: failCount,
      },
    }, { status: 201 });
  } catch (error) {
    enforcement?.fail();
    console.error("Error creating vendor requests:", error);
    return NextResponse.json(
      { error: "Failed to create vendor requests" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quotes/:id/vendor-requests
 * Get all vendor requests for a quote
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { allowed, error, status } = await checkQuoteAccess(id, request);

    if (!allowed) {
      return NextResponse.json({ error }, { status });
    }

    const vendorRequests = await db.quoteVendorRequest.findMany({
      where: { quoteId: id },
      include: {
        responseItems: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Check for expired requests and update status
    const now = new Date();
    for (const vendorRequest of vendorRequests) {
      if (vendorRequest.status === "SENT" && vendorRequest.expiresAt < now) {
        await db.quoteVendorRequest.update({
          where: { id: vendorRequest.id },
          data: { status: "EXPIRED" },
        });
        vendorRequest.status = "EXPIRED";
      }
    }

    // Return vendor requests with snapshot info for internal comparison
    return NextResponse.json({
      vendorRequests: vendorRequests.map((vr: any) => ({
        ...vr,
        // Include snapshot for internal UI to use frozen item list
        snapshot: vr.snapshot,
      })),
    });
  } catch (error) {
    console.error("Error fetching vendor requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor requests" },
      { status: 500 }
    );
  }
}
