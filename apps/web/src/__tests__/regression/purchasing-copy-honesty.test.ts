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
 *   1. `app/intro/page.tsx` 는 **범위 밖**이다. 「발주 준비」 가 8곳 있고(랜딩 서사 전체),
 *      「발주」 자체가 아니라 「준비까지 연결」 이라는 약한 형태다. 서사 재작성은 제품·마케팅
 *      판정이 필요해 호영님께 올렸다. 판정이 나오면 이 파일의 축을 거기까지 넓힌다.
 *   2. `support-center` ai-1 의 「발주서 PDF」 는 **입력물 종류**이지 기능 주장이 아니다
 *      (외부에서 받은 발주서를 분석하는 것은 참일 수 있다). 같은 이유로 남겼다 · 판정 대기.
 *   3. 소스 문자열만 본다. 렌더 결과는 보지 않는다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const HERO = "app/_components/bioinsight-hero-section.tsx";
const SUPPORT = "app/dashboard/support-center/page.tsx";

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

  it("③ 결재 주장은 남는다 (없앤 것이 「없는 척」 이 되면 안 된다)", () => {
    const src = code(SUPPORT);
    // 역할 설명 — 승인·반려는 실재하는 기능이다
    expect(src).toMatch(/결재 요청을 승인·반려합니다/);
    // 승인 체계 설정 카드도 남는다
    expect(src).toMatch(/Approver의 승인을 거치도록/);
  });
});
