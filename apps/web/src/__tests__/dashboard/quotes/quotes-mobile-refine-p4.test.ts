/**
 * §quotes-mobile-refine P4 #dispatch-review-5a — 공급사 발송 검토 시트 정직성·위계
 *
 * 정본: docs/plans/PLAN_quotes-mobile-refine.md P0-G2 판정표 + 호영님 지시문(2026-07-21) §3(5a).
 *
 * P0-G2 실측 기반 delta (기 구현분 제외):
 *   1 스텝퍼 — draft.ready 가 선행 단계와 독립 → 공급사 0(막힘)에도 3단계 초록 체크(지시문의 모순 실재)
 *     → **누적 게이팅**: 선행 미완이면 이후 단계 done 불가.
 *   2 경고 통합 — 히어로 내부 yellow 경고 배너 → **blue 안내 톤**(지시문 히어로 보더 #93c5fd ≈ blue-300)
 *     + `✦ LabAxis 추천 공급사 탐색`(openSupplierRemediation 실배선).
 *   3 접기 — **기 구현**(messageExpanded 기본 false + 요약 줄 + 수정) → delta 0, 회귀 핀만.
 *   4 푸터 — blocked 시 사유 인라인(`공급사 추가 후 전송 가능 · N곳`, aria-label-274 핀 라벨은 무접촉) +
 *     다운로드 `· 직접 전달용` 라벨 + **공급사 1+곳이면 모바일서 다운로드 숨김**(P0 판정: 데스크탑 항상).
 *   5 케이스 칩 — 품목명(quoteSummary) 칩 추가. 담당자 칩은 header-reselect-09 가 "4b 과제거분 복원"으로
 *     핀 → 제거 대신 **모바일 숨김**(핀 보존 절충).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const W = read("src/components/quotes/dispatch/vendor-dispatch-workbench.tsx");

describe("§quotes-mobile-refine P4 — ① 스텝퍼 누적 게이팅 (가짜 체크 0)", () => {
  it("선행 단계 미완 시 이후 done 불가 (누적 prefix 게이팅)", () => {
    expect(W).toMatch(/let prefix = true/);
    expect(W).toMatch(/const ready = prefix && s\.ready/);
  });
  it("state 파생 구조 보존 (09 sentinel 핀: const state … = s.ready)", () => {
    expect(W).toMatch(/const state[^=]*=\s*s\.ready/);
  });
});

describe("§quotes-mobile-refine P4 — ② 경고 통합 히어로", () => {
  it("히어로 내부 yellow 경고 배너 폐지 → blue 안내", () => {
    const hero = W.match(/quote-dispatch-no-supplier-hero[\s\S]{0,900}/)![0];
    expect(hero).not.toMatch(/bg-yellow-50/);
    expect(hero).not.toMatch(/AlertTriangle/);
    expect(hero).toMatch(/border-blue-300/);
  });
  it("LabAxis 추천 공급사 탐색 — 기 구현 실배선 보존 (후보 브라우저 펼침, dead button 0)", () => {
    // P0-G2 보정: 탐색 CTA 는 §09b 에서 이미 구현(setCandidatesExpanded 배선) — 회귀 핀으로 전환.
    expect(W).toMatch(/quote-dispatch-explore-recommended/);
    expect(W).toMatch(/onClick=\{\(\) => setCandidatesExpanded\(true\)\}[\s\S]{0,300}LabAxis 추천 공급사 탐색/);
    expect(W).toMatch(/공급사명 \(선택\)/);
  });
});

describe("§quotes-mobile-refine P4 — ③ 접기 (기 구현 회귀 핀)", () => {
  it("메시지 기본 접힘 + 요약 줄 + 펼침 토글 보존", () => {
    expect(W).toMatch(/useState\(false\)[\s\S]{0,40}/);
    expect(W).toMatch(/전달 메시지 미리보기/);
    expect(W).toMatch(/플랫폼 자동 생성 초안/);
    expect(W).toMatch(/setMessageExpanded\(!messageExpanded\)/);
  });
});

describe("§quotes-mobile-refine P4 — ④ 푸터 위계", () => {
  it("blocked 시 비활성 사유 인라인 (라벨 핀 274 무접촉)", () => {
    expect(W).toMatch(/공급사 추가 후 전송 가능 · \{includedCount\}곳/);
    expect(W).toMatch(/선택 공급사에 요청 전달/);
  });
  it("다운로드 = '직접 전달용' 라벨", () => {
    expect(W).toMatch(/직접 전달용/);
  });
  it("공급사 1+곳이면 모바일 다운로드 숨김 (데스크탑 항상 — P0 판정)", () => {
    expect(W).toMatch(/includedCount > 0 \? "hidden md:inline-flex" : ""/);
  });
});

describe("§quotes-mobile-refine P4 — ⑤ 케이스 칩", () => {
  it("품목명(quoteSummary) 칩 추가", () => {
    expect(W).toMatch(/\{quoteSummary && \(/);
  });
  it("담당자 칩 보존 + 모바일 숨김 (header-reselect-09 핀 절충)", () => {
    expect(W).toMatch(/hidden sm:inline-flex[\s\S]{0,120}담당 발송 운영자/);
  });
  it("케이스 ref 칩 보존 (cuid 미노출)", () => {
    expect(W).toMatch(/케이스 \{quoteRef \?\? "저장 필요"\}/);
  });
});

describe("§quotes-mobile-refine P4 — 회귀 0", () => {
  it("§4-warn-dedup(2026-07-13) 잔존 계약 보존 — 보강 CTA·2상태 배너", () => {
    expect(W).toMatch(/quote-dispatch-supplier-remediation-visible-cta/);
    expect(W).toMatch(/quote-dispatch-state-banner/);
    expect(W).toMatch(/firstReadinessBlocker/);
  });
  it("발송 확인 게이트 보존 (오발송 방지)", () => {
    expect(W).toMatch(/quote-dispatch-confirm-before-send/);
    expect(W).toMatch(/quote-dispatch-send-disabled/);
  });
  it("aria-label 한국어 정합 보존 (274 핀)", () => {
    expect(W).toMatch(/aria-label="공급사 요청 전달 \(비활성\)"/);
    expect(W).toMatch(/aria-label="공급사에 견적 요청 발송"/);
  });
  it("PDF 다운로드 wiring 보존 (314b2 핀)", () => {
    expect(W).toMatch(/executeDownloadPdf/);
    expect(W).toMatch(/isDownloadingPdf/);
  });
  it("압박 어휘 0 (3 surface 한정 규칙)", () => {
    expect(W).not.toMatch(/독려|독촉/);
  });
});
