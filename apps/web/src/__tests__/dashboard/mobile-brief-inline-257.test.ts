/**
 * §11.257 — 【은퇴】 모바일 대시보드 인라인 운영 브리핑 link
 *
 * 은퇴 사유: §main-dashboard-p0-honesty (호영님 핸드오프 2026-09-17 §0-4 · 판정 2026-09-18)
 *   대시보드에서 운영 브리핑 진입점 자체를 제거했다. 이 파일이 검사하던 인라인 link ·
 *   Sparkles 아이콘 · lg:hidden 분기 · FAB wrap 은 **전부 존재하지 않는 기능**이다.
 *   (기준선 실측 2026-09-17: 11건 중 6건이 이미 RED였다 — 검사가 죽은 기능을 붙잡고 있었다.)
 *
 * 명제 이관 (은퇴 전 복원 — CLAUDE.md 「지우기 전에 명제를 이력에서 복원한다」):
 *   1. "모바일 하단 빠른 실행 바 보존"     → main-dashboard-p0-honesty.test.ts  B9
 *   2. "AIInsightDialog 헤더 mount 보존"   → main-dashboard-p0-honesty.test.ts  B9
 *   3. "BarcodeScanFab mount 변경 0"       → operational-brief-fab-sweep-258sweep.test.ts (원 소유 유지)
 *   4. "popup self-contained · controls 속성" → operational-brief-popup-self-contained.test.ts (원 소유 유지)
 *
 * 아래 단언은 **역방향**이다 — 은퇴한 기능이 조용히 되살아나는 것을 막는다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const code = safeRead(resolve(__dirname, "../../app/dashboard/page.tsx"));

describe("§11.257 은퇴 — 대시보드 운영 브리핑 진입점 재유입 차단", () => {
  it("인라인 '운영 브리핑 보기' link 0", () => {
    expect(code).not.toMatch(/운영\s*브리핑\s*보기/);
  });
  it("floating entry mount 0 (§main-dashboard-p0-honesty B6 와 동일 명제)", () => {
    expect(code).not.toMatch(/<OperationalBriefFloatingEntry/);
  });
});
