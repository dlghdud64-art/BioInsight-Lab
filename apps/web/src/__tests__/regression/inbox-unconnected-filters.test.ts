/**
 * §inbox-unconnected-filters (2026-09-24 · 호영님 판정) ·
 * **연결되지 않은 소스는 0을 보여주지 않는다. 표시 자체를 하지 않는다.**
 *
 * ── 왜 ──
 * 운영 작업함의 모듈 알약이 「전체 · 견적 · 발주 · 입고 · 재고위험」 5개였는데,
 * 이 화면에 항목을 넣는 생산자는 `lib/operational-brief/real-quote-inbox.ts` 하나뿐이고
 * 거기서 `sourceModule` 은 **'quote' 로 고정**된다. 나머지 셋은 눌러도 항상 0이다.
 *
 * 🛑 그 0이 문제다 — 「재봤는데 없다」 로 읽히는데 **재본 적이 없다.**
 *    호영님: 「연결되지 않은 소스의 카운트·필터는 0으로 보여주지 않는다. 표시 자체를 하지 않는다.」
 *    발주는 같은 날 UI 를 통째로 지웠으므로(§po-ui-removed) 더 말할 것도 없다.
 *
 * ── 「팀 작업」 은 호영님 근거보다 더 강하다 ──
 * 호영님 근거는 「prod 팀 0개」 였다. 실측은 그보다 강하다 —
 * `ownership-adapter.ts` 의 `buildInboxItemOwnership` 에 `owned_by_team` 을 **내는 분기가 없다.**
 * 팀이 몇 개든 이 필터는 0이다. 데이터가 아니라 **배선이 없는 것**이다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 연결 모듈 목록이 생산자와 일치한다 (오늘: quote 하나)
 *   ② 모듈 알약은 연결 모듈이 2개 이상일 때만 만들어진다 — 1개면 「전체/견적」 이 같은 집합이라 no-op 다
 *   ③ 화면은 그 목록이 비면 알약 블록 자체를 렌더하지 않는다 (구분선까지)
 *   ④ 소유 필터에 「팀 작업」 이 없다 — 옵션·두 곳의 stateMap 모두
 *   ⑤ 지워진 필터 키가 URL 에 남아 있어도 복원하지 않는다 (끌 알약이 없는 막다른 길 방지)
 *   ⑥ 연결 사실을 문구로는 계속 밝힌다 — 필터를 지운 것이 「없는 척」 이 되면 안 된다
 *
 * ── 자기 한계 ──
 *   1. **소유 필터의 나머지 4개는 이 파일이 보지 않는다.** 같은 날 실측으로
 *      `owned_by_me`(모든 생산 지점이 `owner: undefined`) · `escalated` · `awaiting_approval` ·
 *      `awaiting_internal_review` 도 생산 분기가 없어 항상 0이다. 「차단」 KPI·상태 알약도
 *      `blockedReason` 대입이 0이라 같다. 호영님 지시 범위는 「발주·입고·재고위험 + 팀 작업」 이라
 *      나머지는 **판정 대기**로 남겼다(보고 완료). 이 목록은 다음 검사의 시작점이다
 *      (CLAUDE.md §sentinel 이 적어 둔 자기 한계는 다음 검사의 시작점이다).
 *   2. 소스 문자열만 본다. 런타임 렌더는 보지 않는다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const ADAPTER = "lib/ops-console/inbox-adapter.ts";
const OWNERSHIP = "lib/ops-console/ownership-adapter.ts";
const PAGE = "app/dashboard/inbox/page.tsx";
const PRODUCER = "lib/operational-brief/real-quote-inbox.ts";

describe("§inbox-unconnected-filters · 연결 안 된 소스는 표시하지 않는다", () => {
  it("① 연결 모듈 목록이 생산자와 일치한다", () => {
    /* 목록을 개수가 아니라 **집합 리터럴**로 고정한다(CLAUDE.md §개수는 명제가 아니다).
     * 그리고 그 집합이 생산자 소스가 실제로 대입하는 값과 같은지 함께 본다 —
     * 목록만 보면 「선언은 늘었는데 배선이 없는」 경우를 놓친다. */
    const adapter = code(ADAPTER);
    const m = adapter.match(
      /CONNECTED_INBOX_MODULES:\s*readonly InboxSourceModule\[\]\s*=\s*\[([^\]]*)\]/,
    );
    expect(m, "CONNECTED_INBOX_MODULES 선언 없음").not.toBeNull();
    const declared = (m![1].match(/'[a-z_]+'/g) ?? []).map((s) => s.replace(/'/g, "")).sort();
    expect(declared).toEqual(["quote"]);

    // 생산자가 실제로 넣는 sourceModule 값 — 대입 지점 전량
    const produced = [
      ...new Set(
        (code(PRODUCER).match(/sourceModule:\s*"[a-z_]+"/g) ?? []).map((s) =>
          s.replace(/.*"([a-z_]+)"/, "$1"),
        ),
      ),
    ].sort();
    expect(produced, "생산자가 넣는 모듈과 연결 목록이 다르다").toEqual(declared);
  });

  it("② 모듈 알약은 연결 모듈 2개 이상일 때만 만들어진다 (1개면 no-op 컨트롤)", () => {
    const adapter = code(ADAPTER);
    expect(adapter).toMatch(/CONNECTED_INBOX_MODULES\.length > 1/);
    // 하드코딩 알약 목록 부활 차단 — 역계약
    expect(adapter).not.toMatch(/key:\s*'po'\s*,\s*label:\s*'발주'/);
    expect(adapter).not.toMatch(/key:\s*'receiving'\s*,\s*label:\s*'입고'/);
    expect(adapter).not.toMatch(/key:\s*'stock_risk'\s*,\s*label:\s*'재고위험'/);
  });

  it("③ 목록이 비면 화면이 알약 블록을 렌더하지 않는다 (구분선 포함)", () => {
    const page = code(PAGE);
    expect(page).toMatch(/\{MODULE_FILTER_OPTIONS\.length > 0 && \(/);
    /* 창은 그 분기 블록으로 연다 — 고정 폭으로 열면 필드가 하나 늘 때 밖으로 밀린다
     * (CLAUDE.md 4원칙 ⑤). 분기 안에 알약 map 과 구분선이 **둘 다** 있어야 한다. */
    const start = page.indexOf("{MODULE_FILTER_OPTIONS.length > 0 && (");
    // 닫는 경계는 **코드**로 잡는다 — 주석 마커는 stripComments 가 지워서 -1 이 된다
    const end = page.indexOf("STATE_FILTER_OPTIONS.map(", start);
    expect(end).toBeGreaterThan(start);
    const block = page.slice(start, end);
    expect(block).toMatch(/MODULE_FILTER_OPTIONS\.map\(/);
    expect(block).toMatch(/w-px h-5 bg-bd/);
  });

  it("④ 소유 필터에 「팀 작업」 이 없다 (옵션 + stateMap 두 곳)", () => {
    /* 🛑 경로를 OR 로 묶지 않는다 — 옵션에서만 지우고 stateMap 에 남으면
     *    URL 로 키가 들어왔을 때 그 분기가 살아난다. 각각 단언한다. */
    const ownership = code(OWNERSHIP);
    expect(ownership).not.toMatch(/label:\s*'팀 작업'/);
    expect(ownership).not.toMatch(/team_work:/);
    expect(code(PAGE)).not.toMatch(/team_work:/);
    // 회귀 0 — 살아 있는 소유 필터는 보존
    expect(ownership).toMatch(/key:\s*'unassigned'/);
    expect(ownership).toMatch(/key:\s*'waiting_external'/);
  });

  it("⑤ 지워진 필터 키는 URL 에서 복원하지 않는다", () => {
    const page = code(PAGE);
    expect(page).toMatch(/MODULE_FILTER_OPTIONS\.some\(\(o\) => o\.key === p\)/);
    expect(page).toMatch(/OWNER_FILTER_OPTIONS\.some\(\(o\) => o\.key === p\)/);
    // 구 형태(검증 없이 그대로 캐스팅) 부활 차단
    expect(page).not.toMatch(/searchParams\.get\("filter_owner"\) as OwnerFilterKey\) \|\| "all"/);
  });

  it("⑥ 연결 사실은 문구로 계속 밝힌다 (필터를 지운 것이 「없는 척」 이 되면 안 된다)", () => {
    expect(read(PAGE)).toMatch(/발주 · 입고 · 재고 위험은 아직 이 작업함에 연결되지 않았습니다/);
  });
});
