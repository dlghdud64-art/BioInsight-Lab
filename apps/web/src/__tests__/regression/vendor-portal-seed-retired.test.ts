/**
 * §vendor-portal-seed-retired (2026-09-22 · 호영님 판정) · **지어낸 거래 상대를 보여주던 벤더 포털은 돌아오지 않는다.**
 *
 * ── 왜 ──
 * /vendor-portal 이 인증 없이 누구에게나 Zustand 시드(SEED_RFQS · SEED_POS)를 렌더했다 —
 * 실재하지 않는 RFQ(RFQ-2026-0118 · 0119)와 발주, 공급사 「BioReagent Korea」 로 로그인된 것처럼.
 * 들어오는 링크는 0 이었지만 호영님: 「링크가 없으니 괜찮다」 는 근거가 아니다 — 링크 0 은 오늘의 상태지 보장이 아니다.
 * 인증 추가도, 빈 화면 교체도 아니고 **삭제**다(호영님).
 * 로그인 벤더 포털은 §vendor-portal-identity(벤더 계정 체계) 이후 새로 설계한다(app/vendor/page.tsx 주석).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 라우트·시드 저장소가 재생성되지 않는다 (경로 존재 0)
 *   ② 지어낸 식별자(RFQ-2026-0118 · 0119)와 시드 상수(SEED_RFQS · SEED_POS)를 쓰는 소스 0 (주석 제거본 · src 전역)
 *   ③ /vendor-portal 로 가는 링크·이동 0
 *
 * ── 자기 한계 ──
 *   1. prod 404 는 이 파일이 재지 못한다 — 배포 후 실측으로 따로 확인한다(2026-09-22 보고).
 *   2. `lib/vendor-portal/vendor-portal-events.ts` 는 남았다(삭제 지시 범위 밖). 포털이 유일한 발행자였으므로
 *      지금은 발행자 0 이다 — 구독자(procurement/vendor-response-inbox)는 받을 것이 없다. 별건.
 * 선례: ops/vendor-portal-rfq-retired.test.ts (같은 계열 · 포털 RFQ API mock 폐기 2026-08-10)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const SELF = `regression${sep}vendor-portal-seed-retired.test.ts`;

function filesMatching(re: RegExp): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry.startsWith(".next")) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !full.endsWith(SELF)) {
        if (re.test(stripComments(readFileSync(full, "utf8")))) out.push(full.slice(SRC.length + 1).split(sep).join("/"));
      }
    }
  };
  walk(SRC);
  return out.sort();
}

describe("§vendor-portal-seed-retired · 지어낸 벤더 포털은 돌아오지 않는다", () => {
  it("① 라우트·시드 저장소 경로 0", () => {
    for (const rel of ["app/vendor-portal", "lib/vendor-portal/vendor-portal-store.ts"]) {
      expect(existsSync(join(SRC, rel)), rel).toBe(false);
    }
  });

  it("② 지어낸 식별자·시드 상수를 쓰는 소스 0", () => {
    expect(filesMatching(/RFQ-2026-011[89]\b/)).toEqual([]);
    expect(filesMatching(/\bSEED_RFQS\b|\bSEED_POS\b/)).toEqual([]);
    expect(filesMatching(/\buseVendorPortalStore\b/)).toEqual([]);
  });

  it("③ /vendor-portal 로 가는 링크·이동 0", () => {
    expect(filesMatching(/["'`]\/vendor-portal(?:[/?"'`])/)).toEqual([]);
  });
});
