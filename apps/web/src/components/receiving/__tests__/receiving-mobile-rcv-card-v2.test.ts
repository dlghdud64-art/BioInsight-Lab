import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §mobile-receiving-rcv-card Phase 2 (호영님 2026-07-26 핸드오프 — 모바일 입고 관리 개선)
 *   입고 리스트 모바일: RCV 1건 = 카드 1장(차단 사유 체크리스트). 이슈-단위 ModuleLandingItem
 *   분열(RCV → 3카드) 제거, canonical(receivingBatches) 파생 뷰모델 소비.
 *
 * 흰 카드 + 칩/텍스트만 채색(배경 채색 금지) · 체크리스트 순서·의존 · 최종 CTA 사유 인라인 ·
 * 번호 칩 신호등(문서 red / 보류 yellow / 대기 gray) · KPI 단일 소스 · dead button 0.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
// product-detail 교훈: 부정 단언은 설명 주석의 토큰을 오매칭한다 → 코드 대상 단언은 주석 제거 후.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const VIEW = "src/components/receiving/mobile-receiving-view.tsx";
const PAGE = "src/app/dashboard/receiving/page.tsx";

describe("§mobile-receiving-rcv-card P2 — RCV 단위 뷰모델 소비(이슈 분열 제거)", () => {
  it("canonical 파생 뷰모델(MobileReceivingCard/Summary) 사용, ModuleLandingItem 미사용", () => {
    const src = read(VIEW);
    expect(src).toMatch(/from "@\/lib\/ops-console\/mobile-receiving-view-model"/);
    expect(src).toMatch(/MobileReceivingCard/);
    expect(src).toMatch(/MobileReceivingSummary/);
    // 코드(주석 제외)에 이슈-단위 projection 타입 미사용.
    expect(stripComments(src)).not.toMatch(/ModuleLandingItem/);
  });

  it("page.tsx: receivingBatches → buildMobileReceivingSummary 파생 주입", () => {
    const src = read(PAGE);
    expect(src).toMatch(/buildMobileReceivingSummary\(receivingBatches, nowIso\)/);
    expect(src).toMatch(/summary=\{mobileSummary\}/);
  });
});

describe("§mobile-receiving-rcv-card P2 — 흰 카드(배경 채색 금지)", () => {
  it("카드 = 흰 배경 + 보더 #e6eaf0", () => {
    const src = read(VIEW);
    expect(src).toMatch(/border border-\[#e6eaf0\] bg-white/);
  });

  it("차단 카드 배경 rose/emerald 박스 채색 없음(칩·텍스트만)", () => {
    const src = read(VIEW);
    expect(src).not.toMatch(/bg-rose-50 border-rose-100/);
    expect(src).not.toMatch(/bg-emerald-50 border-emerald-100/);
    // 풀폭 파란 CTA 반복(이전 GateCard) 제거
    expect(src).not.toMatch(/blocked \? "bg-blue-600" : "bg-emerald-600"/);
  });
});

describe("§mobile-receiving-rcv-card P2 — 체크리스트 순서·의존·최종 CTA", () => {
  it("체크리스트 헤더 + 자동 소멸 안내", () => {
    const src = read(VIEW);
    expect(src).toMatch(/반영까지 남은 일 · /);
    expect(src).toMatch(/해결되면 자동으로 지워져요/);
  });

  it("검수 줄 선행 미해결 시 비활성 + 안내(dependsOnUnresolved)", () => {
    const src = read(VIEW);
    expect(src).toMatch(/blocker\.dependsOnUnresolved/);
    expect(src).toMatch(/1·2 해결 후 진행돼요/);
  });

  it("최종 CTA 비활성 + 사유 인라인(N건 해결 후 가능)", () => {
    const src = read(VIEW);
    expect(src).toMatch(/disabled/);
    expect(src).toMatch(/건 해결 후 가능/);
  });

  it("ready RCV 활성 재고 반영 CTA", () => {
    const src = read(VIEW);
    expect(src).toMatch(/재고 반영/);
    expect(src).toMatch(/onPost\(card\)/);
  });
});

describe("§mobile-receiving-rcv-card P2 — 번호 칩 신호등(§11.302 yellow, amber 금지)", () => {
  it("문서=red / 보류=yellow / 대기=gray", () => {
    const src = read(VIEW);
    expect(src).toMatch(/bg-\[#fef2f2\] text-\[#b91c1c\]/); // 문서 red
    expect(src).toMatch(/bg-\[#fef9c3\] text-\[#a16207\]/); // 보류 yellow
    expect(src).toMatch(/bg-\[#f1f5f9\] text-\[#94a3b8\]/); // 대기 gray
  });

  it("muted amber(#b45821) 미도입", () => {
    const src = read(VIEW);
    expect(src).not.toMatch(/#b45821/);
    expect(src).not.toMatch(/amber-/);
  });
});

describe("§mobile-receiving-rcv-card P2 — 배선(dead button 0) · 회귀 0", () => {
  it("첨부/검사/반영 실 핸들러 wiring", () => {
    const src = read(VIEW);
    expect(src).toMatch(/onClick=\{\(\) => onAttach\(card\)\}/);
    expect(src).toMatch(/onClick=\{\(\) => onInspect\(card\)\}/);
  });

  it("page.tsx: onPost → store.postToInventory 실 mutation + onAttach/onInspect 실 네비", () => {
    const src = read(PAGE);
    expect(src).toMatch(/postToInventory\(card\.id\)/);
    expect(src).toMatch(/router\.push\(`\/dashboard\/receiving\/\$\{card\.id\}`\)/);
    expect(src).toMatch(/import \{ labToast \}/);
  });

  it("필터 칩(전체/문서 대기/반영 가능) 보존 + KPI 단일 소스", () => {
    const src = read(VIEW);
    expect(src).toMatch(/label: "전체"/);
    expect(src).toMatch(/label: "문서 대기"/);
    expect(src).toMatch(/label: "반영 가능"/);
    expect(src).toMatch(/summary\.blockedCount/);
    expect(src).toMatch(/summary\.readyCount/);
  });

  it("터치 타겟 44px 보존", () => {
    const src = read(VIEW);
    expect(src).toMatch(/min-h-\[44px\]/);
  });
});
