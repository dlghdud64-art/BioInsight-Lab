/**
 * §11.193f #quotes-page-imports-smoke
 *
 * dashboard/quotes/page.tsx 의 JSX component 사용 ↔ import 정합 검증.
 * §11.193a regression guard.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";

const SOURCE = readFileSync(
  resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

/**
 * audit 결과 (Phase 0): Button / Badge / Input.
 * 본 list 는 superset — 사용되지 않는 component 는 helper 가 자동 skip.
 */
const UI_LIBRARY_COMPONENTS = [
  "Button",
  "Badge",
  "Input",
  "Label",
  "Card",
  "CardContent",
  "CardHeader",
  "CardTitle",
  "Skeleton",
  "Dialog",
  "DialogContent",
  "DialogHeader",
  "DialogTitle",
  "DialogFooter",
] as const;

assertImportsForJsxComponents({
  source: SOURCE,
  pageLabel: "quotes/page.tsx",
  components: UI_LIBRARY_COMPONENTS,
  describeLabel: "§11.193f quotes/page.tsx import-completeness smoke",
});
