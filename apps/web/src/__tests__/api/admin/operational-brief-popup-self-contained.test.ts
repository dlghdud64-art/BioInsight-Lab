/**
 * §11.181 #operational-brief-popup-self-contained
 *
 * Provider + Popup + DashboardShell mount + FloatingEntry default 검증.
 *
 * §brief-redesign(2026-06-28): 구 구조 블록(3-tier drill-down·6-section·priority/owner·
 * flex-shrink·ctaLabel/entityRoute) retire. context/shell/FAB/minimize/useIsMobile/
 * aside·Sheet/eyebrow/shortenCtaLabel-export 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.181 OperationalBriefPopupProvider + hook", () => {
  const PATH = "src/components/operational-brief/popup-context.tsx";

  it("파일 존재 + 'use client'", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    expect(read(PATH)).toMatch(/"use client"/);
  });

  it("Provider + hook + noop fallback export", () => {
    const src = read(PATH);
    expect(src).toMatch(/export\s+function\s+OperationalBriefPopupProvider/);
    expect(src).toMatch(/export\s+function\s+useOperationalBriefPopup/);
    expect(src).toMatch(/NOOP_VALUE/);
  });

  it("context value — isOpen / open / close / selectedItemId / setSelectedItemId", () => {
    const src = read(PATH);
    expect(src).toMatch(/isOpen[^;]*?boolean/);
    // §operational-brief-redesign — open 이 open({ category }) 옵션 시그니처로 확장(인자 허용).
    expect(src).toMatch(/open:\s*\([^)]*\)\s*=>\s*void/);
    expect(src).toMatch(/close:\s*\(\)\s*=>\s*void/);
    expect(src).toMatch(/selectedItemId/);
  });

  it("close() 시 selectedItemId reset (next open 은 list 부터)", () => {
    const src = read(PATH);
    expect(src).toMatch(/close[\s\S]*?setIsOpen\(false\)[\s\S]*?setSelectedItemId\(null\)/);
  });

  it("§11.195 — isMinimized state + toggleMinimize action 노출 (dock chip 진입점)", () => {
    const src = read(PATH);
    // isMinimized boolean + setter
    expect(src).toMatch(/isMinimized[^;]*?boolean/);
    expect(src).toMatch(/toggleMinimize:\s*\(\)\s*=>\s*void/);
    // useState<boolean>(false) 초기값 (minimized 0)
    expect(src).toMatch(/useState[\s\S]*?isMinimized|isMinimized[\s\S]*?useState/);
    // close() 시 isMinimized 도 false 로 reset (다음 open 은 expanded 부터)
    expect(src).toMatch(/close[\s\S]*?setIsMinimized\(false\)/);
  });
});

describe("§11.181 OperationalBriefPopup Sheet 컴포넌트", () => {
  const PATH = "src/components/operational-brief/popup.tsx";

  it("파일 존재 + 'use client'", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    expect(read(PATH)).toMatch(/"use client"/);
  });

  it("§11.202 — desktop 분기는 flex sibling rail (Radix Sheet 0). mobile 분기만 Radix Sheet + modal=true", () => {
    const src = read(PATH);
    // §11.202 — desktop branch 는 plain <aside> 로 mount. Radix Sheet 사용 0.
    //   기존 §11.181/192 의 SheetPrimitive.Root modal={isMobile} 패턴은 desktop
    //   에서 fixed overlay 로 본문을 가렸으므로 폐기. mobile 분기 안에서만 Sheet.
    expect(src).toMatch(/<aside\b[\s\S]*?role="complementary"/);
    // mobile 분기 안에서 modal={true} (dim + body scroll lock)
    expect(src).toMatch(/SheetPrimitive\.Root[\s\S]*?modal=\{true\}/);
    expect(src).toMatch(/SheetPrimitive\.Content/);
  });

  it("§11.183 — useIsMobile hook + matchMedia(max-width: 767px) + cleanup", () => {
    const src = read(PATH);
    expect(src).toMatch(/function\s+useIsMobile/);
    expect(src).toMatch(/matchMedia\(["'`]\(max-width:\s*767px\)["'`]\)/);
    expect(src).toMatch(/removeEventListener\(["']change["']/);
  });

  it("§11.202 — desktop rail 은 fixed/top-N/h-[calc] 0. flex-shrink-0 + 너비 400 (시안 정합 380~420 range)", () => {
    const src = read(PATH);
    // §11.202 — desktop aside 는 부모 flex 가 위치/높이 처리. 자체 fixed/top/h-[calc] 0.
    expect(src).not.toMatch(/md:fixed/);
    expect(src).not.toMatch(/md:top-16/);
    expect(src).not.toMatch(/md:h-\[calc\(100%-4rem\)\]/);
    expect(src).not.toMatch(/md:w-\[480px\]/);
    // desktop rail 너비 400 + flex sibling 강제
    expect(src).toMatch(/md:w-\[400px\]/);
    // mobile bottom sheet 는 그대로 fixed bottom-0 (Portal Sheet 패턴)
    expect(src).toMatch(/inset-x-0[\s\S]*?bottom-0[\s\S]*?h-\[85vh\][\s\S]*?rounded-t-2xl/);
  });

  it("§11.202 — mobile 분기 Overlay mount (dim 유지). desktop 은 dim 0 + onInteractOutside 0", () => {
    const src = read(PATH);
    // mobile 분기 Sheet 안에서 SheetPrimitive.Overlay 사용 (backdrop dim)
    expect(src).toMatch(/<SheetPrimitive\.Overlay/);
    // §11.202 — desktop 은 Radix Sheet 자체를 안 쓰므로 onInteractOutside 분기 코드 0.
    //   (이전 if(!isMobile) e.preventDefault 패턴 폐기 — desktop 은 본문 클릭이 본문 클릭일 뿐)
    expect(src).not.toMatch(/if\s*\(\s*!isMobile\s*\)\s*e\.preventDefault/);
  });

  it("§11.182/198 — 한국어 eyebrow + raw key 제거 (OPERATIONAL BRIEFING 0)", () => {
    const src = read(PATH);
    // 한국어 "운영 브리핑" eyebrow 사용 (popup top + dock chip)
    expect(src).toMatch(/운영 브리핑/);
    // 영문 OPERATIONAL BRIEFING 비노출
    expect(src).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("§11.182/185 — CTA copy = shortenCtaLabel(item.nextAction) + dead button 0", () => {
    const src = read(PATH);
    // §11.185 — shortenCtaLabel 함수 사용
    expect(src).toMatch(/shortenCtaLabel\(item\.nextAction\)/);
  });

  it("§11.185 — shortenCtaLabel: explicit pattern + 14자 cap + truncate ellipsis", () => {
    const src = read(PATH);
    expect(src).toMatch(/CTA_SHORT_LABEL/);
    expect(src).toMatch(/CTA_MAX_LENGTH\s*=\s*14/);
    expect(src).toMatch(/export\s+function\s+shortenCtaLabel/);
    // explicit patterns (호영님 §11.182 예시)
    expect(src).toMatch(/short:\s*"격리 검사 처리"/);
    expect(src).toMatch(/short:\s*"문서 요청 보내기"/);
    expect(src).toMatch(/short:\s*"공급사 확인하기"/);
    // truncate ellipsis (length > 14)
    expect(src).toMatch(/slice\(0,\s*CTA_MAX_LENGTH\)\s*\+\s*"…"/);
  });

  it("§11.195 — minimize button 노출 + isMinimized 흐름 (dock chip 패턴)", () => {
    const src = read(PATH);
    // popup-context 의 isMinimized + toggleMinimize 흡수
    expect(src).toMatch(/isMinimized/);
    expect(src).toMatch(/toggleMinimize/);
    // minimize button (aria-label 한국어) — close X 와 분리된 별도 진입점
    expect(src).toMatch(/aria-label="브리핑 (?:접기|펼치기|최소화|복원)"|aria-label=\{[^}]*?(?:접기|펼치기|최소화|복원)/);
    // dock chip 분기 — isMinimized 일 때 small chip 만 노출 (full sheet 0)
    expect(src).toMatch(/PopupDockChip|isMinimized\s*\?[\s\S]*?dock|dock[\s\S]*?chip/i);
  });
});

describe("§11.181 dashboard shell mount", () => {
  const PATH = "src/app/dashboard/_components/dashboard-shell.tsx";

  it("OperationalBriefPopupProvider import + JSX 감싸기", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*OperationalBriefPopupProvider\s*\}/);
    expect(src).toMatch(/<OperationalBriefPopupProvider>/);
    expect(src).toMatch(/<\/OperationalBriefPopupProvider>/);
  });

  it("OperationalBriefPopup import + mount", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*OperationalBriefPopup\s*\}/);
    expect(src).toMatch(/<OperationalBriefPopup\s*\/>/);
  });
});

describe("§11.181 FloatingEntry default = popup open", () => {
  const PATH = "src/components/operational-brief/floating-entry.tsx";

  it("useOperationalBriefPopup 호출 + handleClick useCallback (§11.181b — minify-safe)", () => {
    const src = read(PATH);
    expect(src).toMatch(/useOperationalBriefPopup\(\)/);
    // §11.181b — handleClick 이 useCallback 으로 wrap, body 안에서 onClick 분기 + popup.open()
    expect(src).toMatch(/handleClick\s*=\s*useCallback/);
    expect(src).toMatch(/popup\.open\(\)/);
  });

  it("open prop 미지정 시 popup.isOpen 으로 derive (aria-expanded 동기)", () => {
    const src = read(PATH);
    expect(src).toMatch(/openProp\s*\?\?\s*popup\.isOpen/);
  });
});

describe("§11.181 7 surface FAB onClick prop 제거", () => {
  const SURFACES: { name: string; path: string }[] = [
    // §11.191 — inbox surface deprecated (hidden redirect → /dashboard).
    // FAB drop 자연스러운 결과 (redirect-only page 17 lines).
    { name: "dashboard", path: "src/app/dashboard/page.tsx" },
    { name: "purchases", path: "src/app/dashboard/purchases/page.tsx" },
    { name: "quotes", path: "src/app/dashboard/quotes/page.tsx" },
    { name: "inventory-content", path: "src/app/dashboard/inventory/inventory-content.tsx" },
    { name: "work-queue-console", path: "src/components/dashboard/work-queue-console.tsx" },
    { name: "purchase-orders-list", path: "src/app/dashboard/purchase-orders/page.tsx" },
  ];

  for (const { name, path } of SURFACES) {
    it(`${name} — FAB block 안에 onClick prop 없음 (default popup 사용)`, () => {
      const src = read(path);
      const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
      expect(m, `${name} FAB mount 없음`).not.toBeNull();
      const block = m![0];
      expect(block).not.toMatch(/\bonClick\s*=/);
    });
  }
});
