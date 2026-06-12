import { describe, it, expect } from "vitest";
import { deriveConcurrencyKey } from "@/lib/security/concurrency-key";

// §11.369-3 P2 — concurrency 키 스킴 단위. 호영님 2 조건 핵심 단언.

describe("§11.369-3 — deriveConcurrencyKey: cross-route 격리", () => {
  it("두 다른 route 는 다른 키 (같은 action/user 여도) — cross-route 잠금 소멸", () => {
    const a = deriveConcurrencyKey({ action: "sensitive_data_import", routePath: "/api/r1", targetEntityId: "unknown", userId: "u1" });
    const b = deriveConcurrencyKey({ action: "sensitive_data_import", routePath: "/api/r2", targetEntityId: "unknown", userId: "u1" });
    expect(a).not.toBe(b);
  });

  it("전역 'unknown' 단일 키 제거 — route 가 키에 포함", () => {
    const k = deriveConcurrencyKey({ action: "x", routePath: "/api/foo", targetEntityId: "unknown", userId: "u1" });
    expect(k).toContain("/api/foo");
    expect(k).not.toBe("x:unknown");
  });
});

describe("§11.369-3 — deriveConcurrencyKey: double-submit 보호 보존", () => {
  it("같은 user+route 재호출 → 같은 키(충돌) — per-call UUID 아님", () => {
    const a = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "unknown", userId: "u1" });
    const b = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "unknown", userId: "u1" });
    expect(a).toBe(b); // 결정적 — 중복 클릭 차단 보존
  });

  it("다른 user 는 다른 키 — per-user 격리", () => {
    const a = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "unknown", userId: "u1" });
    const b = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "unknown", userId: "u2" });
    expect(a).not.toBe(b);
  });

  it("targetEntityId 있으면 per-resource (userId 아닌 resource)", () => {
    const k = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "ent_123", userId: "u1" });
    expect(k).toContain("ent_123");
    expect(k).not.toContain("u1");
  });

  it("같은 resource 재호출 같은 키 / 다른 resource 다른 키", () => {
    const a = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "ent_1", userId: "u1" });
    const b = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "ent_1", userId: "u1" });
    const c = deriveConcurrencyKey({ action: "x", routePath: "/api/r1", targetEntityId: "ent_2", userId: "u1" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
