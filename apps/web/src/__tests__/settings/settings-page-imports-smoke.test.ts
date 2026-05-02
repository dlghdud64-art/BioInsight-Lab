/**
 * §11.193e #settings-page-imports-smoke
 *
 * settings/page.tsx 의 JSX component 사용 ↔ import statement 정합 검증.
 *
 * §11.193a 사례 (Card import 누락 → prod ReferenceError → "일시적인 오류"
 * error boundary) 의 lesson 적용. tsc 가 잡지 못하는 client-side
 * ReferenceError 를 source-level grep 으로 사전 catch.
 *
 * 검증 방식:
 *   for each known UI library component:
 *     if `<Component>` 사용된다면
 *       `import { ..., Component, ... } from "@/components/ui/..."` 도 존재해야 함
 *
 * Karpathy CLAUDE.md "silent wrong assumption" 차단 layer:
 *   - tsc: same-module identifier 부재 detect (build 성공해도 import 누락 시 silent)
 *   - this smoke: JSX usage ↔ ui import 정합 강제 (vitest source-level regex)
 *   - vitest E2E: render-without-throw (별도 batch — RSC + use client 환경 복잡)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// §11.193f — settings smoke 의 regex 패턴을 helper 로 추출하여 재사용.
import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";

const SETTINGS_PATH = resolve(
  __dirname,
  "../../app/dashboard/settings/page.tsx",
);
const SOURCE = readFileSync(SETTINGS_PATH, "utf8");

/**
 * settings/page.tsx 에서 사용 가능한 known UI library components.
 *
 * Local helpers (SectionCard, FieldBlock, SliderField, ApprovalTierRow,
 * SettingsPageFallback, SettingsPageContent) 는 same-file definition
 * 이라 import 검증 대상 아님 — 본 list 에서 제외.
 */
const UI_LIBRARY_COMPONENTS = [
  "Card",
  "CardContent",
  "CardDescription",
  "CardHeader",
  "CardTitle",
  "Badge",
  "Button",
  "Input",
  "Label",
  "Switch",
  "Skeleton",
  "Dialog",
  "DialogContent",
  "DialogDescription",
  "DialogHeader",
  "DialogTitle",
  "DialogFooter",
] as const;

// §11.193f — helper 사용 (이전 inline regex 와 동일 동작).
assertImportsForJsxComponents({
  source: SOURCE,
  pageLabel: "settings/page.tsx",
  components: UI_LIBRARY_COMPONENTS,
  describeLabel: "§11.193e settings/page.tsx import-completeness smoke",
});

describe("§11.193d Phase 2.3 — workflow capabilities multi-badge (시안 정합)", () => {
  /**
   * Phase 1 의 inline `orgRoleLabel` mapping 은 Phase 2.3 에서
   * workflow-capabilities.ts 의 WORKFLOW_CAPABILITY_LABEL/BADGE_CLS 로 이관.
   * settings/page.tsx 는 resolveWorkflowCapabilities 호출 + multi-badge 렌더만.
   * 라벨/색상 정합 검증은 lib level test (workflow-capabilities.test.ts) 가 담당.
   */
  it("resolveWorkflowCapabilities import + 호출 (DB 우선 + role fallback)", () => {
    expect(SOURCE).toMatch(
      /import\s*\{[\s\S]*?resolveWorkflowCapabilities[\s\S]*?\}\s*from\s+["']@\/lib\/permissions\/workflow-capabilities["']/,
    );
    expect(SOURCE).toMatch(/resolveWorkflowCapabilities\(/);
  });

  it("WORKFLOW_CAPABILITY_LABEL + WORKFLOW_CAPABILITY_BADGE_CLS import (multi-badge 렌더)", () => {
    expect(SOURCE).toMatch(/WORKFLOW_CAPABILITY_LABEL/);
    expect(SOURCE).toMatch(/WORKFLOW_CAPABILITY_BADGE_CLS/);
  });

  it("capabilities 배열 iteration (org 1개에 capability N개 → badge N개)", () => {
    // capabilities.forEach 또는 capabilities.map 으로 multi-badge 분기
    expect(SOURCE).toMatch(/capabilities\.(?:forEach|map)/);
  });

  it("empty state — capabilities 0 일 때 '운영 권한 없음' 표시 (raw key 노출 0)", () => {
    expect(SOURCE).toMatch(/운영 권한 없음/);
  });

  it("organizations API response shape — workflowCapabilities forward", () => {
    // useQuery type 안에 workflowCapabilities 필드 (unknown) 명시
    expect(SOURCE).toMatch(/workflowCapabilities\?\s*:\s*unknown/);
  });
});

describe("§11.193e settings/page.tsx structural integrity", () => {
  it("export const dynamic = 'force-dynamic' 보존 (auth 의존 RSC)", () => {
    expect(SOURCE).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });

  it("default export = SettingsPage Suspense wrapper", () => {
    // export default function ... wraps SettingsPageContent in Suspense
    expect(SOURCE).toMatch(/export\s+default\s+function/);
    expect(SOURCE).toMatch(/<Suspense/);
  });

  it("activeSection state initial = 'operator' (호영님 default landing)", () => {
    expect(SOURCE).toMatch(
      /useState<SettingsSection>\(\s*["']operator["']\s*\)/,
    );
  });

  it("6 section render 분기 모두 정의 (operator/notifications/billing/integrations/ontology/security)", () => {
    expect(SOURCE).toMatch(/activeSection === ["']operator["']/);
    expect(SOURCE).toMatch(/activeSection === ["']notifications["']/);
    expect(SOURCE).toMatch(/activeSection === ["']billing["']/);
    expect(SOURCE).toMatch(/activeSection === ["']integrations["']/);
    expect(SOURCE).toMatch(/activeSection === ["']ontology["']/);
    expect(SOURCE).toMatch(/activeSection === ["']security["']/);
  });
});
