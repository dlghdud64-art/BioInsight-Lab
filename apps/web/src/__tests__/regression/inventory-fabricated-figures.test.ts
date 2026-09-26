/**
 * §inventory-fabricated-figures (2026-09-16 · 릴레이 지시) · **재고 운영 화면은 지어낸 수를 그리지 않는다.**
 *
 * ── 왜 ──
 * 재고 「입출고 흐름」 탭과 형제 「보관 위치」 탭이 props·fetch 없이 모듈 상수만 그렸다.
 *   입출고 흐름: 재고 반영 45(78 lots) · 사용 중 12 · 안전재고 미만 3 「조치 필요」 · 검수 대기 2 …
 *              + 「AI 흐름 분석 4건」 = detectInsights(MOCK_INVENTORIES, MOCK_USAGE)
 *   보관 위치:   구역 5개 품목·만료·재주문 수 전부 buildMockItems()
 *   prod 대조(2026-09-16 · 릴레이 브라우저 + operator DB): 재고 4품목 · lot 0 · 사용 이력 0 ·
 *   미달 1품목 · ReceivingDraft 0 → 맞는 수가 없었다. 사용 기록 0건에 「사용량 급증 2건」.
 * 운영 판단 화면이 사실 아닌 수로 「조치 필요」를 지시하면 재주문·폐기 결정이 틀린다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 재고 탭 뷰에 모듈 수준 가짜 데이터가 없다(MOCK_ · buildMock · generateMock · 숫자 리터럴 count).
 *   ② 데이터 원천(props·query·fetch)이 없는 뷰는 「데이터 없음」 상태를 그린다 — 수를 그리지 않는다.
 *   ③ 분석 카드(detectInsights)는 **실사용 기록 길이 게이트** 뒤에서만 렌더되고, 가짜 입력을 받지 않는다.
 *   ④ 탭 자체는 남아 있다(삭제로 '고쳤다' 하지 않는다 · 되살릴 자리를 보존).
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. 목록 밖 재고 컴포넌트. 2026-09-16 같은 스윕에서 발견했으나 **별건으로 분리**한 것:
 *      - ~~import-staging-workbench.tsx~~ → **닫힘 §inventory-import-fake-success (2026-09-26 · 호영님 지시)**
 *        여기 적힌 그대로였다: 파일을 읽지 않고 generateMockRows 로 행을 짓고, API 호출 0건에 1.5초 뒤
 *        「적용 완료」. 이 목록이 **10일간 정답을 들고 있었다** — §sentinel 자기 한계는 다음 검사의 시작점.
 *        처방은 삭제가 아니었다: 저장 경로(/api/inventory/import/preview+commit)와 그 경로를 부르는
 *        UI(import-wizard.tsx)가 **이미 있었고 렌더 도달이 0** 이었다 → 라이브 진입점을 그쪽으로 붙였다.
 *        반대 명제는 regression/inventory-import-fake-success.test.ts 가 든다.
 *      - inventory-context-panel.tsx   generateMockRisks/Actions 는 이름과 달리 실제 item 필드 파생.
 *                                      단 「미개봉 {수량×0.3}ea」 는 지어낸 수 · 「최근 14일 사용속도」 는 측정 안 한 표현
 *      - priority-action-queue.tsx     items 미전달 시 generateMockQueueItems 폴백(현재 부모가 항상 전달 → 도달 불가)
 *   2. 런타임 값. 소스 형태만 본다.
 *   3. 서버가 내려주는 가짜 값(API 쪽 하드코딩)은 이 검사 밖이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

/** 재고 화면 탭으로 렌더되는 뷰 = 이 검사의 표면 */
const TAB_VIEWS = [
  { file: "components/inventory/inventory-flow-view.tsx", tab: "flow", component: "InventoryFlowView" },
  { file: "components/inventory/storage-location-view.tsx", tab: "storage-location", component: "StorageLocationView" },
];
const CONTENT = "app/dashboard/inventory/inventory-content.tsx";

describe("§inventory-fabricated-figures · 재고 탭은 지어낸 수를 그리지 않는다", () => {
  it("① 모듈 수준 가짜 데이터 0", () => {
    const offenders: string[] = [];
    for (const { file } of TAB_VIEWS) {
      const src = code(file);
      if (/\bMOCK_[A-Z_]+/.test(src)) offenders.push(`${file} · MOCK_ 상수`);
      if (/\b(buildMock|generateMock)\w*\s*\(/.test(src)) offenders.push(`${file} · mock 생성 함수`);
      if (/\b(itemCount|lotCount|count|totalItems)\s*:\s*\d/.test(src)) offenders.push(`${file} · 숫자 리터럴 count`);
    }
    expect(offenders).toEqual([]);
  });

  it("② 데이터 원천이 없으면 「데이터 없음」 상태를 그린다", () => {
    for (const { file } of TAB_VIEWS) {
      const src = code(file);
      const hasSource = /useQuery\s*\(|csrfFetch\s*\(|\bfetch\s*\(|function\s+\w+\s*\(\s*\{[^)]+\}\s*:/.test(src);
      if (hasSource) continue;
      expect(src, `${file} · 원천 없이 수를 그린다`).toMatch(/data-testid="[\w-]+-unwired"/);
      expect(src, `${file} · 「데이터 없음」 문구 부재`).toMatch(/데이터 없음/);
    }
  });

  it("③ 분석 카드는 실사용 기록 길이 게이트 뒤에서만 · 가짜 입력 금지", () => {
    for (const { file } of TAB_VIEWS) {
      const src = code(file);
      if (!/detectInsights\s*\(|AI 흐름 분석/.test(src)) continue;
      expect(src, `${file} · 분석 엔진이 모듈 상수를 입력으로 받는다`).not.toMatch(
        /detectInsights\s*\(\s*(MOCK_|\[)/,
      );
      expect(src, `${file} · 사용 기록 0건 게이트 없음`).toMatch(/usage\w*\.length\s*>\s*0/i);
    }
  });

  it("④ 두 탭은 재고 화면에 그대로 남아 있다", () => {
    const src = code(CONTENT);
    for (const { tab, component } of TAB_VIEWS) {
      expect(src).toMatch(new RegExp(`<TabsContent value="${tab}"[\\s\\S]{0,200}?<${component}\\b`));
    }
  });
});
