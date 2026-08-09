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
import { VERCEL_CRON_REGISTRY } from "../../lib/ops-console/vercel-cron-registry";

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

  it("schema points to official Vercel config contract", () => {
    const config = JSON.parse(vercelJsonRaw);
    expect(config.$schema).toBe("https://openapi.vercel.sh/vercel.json");
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

describe("§cron-registry-drift #4 — 개수가 아니라 canonical↔registry 정합을 잠근다", () => {
  /**
   * §cron-registry-drift (2026-08-08) — 잠금 이전.
   *
   * 구 단언은 `config.crons.length === 5` 하드값이었다. 그러나 이 파일 헤더가
   * 스스로 선언하듯 canonical 은 vercel.json crons 이다 — canonical 이 늘 때마다
   * 파생 sentinel 이 깨지는 구조는 "옛 값 잠금"(§inventory-dead-file-cleanup 계보)
   * 이다. 실제로 catalog-ingest(0 3 * * *) · retention-archive(0 4 * * *) 가
   * 추가되며 5 → 7 이 되자 이 단언이 RED 로 상주했다.
   *
   * 따라서 개수는 잠그지 않는다. 대신 canonical 의 모든 path 가 운영
   * 레지스트리에 존재하고 schedule 이 일치할 것을 잠근다 — cron 을 새로
   * 추가하는 행위 자체는 막지 않되, registry 누락은 즉시 RED 가 된다.
   */
  it("crons 개수는 운영 레지스트리 개수와 같다 (하드값 아님)", () => {
    const config = JSON.parse(vercelJsonRaw);
    expect(config.crons.length).toBe(VERCEL_CRON_REGISTRY.length);
  });

  it("canonical 의 모든 cron path 가 레지스트리에 존재한다 (누락 0)", () => {
    const config = JSON.parse(vercelJsonRaw);
    const registryPaths = new Set(VERCEL_CRON_REGISTRY.map((e) => e.path));
    const missing = (config.crons as Array<{ path: string }>)
      .map((c) => c.path)
      .filter((p) => !registryPaths.has(p));
    expect(missing).toEqual([]);
  });

  it("레지스트리에 canonical 에 없는 유령 항목이 없다", () => {
    const config = JSON.parse(vercelJsonRaw);
    const configPaths = new Set(
      (config.crons as Array<{ path: string }>).map((c) => c.path),
    );
    const ghosts = VERCEL_CRON_REGISTRY.map((e) => e.path).filter(
      (p) => !configPaths.has(p),
    );
    expect(ghosts).toEqual([]);
  });

  it("scheduleKst 가 cron 시각(UTC)의 +9 환산과 일치한다", () => {
    // 날조 방지 — "매일 HH:MM KST" 문자열이 schedule 의 UTC 시각과 정합해야 한다.
    for (const entry of VERCEL_CRON_REGISTRY) {
      const m = entry.schedule.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
      expect(m).not.toBeNull();
      const minuteUtc = Number(m![1]);
      const hourUtc = Number(m![2]);
      const hourKst = (hourUtc + 9) % 24;
      const expected = `매일 ${String(hourKst).padStart(2, "0")}:${String(
        minuteUtc,
      ).padStart(2, "0")} KST`;
      expect(entry.scheduleKst).toBe(expected);
    }
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

describe("§11.250b-fix #5 — 운영 경계와 수동 차단 지점", () => {
  it("vercel.json cron은 운영 레지스트리와 1:1로 맞는다", () => {
    const config = JSON.parse(vercelJsonRaw);
    const configPaths = config.crons.map((entry: { path: string }) => entry.path).sort();
    const registryPaths = VERCEL_CRON_REGISTRY.map((entry) => entry.path).sort();

    expect(registryPaths).toEqual(configPaths);
  });

  it("모든 cron은 목적, prod-only 대상 환경, 수동 차단 지점을 가진다", () => {
    const config = JSON.parse(vercelJsonRaw);
    for (const cron of config.crons as Array<{ path: string; schedule: string }>) {
      const registry = VERCEL_CRON_REGISTRY.find((entry) => entry.path === cron.path);

      expect(registry).toBeDefined();
      expect(registry?.schedule).toBe(cron.schedule);
      expect(registry?.purposeKo).toMatch(/./);
      expect(registry?.environment).toBe("prod-only");
      expect(registry?.runBoundaryKo).toMatch(/production/);
      expect(registry?.manualGateKo).toMatch(/Vercel Dashboard|CRON_SECRET/);
      expect(registry?.operatorCheckKo).toMatch(/확인/);
      expect(registry?.expectedResultKo).toMatch(/./);
    }
  });

  it("운영자가 3초 안에 읽을 scheduleKst와 목적이 비어 있지 않다", () => {
    for (const registry of VERCEL_CRON_REGISTRY) {
      expect(registry.scheduleKst).toMatch(/KST/);
      expect(registry.purposeKo.length).toBeGreaterThan(10);
    }
  });
});
