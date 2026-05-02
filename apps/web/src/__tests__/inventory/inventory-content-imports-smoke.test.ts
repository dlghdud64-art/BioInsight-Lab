/**
 * §11.193f #inventory-content-imports-smoke
 *
 * dashboard/inventory/inventory-content.tsx 의 JSX component 사용 ↔
 * import 정합 검증. §11.193a regression guard.
 *
 * inventory-content 는 dashboard/inventory/page.tsx 의 main client
 * component (page.tsx 자체는 thin RSC wrapper).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertImportsForJsxComponents } from "../helpers/page-imports-smoke";

const SOURCE = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

/**
 * audit 결과 (Phase 0): Card/CardContent/CardDescription/CardHeader/CardTitle/
 * Button/Input/Label/Textarea/Dialog (+ sub) /Select (+ sub) /Badge/Switch/
 * DropdownMenu (+ sub).
 *
 * inventory-content 는 가장 많은 UI library 사용 — Card 누락 시 §11.193a 와
 * 동일 ReferenceError. 본 smoke 가 사전 catch.
 */
const UI_LIBRARY_COMPONENTS = [
  "Card",
  "CardContent",
  "CardDescription",
  "CardHeader",
  "CardTitle",
  "Button",
  "Input",
  "Label",
  "Textarea",
  "Badge",
  "Switch",
  "Skeleton",
  "Dialog",
  "DialogContent",
  "DialogDescription",
  "DialogHeader",
  "DialogTitle",
  "DialogTrigger",
  "Select",
  "SelectContent",
  "SelectItem",
  "SelectTrigger",
  "SelectValue",
  "DropdownMenu",
  "DropdownMenuContent",
  "DropdownMenuItem",
  "DropdownMenuSeparator",
  "DropdownMenuTrigger",
] as const;

assertImportsForJsxComponents({
  source: SOURCE,
  pageLabel: "inventory/inventory-content.tsx",
  components: UI_LIBRARY_COMPONENTS,
  describeLabel:
    "§11.193f inventory/inventory-content.tsx import-completeness smoke",
});
