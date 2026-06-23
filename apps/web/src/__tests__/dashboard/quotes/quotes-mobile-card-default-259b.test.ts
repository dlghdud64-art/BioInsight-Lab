/**
 * §11.259b #quotes-mobile-card-default — 호영님 spec 견적 관리 모바일 #2
 *
 * 호영님 spec:
 *   - 모바일(768px 이하) 진입 시 viewMode 기본 카드 뷰로 전환
 *   - 사용자가 명시적으로 table 선택했다면 그 선택 존중 (localStorage / server)
 *
 * canonical truth lock:
 *   - useState initial "table" 보존 (§11.227 #9 데스크탑 기본 유지)
 *   - localStorage "labaxis-quote-view-mode" hydration 보존 (§11.217 Phase 6)
 *   - server preferences quotesView.mode hydration 보존 (§11.230c (a)-3)
 *   - 모바일 분기 = localStorage saved 가 없을 때만 적용 (canonical truth 보호)
 *
 * 실패 시그널 = 모바일 진입 시 무조건 card 강제 (사용자 명시 table 선택 무시).
 *   → false. saved 있으면 saved 우선 (early return). saved 없을 때만 mobile card.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.259b #1 — 모바일 viewMode 기본 카드 분기", () => {
  it("§11.259b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.259b/);
  });

  it("matchMedia(max-width: 767px) 모바일 감지 호출 존재", () => {
    expect(page).toMatch(/matchMedia\(["'`]\(max-width:\s*767px\)["'`]\)/);
  });

  it("localStorage saved 없을 때만 모바일 card 분기 (saved 우선 보존)", () => {
    // §11.217 hydration useEffect 안에 §11.259b 분기 — saved 가 card/table 이면
    // setViewMode(saved) 후 early return, 그 다음 mobile matchMedia 분기.
    expect(page).toMatch(
      /labaxis-quote-view-mode[\s\S]{0,400}setViewMode\(saved\)[\s\S]{0,400}matchMedia\(["'`]\(max-width:\s*767px\)["'`]\)[\s\S]{0,200}setViewMode\(["'`]card["'`]\)/,
    );
  });
});

describe("§11.259b #2 — invariant 보존 (canonical truth)", () => {
  it("useState initial 'table' 보존 (§11.227 #9 데스크탑 기본)", () => {
    expect(page).toMatch(
      /const \[viewMode, setViewMode\] = useState<"card"\s*\|\s*"table">\("table"\)/,
    );
  });

  it("localStorage key 'labaxis-quote-view-mode' 보존", () => {
    expect(page).toMatch(/labaxis-quote-view-mode/);
  });

  it("localStorage hydration (mount read) 보존", () => {
    expect(page).toMatch(
      /window\.localStorage\.getItem\(["'`]labaxis-quote-view-mode["'`]\)/,
    );
  });

  it("server preferences quotesView.mode hydration 보존 (§11.230c (a)-3)", () => {
    expect(page).toMatch(/userPrefs\.preferences\?\.quotesView/);
    expect(page).toMatch(/view\.mode === "card" \|\| view\.mode === "table"/);
  });

  it("server PATCH on viewMode change 보존 (§11.230c (a)-3)", () => {
    expect(page).toMatch(
      /userPrefs\.updateQuotesView\(\{[\s\S]{0,100}mode:\s*viewMode/,
    );
  });

  it("viewMode toggle 버튼 2개 (카드 / 테이블) 보존", () => {
    expect(page).toMatch(/aria-pressed=\{viewMode === "card"\}/);
    expect(page).toMatch(/aria-pressed=\{viewMode === "table"\}/);
    expect(page).toMatch(/aria-label="카드 보기"/);
    expect(page).toMatch(/aria-label="테이블 보기"/);
  });

  it("viewMode === 'card' / 'table' 분기 렌더 모두 보존", () => {
    // §quotes-mobile-redesign Part2 — 렌더 분기를 viewMode → effectiveViewMode(=isMobile ? "card" : viewMode)로
    //   전환(모바일 카드 단일 고정). 토글 aria-pressed는 viewMode 유지(위 #2 보존). card/table 양 분기 렌더 의도 불변.
    expect(page).toMatch(/effectiveViewMode === "table" && sortedQuotes\.length > 0/);
    expect(page).toMatch(/effectiveViewMode === "card" && urgentQuotes\.length > 0/);
    expect(page).toMatch(/effectiveViewMode === "card" && inProgressQuotes\.length > 0/);
    expect(page).toMatch(/effectiveViewMode === "card" && completedQuotes\.length > 0/);
  });
});
