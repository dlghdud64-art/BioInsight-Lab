/**
 * §cas-hazard-classification P2 (호영님 2026-07-04) — 정적 CAS→GHS 위험분류.
 *
 * 목적: Product.casNo → GHS 위험코드(H-code) → 위험등급 파생. 안전페이지 "전량 일반"
 *       착시(분류 미작동)의 근본 해소. 외부 API 무의존(결정적·감사가능·오프라인).
 *
 * ⚠️ 규제 주의: 아래 표는 표준 GHS 분류에 기반한 **큐레이션 시작셋**이다. 법적 최종
 *   근거는 각 물질의 공식 SDS 이며, 안전관리자(호영님) 검토·확장을 전제한다. 미수록
 *   CAS 는 "미분류(unknown)" 로 정직 표기하며 절대 "일반(low)" 으로 오도하지 않는다.
 *
 * 순수 모듈 — DOM/React/네트워크 무의존(단위테스트 용이). canonical = hazardCodes.
 */

export type HazardClassLevel = "critical" | "high" | "medium" | "low" | "unknown";

/** GHS 픽토그램 키(utils PICTOGRAM_DESCRIPTIONS 정합). */
export type GhsPictogram =
  | "explosive" | "flame" | "oxidizer" | "gas_cylinder"
  | "corrosive" | "skull" | "exclamation" | "health_hazard" | "environment";

export interface CasGhsEntry {
  /** 물질명(참조용). */
  name: string;
  /** GHS 위험코드(H-code). 빈 배열 = 분류됨·비위험(예: NaCl). */
  hazardCodes: string[];
}

/**
 * 정적 CAS→GHS 표. key = normalizeCas() 정규화된 CAS.
 * 실험실 빈번 시약(산·염기·용매·산화제·독성·발암·생물시약) 중심. LabAxis 실보유 시약 확장 반영.
 */
export const CAS_GHS_TABLE: Record<string, CasGhsEntry> = {
  // ── 산 / 부식성 ──
  "7647-01-0": { name: "염산 (Hydrochloric acid)", hazardCodes: ["H314", "H335", "H290"] },
  "7664-93-9": { name: "황산 (Sulfuric acid)", hazardCodes: ["H314", "H290"] },
  "7697-37-2": { name: "질산 (Nitric acid)", hazardCodes: ["H272", "H314", "H290"] },
  "7664-38-2": { name: "인산 (Phosphoric acid)", hazardCodes: ["H314"] },
  "64-19-7": { name: "아세트산 (Acetic acid, glacial)", hazardCodes: ["H226", "H314"] },
  // ── 염기 ──
  "1310-73-2": { name: "수산화나트륨 (NaOH)", hazardCodes: ["H314", "H290"] },
  "1310-58-3": { name: "수산화칼륨 (KOH)", hazardCodes: ["H302", "H314"] },
  "1336-21-6": { name: "암모니아수 (Ammonia solution)", hazardCodes: ["H314", "H335", "H400"] },
  // ── 인화성 용매 ──
  "67-56-1": { name: "메탄올 (Methanol)", hazardCodes: ["H225", "H301", "H311", "H331", "H370"] },
  "64-17-5": { name: "에탄올 (Ethanol)", hazardCodes: ["H225"] },
  "67-63-0": { name: "이소프로판올 (Isopropanol)", hazardCodes: ["H225", "H319", "H336"] },
  "67-64-1": { name: "아세톤 (Acetone)", hazardCodes: ["H225", "H319", "H336"] },
  "75-05-8": { name: "아세토니트릴 (Acetonitrile)", hazardCodes: ["H225", "H302", "H312", "H332", "H319"] },
  "108-88-3": { name: "톨루엔 (Toluene)", hazardCodes: ["H225", "H304", "H315", "H336", "H361d", "H373"] },
  "110-54-3": { name: "n-헥산 (n-Hexane)", hazardCodes: ["H225", "H304", "H315", "H336", "H361f", "H373", "H411"] },
  "68-12-2": { name: "디메틸포름아마이드 (DMF)", hazardCodes: ["H226", "H312", "H332", "H319", "H360D"] },
  // ── 할로겐 용매 ──
  "67-66-3": { name: "클로로포름 (Chloroform)", hazardCodes: ["H302", "H315", "H319", "H331", "H351", "H361d", "H372"] },
  "75-09-2": { name: "디클로로메탄 (Dichloromethane)", hazardCodes: ["H315", "H319", "H335", "H336", "H351"] },
  // ── 산화제 ──
  "7722-84-1": { name: "과산화수소 (Hydrogen peroxide, conc.)", hazardCodes: ["H271", "H302", "H314", "H332", "H335"] },
  // ── 독성 / 발암 ──
  "50-00-0": { name: "포름알데히드 (Formaldehyde)", hazardCodes: ["H301", "H311", "H331", "H314", "H317", "H350"] },
  "30525-89-4": { name: "파라포름알데히드 (Paraformaldehyde)", hazardCodes: ["H228", "H302", "H332", "H315", "H317", "H318", "H335", "H351"] },
  "75-07-0": { name: "아세트알데히드 (Acetaldehyde)", hazardCodes: ["H224", "H319", "H335", "H351"] },
  "71-43-2": { name: "벤젠 (Benzene)", hazardCodes: ["H225", "H304", "H315", "H319", "H340", "H350", "H372"] },
  "79-06-1": { name: "아크릴아마이드 (Acrylamide)", hazardCodes: ["H301", "H312", "H332", "H315", "H317", "H319", "H340", "H350", "H361f", "H372"] },
  "26628-22-8": { name: "아지드화나트륨 (Sodium azide)", hazardCodes: ["H300", "H310", "H373", "H410"] },
  "1239-45-8": { name: "에티듐브로마이드 (Ethidium bromide)", hazardCodes: ["H302", "H330", "H341"] },
  "60-24-2": { name: "2-머캅토에탄올 (2-Mercaptoethanol)", hazardCodes: ["H301", "H310", "H315", "H317", "H318", "H331", "H410"] },
  "110-18-9": { name: "TEMED", hazardCodes: ["H225", "H302", "H314", "H332"] },
  // ── 생물/완충 시약 (경도~비위험) ──
  "151-21-3": { name: "SDS (Sodium dodecyl sulfate)", hazardCodes: ["H228", "H302", "H315", "H318", "H332", "H335"] },
  "3483-12-3": { name: "DTT (Dithiothreitol)", hazardCodes: ["H302", "H315", "H319", "H335"] },
  "77-86-1": { name: "Tris base", hazardCodes: ["H315", "H319", "H335"] },
  "60-00-4": { name: "EDTA", hazardCodes: ["H319"] },
  // ── 비위험(분류됨·저위험): 미분류와 구분 ──
  "7647-14-5": { name: "염화나트륨 (NaCl)", hazardCodes: [] },
  "7732-18-5": { name: "정제수 (Water)", hazardCodes: [] },
  "56-81-5": { name: "글리세롤 (Glycerol)", hazardCodes: [] },
  "50-99-7": { name: "포도당 (D-Glucose)", hazardCodes: [] },

  // ── §cas-table-seed-expansion (호영님 2026-07-04, LabAxis_seed 88종 유래) ──
  //   실 보유 시약 중 단일 CAS 도출 가능한 순수 화학물질. 표준 GHS(공급사 SDS 정합) 기반 큐레이션.
  //   ⚠ 안전관리자(호영님) 검토·확정 전제. 생물시약·배지·키트·혈청·항체는 단일 CAS 없어 제외(미분류 정당).
  "109-70-6": { name: "BCP (1-Bromo-3-chloropropane)", hazardCodes: ["H315", "H319", "H335"] },
  "7758-99-8": { name: "황산구리 5수화물 (Copper(II) sulfate pentahydrate)", hazardCodes: ["H302", "H315", "H319", "H410"] },
  "52-89-1": { name: "L-시스테인 염산염 (L-Cysteine HCl)", hazardCodes: ["H315", "H319", "H335"] },
  "329-98-6": { name: "PMSF (Phenylmethylsulfonyl fluoride)", hazardCodes: ["H301", "H314"] },
  "127-09-3": { name: "아세트산나트륨 (Sodium acetate)", hazardCodes: [] },
  "9002-93-1": { name: "Triton X-100", hazardCodes: ["H302", "H318", "H411"] },
  "9012-36-6": { name: "아가로스 (Agarose)", hazardCodes: [] },
  "1330-20-7": { name: "자일렌 (Xylene)", hazardCodes: ["H226", "H304", "H312", "H315", "H319", "H332", "H335", "H373"] },
  "7705-08-0": { name: "염화철(III) 용액 (Ferric chloride)", hazardCodes: ["H290", "H302", "H314"] },
  "67-68-5": { name: "DMSO (Dimethyl sulfoxide)", hazardCodes: [] },
  "298-93-1": { name: "MTT", hazardCodes: ["H301"] },
  "1405-41-0": { name: "겐타마이신 황산염 (Gentamicin sulfate)", hazardCodes: ["H317", "H334"] },
  "9001-73-4": { name: "파파인 (Papain)", hazardCodes: ["H315", "H319", "H334", "H335"] },
  "1609-47-8": { name: "DEPC (Diethyl pyrocarbonate)", hazardCodes: ["H302", "H315", "H319", "H335"] },
  "493-52-7": { name: "메틸레드 (Methyl red)", hazardCodes: ["H228"] },
  "76-60-4": { name: "브로모크레졸 그린 (Bromocresol green)", hazardCodes: [] },
  "477-73-6": { name: "사프라닌 O (Safranin O)", hazardCodes: [] },
  "2353-45-9": { name: "패스트 그린 FCF (Fast green FCF)", hazardCodes: [] },
  "517-28-2": { name: "헤마톡실린 (Hematoxylin)", hazardCodes: [] },
  "139-33-3": { name: "EDTA 이나트륨 (Na2 EDTA)", hazardCodes: ["H319"] },
};

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

/** CAS 정규화: 공백/전각 제거 후 형식 검증. 유효하지 않으면 null. */
export function normalizeCas(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = String(raw).trim().replace(/\s+/g, "");
  return CAS_RE.test(t) ? t : null;
}

export interface CasClassification {
  /** 표에서 매칭됨(빈 hazardCodes 도 매칭=분류됨·비위험). */
  matched: boolean;
  hazardCodes: string[];
  /** 매칭 시 물질명(참조). */
  name?: string;
}

/** CAS → GHS 분류. 미수록/무효 CAS = matched:false(미분류). */
export function classifyByCas(rawCas: string | null | undefined): CasClassification {
  const cas = normalizeCas(rawCas);
  if (!cas) return { matched: false, hazardCodes: [] };
  const entry = CAS_GHS_TABLE[cas];
  if (!entry) return { matched: false, hazardCodes: [] };
  return { matched: true, hazardCodes: [...entry.hazardCodes], name: entry.name };
}

// GHS 위험도 코드셋(utils safety-visualization 정합·확장).
const CRITICAL_CODES = new Set(["H300", "H310", "H330", "H350", "H360", "H370", "H372", "H340"]);
const HIGH_CODES = new Set(["H301", "H311", "H331", "H314", "H318", "H341", "H351", "H361", "H371", "H373", "H304"]);

/**
 * 위험등급 파생(canonical). 
 *  - classified=false → "unknown"(미분류): "일반"으로 오도 금지.
 *  - classified=true + critical 코드 → "critical", high 코드 → "high",
 *    그 외 코드 있음 → "medium", 코드 없음(비위험) → "low".
 */
export function deriveHazardLevel(input: { classified: boolean; hazardCodes: string[] | null | undefined }): HazardClassLevel {
  if (!input.classified) return "unknown";
  const codes = input.hazardCodes ?? [];
  if (codes.some((c) => CRITICAL_CODES.has(c))) return "critical";
  if (codes.some((c) => HIGH_CODES.has(c))) return "high";
  if (codes.length > 0) return "medium";
  return "low";
}

// H-code → GHS 픽토그램 매핑(표준 GHS 규칙).
const PICTO_RULES: Array<{ picto: GhsPictogram; test: (c: string) => boolean }> = [
  { picto: "explosive", test: (c) => /^H20[0-4]$/.test(c) },
  { picto: "flame", test: (c) => /^H22[0-8]$/.test(c) || /^H2[56][01]$/.test(c) },
  { picto: "oxidizer", test: (c) => /^H27[012]$/.test(c) },
  { picto: "gas_cylinder", test: (c) => /^H28[01]$/.test(c) },
  { picto: "corrosive", test: (c) => c === "H314" || c === "H318" || c === "H290" },
  { picto: "skull", test: (c) => ["H300", "H310", "H330", "H301", "H311", "H331"].includes(c) },
  { picto: "health_hazard", test: (c) => ["H304", "H334", "H340", "H341", "H350", "H351", "H360", "H361", "H370", "H371", "H372", "H373"].includes(c) },
  { picto: "exclamation", test: (c) => ["H302", "H312", "H315", "H317", "H319", "H332", "H335", "H336"].includes(c) },
  { picto: "environment", test: (c) => /^H4(00|1[0-2])/.test(c) },
];

/** H-code 배열 → GHS 픽토그램 키 배열(중복 제거). */
export function pictogramsFromHazardCodes(hazardCodes: string[] | null | undefined): GhsPictogram[] {
  const codes = hazardCodes ?? [];
  const out = new Set<GhsPictogram>();
  for (const c of codes) {
    const base = c.replace(/[a-z]+$/i, ""); // H361d → H361
    for (const rule of PICTO_RULES) {
      if (rule.test(c) || rule.test(base)) out.add(rule.picto);
    }
  }
  return [...out];
}
