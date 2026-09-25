/**
 * §purchasing-copy-honesty (2026-09-24 · 호영님 판정 ③) ·
 * **없는 기능을 제품 설명으로 광고하지 않는다. 있는 기능(결재)은 그대로 말한다.**
 *
 * ── 왜 ──
 * 발주 UI(§po-ui-removed)와 구매 운영(§purchases-ui-removed)을 지운 뒤에도
 * **링크가 아닌 제품 설명**에 「발주」 주장이 남아 있었다:
 *   · `app/_components/bioinsight-hero-section.tsx` 퍼블릭 랜딩 파이프라인 4번째 단계
 *     「발주 · 승인 라인 및 연동」
 *   · `app/dashboard/support-center` role-2「구매 담당(Approver)」 「…발주를 처리합니다」
 *
 * 🛑 호영님: 「퍼블릭 랜딩이 없는 기능을 광고하고 있습니다. **제품 안의 가짜 숫자보다 더 바깥으로
 *    나가는 거짓**입니다.」 링크는 눌러야 드러나지만 설명은 읽는 순간 틀린다.
 *
 * ── 결재는 유지된다 (호영님 ① 판정) ──
 * 삭제한 것은 **발주**이지 결재가 아니다. `request-approval` API · `admin/requests` 승인·반려 ·
 * 승인자 라우팅 · 예산 결재 게이트는 전부 있고 **입구 하나만** 없어진 상태다(CTA 를 견적 상세로 이식 예정).
 * 그래서 「승인 라인」·「승인·반려」 는 **참이고 남긴다.** 조항이 요구하는 것은 침묵이 아니라
 * **거짓의 제거**다(§연결되지 않은 소스는 0 을 보여주지 않는다 와 같은 뿌리).
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 퍼블릭 랜딩 파이프라인이 「발주」 를 단계로 걸지 않는다 · 「결재」 로 말한다
 *   ② 지원센터 역할·카드 설명이 「발주」 를 수행 기능으로 말하지 않는다
 *   ③ 결재 주장은 **남는다** — 없앤 것이 「없는 척」 이 되면 안 된다
 *
 * ── 자기 한계 ──
 *   ~~1. `app/intro/page.tsx` 범위 밖~~ → **닫힘 §intro-flow-honesty (2026-09-25 · 호영님 판정)**.
 *      호영님이 흐름을 판정했다: 검색 → 비교 → 견적 요청 → **회신 추적** → 선정 → 입고 → 재고.
 *      「회신 추적」 이 들어간 이유는 그 숫자(회신 N/M)가 제품이 **지금 실제로 해주는 일**이기 때문이다
 *      (§quote-reply-denominator 로 분모까지 고쳤다). 아래 ④ 가 그 축을 든다.
 *   2. `support-center` ai-1 의 「발주서 PDF」 는 **입력물 종류**이지 기능 주장이 아니다
 *      (외부에서 받은 발주서를 분석하는 것은 참일 수 있다). 같은 이유로 남겼다 · 판정 대기.
 *   3. 소스 문자열만 본다. 렌더 결과는 보지 않는다.
 *   4. **결재 축은 아직 안 본다** — 호영님 2026-09-25 라이브 실측으로 목록에 올린다(닫지는 않았다):
 *      · 견적 관리 상단 KPI 「승인/예외 · 선정·승인 대기」 — 「승인」 은 FREE 에 없는 결재다.
 *        오늘 참인 이름은 「선정 대기」 다.
 *      · 이 파일 안 /intro L538 「승인 기준과 권한」 · L564 「승인 기준」 서사
 *      · ③ 이 지키는 지원센터 결재 주장 — 있는 기능이지만 **FREE 에서는 보이지 않는다**
 *      다음 트랙(결재 약속 표면 전수)이 이 넷을 한 축으로 판정한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const HERO = "app/_components/bioinsight-hero-section.tsx";
const SUPPORT = "app/dashboard/support-center/page.tsx";
const INTRO = "app/intro/page.tsx";

describe("§purchasing-copy-honesty · 없는 기능을 설명으로 광고하지 않는다", () => {
  it("① 퍼블릭 랜딩 파이프라인이 발주를 단계로 걸지 않는다 · 결재로 말한다", () => {
    /* 창은 파이프라인 배열 **블록**으로 연다 — 파일 전체로 열면 다른 문맥의 글자에 걸린다
     * (CLAUDE.md 4원칙 ⑤ · 고정 폭 슬라이스 금지). */
    const src = code(HERO);
    const start = src.indexOf("const PIPELINE_STEPS = [");
    expect(start, "PIPELINE_STEPS 없음").toBeGreaterThan(-1);
    const end = src.indexOf("];", start);
    const block = src.slice(start, end);
    expect(block, "파이프라인에 발주 단계 잔존").not.toMatch(/label: "발주"/);
    expect(block).toMatch(/label: "결재"/);
    // ③ 결재 주장은 남는다 — 「승인 라인」 은 참이다
    expect(block).toMatch(/승인 라인/);
  });

  it("② 지원센터가 발주를 수행 기능으로 말하지 않는다", () => {
    const src = code(SUPPORT);
    /* 🛑 남은 「발주」 는 **두 건뿐**이고 둘 다 기능 주장이 아니다:
     *   · 삭제 사유를 적은 주석은 stripComments 가 지운다
     *   · ai-1 의 「발주서 PDF」 는 입력물 종류(자기 한계 2)
     * 그 두 형태를 제외한 **수행 주장**이 0 인지 본다. 목록이 아니라 0을 단언한다
     * (CLAUDE.md §예외 목록에는 만료일과 소유자가 있어야 한다 — 없으면 0을 단언한다). */
    expect(src).not.toMatch(/발주를 처리합니다/);
    expect(src).not.toMatch(/발주 진행/);
    expect(src).not.toMatch(/확정·발주 시/);
    // 삭제된 카드가 되살아나면 RED
    expect(src).not.toMatch(/title: "발주 및 구매 관리"/);
  });

  it("④ /intro 서사가 「발주 준비」 를 단계로 말하지 않는다 · 회신 추적·선정으로 말한다", () => {
    /* §intro-flow-honesty (2026-09-25 · 호영님 판정) — 자기 한계 1 이 닫힌 자리다.
       구 서사는 「발주 준비」 를 8곳에서 흐름의 종착으로 걸고 있었다. 그 화면이 없다. */
    const src = code(INTRO);
    expect(src).not.toMatch(/발주/);
    // 호영님이 준 흐름이 서사에 실제로 들어 있다.
    expect(src).toMatch(/견적 요청, 회신 추적, 선정까지/);
    expect(src).toMatch(/label: "견적 요청 → 회신 추적"/);
    expect(src).toMatch(/label: "선정 → 입고·재고"/);
    expect(src).toMatch(/title: "회신 추적"/);
    /* 샘플 지표도 제품이 실제로 재는 구간으로. 구 「요청→발주 추적」 은 잴 수 있는 끝이 없었다. */
    expect(src).toMatch(/change: "요청→회신"/);
    /* ⚠️ 「선정」 은 사용자의 **행위**를 가리킨다 — 그 선택을 저장하는 화면은 아직 없다
       (select-reply API 는 있고 부르는 UI 0 · QuoteReply 0행). 문구가 기록 기능을 약속하면 RED 다. */
    expect(src).not.toMatch(/선정 기록/);
    expect(src).not.toMatch(/선정 저장/);
  });

  it("③ 결재 주장은 남는다 (없앤 것이 「없는 척」 이 되면 안 된다)", () => {
    const src = code(SUPPORT);
    // 역할 설명 — 승인·반려는 실재하는 기능이다
    expect(src).toMatch(/결재 요청을 승인·반려합니다/);
    // 승인 체계 설정 카드도 남는다
    expect(src).toMatch(/Approver의 승인을 거치도록/);
  });
});
