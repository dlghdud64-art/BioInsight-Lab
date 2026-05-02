/**
 * §11.193f #dashboard-page-imports-smoke
 *
 * dashboard/page.tsx 의 JSX component 사용 ↔ import 정합 검증.
 * §11.193e settings smoke pattern 일반화 (helper 추출).
 *
 * §11.193a regression guard — `<Card>` JSX 사용했지만 `import { Card }`
 * 누락 시 prod ReferenceError 사전 catch (tsc 미발견).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";

const SOURCE = readFileSync(
  resolve(__dirname, "../../app/dashboard/page.tsx"),
  "utf8",
);

/**
 * dashboard/page.tsx 사용 가능 UI library components.
 * audit 결과: Card / CardContent / CardHeader / CardTitle / Button / Badge.
 * 다른 component 추가 시 본 list 에 명시.
 */
const UI_LIBRARY_COMPONENTS = [
  "Card",
  "CardContent",
  "CardHeader",
  "CardTitle",
  "Button",
  "Badge",
  "Input",
  "Label",
  "Switch",
  "Skeleton",
] as const;

assertImportsForJsxComponents({
  source: SOURCE,
  pageLabel: "dashboard/page.tsx",
  components: UI_LIBRARY_COMPONENTS,
  describeLabel: "§11.193f dashboard/page.tsx import-completeness smoke",
});
