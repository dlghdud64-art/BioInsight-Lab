/**
 * §migration-order-drift-guard Phase 3 — /api/health migration drift 필드 wiring (RED → GREEN).
 *
 * 계약:
 *   W1. 성공: 응답 migrations = { ok, reachable, pendingCount, unknownCount,
 *       unfinishedCount, rolledBackCount, clean, manifestGeneratedAt } — count/boolean만.
 *   W2. leak 가드: migration "이름 목록"(pending[]/unknown[])은 public health에 절대 미노출
 *       (스키마 정보 leak — 상세는 operator smoke 전용).
 *   W3. probe 실패: migrations = { ok:false, reachable:false } — 기존 status 의미는 불변
 *       (drift 정보는 additive, 기존 health 소비자 회귀 0).
 *
 * 커버리지 경계: wiring만. drift 계산 계약은 lib/health/migration-drift.test.ts가 잠근다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(async () => [{ "?column?": 1 }]),
    user: { count: vi.fn(async () => 3) },
    organization: { count: vi.fn(async () => 1) },
  },
}));
vi.mock("@/lib/health/migration-drift", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/health/migration-drift")>();
  return { ...orig, probeMigrationDrift: vi.fn() };
});

import { probeMigrationDrift } from "@/lib/health/migration-drift";
import { GET } from "@/app/api/health/route";

const mockProbe = probeMigrationDrift as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL =
    "postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
});

describe("§migration-order-drift-guard W1·W2 — health migrations 필드 (count/boolean만)", () => {
  it("probe 성공: count 필드 전수 + clean + manifestGeneratedAt, 이름 배열 미노출", async () => {
    mockProbe.mockResolvedValue({
      ok: true,
      reachable: true,
      drift: {
        pending: ["20260731120000_receiving_document"],
        unknown: [],
        appliedCount: 51,
        unfinishedCount: 0,
        rolledBackCount: 0,
        clean: false,
      },
      manifestGeneratedAt: "2026-08-04T00:00:00.000Z",
    });

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("ok"); // 기존 의미 불변
    expect(body.migrations).toEqual({
      ok: true,
      reachable: true,
      pendingCount: 1,
      unknownCount: 0,
      unfinishedCount: 0,
      rolledBackCount: 0,
      clean: false,
      manifestGeneratedAt: "2026-08-04T00:00:00.000Z",
    });
    // W2 — leak 가드: 이름 배열이 응답 어디에도 없다.
    expect(JSON.stringify(body)).not.toContain("20260731120000_receiving_document");
  });
});

describe("§migration-order-drift-guard W3 — probe 실패는 additive (기존 status 불변)", () => {
  it("probe reject 아님·ok:false 반환: migrations={ok:false,reachable:false}, status는 ok 유지", async () => {
    mockProbe.mockResolvedValue({
      ok: false,
      reachable: false,
      error: "connect ETIMEDOUT",
    });

    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("ok"); // DB 자체 체크 성공 → 기존 소비자 회귀 0
    expect(body.migrations).toEqual({ ok: false, reachable: false });
    expect(JSON.stringify(body.migrations)).not.toContain("drift");
  });
});
