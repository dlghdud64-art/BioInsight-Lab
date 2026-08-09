/**
 * §cron-registry-drift — `VERCEL_CRON_REGISTRY` 라이브 도달성 잠금.
 *
 * 배경 (2026-08-08 Phase 0 실측):
 *   `src/lib/ops-console/vercel-cron-registry.ts` 는 운영 메타(목적 · KST 시각 ·
 *   수동 차단 지점 · 기대 결과)를 담고 있으나 **importer 가 0** 이었다 —
 *   자기 자신과 sentinel 테스트 외에 이 상수를 읽는 파일이 없었다.
 *   그 결과 `/admin/cron` 화면은 CronExecutionLog 실행 이력만 보여주고,
 *   운영자는 "이 cron 이 무엇을 하고 어떻게 끄는지" 를 화면에서 볼 수 없었다.
 *
 * §inventory-dead-file-cleanup 계보의 교훈:
 *   스타일·문자열·타입이 존재한다는 것은 라이브의 증거가 아니다.
 *   **importer 0 이면 dead.** 따라서 "값이 채워졌는가" 가 아니라
 *   "라이브 표면이 그 값을 읽는가" 를 잠근다.
 *
 * canonical truth: `apps/web/vercel.json` crons.
 *   이 파일은 도달성만 검사하며 canonical 을 읽지 않는다(정합 검사는
 *   `vercel-cron-registry.test.ts` 소관 — 책임 이원화 0).
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// __dirname = apps/web/src/__tests__/ops
const SRC_ROOT = resolve(__dirname, "../..");

/** 라이브 표면으로 간주하는 스캔 대상 — 테스트 디렉터리는 포함하지 않는다. */
const LIVE_DIRS = ["app", "components"];

/** registry 를 읽는다고 판정하는 마커 (경로 alias / 상대경로 양쪽) */
const IMPORT_MARKERS = [
  "ops-console/vercel-cron-registry",
  "VERCEL_CRON_REGISTRY",
  "getVercelCronRegistryEntry",
];

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    // 스캔 제외: 빌드 산출물 · 의존성 · 테스트
    if (name === "node_modules" || name === ".next" || name === "__tests__") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

const liveFiles = LIVE_DIRS.flatMap((d) => walk(resolve(SRC_ROOT, d)));

const importers = liveFiles.filter((f) => {
  const src = readFileSync(f, "utf8");
  return IMPORT_MARKERS.some((m) => src.includes(m));
});

describe("§cron-registry-drift — registry 라이브 도달성", () => {
  it("스캔 자체가 성립한다 (라이브 파일이 실제로 수집됨)", () => {
    // 이 단언이 없으면 walk 가 0건을 반환해도 importer 0 이 'dead' 인지
    // '스캔 실패' 인지 구분되지 않는다 — clean 위장 차단.
    expect(liveFiles.length).toBeGreaterThan(0);
  });

  it("VERCEL_CRON_REGISTRY 를 읽는 라이브 표면이 1개 이상 존재한다", () => {
    expect(importers.length).toBeGreaterThanOrEqual(1);
  });

  it("importer 중 하나는 admin cron 운영 표면이다", () => {
    // 어디서든 읽히기만 하면 되는 게 아니라, 운영자가 보는 화면 경로에
    // 도달해야 이 트랙의 목적(가시성)이 충족된다.
    const onAdminCronSurface = importers.some((f) =>
      f.replace(/\\/g, "/").includes("/cron/"),
    );
    expect(onAdminCronSurface).toBe(true);
  });
});
