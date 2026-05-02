/**
 * §11.193f #stock-risk-page-imports-smoke
 *
 * dashboard/stock-risk/page.tsx 의 JSX component 사용 ↔ import 정합 검증.
 * §11.193a regression guard.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";

const SOURCE = readFileSync(
  resolve(__dirname, "../../app/dashboard/stock-risk/page.tsx"),
  "utf8",
);

/**
 * audit 결과 (Phase 0): Badge / Button / Input.
 */
const UI_LIBRARY_COMPONENTS = [
  "Badge",
  "Button",
  "Input",
  "Label",
  "Card",
  "CardContent",
  "CardHeader",
  "CardTitle",
  "Skeleton",
] as const;

assertImportsForJsxComponents({
  source: SOURCE,
  pageLabel: "stock-risk/page.tsx",
  components: UI_LIBRARY_COMPONENTS,
  describeLabel: "§11.193f stock-risk/page.tsx import-completeness smoke",
});
