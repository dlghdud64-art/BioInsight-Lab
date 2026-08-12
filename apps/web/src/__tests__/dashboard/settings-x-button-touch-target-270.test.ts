/**
 * §11.270 #settings-x-button-touch-target — settings 5 spot X button 44x44
 *   (§11.266 family cross-cutting concern 확장)
 *
 * §11.266 family 가 dashboard/inventory/sourcing 3 surface 44x44 일관성 적용.
 * settings surface 의 5 spot native X button (Badge 안 chip 제거) 이
 * `p-0.5 + h-3 w-3` ~16-20px → 44x44 미달.
 *
 * 5 spot:
 *   - workspace/page.tsx:730 (domain 제거)
 *   - security/page.tsx:299 (domain 제거)
 *   - compliance-links/page.tsx:621 (hazard code 제거)
 *   - compliance-links/page.tsx:666 (pictogram 제거)
 *   - compliance-links/page.tsx:713 (category 제거)
 *
 * Fix (minimum diff, 5 className swap — 동일 패턴):
 *   기존: ml-1 hover:bg-slate-200 rounded-full p-0.5
 *   신규: ml-1 inline-flex items-center justify-center min-h-[44px] min-w-[44px]
 *         hover:bg-slate-200 rounded-full p-0.5 transition-colors
 *   - min-h-[44px] + min-w-[44px] 추가 (Apple HIG / Material 표준)
 *   - inline-flex items-center justify-center 추가 (X icon 44px 안 가운데 정렬)
 *   - X icon h-3 w-3 그대로 (visual size 보존)
 *   - 기존 p-0.5 + hover state + rounded-full / ml-1 보존
 *
 * canonical truth lock:
 *   - removeDomain / removeHazardCode / updateRule onClick 보존
 *   - X icon (h-3 w-3 또는 h-4 w-4) 보존
 *   - aria-label 보존 (security/workspace 는 명시, compliance-links 는 부재 — 별도 backlog)
 *   - Badge wrapper (variant="secondary") 보존
 *   - ml-1 gap + hover:bg-slate-200 + rounded-full + p-0.5 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WORKSPACE = readFileSync(resolve(__dirname, "../../app/settings/workspace/page.tsx"), "utf8");
const SECURITY = readFileSync(resolve(__dirname, "../../app/settings/security/page.tsx"), "utf8");
/**
 * ⚠️ 2026-08-12 — compliance-links 대상 **은퇴**.
 *
 * `ComplianceLink` 모델이 스키마에 존재하지 않아(§phantom-model-call) 그 화면의
 * CRUD 가 전부 실패했고, 화면을 폐기했다. 잠글 대상이 사라진 것이지
 * **터치 영역 정책(min-h/min-w 44px)이 폐기된 것이 아니다** — workspace·security
 * 2파일 잠금은 그대로 유지한다.
 *
 * 복원 조건: `ComplianceLink` 모델 신설 → 화면 복원 시 이 파일의 compliance 단언과
 * §11.270b(aria-label) 를 **함께 되살린다**(docs/plans/PLAN_schema-proposal-4models.md §1-3).
 */

describe("§11.270 #1 — settings 5 spot X button 44x44 touch target", () => {
  it("§11.270 trace marker comment 존재 (2 file 중 1 이상)", () => {
    const allFiles = WORKSPACE + SECURITY;
    expect(allFiles).toMatch(/§11\.270/);
  });

  it("workspace domain X button 에 min-h-[44px] + min-w-[44px] 적용", () => {
    expect(WORKSPACE).toMatch(
      /removeDomain\(domain\)[\s\S]{0,400}min-h-\[44px\] min-w-\[44px\]/,
    );
  });

  it("security domain X button 에 min-h-[44px] + min-w-[44px] 적용", () => {
    expect(SECURITY).toMatch(
      /removeDomain\(domain\)[\s\S]{0,400}min-h-\[44px\] min-w-\[44px\]/,
    );
  });

});

describe("§11.270 #2 — invariant 보존 (canonical truth)", () => {
  it("workspace removeDomain onClick + X icon + aria-label 보존", () => {
    expect(WORKSPACE).toMatch(/onClick=\{\(\) => removeDomain\(domain\)\}/);
    expect(WORKSPACE).toMatch(/<X className="h-3 w-3"/);
    expect(WORKSPACE).toMatch(/aria-label=\{`\$\{domain\} 제거`\}/);
  });

  it("security removeDomain onClick + X icon + aria-label 보존", () => {
    expect(SECURITY).toMatch(/onClick=\{\(\) => removeDomain\(domain\)\}/);
    expect(SECURITY).toMatch(/<X className="h-3 w-3"/);
    expect(SECURITY).toMatch(/aria-label=\{`\$\{domain\} 제거`\}/);
  });


  it("2 spot 모두 hover:bg-slate-200 + rounded-full 보존 (compliance 3 spot 은퇴)", () => {
    const matchesWorkspace = (WORKSPACE.match(/hover:bg-slate-200 rounded-full/g) || []).length;
    const matchesSecurity = (SECURITY.match(/hover:bg-slate-200 rounded-full/g) || []).length;
    expect(matchesWorkspace).toBeGreaterThanOrEqual(1);
    expect(matchesSecurity).toBeGreaterThanOrEqual(1);
  });

  it("X icon h-3 w-3 (visual size 보존)", () => {
    expect(WORKSPACE).toMatch(/<X className="h-3 w-3"/);
    expect(SECURITY).toMatch(/<X className="h-3 w-3"/);
  });

  it("Badge wrapper (variant=\"secondary\") 보존", () => {
    expect(WORKSPACE).toMatch(/<Badge[\s\S]{0,200}variant="secondary"/);
    expect(SECURITY).toMatch(/<Badge[\s\S]{0,200}variant="secondary"/);
  });
});
