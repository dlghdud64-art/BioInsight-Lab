/**
 * §quote-brief-rail-removed (2026-09-26 · 호영님 판정 · release blocker)
 *
 * 역계약. 견적 관리 화면의 브리핑 레일을 **삭제**했다(숨김 아님).
 *   · 우측 레일(≥1200) — 헤더 + 4탭(상태 요약 / 회신 현황 / 비교 진행 / 다음 단계)
 *   · 모바일 맥락 시트(<1200) — 레일의 하단 시트판
 *   · 모바일 브리핑 시트(MobileOperationalBriefSheet) — 맥락 시트의 ✦ 버튼이 열던 두 번째 시트
 *
 * 명제
 *   ① 이 화면(page.tsx + components/quotes/**)에 그 이름의 문자열이 없다.
 *      범위는 견적 화면뿐이다 — 재고·인박스·대시보드 FAB 의 공용 브리핑은 이 조항 밖이다.
 *   ② 선택된 견적만으로 마운트되는 표면이 없다. 선택된 견적을 조건으로 그리는 블록은
 *      전부 작업창(activeWorkWindow)이 열렸을 때만이다. → ?selected= 로 들어와도 레일·시트 0.
 *   ③ ?selected= 는 선택 하이라이트의 초기값으로만 읽힌다.
 *   ④ 행·카드 클릭 = 선택 하이라이트만. 선택 함수는 선택 상태와 URL 외에 아무것도 열지 않는다.
 *   ⑤ 레일이 하던 진입은 다른 자리로 옮겼다(dead button 0):
 *        회신 확인 → 견적 상세(/quotes/{id}) · 기본 탭이 「수신 견적」
 *        전체 상세 열기 → 행 ⋮ 메뉴 「상세 열기」 → /quotes/{id}
 *        그 밖의 단계 CTA → 그 단계 작업창을 바로 연다(레일 경유 폐지)
 *      모든 CTA 라벨이 목적지를 갖는다 — 목적지 없는 라벨은 누르면 선택만 되는 죽은 버튼이다.
 *   ⑥ 레일 전용 상태·훅은 소비자 0 이므로 지웠다.
 *
 * 은퇴한 선행 센티넬(레일 전용)은 각 파일 헤더에 원 명제를 남겼다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { blockFrom } from "@/__tests__/_helpers/block-window";

const APPS_WEB = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(resolve(APPS_WEB, rel), "utf8");

const PAGE = "src/app/dashboard/quotes/page.tsx";
const MOBILE_VIEW = "src/components/quotes/mobile-quotes-view.tsx";
const pageSrc = read(PAGE);
const pageCode = stripComments(pageSrc);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** 함수 선언 본문 — `function name(` 뒤 첫 여는 중괄호부터 짝까지. */
function fnBody(code: string, name: string): string {
  const i = code.indexOf(`function ${name}(`);
  expect(i, `${name} 선언이 있어야 한다`).toBeGreaterThanOrEqual(0);
  return blockFrom(code, code.indexOf("{", code.indexOf(")", i)));
}

describe("§quote-brief-rail-removed ① 이름 0건 (견적 화면 범위)", () => {
  it("page.tsx + components/quotes/** 에 「운영 브리핑」 이 없다 (주석 포함 · 원문 grep 과 같은 축)", () => {
    const files = [resolve(APPS_WEB, PAGE), ...walk(resolve(APPS_WEB, "src/components/quotes"))];
    expect(files.length).toBeGreaterThan(10);
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("운영 브리핑"));
    expect(hits).toEqual([]);
  });
});

describe("§quote-brief-rail-removed ② 선택된 견적만으로 마운트되는 표면 0", () => {
  it("레일·시트 부품의 import·마커가 없다", () => {
    expect(pageCode).not.toMatch(/MobileOperationalBriefSheet/);
    expect(pageCode).not.toMatch(/operational-brief\/mobile-bottom-sheet/);
    expect(pageCode).not.toMatch(/operational-brief\/metric-cell/);
    // 레일 컨테이너 토큰(비교 모달 표의 min-w-[480px] 와 가른다)
    expect(pageCode).not.toMatch(/(?<!min-)w-\[480px\] shrink-0/);
    expect(pageCode).not.toMatch(/min-\[1200px\]:fixed/);
    expect(pageCode).not.toMatch(/role="tablist"/);
  });

  it("selectedQuote 를 조건으로 그리는 JSX 블록은 전부 작업창 게이트 안이다", () => {
    const conds = [...pageCode.matchAll(/\{([^{}]*?\bselectedQuote\b[^{}]*?)&&\s*\(/g)].map((m) => m[1]);
    // 작업창 2곳(발송 워크벤치 · CenterWorkWindow)이 있어야 한다 — 0이면 정규식이 빗나간 것이다.
    expect(conds.length).toBeGreaterThanOrEqual(2);
    for (const c of conds) expect(c, `작업창 게이트 없는 선택 표면: ${c}`).toMatch(/\bactiveWorkWindow\b/);
  });
});

describe("§quote-brief-rail-removed ③ ?selected= 는 하이라이트 초기값만", () => {
  it("searchParams 의 selected 를 읽는 곳은 선택 상태 초기값 1곳뿐이다", () => {
    const reads = pageCode.match(/searchParams\.get\("selected"\)/g) ?? [];
    expect(reads).toHaveLength(1);
    expect(pageCode).toMatch(/useState<string \| null>\(searchParams\.get\("selected"\) \?\? null\)/);
  });
});

describe("§quote-brief-rail-removed ④ 행·카드 클릭 = 선택만", () => {
  it("선택 함수는 선택 상태와 URL 만 만진다", () => {
    const body = fnBody(pageCode, "selectQuoteRow");
    expect(body).toMatch(/setSelectedQuoteId\(/);
    expect(body).not.toMatch(/setActiveWorkWindow|router\.|set[A-Z]\w*Open\(|setSendIntentQuoteId|setPrepareQuoteId/);
  });

  it("테이블 행 onClick · Enter 는 선택 함수만 부른다", () => {
    const trStart = pageCode.indexOf('aria-label={`견적 ${tableDisplayTitle}');
    expect(trStart).toBeGreaterThan(0);
    const onClick = blockFrom(pageCode, pageCode.indexOf("{", pageCode.indexOf("onClick={(e) =>", trStart) + 14));
    expect(onClick).toMatch(/selectQuoteRow\(quote\.id\)/);
    expect(onClick).not.toMatch(/setActiveWorkWindow|router\.|handleQuoteCardSelect|Open\(true\)/);
    const onKey = blockFrom(pageCode, pageCode.indexOf("{", pageCode.indexOf("onKeyDown={(e) =>", trStart) + 16));
    const enter = blockFrom(onKey, onKey.indexOf("{", onKey.indexOf('e.key === "Enter"')));
    expect(enter).toMatch(/selectQuoteRow\(quote\.id\)/);
    expect(enter).not.toMatch(/setActiveWorkWindow|router\.|Open\(true\)/);
  });

  it("카드 클릭(라벨 없음)도 선택만 · handleQuoteCardSelect 첫 분기", () => {
    const i = pageCode.indexOf("const handleQuoteCardSelect = useCallback(");
    expect(i).toBeGreaterThan(0);
    const body = blockFrom(pageCode, pageCode.indexOf("{", pageCode.indexOf("=>", i)));
    const first = blockFrom(body, body.indexOf("{", body.indexOf("if (ctaLabel === undefined)")));
    expect(first).toMatch(/selectQuoteRow\(quoteId\);\s*return;/);
  });
});

describe("§quote-brief-rail-removed ⑤ 대체 진입점 (dead button 0)", () => {
  const handler = (() => {
    const i = pageCode.indexOf("const handleQuoteCardSelect = useCallback(");
    return blockFrom(pageCode, pageCode.indexOf("{", pageCode.indexOf("=>", i)));
  })();

  it("회신 확인 → 견적 상세(/quotes/{id}) · 라벨 상수와 표 라벨이 같다", () => {
    expect(pageCode).toMatch(/const REPLY_CHECK_CTA = "새 회신 보기";/);
    const branch = blockFrom(handler, handler.indexOf("{", handler.indexOf("ctaLabel === REPLY_CHECK_CTA")));
    expect(branch).toMatch(/router\.push\(`\/quotes\/\$\{quoteId\}`\)/);
  });

  it("단계 CTA 의 작업창 목적지 · 집합을 리터럴로 고정한다", () => {
    const m = pageCode.match(/const CTA_WORK_WINDOW[^=]*=\s*(\{[\s\S]*?\});/);
    expect(m).not.toBeNull();
    const pairs = [...m![1].matchAll(/"([^"]+)":\s*"([a-z_]+)"/g)].map((x) => `${x[1]} -> ${x[2]}`).sort();
    expect(pairs).toEqual([
      "비교 결과 정리 -> compare_review",
      "승인 증빙 연결 -> approval_prep",
      "재요청 보내기 -> followup_send",
      "조건 확인 -> compare_review",
      "추가 회신 확보 -> followup_send",
    ]);
    const branch = blockFrom(handler, handler.indexOf("{", handler.indexOf("if (workWindow)")));
    expect(branch).toMatch(/setSelectedQuoteId\(quoteId\)/);
    expect(branch).toMatch(/setActiveWorkWindow\(workWindow\)/);
  });

  it("모든 CTA 라벨이 목적지를 갖는다 (표 + getOpSignals 덮어쓰기)", () => {
    const labels = new Set<string>();
    for (const x of pageCode.matchAll(/\bctaLabel: "([^"]+)"/g)) labels.add(x[1]);
    // PO_DETAIL_CTA 는 상수로 들어간다
    expect(pageCode).toMatch(/ctaLabel: PO_DETAIL_CTA/);
    expect(labels.size).toBeGreaterThanOrEqual(7);
    const direct = ["입고 관리 열기", "견적 요청 발송"].filter((l) => handler.includes(`ctaLabel === "${l}"`));
    expect(direct).toEqual(["입고 관리 열기", "견적 요청 발송"]);
    const windowKeys = [...pageCode.match(/const CTA_WORK_WINDOW[^=]*=\s*(\{[\s\S]*?\});/)![1].matchAll(/"([^"]+)":/g)].map((x) => x[1]);
    const handled = new Set([...direct, "새 회신 보기", ...windowKeys]);
    const orphan = [...labels].filter((l) => !handled.has(l));
    expect(orphan).toEqual([]);
  });

  it("행 ⋮ 메뉴 「상세 열기」 → /quotes/{id} · 테이블 행과 카드 두 곳", () => {
    const menu = fnBody(pageCode, "QuoteRowMenu");
    expect(menu).toMatch(/href=\{`\/quotes\/\$\{quoteId\}`\}/);
    expect(menu).toMatch(/상세 열기/);
    expect(menu).toMatch(/createPortal\(/);
    expect(pageCode.match(/<QuoteRowMenu quoteId=\{quote\.id\}/g) ?? []).toHaveLength(2);
  });

  it("발송 결과 토스트 액션이 레일 대신 실제 목적지로 간다", () => {
    expect(pageCode).toMatch(/label: "발송 검토 다시"[^\n]*setActiveWorkWindow\("request_send"\)/);
    expect(pageCode).toMatch(/label: "회신 추적 보기"[^\n]*router\.push\(`\/quotes\/\$\{quoteId\}`\)/);
  });

  it("모바일: 카드 탭 = 상세, 「나중에」 = 배너 접기(상세 이동 아님)", () => {
    expect(pageCode).toMatch(/onSelect=\{\(id\) => router\.push\(`\/quotes\/\$\{id\}`\)\}/);
    const mv = stripComments(read(MOBILE_VIEW));
    expect(mv).toMatch(/onClick=\{\(\) => setLaterId\(top\.id\)\}[^>]*>나중에</);
    expect(mv).toMatch(/\{top && top\.id !== laterId && \(/);
  });
});

describe("§quote-brief-rail-removed ⑥ 레일 전용 상태·훅 소비자 0 → 삭제", () => {
  it.each([
    "activeChipId", "briefSheetOpen", "briefDetailExpanded", "factsExpanded",
    "autoScrollToVendorSection", "vendorResponseSectionRef",
    "useOperationalBriefNarrative", "briefNarrative",
    "openQuoteContextRail", "closeQuoteContextRail",
    "selectedDispatchEvidence", "getQuoteDispatchEvidence",
    "buildBriefRationale", "rationaleToneDotClass", "ElapsedDaysText",
  ])("%s 가 없다", (sym) => {
    expect(pageCode).not.toMatch(new RegExp(`\\b${sym}\\b`));
  });

  it("숨김으로 남기지 않았다 · 죽은 구역 0", () => {
    expect(pageCode).not.toMatch(/\{\s*false\s*&&/);
  });
});
