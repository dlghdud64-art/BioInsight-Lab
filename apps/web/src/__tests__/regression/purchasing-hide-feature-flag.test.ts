/**
 * §purchasing-flag-retired (2026-09-25 · 호영님 판정) ·
 * **ENABLE_PURCHASING 은퇴 — 숨기던 장치가 잔재가 됐다.**
 *
 * ── 이 파일의 이력 ──
 * §purchasing-hide (호영님 P1 2026-06-23) 이 「발주/구매 라이브 진입점만 플래그로 차단 ·
 * **숨김이지 삭제가 아니다**」 로 도입했다. 그 전제 위에 두 축이 있었다:
 *   (A) 게이트 강제 — 각 표면이 ENABLE_PURCHASING 으로 분기하는가
 *   (B) 회귀 0      — 발주 소스 문자열·라우트가 **보존**되는가(렌더 게이트만)
 *
 * 그 전제가 표면마다 차례로 철회됐다:
 * ```
 * 2026-09-24  §po-ui-removed            발주 화면 5개 삭제        → (B) 발주 landing 보존 은퇴
 * 2026-09-24  §purchases-ui-removed     구매 운영 화면 삭제       → (A)(B) bottom-nav·more-sheet 은퇴
 * 2026-09-25  §order-entry-removed      「주문 접수」 진입점 0
 * 2026-09-25  §admin-order-create-removed 관리자 주문 생성 0      → PURCHASED 생산자 0
 * 2026-09-25  §funnel-s5-removed        퍼널 s5 삭제
 * 2026-09-25  §purchasing-flag-retired  **플래그 자체 은퇴**      → 이 파일 전량 반대 명제로
 * ```
 *
 * ── 왜 은퇴인가 ──
 * 숨길 대상이 0 이 되자 플래그의 **on 가지**는 「켜면 404 로 가는 코드」 가 됐다.
 * 「보존」 이라 불렀지만 되살릴 수 있는 형태가 아니었다 — 목적지 화면이 없다.
 * 호영님: 4곳 on 가지 삭제 · 「확정 발주액」 은 UI 만 삭제 · 관리자 「주문 전환」 칩 삭제.
 *
 * 🔑 되살리는 절차는 **문서로** 남겼다: `docs/plans/QUEUE_concierge-purchasing.md`
 *    (관리자 주문 생성 버튼 · 고객이 대행 주문을 볼 화면 · 퍼널 s5 — 셋)
 *    플래그로 코드를 남기는 것보다 문서가 정직하다 — 켜도 동작하지 않는 코드는 보존이 아니다.
 *
 * ── 이 파일이 지키는 명제(반대 방향) ──
 *   ① 플래그가 없다 (선언·기본값·preview·env override 전부)
 *   ② 소비자 4곳에 on 가지가 없다
 *   ③ 지운 것이 「없는 척」 이 되지 않았다 — 데이터 축과 되살릴 근거는 남아 있다
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

describe("§purchasing-flag-retired · 플래그가 없다 ①", () => {
  it("feature-flags.ts · 선언·기본값·preview·env override 전부 0", () => {
    /* 부정 단언은 **주석 제거본**에 건다 — 은퇴 사유 주석에 플래그 이름이 적혀 있다(CLAUDE.md). */
    const src = code("src/lib/feature-flags.ts");
    expect(src).not.toMatch(/ENABLE_PURCHASING/);
    expect(src).not.toMatch(/NEXT_PUBLIC_FF_PURCHASING/);
    /* 다른 플래그는 무손상이다 — 이 커밋이 플래그 체계를 지운 게 아니다. */
    expect(src).toMatch(/ENABLE_CONTRACT_INBOX:\s*boolean/);
    expect(src).toMatch(/getFlag/);
  });

  it("소스 전역에 on 가지 판정이 0 이다", () => {
    for (const rel of [
      "src/app/dashboard/page.tsx",
      "src/components/dashboard/pipeline.tsx",
      "src/components/dashboard/stat-line.tsx",
      "src/components/inventory/ReorderReviewSheet.tsx",
      "src/components/quotes/quote-funnel.tsx",
    ]) {
      expect(code(rel), rel).not.toMatch(/ENABLE_PURCHASING/);
      expect(code(rel), rel).not.toMatch(/purchasingOn/);
    }
  });
});

describe("§purchasing-flag-retired · 소비자 4곳 on 가지 삭제 ②", () => {
  it("(1) dashboard/page · 파이프라인 라벨에 발주 단계가 없다", () => {
    const src = code("src/app/dashboard/page.tsx");
    expect(src).not.toMatch(/견적 → 발주 → 입고 → 재고/);
    expect(src).toMatch(/견적 → 입고 → 재고/);
  });

  it("(2) pipeline · po 단계 정의와 필터가 함께 사라졌다", () => {
    const src = code("src/components/dashboard/pipeline.tsx");
    expect(src).not.toMatch(/key: "po"/);
    expect(src).not.toMatch(/label: "발주"/);
    // 아무것도 거르지 않는 필터를 남기지 않는다.
    expect(src).not.toMatch(/s\.key !== "po"/);
    expect(src).toMatch(/const stages = buildStages\(summary\);/);
    // 남는 3단계는 무손상.
    for (const k of ["quote", "receive", "stock"]) {
      expect(src, k).toMatch(new RegExp(`key: "${k}"`));
    }
  });

  it("(3) stat-line · 「확정 발주액」 카드는 UI 만 지웠다 (2 KPI 고정)", () => {
    const src = code("src/components/dashboard/stat-line.tsx");
    expect(src).not.toMatch(/확정 발주액/);
    expect(src).not.toMatch(/it\.key !== "confirmed"/);
    expect(src).toMatch(/const kpiGridClass = "grid grid-cols-1 md:grid-cols-2 gap-2";/);
  });

  it("(4) ReorderReviewSheet · 「바로 발주」 버튼·핸들러·정직 사유가 함께 사라졌다", () => {
    const src = code("src/components/inventory/ReorderReviewSheet.tsx");
    expect(src).not.toMatch(/handleDirectPurchase/);
    expect(src).not.toMatch(/reorder-review-direct-purchase-cta/);
    expect(src).not.toMatch(/발주 기능은 준비 중입니다/);
    expect(src).not.toMatch(/바로 발주는 공급사·단가 확정 후 가능합니다/);
    /* 견적 요청 경로는 무손상이다 — 이게 이 시트의 살아 있는 액션이다. */
    expect(src).toMatch(/reorder-review-request-quote-cta/);
    expect(src).toMatch(/견적 요청 초안 만들기/);
  });
});

describe("§purchasing-flag-retired · 「없는 척」 이 되지 않았다 ③", () => {
  it("데이터 축은 그대로다 (금액의 근거는 Order 이고 summary 가 계속 낸다)", () => {
    /* 호영님: 「확정 발주액」 은 **UI 만** 삭제. 서버가 내는 값을 없앤 게 아니다. */
    expect(read("src/app/api/dashboard/summary/route.ts")).toMatch(/confirmedAmount/);
  });

  it("되살리는 절차가 문서로 남아 있다 (플래그를 지운 대가)", () => {
    /* 플래그를 지우면 「flag flip 으로 되살린다」 가 사라진다.
       그 자리를 문서가 메운다 — 없으면 다음 사람이 무엇을 되살려야 하는지 모른다. */
    const doc = join(REPO_ROOT, "docs/plans/QUEUE_concierge-purchasing.md");
    expect(existsSync(doc)).toBe(true);
    const md = readFileSync(doc, "utf8");
    expect(md).toMatch(/다시 켤 때 필요한 것/);
    expect(md).toMatch(/ENABLE_PURCHASING/);
  });
});
