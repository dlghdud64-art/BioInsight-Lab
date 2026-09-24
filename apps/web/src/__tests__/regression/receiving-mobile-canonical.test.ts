/**
 * §receiving-mobile-canonical (2026-09-22 · 호영님 판정 · 커밋 3/4) · **입고는 기기에 따라 다른 세계를 보여주지 않는다.**
 *
 * ── 왜 ──
 * 한 화면(/dashboard/receiving)이 둘로 갈려 있었다.
 *   데스크톱 — 정본 `ReceivingDraft`(GET /api/receiving-drafts)
 *   모바일   — ops-console **시드**(receivingBatches)
 * 그래서 실재하지 않는 입고 1건(RCV-2026-0031 · Thermo Fisher Scientific · 3라인 · 「24시간 초과」)이
 * 모든 사용자의 휴대폰에 떴다. 「재고 반영」 버튼은 `postToInventory`(시드 스토어)만 바꿨다 — 저장 0.
 * 그 시드 카드가 blocked 라 가짜 성공 토스트까지 가지 않은 것은 운이지 설계가 아니었다(호영님).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 모바일 목록은 데스크톱과 **같은 정본 행**(caseList.rows)에서 파생한다 — 시드 import 0
 *   ② 세 액션이 모두 정본 경로다 — 반영=일괄 처리 모달(/approve) · 검수=입고안 상세 · 첨부=발주 문서 API
 *   ③ 모바일도 로딩·오류·0건을 구분한다(데스크톱과 같은 상태)
 *   ④ 파생기는 순수함수 — nowIso 주입 · 새 truth 저장 0
 *   ⑤ 표시 번호는 발주번호다(입고안에 RCV 채번이 없다 · 데스크톱과 같은 값)
 *
 * ── 승계 (§po-seed-cutoff 2차 · 2026-09-24) ──
 * 시드 파일이 삭제되며 `lib/ops-console/__tests__/mobile-receiving-view-model.test.ts`(시드 빌더 단위 테스트 12건)가
 * 검사할 구현을 잃었다. 🔑 지우기 전에 그 파일이 단언하던 명제를 여기로 옮긴다:
 *   · blocker 전무 → ready · blockers 순서(문서 → 보류 → 검수) · 검수 줄의 dependsOnUnresolved 선행 의존
 *   · 종결 상태(도착 전·반영 완료·취소) 목록 제외 · 정렬(차단 → 지연 → 오래된 순) · KPI = cards 동일 소스
 * 아래 ④가 정본 축(ReceivingCaseRow)에서 같은 명제를 단언한다. 시드 축이던 항목(보류 blocker ·
 * missingDocs 프리셋)은 입고안 계약에 그 필드가 없어 승계 대상이 아니다(자기 한계 3 참조).
 *
 * ── 자기 한계 ──
 *   1. 발주 목록·상세는 아직 시드를 읽는다 — 커밋 2(호영님 순서). 이 파일은 안 본다.
 *   2. 옛 시드 뷰모델(mobile-receiving-view-model.ts 의 buildMobileReceivingSummary)은 **앱 소비자 0** 이 됐다.
 *      타입은 계속 쓰이고(카드·요약 계약) 함수만 죽었다 — 시드 파일 정리는 커밋 2에서 함께 판정한다.
 *   3. 라인별 미첨부 문서 세트(missingDocs)는 입고안 계약에 없어 빈 배열이다. 첨부 시트는 발주 문서 목록을 읽는다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { buildMobileReceivingSummaryFromCases } from "@/lib/ops-console/mobile-receiving-from-drafts";
import type { ReceivingCaseRow } from "@/lib/ops-console/receiving-desktop-view-model";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const PAGE = "app/dashboard/receiving/page.tsx";
const SHEET = "components/receiving/mobile-doc-attach-sheet.tsx";
const BUILDER = "lib/ops-console/mobile-receiving-from-drafts.ts";

/** 정본 행 최소 픽스처 — 뷰모델이 쓰는 필드만. */
function row(over: Partial<ReceivingCaseRow> = {}): ReceivingCaseRow {
  return {
    id: "d1",
    displayNumber: "PO-1",
    orderId: "o1",
    vendorName: "V",
    submittedAt: "2026-09-20T00:00:00.000Z",
    status: "PENDING_REVIEW",
    statusLabel: "",
    statusTone: "info",
    lineCount: 2,
    lineSummary: "",
    lines: [],
    actions: [],
    remainingActionCount: 0,
    holdChips: [],
    postable: true,
    isDone: false,
    footerCaption: "",
    step: 2,
    documents: [],
    rawItems: [],
    searchText: "",
    ...over,
  } as ReceivingCaseRow;
}

describe("§receiving-mobile-canonical · 입고 모바일은 정본을 읽는다", () => {
  it("① 모바일 목록 = 정본 행 파생 · 시드 import 0", () => {
    const src = code(PAGE);
    expect(src).toMatch(/buildMobileReceivingSummaryFromCases\(caseList\.rows, nowIso\)/);
    expect(src).not.toMatch(/\buseOpsStore\b/);
    expect(src).not.toMatch(/\breceivingBatches\b/);
    expect(src).not.toMatch(/\bpostToInventory\b/);
    expect(code(BUILDER)).not.toMatch(/seed-data|ops-store/);
  });

  it("② 세 액션이 정본 경로 (반영·검수·첨부)", () => {
    const src = code(PAGE);
    // 반영 = 데스크톱과 같은 CTA(일괄 처리 모달 → /approve)
    expect(src).toMatch(/onPost=\{\(card: MobileReceivingCard\) => \{[\s\S]{0,200}handleCta\(row\)/);
    // 검수 = 입고안 상세(정본 id)
    expect(src).toMatch(/onInspect=\{\(card: MobileReceivingCard\) => router\.push\(`\/dashboard\/receiving\/\$\{card\.id\}`\)/);
    // 첨부 = 정본 발주 id 를 그대로 넘긴다(시드 poId 되찾기 0)
    expect(src).toMatch(/target=\{attachRow \? \{ displayNumber: attachRow\.displayNumber, orderId: attachRow\.orderId \} : null\}/);
    const sheet = code(SHEET);
    expect(sheet).not.toMatch(/ReceivingBatchContract|useResolvedOrderId/);
    expect(sheet).toMatch(/const orderId = target\?\.orderId \?\? null;/);
  });

  it("③ 모바일도 로딩·오류·0건을 구분한다", () => {
    const src = code(PAGE);
    const mobile = src.slice(src.indexOf('<div className="md:hidden">'), src.indexOf('<div className="hidden md:block">'));
    expect(mobile).toMatch(/loading \?/);
    expect(mobile).toMatch(/입고 목록 불러오는 중/);
    expect(mobile).toMatch(/loadError \?/);
    expect(mobile).toMatch(/다시 시도/);
  });

  it("④ 파생기는 순수함수 · 같은 입력이면 같은 출력 · 완료 건 제외 · 차단/지연 우선", () => {
    const NOW = "2026-09-22T00:00:00.000Z";
    const rows = [
      row({ id: "ready", postable: true }),
      row({ id: "blocked", postable: false, actions: [{ kind: "doc", label: "COA 확보 · A", shortLabel: "COA 확보", itemId: null }] }),
      row({ id: "done", isDone: true }),
    ];
    const a = buildMobileReceivingSummaryFromCases(rows, NOW);
    const b = buildMobileReceivingSummaryFromCases(rows, NOW);
    expect(a).toEqual(b);
    expect(a.cards.map((c) => c.id)).toEqual(["blocked", "ready"]);
    expect(a.blockedCount).toBe(1);
    expect(a.readyCount).toBe(1);
    expect(a.cards[0].blockers[0]).toMatchObject({ kind: "doc", dependsOnUnresolved: false });
    // 검수 줄은 문서가 남아 있으면 회색(선행 조치 먼저)
    const withBoth = buildMobileReceivingSummaryFromCases(
      [row({ id: "x", postable: false, actions: [
        { kind: "doc", label: "COA 확보 · A", shortLabel: "COA 확보", itemId: null },
        { kind: "inspection", label: "검수 판정 · B", shortLabel: "검수 판정", itemId: "i1" },
      ] })],
      NOW,
    );
    expect(withBoth.cards[0].blockers.map((x) => [x.kind, x.dependsOnUnresolved])).toEqual([
      ["doc", false],
      ["inspection", true],
    ]);
  });

  it("⑤ 표시 번호는 발주번호(데스크톱과 같은 값) · 도착 미상은 SLA 초과로 세지 않는다", () => {
    const s = buildMobileReceivingSummaryFromCases(
      [row({ id: "n", displayNumber: "PO-2026-1", submittedAt: null, postable: false })],
      "2026-09-22T00:00:00.000Z",
    );
    expect(s.cards[0].receivingNumber).toBe("PO-2026-1");
    expect(s.cards[0].isOverdue).toBe(false);
  });
});
