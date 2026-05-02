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

describe("§11.193e settings/page.tsx import-completeness smoke", () => {
  for (const name of UI_LIBRARY_COMPONENTS) {
    // JSX usage detect: `<Component ` or `<Component>` or `<Component/>`
    const usagePattern = new RegExp(`<${name}[\\s>/]`);
    const isUsed = usagePattern.test(SOURCE);
    if (!isUsed) continue; // not referenced → no import needed

    it(`uses <${name}> → must import from "@/components/ui/*"`, () => {
      // import { ..., Component, ... } from "@/components/ui/..."
      // (또는 default export 또는 namespace import — 본 검증은 named import 만)
      // word boundary 사용하여 substring 매칭 회피.
      const importPattern = new RegExp(
        `import[\\s\\S]*?\\b${name}\\b[\\s\\S]*?from\\s+["']@\\/components\\/ui\\/`,
      );
      expect(
        SOURCE,
        `<${name}> 가 settings/page.tsx 에 사용됐지만 import "@/components/ui/*" 에서 ${name} identifier 부재 — §11.193a Card 사례와 동일 ReferenceError 위험`,
      ).toMatch(importPattern);
    });
  }
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
