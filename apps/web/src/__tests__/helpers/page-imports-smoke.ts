/**
 * §11.193f #page-imports-smoke-helper
 *
 * page.tsx 의 JSX component 사용 ↔ import statement 정합 검증을 surface
 * 별로 일반화하는 helper. §11.193e settings smoke 패턴 추출.
 *
 * 배경 (§11.193a):
 *   settings/page.tsx billing section 이 `<Card>` JSX 사용했지만
 *   `import { Card }` 누락 → prod ReferenceError → "일시적인 오류"
 *   error boundary. tsc 가 same-module identifier 부재만 감지 →
 *   build 시 silent passthrough → prod 에서만 발현.
 *
 * defense layer (Karpathy CLAUDE.md "silent wrong assumption" 차단):
 *   1. tsc — same-module identifier (build 시점)
 *   2. **본 helper** — JSX usage ↔ ui import 정합 (vitest source-level regex)
 *   3. vitest E2E render — actual mount (별도 batch, RSC + use client 환경 복잡)
 *
 * Layer 2 가 ROI 가장 높음 — low cost, fast vitest, regex-based.
 *
 * 사용:
 *   import { describe } from "vitest";
 *   import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";
 *
 *   const SOURCE = readFileSync(PAGE_PATH, "utf8");
 *   assertImportsForJsxComponents({
 *     source: SOURCE,
 *     pageLabel: "settings/page.tsx",
 *     components: ["Card", "CardContent", "Button", ...],
 *   });
 */

import { describe, it, expect } from "vitest";

export interface PageImportsSmokeOptions {
  /** page.tsx 파일 내용 (readFileSync 결과). */
  source: string;
  /** error 메시지에 노출되는 page 식별자 (예: "settings/page.tsx"). */
  pageLabel: string;
  /** 검증 대상 UI library component 이름 목록. */
  components: readonly string[];
  /** describe block 라벨 (default: `${pageLabel} import-completeness smoke`). */
  describeLabel?: string;
  /**
   * import path prefix. default = `@/components/ui/`.
   * 다른 디렉토리 (예: `@/components/dashboard/`) 검증 시 override.
   */
  importPathPrefix?: string;
}

/**
 * page.tsx 안에서 사용되는 JSX component 가 import 되어 있는지 검증.
 *
 * 검증 알고리즘:
 *   for each component in opts.components:
 *     if `<Component[\s>/]` regex 가 source 에 매치:
 *       `import [\s\S]*? \bComponent\b [\s\S]*? from "${importPathPrefix}..."`
 *       regex 가 source 에 매치되어야 함 — fail 시 ReferenceError 위험.
 *
 *   사용되지 않는 component 는 검증 skip (no import needed).
 *
 * 본 함수는 vitest describe 안에서 호출되어야 함 — 내부적으로
 * describe + it block 을 생성한다.
 */
export function assertImportsForJsxComponents(
  opts: PageImportsSmokeOptions,
): void {
  const {
    source,
    pageLabel,
    components,
    describeLabel,
    importPathPrefix = "@/components/ui/",
  } = opts;

  const label = describeLabel ?? `${pageLabel} import-completeness smoke`;
  // regex literal 안에 들어갈 수 있도록 prefix escape (`/` → `\\/`).
  const escapedPrefix = importPathPrefix.replace(/\//g, "\\/");

  describe(label, () => {
    for (const name of components) {
      // JSX usage detect: `<Component ` or `<Component>` or `<Component/>`
      const usagePattern = new RegExp(`<${name}[\\s>/]`);
      const isUsed = usagePattern.test(source);
      if (!isUsed) continue;

      it(`uses <${name}> → must import from "${importPathPrefix}*"`, () => {
        // import { ..., Component, ... } from "${prefix}..."
        // word boundary 사용하여 substring 매칭 회피.
        const importPattern = new RegExp(
          `import[\\s\\S]*?\\b${name}\\b[\\s\\S]*?from\\s+["']${escapedPrefix}`,
        );
        expect(
          source,
          `<${name}> 가 ${pageLabel} 에 사용됐지만 import "${importPathPrefix}*" 에서 ${name} identifier 부재 — §11.193a Card 사례와 동일 ReferenceError 위험`,
        ).toMatch(importPattern);
      });
    }
  });
}

/**
 * 표준 shadcn/ui component 목록 — 대부분의 page.tsx 가 사용 가능한 superset.
 * 각 page 별로 필요한 subset 만 골라 components prop 에 전달.
 *
 * Local helpers (예: settings/page.tsx 의 SectionCard, FieldBlock) 는 same-file
 * definition 이라 본 list 에서 제외 — page 별 audit 후 명시 필요 시 추가.
 */
export const STANDARD_UI_COMPONENTS = [
  "Card",
  "CardContent",
  "CardDescription",
  "CardHeader",
  "CardTitle",
  "Badge",
  "Button",
  "Input",
  "Label",
  "Textarea",
  "Switch",
  "Checkbox",
  "RadioGroup",
  "RadioGroupItem",
  "Skeleton",
  "Separator",
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Dialog",
  "DialogContent",
  "DialogDescription",
  "DialogHeader",
  "DialogTitle",
  "DialogFooter",
  "DialogTrigger",
  "Sheet",
  "SheetContent",
  "SheetDescription",
  "SheetHeader",
  "SheetTitle",
  "SheetTrigger",
  "DropdownMenu",
  "DropdownMenuContent",
  "DropdownMenuItem",
  "DropdownMenuLabel",
  "DropdownMenuSeparator",
  "DropdownMenuTrigger",
  "Select",
  "SelectContent",
  "SelectItem",
  "SelectTrigger",
  "SelectValue",
  "Tooltip",
  "TooltipContent",
  "TooltipProvider",
  "TooltipTrigger",
  "Popover",
  "PopoverContent",
  "PopoverTrigger",
  "Avatar",
  "AvatarFallback",
  "AvatarImage",
  "Progress",
  "Alert",
  "AlertDescription",
  "AlertTitle",
  "ScrollArea",
] as const;
