/**
 * pack-unit-options.ts
 * ────────────────────
 * #label-scan-ux — 규격(통 1개 함량) 단위 controlled vocabulary.
 * free-text "CAPSULES" 기본값 제거 → 드롭다운 통제 어휘.
 * 라벨 추출 단위 자동 매핑(예: "500g" / "G" → "g")은 normalizePackUnit 로.
 */

export interface PackUnitOption {
  value: string;
  label: string;
  group: "mass" | "volume" | "count";
}

export const PACK_UNIT_OPTIONS: PackUnitOption[] = [
  // 질량
  { value: "µg", label: "µg (마이크로그램)", group: "mass" },
  { value: "mg", label: "mg (밀리그램)", group: "mass" },
  { value: "g", label: "g (그램)", group: "mass" },
  { value: "kg", label: "kg (킬로그램)", group: "mass" },
  // 부피
  { value: "µL", label: "µL (마이크로리터)", group: "volume" },
  { value: "mL", label: "mL (밀리리터)", group: "volume" },
  { value: "L", label: "L (리터)", group: "volume" },
  // 개수/포장
  { value: "EA", label: "EA (개)", group: "count" },
  { value: "vial", label: "vial (바이알)", group: "count" },
  { value: "bottle", label: "bottle (병)", group: "count" },
  { value: "capsule", label: "capsule (캡슐)", group: "count" },
  { value: "tablet", label: "tablet (정)", group: "count" },
  { value: "test", label: "test (테스트)", group: "count" },
  { value: "unit", label: "unit (유닛)", group: "count" },
];

export const PACK_UNIT_GROUP_LABELS: Record<PackUnitOption["group"], string> = {
  mass: "질량",
  volume: "부피",
  count: "개수 / 포장",
};

const VALUE_SET = new Set(PACK_UNIT_OPTIONS.map((o) => o.value));

const SYNONYMS: Record<string, string> = {
  gram: "g", grams: "g", g: "g",
  milligram: "mg", milligrams: "mg", mg: "mg",
  kilogram: "kg", kilograms: "kg", kg: "kg",
  microgram: "µg", micrograms: "µg", ug: "µg", "µg": "µg", mcg: "µg",
  liter: "L", litre: "L", liters: "L", l: "L",
  milliliter: "mL", milliliters: "mL", ml: "mL",
  microliter: "µL", microliters: "µL", ul: "µL", "µl": "µL",
  ea: "EA", each: "EA", 개: "EA",
  vial: "vial", vials: "vial",
  bottle: "bottle", bottles: "bottle", 병: "bottle",
  capsule: "capsule", capsules: "capsule", caps: "capsule",
  tablet: "tablet", tablets: "tablet", tab: "tablet", tabs: "tablet",
  test: "test", tests: "test",
  unit: "unit", units: "unit",
};

/**
 * 라벨/추출 원시 단위 문자열을 통제 어휘 value 로 정규화.
 * 예: "500g" → "g", "G" → "g", "CAPSULES" → "capsule", "100 mL" → "mL".
 * 매칭 실패 시 "" (사용자가 드롭다운에서 직접 선택).
 */
export function normalizePackUnit(raw: string | null | undefined): string {
  if (!raw) return "";
  // 선행 숫자·공백·소수점 제거("500g" → "g", "100 mL" → "mL")
  const stripped = String(raw).trim().replace(/^[\d.\s]+/, "").trim();
  if (!stripped) return "";
  // 정확 value 일치(대소문자 보존 어휘 우선)
  if (VALUE_SET.has(stripped)) return stripped;
  const lower = stripped.toLowerCase();
  if (SYNONYMS[lower]) return SYNONYMS[lower];
  // 대소문자 무시 value 일치
  const ci = PACK_UNIT_OPTIONS.find((o) => o.value.toLowerCase() === lower);
  return ci ? ci.value : "";
}
