/**
 * §zero-state-dashed-unify (2026-09-21 · 호영님 판정) · **0건 카드·빈 상태 박스 = 흰 배경 + 점선 테두리.**
 *
 * ── 근거 ──
 *   CLAUDE.md §Mobile Patterns 1 개정(2026-09-21) — 0건은 "꺼짐/불가" 가 아니라 "아직 안 채워진 자리".
 *   §dashboard-empty-state-unify(호영님 2026-07-04) — "빈/0/비활성 카드 회색 채움 제거 → 흰 배경 + 점선 테두리"
 *   를 이미 결정해 두었고(KPI 카드 · 빈상태 박스 둘 다), 대시보드 stat-line·pipeline 만 이행돼 있었다.
 *   조항 문구와 주석이 옛 설계(bg-gray-50)에 남아 있어 **이 6곳이 회색 채움으로 남았다.**
 *
 * ── 이 파일이 지키는 명제 ──
 *   6곳의 0건/빈 상태 요소가 흰 배경 + 점선 테두리이고 회색 채움이 없다. 창은 **요소 단위**다 —
 *   각 요소의 className 문자열 리터럴(0건 분기) 하나만 본다(파일 전체 grep 금지 · 2026-09-21 절차).
 *
 *     KPI 카드   inventory-content 헤더 「전체 품목」 0건 · status-count-grid 0건 셀 · purchase-orders 0건 KPI
 *     빈 상태    inventory-flow-view · storage-location-view 「데이터 없음」 · budget 「지출 추이·부서별 소진 데이터 없음」
 *
 * ── 범위 밖 (의도적) ──
 *   뱃지 틴트(재고 lot 이슈 0건 `border-slate-200 bg-slate-50` 등) — 7월 결정이 "뱃지 틴트·로딩 스켈레톤은
 *   정당(제외)" 로 뺐다. 데이터가 **있을 때만** 뜨는 안내 박스(inventory-content uncovered 안내 ·
 *   purchase-orders 외부 대기 목록)도 0건 문맥이 아니라 제외했다.
 *
 * ── 자기 한계 ──
 *   1. 이 6곳 밖의 0건 요소. 새로 생기는 0건 카드가 회색 채움을 쓰면 이 파일은 못 잡는다.
 *   2. 런타임 렌더. className 리터럴만 본다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

/** `anchor` 뒤에서 `marker` 를 찾고, 그 직후의 문자열 리터럴("…") 하나를 돌려준다. 못 찾으면 "". */
function literalAfter(src: string, anchor: string, marker: string): string {
  const at = src.indexOf(anchor);
  if (at < 0) return "";
  const m = src.indexOf(marker, at);
  if (m < 0) return "";
  const q1 = src.indexOf('"', m + marker.length - 1);
  const q2 = src.indexOf('"', q1 + 1);
  return q1 < 0 || q2 < 0 ? "" : src.slice(q1 + 1, q2);
}

/** 텍스트 앞에 있는 가장 가까운 `<div className="…">` 리터럴 — 빈 상태 박스의 컨테이너. */
function containerBefore(src: string, text: string): string {
  const at = src.indexOf(text);
  if (at < 0) return "";
  const div = src.lastIndexOf('<div', at);
  const cls = src.indexOf('className="', div);
  if (div < 0 || cls < 0 || cls > at) return "";
  const end = src.indexOf('"', cls + 11);
  return src.slice(cls + 11, end);
}

const SITES: { name: string; get: () => string }[] = [
  {
    name: "inventory-content 헤더 「전체 품목」 0건",
    get: () => literalAfter(code("app/dashboard/inventory/inventory-content.tsx"),
      'data-testid="dashboard-inventory-header-kpi-total-items"', ': "'),
  },
  {
    name: "status-count-grid 0건 셀",
    get: () => literalAfter(code("components/layout/status-count-grid.tsx"), ": isZero", '? "'),
  },
  {
    name: "purchase-orders 0건 KPI",
    get: () => literalAfter(code("app/dashboard/purchase-orders/page.tsx"), "const toneCard = isZero", '? "'),
  },
  {
    name: "inventory-flow-view 데이터 없음",
    get: () => literalAfter(code("components/inventory/inventory-flow-view.tsx"),
      'data-testid="inventory-flow-unwired"', 'className="'),
  },
  {
    name: "storage-location-view 데이터 없음",
    get: () => literalAfter(code("components/inventory/storage-location-view.tsx"),
      'data-testid="storage-location-unwired"', 'className="'),
  },
  {
    name: "budget 지출 추이·부서별 소진 데이터 없음",
    get: () => containerBefore(code("app/dashboard/budget/page.tsx"), "지출 추이·부서별 소진 데이터 없음"),
  },
];

describe("§zero-state-dashed-unify · 0건·빈 상태 = 흰 배경 + 점선", () => {
  for (const site of SITES) {
    it(site.name, () => {
      const cls = site.get();
      expect(cls, `${site.name}: 요소를 찾지 못함(앵커 확인)`).not.toBe("");
      expect(cls).toMatch(/\bbg-white\b/);
      expect(cls).toMatch(/\bborder-dashed\b/);
      expect(cls).toMatch(/\bborder-slate-200\b/);
      // 옛 회색 채움이 돌아오면 RED
      expect(cls).not.toMatch(/\bbg-gray-50\b/);
      expect(cls).not.toMatch(/\bborder-gray-200\b/);
    });
  }
});
