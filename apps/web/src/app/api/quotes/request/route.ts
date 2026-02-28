import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateVendorRequestToken } from "@/lib/api/vendor-request-token";
import { sendEmail } from "@/lib/email/sender";
import { generateVendorQuoteRequestEmail } from "@/lib/email/vendor-request-templates";

// ---------------------------------------------------------------------------
// Zod 스키마
// ---------------------------------------------------------------------------

const requestItemSchema = z
  .object({
    productName: z
      .string({ required_error: "productName은 필수입니다." })
      .min(1)
      .max(500)
      .trim(),
    catalogNumber: z.string().trim().optional(),
    brand: z.string().trim().optional(),

    // 벤더 식별: vendorId(DB FK) 또는 vendorName 중 하나 필수
    vendorId: z.string().optional(),
    vendorName: z.string().trim().optional(),

    quantity: z
      .number({ required_error: "quantity는 필수입니다." })
      .int("quantity는 정수여야 합니다.")
      .min(1, "quantity는 1 이상이어야 합니다."),
    unitPrice: z.number().nonnegative().optional(), // 단가 (KRW)
    currency: z.string().default("KRW"),
    lineTotal: z.number().nonnegative().optional(), // 행 합계
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.vendorId || d.vendorName, {
    message: "vendorId 또는 vendorName 중 하나는 필수입니다.",
    path: ["vendorId"],
  });

const commonRequestSchema = z.object({
  title: z
    .string({ required_error: "title은 필수입니다." })
    .min(1)
    .max(200)
    .trim(),
  deliveryDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "deliveryDate는 유효한 날짜여야 합니다.")
    .optional(),
  deliveryLocation: z.string().trim().max(500).optional(),
  specialNotes: z.string().trim().max(2000).optional(),
});

const bulkQuoteRequestSchema = z.object({
  items: z
    .array(requestItemSchema, { required_error: "items 배열은 필수입니다." })
    .min(1, "품목이 1개 이상 필요합니다.")
    .max(500, "한 번에 최대 500개까지 요청할 수 있습니다."),
  commonRequest: commonRequestSchema,
  // 벤더별 개별 메시지 (key: vendorId 또는 vendorName)
  vendorMessages: z.record(z.string(), z.string().max(2000)).optional(),
  organizationId: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

type RequestItem = z.infer<typeof requestItemSchema>;

// ---------------------------------------------------------------------------
// 헬퍼: 아이템의 벤더 그룹 키 결정 (vendorId 우선)
// ---------------------------------------------------------------------------
function getVendorKey(item: RequestItem): string {
  return item.vendorId ?? item.vendorName ?? "__unknown__";
}

// ---------------------------------------------------------------------------
// 헬퍼: 벤더 이메일 조회 (vendorId → DB, vendorName → DB 검색)
// ---------------------------------------------------------------------------
async function resolveVendorEmail(
  vendorId?: string,
  vendorName?: string
): Promise<{ email: string | null; name: string | null }> {
  if (vendorId) {
    const vendor = await db.vendor.findUnique({
      where: { id: vendorId },
      select: { email: true, name: true },
    });
    return { email: vendor?.email ?? null, name: vendor?.name ?? null };
  }
  if (vendorName) {
    const vendor = await db.vendor.findFirst({
      where: { name: { equals: vendorName, mode: "insensitive" } },
      select: { email: true, name: true },
    });
    return { email: vendor?.email ?? null, name: vendor?.name ?? vendorName };
  }
  return { email: null, name: null };
}

// ---------------------------------------------------------------------------
// 헬퍼: 이메일 미설정 시 콘솔 Mock 발송
// ---------------------------------------------------------------------------
async function dispatchVendorEmail(params: {
  vendorEmail: string;
  vendorName: string | null;
  quoteTitle: string;
  itemCount: number;
  message?: string;
  responseUrl: string;
  expiresAt: Date;
}): Promise<{ email: string; success: boolean; error?: string }> {
  const emailTemplate = generateVendorQuoteRequestEmail({
    vendorName: params.vendorName ?? undefined,
    quoteTitle: params.quoteTitle,
    itemCount: params.itemCount,
    message: params.message,
    responseUrl: params.responseUrl,
    expiresAt: params.expiresAt,
  });

  try {
    await sendEmail({
      to: params.vendorEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
    return { email: params.vendorEmail, success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // 이메일 라이브러리 미설정 시 Mock 로그로 대체
    console.log(
      "[quotes/request] [MOCK EMAIL] 발송 대상:",
      params.vendorEmail,
      "| 제목:",
      emailTemplate.subject,
      "| 품목 수:",
      params.itemCount
    );
    return { email: params.vendorEmail, success: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// POST /api/quotes/request
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. 인증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. JSON 파싱
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문이 유효한 JSON 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // 3. Zod 검증
    const parsed = bulkQuoteRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "요청 데이터 유효성 검사에 실패했습니다.",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 422 }
      );
    }

    const { items, commonRequest, vendorMessages = {}, organizationId: clientOrganizationId, expiresInDays } = parsed.data;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 4-a. 서버 세션 기반 organizationId 결정 (클라이언트 값 직접 신뢰 금지)
    //      P2003 방지: DB에 없는 organizationId를 사용하면 FK 위반 발생
    let serverOrgId: string | null = null;
    const clientOrgId = clientOrganizationId?.trim() || null;
    if (clientOrgId) {
      // 클라이언트가 보낸 organizationId가 실제 사용자가 속한 조직인지 검증
      const membership = await db.organizationMember.findUnique({
        where: { userId_organizationId: { userId: session.user.id, organizationId: clientOrgId } },
        select: { organizationId: true },
      });
      serverOrgId = membership?.organizationId ?? null;
      if (!serverOrgId) {
        console.warn(
          `[quotes/request] organizationId 검증 실패: 클라이언트 값(${clientOrgId})으로 사용자(${session.user.id}) 멤버십 없음. 기본 조직으로 폴백.`
        );
      }
    }
    if (!serverOrgId) {
      // 클라이언트가 organizationId를 안 보냈거나 검증 실패 시 사용자의 첫 번째 조직 사용
      const firstMembership = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });
      serverOrgId = firstMembership?.organizationId ?? null;
    }

    // 4. 벤더별 품목 그룹화 (vendorId 우선, fallback: vendorName)
    const vendorGroupMap = new Map<string, RequestItem[]>();
    for (const item of items) {
      const key = getVendorKey(item);
      if (!vendorGroupMap.has(key)) vendorGroupMap.set(key, []);
      vendorGroupMap.get(key)!.push(item);
    }

    // 5. 벤더 정보 사전 조회 (DB I/O는 트랜잭션 밖에서 처리)
    type VendorMeta = { email: string | null; name: string | null };
    const vendorMetaMap = new Map<string, VendorMeta>();
    for (const [key, groupItems] of vendorGroupMap.entries()) {
      const sample = groupItems[0];
      const meta = await resolveVendorEmail(sample.vendorId, sample.vendorName);
      vendorMetaMap.set(key, meta);
    }

    // 6. 트랜잭션: 벤더별 Quote + QuoteListItem + QuoteVendorRequest 일괄 생성
    //    전체를 단일 트랜잭션으로 묶어 중간 실패 시 전체 롤백 보장
    type CreatedRecord = {
      vendorKey: string;
      quoteId: string;
      vendorRequestId: string;
      vendorEmail: string | null;
      vendorName: string | null;
      token: string;
      responseUrl: string;
      itemCount: number;
      message: string | undefined;
    };

    const createdRecords: CreatedRecord[] = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const records: CreatedRecord[] = [];

        for (const [vendorKey, groupItems] of vendorGroupMap.entries()) {
          const meta = vendorMetaMap.get(vendorKey)!;

          // 벤더별 제목: "원본 제목 (벤더명, N건)"
          const vendorLabel = meta.name ?? groupItems[0].vendorName ?? vendorKey;
          const vendorTitle = `${commonRequest.title} (${vendorLabel}, ${groupItems.length}건)`;

          // 벤더 전용 메시지 조합: 개별 귓속말 + 공통 요청사항
          const privateMsg = vendorMessages[vendorKey];
          const specialPart = commonRequest.specialNotes
            ? `\n\n[추가 요청사항]\n${commonRequest.specialNotes}`
            : "";
          const deliveryPart = commonRequest.deliveryDate
            ? `\n납기 희망일: ${commonRequest.deliveryDate}`
            : "";
          const locationPart = commonRequest.deliveryLocation
            ? `\n배송지: ${commonRequest.deliveryLocation}`
            : "";
          const composedMessage = [
            privateMsg,
            deliveryPart || locationPart
              ? `[공통 배송 정보]${deliveryPart}${locationPart}`
              : null,
            specialPart || null,
          ]
            .filter(Boolean)
            .join("\n\n") || undefined;

          // 6-1. Quote 생성 (해당 벤더 품목만 포함)
          //      deliveryDate/deliveryLocation/specialNotes는 Quote 스키마에 없음
          //      → description 및 QuoteVendorRequest.message/snapshot에 보존
          const quote = await tx.quote.create({
            data: {
              userId: session.user.id,
              organizationId: serverOrgId,
              title: vendorTitle,
              description: composedMessage ?? null,
              items: {
                create: groupItems.map((item, idx) => {
                  const quantity = item.quantity;
                  const unitPrice = item.unitPrice != null ? Math.round(item.unitPrice) : null;
                  const lineTotal =
                    item.lineTotal != null
                      ? Math.round(item.lineTotal)
                      : unitPrice != null
                      ? Math.round(unitPrice * quantity)
                      : null;
                  return {
                    name: item.productName,
                    brand: item.brand ?? null,
                    catalogNumber: item.catalogNumber ?? null,
                    lineNumber: idx + 1,
                    quantity,
                    unitPrice,
                    currency: item.currency,
                    lineTotal,
                    notes: item.notes ?? null,
                    raw: {
                      // vendor 정보는 raw(snapshot) JSON 에 보존
                      vendorId: item.vendorId ?? null,
                      vendorName: item.vendorName ?? meta.name ?? null,
                    },
                  };
                }),
              },
            },
            select: { id: true, items: { select: { id: true } } },
          });

          // 6-2. QuoteVendorRequest 생성 (벤더별 격리 스냅샷 + 고유 토큰)
          const token = generateVendorRequestToken();
          const snapshot = {
            quoteId: quote.id,
            title: vendorTitle,
            createdAt: new Date().toISOString(),
            // 공통 배송 정보 보존 (Quote 스키마에 컬럼 없어 snapshot에 유지)
            deliveryDate: commonRequest.deliveryDate ?? null,
            deliveryLocation: commonRequest.deliveryLocation ?? null,
            specialNotes: commonRequest.specialNotes ?? null,
            items: groupItems.map((item, idx) => ({
              quoteItemId: quote.items[idx]?.id ?? null,
              lineNumber: idx + 1,
              productName: item.productName,
              brand: item.brand ?? null,
              catalogNumber: item.catalogNumber ?? null,
              quantity: item.quantity,
              unit: "ea",
              currentPrice: item.unitPrice ?? null,
              notes: item.notes ?? null,
            })),
          };

          const vendorRequest = await tx.quoteVendorRequest.create({
            data: {
              quoteId: quote.id,
              vendorName: meta.name ?? groupItems[0].vendorName ?? null,
              vendorEmail: meta.email ?? `vendor-${vendorKey}@placeholder.invalid`,
              message: composedMessage ?? null,
              token,
              status: "SENT",
              expiresAt,
              snapshot,
            },
            select: { id: true, vendorEmail: true },
          });

          records.push({
            vendorKey,
            quoteId: quote.id,
            vendorRequestId: vendorRequest.id,
            vendorEmail: meta.email,
            vendorName: meta.name ?? groupItems[0].vendorName ?? null,
            token,
            responseUrl: `${appUrl}/vendor/${token}`,
            itemCount: groupItems.length,
            message: composedMessage,
          });
        }

        return records;
      },
      { timeout: 30_000 } // 대량 품목 처리를 위한 타임아웃 연장
    );

    // 7. 이메일 병렬 발송 (DB 저장 완료 후 실행, 발송 실패는 견적 생성에 영향 없음)
    const emailResults = await Promise.all(
      createdRecords.map((record: CreatedRecord) => {
        if (!record.vendorEmail) {
          // 이메일 주소 없는 벤더 → Mock 로그 출력
          console.log(
            `[quotes/request] [MOCK EMAIL] 이메일 없는 벤더 스킵: vendorKey=${record.vendorKey}`,
            `| 응답 URL: ${record.responseUrl}`
          );
          return Promise.resolve({
            email: null,
            success: false,
            error: "벤더 이메일 주소가 등록되지 않았습니다.",
            vendorKey: record.vendorKey,
          });
        }

        return dispatchVendorEmail({
          vendorEmail: record.vendorEmail,
          vendorName: record.vendorName,
          quoteTitle: commonRequest.title,
          itemCount: record.itemCount,
          message: record.message,
          responseUrl: record.responseUrl,
          expiresAt,
        }).then((result) => ({ ...result, vendorKey: record.vendorKey }));
      })
    );

    // 8. 응답 조합
    return NextResponse.json(
      {
        message: `${createdRecords.length}개 벤더에 대한 견적 요청이 생성되었습니다.`,
        quotes: createdRecords.map((r: CreatedRecord) => ({
          quoteId: r.quoteId,
          vendorKey: r.vendorKey,
          vendorName: r.vendorName,
          itemCount: r.itemCount,
        })),
        vendorRequests: createdRecords.map((r: CreatedRecord) => ({
          vendorRequestId: r.vendorRequestId,
          vendorKey: r.vendorKey,
          vendorName: r.vendorName,
          vendorEmail: r.vendorEmail,
          token: r.token,
          responseUrl: r.responseUrl,
          expiresAt: expiresAt.toISOString(),
        })),
        emailResults,
        summary: {
          totalVendors: createdRecords.length,
          totalItems: items.length,
          emailsSent: emailResults.filter((r) => r.success).length,
          emailsFailed: emailResults.filter((r) => !r.success).length,
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Quote Request DB Error Details:", error);
    console.error("[quotes/request] Error:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });

    let clientMessage = "견적 요청 생성에 실패했습니다.";
    if (error?.code === "P2003") {
      clientMessage = "존재하지 않는 제품 또는 조직 정보가 포함되어 있습니다.";
    } else if (error?.message?.includes("timeout")) {
      clientMessage = "처리 시간이 초과되었습니다. 품목 수를 줄여 다시 시도해 주세요.";
    }

    return NextResponse.json({ error: clientMessage }, { status: 500 });
  }
}
