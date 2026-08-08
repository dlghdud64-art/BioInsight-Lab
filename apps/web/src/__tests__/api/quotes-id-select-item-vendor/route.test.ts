/**
 * §quote-item-vendor-selection Phase 2 — POST /api/quotes/[id]/select-item-vendor
 *
 * 계약 (계획서 §3 Success Criteria · §4 canonical truth):
 *   S1 인증: 세션 없으면 401.
 *   S2 권한: quote owner OR organization member 만 — 그 외 404 (존재 leak 차단,
 *      select-reply 형제 관례 승계).
 *   S3 품목 소속 검증: quoteItemId 가 이 quote 의 품목이어야 함 (400).
 *   S4 응답 실존 검증: vendorRequestId 가 **해당 품목에 실제 응답(QuoteVendorResponseItem)
 *      을 제출한** 요청이어야 함 — 가짜 선택 금지 (400). 응답 없는 vendor 확정 불가.
 *   S5 해제: vendorRequestId === null → 선택 해제(성공).
 *   S6 lock 규율: enforceAction 이후 모든 early-return 이 fail() 호출
 *      (ADR §11.21 lock leak → 409 사고 관례 승계), 성공은 complete().
 *
 * CSRF 는 middleware 레지스트리 기본값(required)이 담당 — 라우트 내부 처리 아님
 * (select-reply 와 동일). 클라이언트는 csrfFetch 사용(§support-csrf-fix).
 */

import { mockJsonResponse } from "@/__tests__/helpers/response-mock";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));

vi.mock("@/auth");

vi.mock("@/lib/db", () => ({
  db: {
    quote: { findUnique: vi.fn() },
    organizationMember: { findFirst: vi.fn() },
    quoteVendorResponseItem: { findFirst: vi.fn() },
    quoteListItem: { update: vi.fn() },
  },
}));

const enforcementSpies = { complete: vi.fn(), fail: vi.fn() };
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_test",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: enforcementSpies.complete,
    fail: enforcementSpies.fail,
  }),
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { POST } from "@/app/api/quotes/[id]/select-item-vendor/route";

const mockDb = db as unknown as {
  quote: { findUnique: ReturnType<typeof vi.fn> };
  organizationMember: { findFirst: ReturnType<typeof vi.fn> };
  quoteVendorResponseItem: { findFirst: ReturnType<typeof vi.fn> };
  quoteListItem: { update: ReturnType<typeof vi.fn> };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const QUOTE = {
  id: "q-1",
  userId: "user-1",
  organizationId: "org-1",
  items: [{ id: "qi-1" }, { id: "qi-2" }],
  vendorRequests: [{ id: "vr-1" }, { id: "vr-2" }],
};

function call(body: unknown, quoteId = "q-1") {
  return POST(
    { json: async () => body } as never,
    { params: Promise.resolve({ id: quoteId }) } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
  mockDb.quote.findUnique.mockResolvedValue(QUOTE);
  mockDb.quoteVendorResponseItem.findFirst.mockResolvedValue({ id: "resp-1" });
  mockDb.quoteListItem.update.mockImplementation(async ({ data }: any) => ({
    id: "qi-1",
    selectedVendorRequestId: data.selectedVendorRequestId,
  }));
});

describe("§quote-item-vendor-selection S1·S2 — 인증·권한", () => {
  it("세션 없음 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-1" });
    expect(res.status).toBe(401);
    expect(mockDb.quoteListItem.update).not.toHaveBeenCalled();
  });

  it("owner 아님 + org member 아님 → 404 (존재 leak 차단) + fail()", async () => {
    mockAuth.mockResolvedValue({ user: { id: "stranger", role: "USER" } });
    mockDb.organizationMember.findFirst.mockResolvedValue(null);
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-1" });
    expect(res.status).toBe(404);
    expect(enforcementSpies.fail).toHaveBeenCalled();
    expect(mockDb.quoteListItem.update).not.toHaveBeenCalled();
  });

  it("org member 는 허용 (multi-user collaboration — select-reply 관례 승계)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "teammate", role: "USER" } });
    mockDb.organizationMember.findFirst.mockResolvedValue({ id: "m-1" });
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-1" });
    expect(res.status).toBe(200);
  });
});

describe("§quote-item-vendor-selection S3·S4 — 소속·응답 실존 검증 (가짜 선택 금지)", () => {
  it("타 quote 품목 → 400 ITEM_NOT_ON_QUOTE + fail()", async () => {
    const res = await call({ quoteItemId: "qi-other", vendorRequestId: "vr-1" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ITEM_NOT_ON_QUOTE");
    expect(enforcementSpies.fail).toHaveBeenCalled();
  });

  it("타 quote vendorRequest → 400 VENDOR_REQUEST_NOT_ON_QUOTE", async () => {
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-other" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VENDOR_REQUEST_NOT_ON_QUOTE");
  });

  it("해당 품목에 응답 없는 vendor → 400 NO_RESPONSE_FOR_ITEM (핵심 계약)", async () => {
    mockDb.quoteVendorResponseItem.findFirst.mockResolvedValue(null);
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-2" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("NO_RESPONSE_FOR_ITEM");
    expect(mockDb.quoteListItem.update).not.toHaveBeenCalled();
    expect(enforcementSpies.fail).toHaveBeenCalled();
  });

  it("응답 실존 → 200 저장 + complete()", async () => {
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-1" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.selectedVendorRequestId).toBe("vr-1");
    expect(mockDb.quoteListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "qi-1" },
        data: { selectedVendorRequestId: "vr-1" },
      }),
    );
    expect(enforcementSpies.complete).toHaveBeenCalled();
  });
});

describe("§quote-item-vendor-selection S5 — 해제", () => {
  it("vendorRequestId null → 응답 검증 skip·해제 저장 200", async () => {
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: null });
    expect(res.status).toBe(200);
    expect(mockDb.quoteVendorResponseItem.findFirst).not.toHaveBeenCalled();
    expect(mockDb.quoteListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { selectedVendorRequestId: null } }),
    );
  });
});

describe("§quote-item-vendor-selection S6 — 입력 방어", () => {
  it("잘못된 body → 400 + fail() (lock 누수 0)", async () => {
    const res = await call({ quoteItemId: 123 });
    expect(res.status).toBe(400);
    expect(enforcementSpies.fail).toHaveBeenCalled();
  });

  it("quote 없음 → 404 + fail()", async () => {
    mockDb.quote.findUnique.mockResolvedValue(null);
    const res = await call({ quoteItemId: "qi-1", vendorRequestId: "vr-1" });
    expect(res.status).toBe(404);
    expect(enforcementSpies.fail).toHaveBeenCalled();
  });
});
