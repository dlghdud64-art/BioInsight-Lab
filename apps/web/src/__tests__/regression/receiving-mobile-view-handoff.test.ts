/**
 * 입고 관리 모바일웹 리디자인(핸드오프, 호영님 2026-07-05) — MobileReceivingView 시안 정합.
 * KPI 흰 카드+7px 도트 · 입고 카드 상태색 절제(배경 채색 금지·좌측 세로띠 제거) · CTA no-op 0 보존.
 *
 * 【UPDATED — §mobile-receiving-rcv-card P1·P2 (호영님 2026-07-26 핸드오프, 커밋 575bda04)】
 *   RCV 1건 = 카드 1장. 이전(이슈-단위 ModuleLandingItem projection: card-level onClick(item)/
 *   gateOf 프로젝션)은 canonical(receivingBatches) 파생 뷰모델(MobileReceivingCard/Summary)로 통합 —
 *   반영 차단/준비됨 2상태 · 차단 사유 체크리스트 · per-blocker CTA(첨부/검사) + 최종 재고 반영 CTA로
 *   재구성. 원 intent(흰 카드+도트 · 카드 배경 채색 금지 · 좌측 세로띠 제거 · CTA no-op 0)를 새
 *   RCV-카드 구조에 재앵커(부재-lock + intent-lock). 07-05 filled-CTA(h-11/문서 첨부) 및 card-level
 *   onClick(item)/gateOf 시그니처는 supersede.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const VIEW = readFileSync(join(__dirname, "..", "..", "components/receiving/mobile-receiving-view.tsx"), "utf8");

describe("입고 모바일 리디자인 — KPI 카드(흰 카드+도트)", () => {
  it("KPI 2카드 흰 배경(bg-white) + 7px 상태 도트, 꽉 찬 배경색 미사용", () => {
    expect(VIEW).toMatch(/h-\[7px\] w-\[7px\] rounded-full/);
    // §rcv-card 재앵커: 반영 차단 도트 = #b91c1c(구 bg-rose-500 supersede), 반영 가능 = emerald-500.
    expect(VIEW).toMatch(/bg-\[#b91c1c\]/); // 반영 차단 도트
    expect(VIEW).toMatch(/bg-emerald-500/); // 반영 가능 도트
    // KPI 컨테이너 = 흰 카드(blocked/ready 둘 다 border bg-white, filled 배경 금지) — summary 파생.
    expect(VIEW).toMatch(/border bg-white \$\{\s*summary\.blockedCount > 0/);
    expect(VIEW).toMatch(/border bg-white \$\{\s*summary\.readyCount > 0/);
  });
});

describe("입고 모바일 리디자인 — 입고 카드(상태색 절제 + 배경 채색 금지 + 큰 CTA)", () => {
  it("카드 보더 중립(#e6eaf0) + bg-white — 좌측 세로띠(w-1 stripe) 잔재 0", () => {
    // §rcv-card: 상태색 = 헤더 배지 칩에만, 카드 보더/배경 채색 금지.
    expect(VIEW).toMatch(/rounded-2xl border border-\[#e6eaf0\] bg-white/);
    expect(VIEW).not.toMatch(/w-1 shrink-0/); // 좌측 세로띠 잔재 0 (원 intent 보존)
  });
  it("상태 배지 칩(반영 차단 rose / 반영 준비됨 green) — 칩만 채색", () => {
    expect(VIEW).toMatch(/bg-\[#fef2f2\] text-\[#b91c1c\]/); // 반영 차단 배지
    expect(VIEW).toMatch(/bg-\[#f0fdf4\] text-\[#15803d\]/); // 반영 준비됨 배지
  });
  it("큰 primary CTA(min-h-[44px]) — 재고 반영 + 첨부, 구 라벨(문서 검토) 잔재 0", () => {
    expect(VIEW).toMatch(/재고 반영/); // 최종 CTA(ready 활성 / blocked 비활성)
    expect(VIEW).toMatch(/min-h-\[44px\][\s\S]*?bg-\[#2563eb\]/); // 실비율 큰 CTA(파랑)
    expect(VIEW).toMatch(/첨부/); // blocker 행 문서 첨부 진입
    expect(VIEW).not.toMatch(/문서 검토/); // 구 라벨(작은 링크) 잔재 0
  });
});

describe("입고 모바일 리디자인 — 상단 필터 카운트(핸드오프 정합)", () => {
  it("칩에 카운트 인라인(전체/반영 차단/반영 가능) — summary 파생", () => {
    expect(VIEW).toMatch(/c\.k === "all"\s*\?\s*summary\.cards\.length\s*:\s*c\.k === "blocked"\s*\?\s*summary\.blockedCount\s*:\s*summary\.readyCount/);
    expect(VIEW).toMatch(/tabular-nums/);
  });
  it("시안 정합 — 비활성 칩 중립, danger 색은 활성 시에만(항상-rose 틴트 제거)", () => {
    // 활성 반영 차단 칩 = filled(.danger.on) #b91c1c(구 rose-600 supersede)
    expect(VIEW).toMatch(/bg-\[#b91c1c\] border-\[#b91c1c\] text-white/);
    // 구: 비활성 danger 칩 상시 rose 틴트 잔재 0
    expect(VIEW).not.toMatch(/bg-rose-50 border-rose-200 text-rose-700/);
  });
});

describe("입고 모바일 리디자인 — 무회귀(no-op 0·wiring 보존)", () => {
  it("CTA 실 배선(첨부/검사/재고반영) + empty + canonical 뷰모델 매핑 보존", () => {
    // §rcv-card: card-level onClick(item) → per-action 실 핸들러(onAttach/onInspect/onPost). dead button 0.
    expect(VIEW).toMatch(/onClick=\{\(\) => onAttach\(card\)\}/);
    expect(VIEW).toMatch(/onClick=\{\(\) => onInspect\(card\)\}/);
    expect(VIEW).toMatch(/onClick=\{\(\) => onPost\(card\)\}/);
    expect(VIEW).toMatch(/조건에 맞는 입고가 없습니다/); // empty state
    // canonical 매핑 — gateOf(구) → MobileReceivingCard/Summary 뷰모델 파생.
    expect(VIEW).toMatch(/MobileReceivingCard/);
    expect(VIEW).toMatch(/MobileReceivingSummary/);
  });
});
