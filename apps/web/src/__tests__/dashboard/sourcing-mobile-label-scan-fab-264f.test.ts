/**
 * §11.264f #sourcing-mobile-label-scan-fab — DEPRECATED (superseded by §11.268a)
 *
 * §11.264f 가 추가했던 모바일 우하단 FAB (sourcing-label-scan-fab) 가 호영님
 * P0 spec (§11.268a) 으로 제거되었음. 이유: 비교/견적 액션 바 활성 시 FAB 이
 * 액션 바 우측 "견적 요청서 만들기" button 과 완전 겹침 → 핵심 액션 차단.
 *
 * §11.268a 가 FAB block 제거 + 헤더 inline button 의 `hidden md:flex` →
 * `flex` 로 swap (모바일 + 데스크탑 둘 다 헤더 inline 으로 visible).
 *
 * 이 test 파일은 sandbox 권한 제약으로 삭제 불가 — supersede note 로 보존.
 * §11.268a sentinel test (sourcing-label-scan-fab-removed-268a.test.ts) 가
 * FAB 부재 + 헤더 inline 모바일 visible 을 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/_workbench/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264f DEPRECATED — superseded by §11.268a (FAB 제거)", () => {
  it("§11.268a FAB block 제거 확인 (sourcing-label-scan-fab data-testid 부재)", () => {
    expect(page).not.toMatch(/data-testid="sourcing-label-scan-fab"/);
  });

  it("§11.268a 헤더 inline button 모바일 visible (hidden md:flex → flex)", () => {
    expect(page).toMatch(
      /onClick=\{\(\) => setLabelScanOpen\(true\)\}[\s\S]{0,400}className="flex items-center gap-1\.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-500\/15/,
    );
  });

  it("setLabelScanOpen + LabelScannerModal 트리거 정합 보존", () => {
    expect(page).toMatch(/const\s+\[labelScanOpen,\s+setLabelScanOpen\]\s*=\s*useState/);
    expect(page).toMatch(/<LabelScannerModal/);
  });
});
