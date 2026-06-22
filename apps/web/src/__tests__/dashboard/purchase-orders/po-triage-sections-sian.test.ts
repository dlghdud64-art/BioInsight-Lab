/**
 * §시안-PO-Phase1 #po-triage-sections-sian
 *
 * 발주 관리 page.tsx 시안 Phase 1 재구성 RED guard (source-regex).
 *
 * 핵심 가치 = "내 차례(지금 실행 가능)" vs "외부 대기(공급사 응답 대기)" 분리.
 *
 * 검증 범위:
 *   1. 발주 흐름 파이프라인(발행 가능 / 공급사 확인 / 입고 인계) 노드 존재.
 *   2. 트리아지 KPI 4(실행 가능 / 외부 대기 / 기한 초과 / 전체 진행) 존재.
 *   3. 섹션 헤더("지금 내 차례" / "공급사 응답 대기" / "입고로 인계") 존재.
 *   4. "리마인더" 문구 통일 + "독려" 부재(honesty 톤).
 *   5. AI 패널 / 모달 미도입(AI_DATA / IssueModal / ReminderModal 부재).
 *   6. 회귀 0 — 기존 핵심 testid·StatusCountGrid·AppPageHeader·
 *      buildModuleDownstream·updatePurchaseOrdersFilter·ops-store wiring 보존.
 *   7. canonical derive — 새 추가 섹션 count 는 headerStats/builder 에서,
 *      하드코딩 리터럴 count("N건" 숫자 literal) 부재.
 *
 * Source-level guards only (readFileSync + regex). DB / mount 없음.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = "src/app/dashboard/purchase-orders/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§시안-PO-Phase1 — 파일 존재", () => {
  it("page.tsx 존재", () => {
    expect(existsSync(join(REPO_ROOT, PAGE))).toBe(true);
  });
});

describe("§시안-PO-Phase1 (1) 발주 흐름 파이프라인", () => {
  const src = read(PAGE);

  it("파이프라인 헤더 '발주 흐름' 존재", () => {
    expect(src).toMatch(/발주 흐름/);
  });

  it("3 단계 라벨(발행 가능 / 공급사 확인 / 입고 인계) 존재", () => {
    expect(src).toMatch(/발행 가능/);
    expect(src).toMatch(/공급사 확인/);
    expect(src).toMatch(/입고 인계/);
  });

  it("내 차례 vs 외부 대기 서브라벨 존재", () => {
    expect(src).toMatch(/내 차례/);
    expect(src).toMatch(/외부 대기/);
  });

  it("active 단계 '현재 집중' 강조 존재", () => {
    expect(src).toMatch(/현재 집중/);
  });

  it("pipelineStages 가 headerStats canonical 에서 derive", () => {
    expect(src).toMatch(/pipelineStages/);
    expect(src).toMatch(/headerStats\.readyToExecute/);
    expect(src).toMatch(/headerStats\.waitingExternal/);
  });

  it("chevron 노드 연결(blue active / slate todo)", () => {
    expect(src).toMatch(/ChevronRight/);
    expect(src).toMatch(/bg-blue-600/);
  });
});

describe("§시안-PO-Phase1 (2) 트리아지 KPI 4", () => {
  const src = read(PAGE);

  it("triageKpis 정의 존재", () => {
    expect(src).toMatch(/triageKpis/);
  });

  it("4 라벨(실행 가능 / 외부 대기 / 기한 초과 / 전체 진행) 존재", () => {
    expect(src).toMatch(/실행 가능/);
    expect(src).toMatch(/외부 대기/);
    expect(src).toMatch(/기한 초과/);
    expect(src).toMatch(/전체 진행/);
  });

  it("count 전부 headerStats canonical (overdue / openActionable)", () => {
    expect(src).toMatch(/headerStats\.overdue/);
    expect(src).toMatch(/headerStats\.openActionable/);
  });

  it("0건 회색 톤다운(text-gray-400)", () => {
    expect(src).toMatch(/text-gray-400/);
  });

  it("§11.311 한 줄 압축(grid-cols-2 + p-3)", () => {
    expect(src).toMatch(/grid-cols-2 md:grid-cols-4/);
    expect(src).toMatch(/p-3 md:p-4/);
  });
});

describe("§시안-PO-Phase1 (3~5) 트리아지 섹션 헤더", () => {
  const src = read(PAGE);

  it("'지금 내 차례' 섹션 존재", () => {
    expect(src).toMatch(/지금 내 차례/);
  });

  it("'공급사 응답 대기' 섹션 존재", () => {
    expect(src).toMatch(/공급사 응답 대기/);
  });

  it("'입고로 인계' 섹션 존재 (다운스트림 jargon 비노출)", () => {
    expect(src).toMatch(/입고로 인계/);
    expect(src).not.toMatch(/다운스트림 인계/);
  });

  it("내 차례 = buckets.ready / 외부 대기 = buckets.waiting_external derive", () => {
    expect(src).toMatch(/actionableItems\s*=\s*buckets\.ready/);
    expect(src).toMatch(/externalItems\s*=\s*buckets\.waiting_external/);
  });

  it("입고로 인계 count = downstream 합산(handoffTotal)", () => {
    expect(src).toMatch(/handoffTotal/);
    expect(src).toMatch(/downstream\.reduce/);
  });
});

describe("§시안-PO-Phase1 honesty — 리마인더 통일 / 독려 부재", () => {
  const src = read(PAGE);

  it("'리마인더' 문구 존재", () => {
    expect(src).toMatch(/리마인더/);
  });

  it("'독려' 문구 부재", () => {
    expect(src).not.toMatch(/독려/);
  });
});

describe("§시안-PO-Phase1 honesty — AI 패널 / 모달 미도입(Phase 2)", () => {
  const src = read(PAGE);

  it("AI_DATA mock 부재", () => {
    expect(src).not.toContain("AI_DATA");
  });

  it("IssueModal / ReminderModal 포팅 부재", () => {
    expect(src).not.toContain("IssueModal");
    expect(src).not.toContain("ReminderModal");
  });

  it("리마인더 자동발송 mutation 신규 도입 부재", () => {
    expect(src).not.toMatch(/reminderMutation/);
    expect(src).not.toMatch(/send-reminder/);
  });
});

describe("§시안-PO-Phase1 회귀 0 — 기존 wiring / 렌더 보존", () => {
  const src = read(PAGE);

  it("AppPageHeader 보존", () => {
    expect(src).toMatch(/AppPageHeader/);
    expect(src).toMatch(/title="발주 관리"/);
  });

  it("StatusCountGrid (모바일 상태요약) 보존", () => {
    expect(src).toMatch(/StatusCountGrid/);
    expect(src).toMatch(/poStatusItems/);
  });

  it("ops-store unifiedInboxItems wiring 보존", () => {
    expect(src).toMatch(/useOpsStore/);
    expect(src).toMatch(/unifiedInboxItems/);
  });

  it("preferences sync (updatePurchaseOrdersFilter) 보존", () => {
    expect(src).toMatch(/updatePurchaseOrdersFilter/);
    expect(src).toMatch(/purchaseOrdersFilter/);
  });

  it("canonical builder import 보존", () => {
    expect(src).toMatch(/buildModuleHeaderStats/);
    expect(src).toMatch(/buildModulePriorityQueue/);
    expect(src).toMatch(/buildModuleLandingItems/);
    expect(src).toMatch(/buildModuleBuckets/);
    expect(src).toMatch(/buildModuleDownstream/);
  });

  it("EmptyState 보존", () => {
    expect(src).toMatch(/EmptyState/);
  });

  it("ActionableRow + PDF/email quick-action mutation 재사용", () => {
    expect(src).toMatch(/ActionableRow/);
    expect(src).toMatch(/pdfMutation/);
    expect(src).toMatch(/emailMutation/);
    expect(src).toMatch(/generate-pdf/);
    expect(src).toMatch(/send-email/);
  });

  it("bucket tab(상태별 분류) + PO_BUCKET_TABS 보존", () => {
    expect(src).toMatch(/상태별 분류/);
    expect(src).toMatch(/PO_BUCKET_TABS/);
  });

  it("우선 처리 priority queue 렌더 보존", () => {
    expect(src).toMatch(/우선 처리/);
    expect(src).toMatch(/PriorityCard/);
  });
});

describe("§시안-PO-Phase1 canonical — 하드코딩 count 부재", () => {
  const src = read(PAGE);

  it("새 추가 섹션에 리터럴 '1건'/'2건' 등 숫자 하드코딩 부재", () => {
    // 동적 보간({...}건)은 허용, 숫자 literal 바로 앞 "건"은 금지.
    expect(src).not.toMatch(/[>"\s]\d+건/);
  });
});
