/**
 * §quotes-brief-suppress (호영님 2026-07-02) — 견적 관리 surface 운영 브리핑 억제.
 *
 * 결정: 견적 관리에는 "공급사 발송 검토" 모달이 정식 워크플로. 그 위에 뜨는 운영 브리핑(FAB→popup dock)을
 *       견적 surface 에선 사용하지 않는다(호영님 2026-07-02, 실기기 견적 상세 확인).
 * 구현: quotes/page.tsx 에서 (1) OperationalBriefFloatingEntry 마운트/ import 제거(진입 차단),
 *       (2) briefIsOpen 이면 viewMode 무관 항상 close(타 surface 에서 open 채 진입한 경우 포함).
 * 회귀 0: popup-context(close) wiring 보존, "공급사 발송 검토" 모달·mobile bottom sheet 무접촉.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const QUOTES = readFileSync(
  join(REPO_ROOT, "src/app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quotes-brief-suppress — 견적 브리핑 진입 차단", () => {
  it("OperationalBriefFloatingEntry 마운트/ import 없음(FAB 제거)", () => {
    expect(QUOTES).not.toMatch(/OperationalBriefFloatingEntry/);
    expect(QUOTES).not.toMatch(/operational-brief\/floating-entry/);
  });

  it("briefIsOpen 이면 항상 close(viewMode 조건 제거)", () => {
    // 확장된 억제 effect: viewMode 게이트 없이 briefIsOpen 만으로 close.
    expect(QUOTES).toMatch(/if \(briefIsOpen\) \{\s*closeOperationalBrief\(\);/);
    expect(QUOTES).not.toMatch(/viewMode === "table" && briefIsOpen/);
  });
});

describe("§quotes-brief-suppress — 회귀 0", () => {
  it("popup-context close wiring 보존", () => {
    expect(QUOTES).toMatch(/useOperationalBriefPopup\(\)/);
    expect(QUOTES).toMatch(/close: closeOperationalBrief/);
  });
  it('"공급사 발송 검토" 모달·mobile bottom sheet 보존', () => {
    expect(QUOTES).toMatch(/MobileOperationalBriefSheet/);
  });
});
