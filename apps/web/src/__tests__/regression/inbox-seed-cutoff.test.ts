/**
 * §inbox-seed-cutoff (2026-09-22 · 호영님 판정) · **운영 작업함은 시드가 아니라 실데이터를 읽는다.**
 *
 * ── 왜 ──
 * /dashboard/inbox 가 ops-console 시드 그래프(seed-data.ts)만으로 목록 전량을 만들었다.
 * 스토어에는 fetch 가 0 이라 서버 데이터로 바뀌는 경로 자체가 없었고, 모든 사용자에게 같은 11건이 떴다:
 *   가상 RFQ(RFQ-2026-0041) · 가상 발주(PO-2026-0088 · 0087) · 가상 입고(RCV-2026-0031) ·
 *   내부 키가 그대로 박힌 제목(inv-item-fbs 재주문 필요) · 가상 담당자(INBOX_ITEMS 의 「이현우」).
 * 진입점은 살아 있었다 — 모바일 대시보드 「지금 할 일」 의 전체 보기.
 * 퀵 액션(발주서 발행·확인 완료 처리)은 그 시드 스토어만 바꿨다 — 저장 0.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 작업함은 실 endpoint 를 읽는다 — 운영 브리핑 팝업과 **같은 함수**(fetchRealInboxItems) · 시드 import 0
 *   ② 화면이 연결 범위를 밝힌다 — 견적만 · 발주·입고·재고 위험은 아직 연결 안 됨
 *   ③ 액션은 이동 전용 — 로컬 스토어 변경 0(placeholder success 0)
 *   ④ 로딩·오류·0건을 구분한다
 *   ⑤ 작업함이 직접 렌더하는 제목에 내부 키 0 — inventoryItemId 대신 표시명, 없으면 「품목명 미확인」
 *   ⑥ 가상 인박스 상수(INBOX_ITEMS)와 그 레거시 생성기 0 (역계약)
 *
 * ── 자기 한계 ──
 *   1. 발주 목록·상세, 모바일 입고는 **아직 시드를 읽는다** — 별도 커밋(호영님 순서 3 · 2). 이 파일은 안 본다.
 *   2. ⑤의 「품목명 미확인」 은 **현재 렌더 미도달**이다. 실 endpoint(buildRealQuoteInbox)가 내는 종류는
 *      견적 2종(quote_response_pending · quote_review_required)뿐이라 재고 어댑터에 라이브 생산자가 0 이다.
 *      이 fallback 을 근거로 "품목명 처리는 됐다" 고 읽으면 안 된다. 실제로 뜨는 조건이 생기면 그건
 *      품목명을 못 채우는 **생산자 쪽 결함**이다(별건 큐).
 *   3. 같은 형태(내부 키 노출)가 블로커 문구·명령 라벨·재진입 요약·중복 사유에 남아 있다 — 커밋 4.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const PAGE = "app/dashboard/inbox/page.tsx";
const ADAPTER = "lib/ops-console/inbox-adapter.ts";
const STORE = "lib/ops-console/ops-store.tsx";
const SEED = "lib/ops-console/seed-data.ts";

describe("§inbox-seed-cutoff · 운영 작업함은 실데이터를 읽는다", () => {
  it("① 실 endpoint · 팝업과 같은 함수 · 시드 import 0", () => {
    const src = code(PAGE);
    expect(src).toMatch(/import \{ fetchRealInboxItems \} from "@\/lib\/operational-brief\/fetch-real-inbox"/);
    expect(src).toMatch(/queryFn: fetchRealInboxItems/);
    expect(src).toMatch(/const allItems = useMemo\(\(\) => inboxQuery\.data \?\? \[\], \[inboxQuery\.data\]\)/);
    // 시드 경로 역계약
    expect(src).not.toMatch(/\buseOpsStore\b/);
    expect(src).not.toMatch(/\bbuildFullInbox\b/);
    expect(src).not.toMatch(/ops-console\/(seed-data|ops-store)/);
    // 팝업도 같은 함수를 부른다 — 두 화면이 다른 수를 내지 않는다
    expect(code("components/operational-brief/popup.tsx")).toMatch(/fetchRealInboxItems\(\)/);
  });

  it("② 연결 범위를 화면이 밝힌다 (견적만 · 나머지는 아직 연결 안 됨)", () => {
    const src = code(PAGE);
    expect(src).toMatch(/공급사 응답 대기 · 응답 도착 견적을 우선순위대로 처리합니다/);
    expect(src).toMatch(/발주 · 입고 · 재고 위험은 아직 이 작업함에 연결되지 않았습니다/);
    // 예전 문구(견적·승인·입고·재고 위험 전부를 처리한다는 약속)가 돌아오면 RED
    expect(src).not.toMatch(/견적, 승인, 입고, 재고 위험을 우선순위대로 처리합니다/);
  });

  it("③ 액션은 이동 전용 · 로컬 스토어 변경 0", () => {
    const src = code(PAGE);
    expect(src).toMatch(/router\.push\(quickAction\?\.detailRoute \?\? item\.entityRoute\)/);
    expect(src).not.toMatch(/\bonExecute\(\)/);
    expect(src).not.toMatch(/store\.(issuePO|acknowledgePO|createQuoteFromReorder|completeExpiryAction|refreshInbox)/);
    // 즉시 실행형 라벨을 이동 액션에 붙이지 않는다
    expect(src).toMatch(/function readOnlyQuickAction/);
    expect(src).toMatch(/label: "상세 보기"/);
  });

  it("④ 로딩·오류·0건이 다른 상태다", () => {
    const src = code(PAGE);
    expect(src).toMatch(/inboxQuery\.isLoading \?/);
    expect(src).toMatch(/작업함 불러오는 중/);
    expect(src).toMatch(/inboxQuery\.isError \?/);
    expect(src).toMatch(/운영 작업함을 불러오지 못했습니다/);
    expect(src).toMatch(/inboxQuery\.refetch\(\)/);
    expect(src).toMatch(/현재 바로 처리해야 할 운영 항목이 없습니다/);
  });

  it("⑤ 작업함이 렌더하는 제목에 내부 키 0 (현재 렌더 미도달 경로 · 자기 한계 2 참조)", () => {
    const src = code(ADAPTER);
    expect(src).toMatch(/export function stockItemLabel/);
    expect(src).toMatch(/'품목명 미확인'/);
    for (const v of ["rr", "ea", "sp"]) {
      expect(src, `${v} 제목`).not.toMatch(new RegExp("title: `\\$\\{" + v + "\\.inventoryItemId\\}"));
    }
    expect(code("lib/review-queue/reorder-expiry-stock-risk-contract.ts")).toMatch(/itemDisplayName\?: string;/);
  });

  it("⑥ 가상 인박스 상수·레거시 생성기 0 (역계약)", () => {
    for (const rel of [SEED, STORE]) {
      const src = code(rel);
      expect(src, `${rel}: INBOX_ITEMS`).not.toMatch(/\bINBOX_ITEMS\b/);
      expect(src, `${rel}: inboxItems`).not.toMatch(/\binboxItems\b/);
    }
    expect(code(STORE)).not.toMatch(/generateLegacyInboxItems/);
    expect(code(SEED)).not.toMatch(/이현우|inbox-001/);
  });
});
