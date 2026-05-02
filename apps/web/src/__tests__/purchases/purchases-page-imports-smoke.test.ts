/**
 * §11.193f #purchases-page-imports-smoke
 *
 * dashboard/purchases/page.tsx 의 JSX component 사용 ↔ import 정합 검증.
 * §11.193a regression guard.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";

const SOURCE = readFileSync(
  resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
  "utf8",
);

/**
 * audit 결과 (Phase 0): Button / Input.
 * 본 list 는 superset — 사용되지 않는 component 는 helper 가 자동 skip.
 */
const UI_LIBRARY_COMPONENTS = [
  "Button",
  "Input",
  "Badge",
  "Label",
  "Card",
  "CardContent",
  "CardHeader",
  "CardTitle",
  "Skeleton",
] as const;

assertImportsForJsxComponents({
  source: SOURCE,
  pageLabel: "purchases/page.tsx",
  components: UI_LIBRARY_COMPONENTS,
  describeLabel: "§11.193f purchases/page.tsx import-completeness smoke",
});
