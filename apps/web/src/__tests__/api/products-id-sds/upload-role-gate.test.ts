/**
 * §sds-upload-role-gate — POST /api/products/[id]/sds 서버 role 게이트 (행위 검증)
 *
 * 배경 (2026-08-09 실측): 이 라우트는 401 인증 확인과 조직 스코프 산출만 하고
 *   **role 게이트가 없었다** — UI 를 우회하면 인증된 아무 사용자나 안전 문서를 올릴 수 있었다.
 *   §product-detail-sourcing-v21 의 v21 sentinel 은 "개인 업로드 경로 차단"이라 적었으나
 *   그건 UI 가드일 뿐이라 거짓 보증이었고, 같은 커밋에서 문구를 정정했다.
 *
 * 계약 — **docType 별로 행위자 계층이 다르다**:
 *   G1. sds  = 제품 카탈로그 레벨 안전자료 → 소유 관계가 없어 role 로 판정.
 *       합집합(global ADMIN · SUPPLIER · 조직 ADMIN/VIEWER=safety_admin).
 *       `/api/products/[id]/safety` 와 동일 계열(둘 다 제품 안전 정보 쓰기).
 *   G2. coa  = 입고 lot(InventoryRestock) 귀속 → 재고를 받은 실무자(RESEARCHER 포함)가
 *       올리는 것이 정상 경로이며 **소유권 검증이 이미 게이트**다.
 *       여기에 role 게이트를 걸면 회귀 → coa 는 role 무관으로 통과해야 한다.
 *   G3. 거부/통과 모두 enforceAction 핸들을 닫는다(§enforcement-handle-close).
 *
 * 검증 기법: 게이트 **통과** 신호로 storage 미설정 503 을 쓴다. 게이트를 지나야만
 *   uploadSdsFile 에 도달하므로 503 = "게이트 통과" 의 결정적 증거다(정적 매칭 아님).
 *   coa 는 restockId 없이 보내 422(RESTOCK_REQUIRED)로 "role 게이트 미적용"을 증명한다.
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
    product: { findUnique: vi.fn() },
    organizationMember: { findMany: vi.fn() },
    inventoryRestock: { findFirst: vi.fn() },
    sDSDocument: { create: vi.fn() },
  },
}));

// storage 미설정 → 게이트 통과 신호(503).
//   ⚠️ vi.mock factory 는 호이스팅되므로 클래스를 factory **내부**에 선언한다
//      (상위 스코프 변수 참조 시 "Cannot access before initialization").
vi.mock("@/lib/safety/sds-storage", () => {
  class StorageNotConfiguredError extends Error {}
  return {
    StorageNotConfiguredError,
    uploadSdsFile: vi.fn(async () => {
      throw new StorageNotConfiguredError("not configured");
    }),
  };
});

// 계약 밖 부수효과 격리
vi.mock("@/lib/safety/msds-hazard-backfill", () => ({
  backfillHazardFromMsds: vi.fn(async () => ({ backfilled: false })),
}));
vi.mock("@/lib/safety/supersede-sds", () => ({ supersedePriorSds: vi.fn(async () => undefined) }));
vi.mock("@/lib/activity-log", () => ({ createActivityLog: vi.fn(async () => undefined) }));

const enforcementSpies = { complete: vi.fn(), fail: vi.fn() };
vi.mock("@/lib/security/server-enforcement-middleware", () => ({
  enforceAction: () => ({
    allowed: true,
    correlationId: "corr_sds_test",
    actorContext: {} as unknown,
    authResult: { permitted: true } as unknown,
    deny: () => mockJsonResponse({ error: "forbidden" }, { status: 403 }),
    complete: enforcementSpies.complete,
    fail: enforcementSpies.fail,
  }),
}));

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { POST } from "@/app/api/products/[id]/sds/route";

const mockDb = db as unknown as {
  product: { findUnique: ReturnType<typeof vi.fn> };
  organizationMember: { findMany: ReturnType<typeof vi.fn> };
  inventoryRestock: { findFirst: ReturnType<typeof vi.fn> };
  sDSDocument: { create: ReturnType<typeof vi.fn> };
};
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const PRODUCT_ID = "prod-1";

/** docType 과 파일을 담은 formData 요청 */
function makeRequest(docType: "sds" | "coa", extra: Record<string, string> = {}) {
  const form = new Map<string, unknown>();
  form.set("file", {
    name: "msds.pdf",
    type: "application/pdf",
    arrayBuffer: async () => new ArrayBuffer(8),
  });
  form.set("docType", docType);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return {
    formData: async () => ({ get: (k: string) => form.get(k) ?? null }),
  } as unknown as Request;
}

const params = Promise.resolve({ id: PRODUCT_ID });

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.product.findUnique.mockResolvedValue({ id: PRODUCT_ID });
  mockDb.organizationMember.findMany.mockResolvedValue([]);
  mockDb.inventoryRestock.findFirst.mockResolvedValue(null);
});

describe("§sds-upload-role-gate G1 — sds 는 권한자만", () => {
  it("조직 미소속 RESEARCHER → 403 SDS_UPLOAD_FORBIDDEN", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "RESEARCHER" } });
    const res = await POST(makeRequest("sds") as any, { params } as any);
    expect(res.status).toBe(403);
    expect((await (res as any).json())?.code).toBe("SDS_UPLOAD_FORBIDDEN");
    expect(enforcementSpies.fail).toHaveBeenCalled(); // G3 — 거부도 핸들을 닫는다
  });

  it("global ADMIN → 게이트 통과 (storage 미설정 503 에 도달)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2", role: "ADMIN" } });
    const res = await POST(makeRequest("sds") as any, { params } as any);
    expect(res.status).toBe(503);
    expect((await (res as any).json())?.code).toBe("STORAGE_NOT_CONFIGURED");
  });

  it("global SUPPLIER → 게이트 통과", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3", role: "SUPPLIER" } });
    const res = await POST(makeRequest("sds") as any, { params } as any);
    expect(res.status).toBe(503);
  });

  it("조직 VIEWER(safety_admin) RESEARCHER → 게이트 통과 (기존 담당자 권한 보존)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u4", role: "RESEARCHER" } });
    mockDb.organizationMember.findMany.mockResolvedValue([
      { organizationId: "org-1", role: "VIEWER" },
    ]);
    const res = await POST(makeRequest("sds") as any, { params } as any);
    expect(res.status).toBe(503);
  });
});

describe("§sds-upload-role-gate G2 — coa 는 role 무관 (소유권이 게이트)", () => {
  it("조직 미소속 RESEARCHER 의 coa → 403 아님. restockId 부재로 422 (게이트 미적용 증명)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "RESEARCHER" } });
    const res = await POST(makeRequest("coa") as any, { params } as any);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(422);
    expect((await (res as any).json())?.code).toBe("RESTOCK_REQUIRED");
  });

  it("소유하지 않은 lot 의 coa → 422 RESTOCK_INVALID (소유권 검증 보존)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "RESEARCHER" } });
    mockDb.inventoryRestock.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("coa", { restockId: "rs-other" }) as any, {
      params,
    } as any);
    expect(res.status).toBe(422);
    expect((await (res as any).json())?.code).toBe("RESTOCK_INVALID");
  });

  it("소유한 lot 의 coa → 게이트 통과 (RESEARCHER 도 업로드 가능 — 회귀 0)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", role: "RESEARCHER" } });
    mockDb.inventoryRestock.findFirst.mockResolvedValue({ id: "rs-1", inventoryId: "inv-1" });
    const res = await POST(makeRequest("coa", { restockId: "rs-1" }) as any, { params } as any);
    expect(res.status).toBe(503); // storage 까지 도달 = role 게이트에 막히지 않았다
  });
});

describe("§sds-upload-role-gate — 인증 경계 보존", () => {
  it("세션 없음 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest("sds") as any, { params } as any);
    expect(res.status).toBe(401);
  });
});
