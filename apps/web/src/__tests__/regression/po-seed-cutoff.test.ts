/**
 * §po-seed-cutoff (2026-09-22 · 호영님 판정 · 커밋 2/4) · **발주 화면은 지어낸 발주를 그리지 않는다.**
 *
 * ── 왜 ──
 * 발주 목록·상세·발송이 전부 ops-console 시드 그래프 위에 서 있었다(서버 데이터로 바뀌는 경로 0).
 *   목록 — 시드 2건에서 파생: 헤더 「발행 가능 1건」 · 파이프라인 · KPI 4 · 행 PO-2026-0088 · 0087.
 *          시드가 항상 2건이라 `isEmpty` 가 **한 번도 참이 된 적이 없었다** → 빈 상태 코드가 죽어 있었다.
 *   상세 — `store.purchaseOrders.find(id)`(po-001~003). 시드 id 면 지어낸 상세를 그리고,
 *          **실제 주문 id 면 「찾을 수 없음」** 이었다. 그런데 입고 목록·입고 상세가 실제 주문 id 로
 *          그 경로를 걸고 있었다 → 그 링크는 100% 막힌 길.
 *   발송 — 상세와 같은 시드 훅(useDispatchWorkbenchData).
 * 부수 결함: 상세에 조건부 훅(`if (!po) return` 뒤 useMemo)이 있었다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 목록은 시드를 읽지 않는다 · 파생 구조는 보존(실데이터 배선 시 그대로 쓴다)
 *   ② 빈 상태가 **살아난다** · 문구는 현재 참인 것까지만(없는 경로를 안내하지 않는다)
 *   ③ 상세·발송은 시드 조회 0 · 「찾을 수 없음」 이라 말하지 않는다(찾아본 적이 없다)
 *   ④ 입고 → 발주 상세 링크 0 (발주번호는 텍스트로 남는다 · 정보 유지 · 거짓 약속 제거)
 *   ⑤ 조건부 훅 0
 *
 * ── 자기 한계 ──
 *   1. 실제 발주 조회는 **구현하지 않았다**(기능 개발 · 발주는 ENABLE_PURCHASING=false 로 꺼진 미완 기능 · 호영님).
 *      이 파일은 "시드를 안 읽는다" 만 본다. 실데이터가 붙으면 ②의 문구 계약을 그때 다시 판정한다.
 *   2. (닫힘 2026-09-24 · §po-seed-cutoff 2차 → 아래 ⑥) 시드 잔존 경로였던 `workbench-full-overlay` 를 끊었다.
 *      🛑 내가 처음 적은 사유 「시드 id 를 넘기던 표면이 비었으므로 실무상 시드 내용은 뜨지 않는다」 는
 *         호영님이 기각했다 — 앞서 기각된 「플래그로 꺼져 있으니 괜찮다」 와 같은 모양이다.
 *         오늘 입력이 없을 뿐 읽기 경로는 살아 있었다.
 *   3. (닫힘 2026-09-24) ops-console 시드 파일 자체를 삭제했다 — 아래 ⑥ 참조.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const LIST = "app/dashboard/purchase-orders/page.tsx";
const DETAIL = "app/dashboard/purchase-orders/[poId]/page.tsx";
const DISPATCH = "app/dashboard/purchase-orders/[poId]/dispatch/page.tsx";
const NOTICE = "app/dashboard/purchase-orders/_components/po-unwired-notice.tsx";
const RECV_LIST = "components/receiving/receiving-case-list.tsx";
const RECV_DETAIL = "app/dashboard/receiving/[receivingId]/page.tsx";

describe("§po-seed-cutoff · 발주 화면은 지어낸 발주를 그리지 않는다", () => {
  it("① 목록은 시드를 읽지 않는다 · 파생 구조는 보존", () => {
    const src = code(LIST);
    expect(src).not.toMatch(/\buseOpsStore\b/);
    expect(src).not.toMatch(/ops-console\/(ops-store|seed-data)/);
    expect(src).toMatch(/const unifiedInboxItems: UnifiedInboxItem\[\] = \[\];/);
    // 실데이터가 붙을 자리 — 파생 3종은 그대로 둔다(구조 보존)
    expect(src).toMatch(/buildModuleHeaderStats\(unifiedInboxItems, "po"\)/);
    expect(src).toMatch(/buildModulePriorityQueue\(unifiedInboxItems, "po", 6\)/);
    expect(src).toMatch(/buildModuleLandingItems\(unifiedInboxItems, "po"\)/);
  });

  it("② 빈 상태가 살아난다 · 문구는 현재 참인 것까지만", () => {
    const src = code(LIST);
    expect(src).toMatch(/\{isEmpty && \(/);
    expect(src).toMatch(/title="발주 목록 데이터 없음"/);
    expect(src).toMatch(/이 화면은 아직 실제 발주에 연결되지 않았습니다/);
    // 없는 경로를 안내하던 옛 문구(역계약)
    expect(src).not.toMatch(/발주로 전환하면 여기서 진행 상태를 추적합니다/);
    expect(src).not.toMatch(/아직 발주된 항목이 없습니다/);
  });

  it("③ 상세·발송은 시드 조회 0 · 「찾을 수 없음」 이라 말하지 않는다", () => {
    for (const rel of [DETAIL, DISPATCH]) {
      const src = code(rel);
      expect(src, `${rel}: 시드 스토어`).not.toMatch(/\buseOpsStore\b|useDispatchWorkbenchData/);
      expect(src, `${rel}: 시드 데이터`).not.toMatch(/ops-console\/seed-data|VENDOR_MAP/);
      expect(src, `${rel}: 시드 id 조회`).not.toMatch(/purchaseOrders\.find/);
      expect(src, `${rel}: not_found 주장`).not.toMatch(/not_found|찾을 수 없습니다/);
      expect(src, `${rel}: 안내`).toMatch(/<PoUnwiredNotice\b/);
    }
    const notice = code(NOTICE);
    expect(notice).toMatch(/이 화면은 아직 실제 발주에 연결되지 않았습니다/);
    expect(notice).toMatch(/href="\/dashboard\/receiving"/);
  });

  it("④ 입고 → 발주 상세 링크 0 · 발주번호는 텍스트로 남는다", () => {
    for (const rel of [RECV_LIST, RECV_DETAIL]) {
      const src = code(rel);
      expect(src, `${rel}: 발주 상세 링크`).not.toMatch(/\/dashboard\/purchase-orders\//);
    }
    expect(code(RECV_LIST)).toMatch(/<span className="font-mono">\{row\.displayNumber\}<\/span>/);
    expect(code(RECV_DETAIL)).toMatch(/<span className="font-mono">\{draft\.order\.orderNumber\}<\/span>/);
  });

  it("⑥ ops 시드 군집이 없다 · 오버레이도 시드를 읽지 않는다 (§po-seed-cutoff 2차)", () => {
    /* 발주 목록·상세·발송을 끊은 뒤 `workbench-full-overlay` 가 시드 그래프의 **마지막 읽기 경로**였다.
     * 그것까지 끊자 시드 군집(데이터·스토어·전이 러너·발송 훅·미렌더 스트립) 전체가 소비자 0 이 됐고 삭제됐다.
     * 명제를 파일 존재 축으로 둔다 — 하나라도 돌아오면 그 자리에서 RED. */
    for (const rel of [
      "lib/ops-console/seed-data.ts",
      "lib/ops-console/ops-store.tsx",
      "lib/ops-console/scenario-transition-runner.ts",
      "hooks/use-dispatch-workbench-data.ts",
      "app/dashboard/_components/today-hub-strip.tsx",
    ]) {
      expect(existsSync(join(SRC, rel)), `${rel}: 시드 군집 부활`).toBe(false);
    }
    const overlay = code("components/dashboard/overlay/workbench-full-overlay.tsx");
    expect(overlay).not.toMatch(/useDispatchWorkbenchData|useOpsStore|QuoteChainWorkbench/);
    expect(overlay).toMatch(/발주 발송 데이터 없음/);
    // 시드 그래프를 마운트하던 provider 도 없다
    for (const rel of ["app/dashboard/_components/dashboard-shell.tsx", "app/contract-preview/layout.tsx"]) {
      expect(code(rel), `${rel}: provider`).not.toMatch(/OpsStoreProvider/);
    }
  });

  it("⑤ 조건부 훅 0 · 상세·발송은 훅이 아예 없고, 목록은 파생 앞에 early return 이 없다", () => {
    // 상세·발송 — 정적 화면이라 훅 호출 0 (옛 상세의 `if (!po) return` 뒤 useMemo 형태가 원천 차단)
    for (const rel of [DETAIL, DISPATCH]) {
      expect(code(rel), `${rel}: 훅`).not.toMatch(/\buse[A-Z]\w*\(/);
    }
    // 목록 — 컴포넌트 본문(선언 ~ 첫 최상위 return)에 조건부 return 0.
    //   창을 파일 전체로 열면 뒤에 선언된 하위 컴포넌트의 훅이 걸린다(창 시작점·경계 ②⑤).
    const list = code(LIST);
    const start = list.indexOf("function PurchaseOrderLandingPageInner() {");
    const end = list.indexOf("\n  return (", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(list.slice(start, end)).not.toMatch(/^\s{2}if \([^)]*\)[\s\S]{0,40}?\breturn\b/m);
  });
});
