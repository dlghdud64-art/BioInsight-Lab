/**
 * §main-dashboard-redesign P4 — 중단 모듈(Pipeline·ActionInbox) sentinel
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P4 중단 모듈, 가드③)
 *
 * 검증:
 *   (A) Pipeline — 4단계(견적→발주→입고→재고) summary 단일 진실 + 4상태 + §11.311.
 *   (B) 가드③ — Pipeline 전이맵 로컬 재정의 0(state-machine canonical 권위 참조).
 *   (C) ActionInbox — 통합(max-h 412 스크롤) + 행 클릭 라우팅 + empty 정직 + dead button 0.
 *   (D) P4 격리 — page.tsx 미배선(고립 빌드, 탑재 별도 커밋).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const PIPE = "src/components/dashboard/pipeline.tsx";
const INBOX = "src/components/dashboard/action-inbox.tsx";
const PAGE = "src/app/dashboard/page.tsx";

// ── (A) Pipeline 4단계 summary 단일 진실 ────────────────────────────────
describe("§main-dashboard-redesign P4 (A) — Pipeline 4단계", () => {
  it("4단계 라벨 — 견적/발주/입고/재고", () => {
    const src = read(PIPE);
    expect(src).toMatch(/견적/);
    expect(src).toMatch(/발주/);
    expect(src).toMatch(/입고/);
    expect(src).toMatch(/재고/);
  });
  it("summary 모듈 단일 진실 — modules.{quote,po,receive,stock}", () => {
    const src = read(PIPE);
    expect(src).toMatch(/modules\.quote/);
    expect(src).toMatch(/modules\.po/);
    expect(src).toMatch(/modules\.receive/);
    expect(src).toMatch(/modules\.stock/);
    expect(src).toMatch(/from "@\/lib\/dashboard\/summary-derive"/);
  });
  it("4상태(loading/error/empty·ready) + §11.311 컴팩트 + 0 회색", () => {
    const src = read(PIPE);
    expect(src).toMatch(/state === "loading"/);
    expect(src).toMatch(/state === "error"/);
    expect(src).toMatch(/animate-pulse/);
    expect(src).toMatch(/text-lg md:text-xl/);
    expect(src).toMatch(/bg-gray-50/);
  });
  it("터치 ≥44px + 가짜 차트/목업 0", () => {
    const src = read(PIPE);
    expect(src).toMatch(/min-h-\[44px\]/);
    expect(src).not.toMatch(/MOCKUP|mockup|recharts|AreaChart/);
  });
});

// ── (B) 가드③ — 전이맵 로컬 재정의 0 ────────────────────────────────────
describe("§main-dashboard-redesign P4 (B) — 가드③ Pipeline 전이 canonical", () => {
  it("Pipeline 에 ALLOWED_*_TRANSITIONS 로컬 재정의 없음(O1 drift 차단)", () => {
    expect(read(PIPE)).not.toMatch(/ALLOWED_\w+_TRANSITIONS\s*[:=]/);
  });
  it("state-machine canonical 권위 참조 명시", () => {
    expect(read(PIPE)).toMatch(/state-machine/);
  });
});

// ── (C) ActionInbox 통합 ────────────────────────────────────────────────
describe("§main-dashboard-redesign P4 (C) — ActionInbox 통합 (§dashboard-shifan-fidelity P-fid2 시안 .task 행)", () => {
  it("행 클릭 라우팅(href) + 터치 ≥44px", () => {
    const src = read(INBOX);
    expect(src).toMatch(/href=\{it\.href\}/);
    expect(src).toMatch(/min-h-\[44px\]/);
  });
  it("empty 정직 — '처리할 항목 없음'", () => {
    expect(read(INBOX)).toMatch(/처리할 항목 없음/);
  });
  it("dead button 0 — count>0 항목만 렌더(0건 행 미노출)", () => {
    expect(read(INBOX)).toMatch(/filter\(\(it\)\s*=>\s*it\.count\s*>\s*0\)/);
  });
  it("§dashboard-shifan-fidelity — 시안 행 구성(상태 배지 pill + 설명 + 액션 버튼)", () => {
    const src = read(INBOX);
    // §P-fid2: 행 = 아이콘 + (제목+배지) + 설명 + 액션 버튼. 단조 dot+건수 행 폐지.
    expect(src).toMatch(/TONE_PILL_LABEL/);  // 긴급/검토 필요 배지
    expect(src).toMatch(/it\.cta/);          // 우측 액션 버튼 라벨
    expect(src).toMatch(/it\.detail/);       // 설명
  });
  it("§11.302 신호등 톤(danger/warn/info/ok, amber 금지·yellow)", () => {
    const src = read(INBOX);
    expect(src).toMatch(/danger/);
    expect(src).toMatch(/warn/);
    expect(src).toMatch(/bg-red-/);
    expect(src).toMatch(/bg-yellow-/);
    expect(src).not.toMatch(/-amber-|-orange-/);
  });
});

// ── (D) 탑재 단계 — Pipeline 배선(P4-B1), ActionInbox 미배선(P4-B2) ──────
describe("§main-dashboard-redesign P4 (D) — 모듈 탑재 단계", () => {
  it("page.tsx 가 Pipeline 배선(P4-B1 — SmartReceiving 대체)", () => {
    expect(read(PAGE)).toMatch(/components\/dashboard\/pipeline|<Pipeline/);
  });
  it("page.tsx 가 ActionInbox 배선(§dashboard-shifan-adopt P1 — 우선순위 배너 대체)", () => {
    expect(read(PAGE)).toMatch(/action-inbox|ActionInbox/);
  });
});
