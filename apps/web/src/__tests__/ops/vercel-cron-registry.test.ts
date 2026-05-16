/**
 * §11.250b-fix #vercel-cron-registry-completion — production fix.
 *
 * 호영님 spec: §11.250e Phase 0 audit 에서 inventory-check + order-followup-check
 *   cron route 가 vercel.json 미등록 (route 존재 but host 에서 실행 안 됨) 발견.
 *   §11.250b INVENTORY_LOW + INVENTORY_EXPIRING 알림이 production 영구히 dead.
 *
 * Strategy:
 *   - vercel.json crons array 안 2 entry 추가 (inventory-check + order-followup-check).
 *   - 기존 schedule 정합 (route file 주석에 명시된 시각 유지):
 *     - inventory-check: 0 8 * * * (매일 오전 8시, route 주석 정합)
 *     - order-followup-check: 0 9 * * * (매일 오전 9시, route 주석 정합)
 *   - 기존 3 entry (dashboard-snapshot / user-soft-delete-purge / quote-expiry-check) 보존.
 *
 * canonical truth lock:
 *   - vercel.json crons = canonical (host Vercel 가 읽음).
 *   - route file 주석은 reference 만 — vercel.json 등록 없으면 route 미실행.
 *   - schedule 값 변경 0 (route 주석 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const VERCEL_JSON_PATH = resolve(__dirname, "../../../vercel.json");
const vercelJsonRaw = safeRead(VERCEL_JSON_PATH);

describe("§11.250b-fix #1 — vercel.json valid JSON", () => {
  it("vercel.json file 존재", () => {
    expect(vercelJsonRaw.length).toBeGreaterThan(0);
  });

  it("valid JSON parse", () => {
    expect(() => JSON.parse(vercelJsonRaw)).not.toThrow();
  });

  it("crons array 존재", () => {
    const config = JSON.parse(vercelJsonRaw);
    expect(config.crons).toBeDefined();
    expect(Array.isArray(config.crons)).toBe(true);
  });
});

describe("§11.250b-fix #2 — 신규 cron entry 등록 (production fix)", () => {
  it("inventory-check cron 등록 (0 8 * * *)", () => {
    const config = JSON.parse(vercelJsonRaw);
    const entry = config.crons.find(
      (c: { path: string }) => c.path === "/api/cron/inventory-check",
    );
    expect(entry).toBeDefined();
    expect(entry.schedule).toBe("0 8 * * *");
  });

  it("order-followup-check cron 등록 (0 9 * * *)", () => {
    const config = JSON.parse(vercelJsonRaw);
    const entry = config.crons.find(
      (c: { path: string }) => c.path === "/api/cron/order-followup-check",
    );
    expect(entry).toBeDefined();
    expect(entry.schedule).toBe("0 9 * * *");
  });
});

describe("§11.250b-fix #3 — 기존 cron entry 보존 (invariant)", () => {
  it("dashboard-snapshot cron 보존 (0 0 * * *)", () => {
    const config = JSON.parse(vercelJsonRaw);
    const entry = config.crons.find(
      (c: { path: string }) => c.path === "/api/cron/dashboard-snapshot",
    );
    expect(entry).toBeDefined();
    expect(entry.schedule).toBe("0 0 * * *");
  });

  it("user-soft-delete-purge cron 보존 (0 2 * * *)", () => {
    const config = JSON.parse(vercelJsonRaw);
    const entry = config.crons.find(
      (c: { path: string }) => c.path === "/api/cron/user-soft-delete-purge",
    );
    expect(entry).toBeDefined();
    expect(entry.schedule).toBe("0 2 * * *");
  });

  it("§11.250e quote-expiry-check cron 보존 (0 10 * * *)", () => {
    const config = JSON.parse(vercelJsonRaw);
    const entry = config.crons.find(
      (c: { path: string }) => c.path === "/api/cron/quote-expiry-check",
    );
    expect(entry).toBeDefined();
    expect(entry.schedule).toBe("0 10 * * *");
  });

  it("buildCommand / installCommand / framework 보존", () => {
    const config = JSON.parse(vercelJsonRaw);
    expect(config.buildCommand).toBe("npm run build");
    expect(config.installCommand).toBe("npm install");
    expect(config.framework).toBe("nextjs");
  });
});

describe("§11.250b-fix #4 — crons 총 5 entry (3 기존 + 2 신규)", () => {
  it("총 5 cron entry", () => {
    const config = JSON.parse(vercelJsonRaw);
    expect(config.crons.length).toBe(5);
  });

  it("schedule 모두 cron syntax (0 N * * *)", () => {
    const config = JSON.parse(vercelJsonRaw);
    for (const entry of config.crons) {
      expect(entry.schedule).toMatch(/^\d+\s+\d+\s+\*\s+\*\s+\*$/);
    }
  });

  it("path 모두 /api/cron/* 형식", () => {
    const config = JSON.parse(vercelJsonRaw);
    for (const entry of config.crons) {
      expect(entry.path).toMatch(/^\/api\/cron\//);
    }
  });
});
