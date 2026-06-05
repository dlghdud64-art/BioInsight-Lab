/**
 * §11.367-1 — 모바일 소싱 "상세 보기" dead button 해소 sentinel
 *
 * root cause(차단 대상): "상세 보기" onClick→setActiveResultId 는 wiring 있으나,
 *   상세 surface(우측 rail QuoteCartPanel/SourcingContextRail)가 hidden lg:flex →
 *   모바일(<1024px)에서 화면 반응 0 = dead.
 * 해결: 동일 SourcingContextRail 을 모바일 bottom Sheet 로 노출(open 게이트 !isLgUp,
 *   데스크탑 이중 렌더 방지). 상세 보기 onClick(onSelect) 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SEARCH = "src/app/_workbench/search/page.tsx";
const ROW = "src/app/_workbench/_components/sourcing-result-row.tsx";

describe("§11.367-1 — 모바일 상세 Sheet 노출", () => {
  it("lg 브레이크포인트 게이트(isLgUp) + matchMedia", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/const \[isLgUp, setIsLgUp\] = useState\(false\)/);
    expect(src).toMatch(/matchMedia\("\(min-width: 1024px\)"\)/);
  });
  it("상세 rail 공유 노드(sourcingRail) + detailSlot 재사용", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/const sourcingRail = railProduct \?/);
    expect(src).toMatch(/detailSlot=\{sourcingRail\}/);
  });
  it("모바일 detail Sheet: activeResultId 로 열림 + 데스크탑 이중 렌더 방지", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/data-testid="sourcing-detail-mobile-sheet"/);
    expect(src).toMatch(/open=\{!isLgUp && !!activeResultId\}/);
    expect(src).toMatch(/lg:hidden h-\[85vh\]/);
  });
});

describe("§11.367-1 — 회귀 0", () => {
  it("상세 보기 버튼 onClick(onSelect) 보존(데스크탑·모바일)", () => {
    const src = read(ROW);
    expect(src).toMatch(/data-testid="sourcing-result-row-detail-cta"/);
    expect(src).toMatch(/data-testid="sourcing-result-row-detail-cta-mobile"/);
    expect(src).toMatch(/onClick=\{\(\) => \{ onSelect\(\); \}\}/);
  });
  it("데스크탑 우측 rail(hidden lg:flex) 보존", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/hidden lg:flex w-\[360px\]/);
  });
});
