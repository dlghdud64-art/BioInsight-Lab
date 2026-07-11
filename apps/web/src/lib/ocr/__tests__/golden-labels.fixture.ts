/**
 * golden-labels.fixture.ts
 * ────────────────────────
 * §label-scan-extraction — 추출 엔진 회귀 골든 셋 (호영님 2026-07-10 지시 #2).
 *
 * 선명한 라벨 3종에서 연속 저신뢰/추출 실패 → 회귀 기준 고정.
 * 수정 후 이 3종에서 핵심 필드(제품명·Cat/REF·Lot·EXP·규격+단위) 추출 통과 = 회귀 기준.
 *
 * ⚠️ GMP 무결성: 실물 라벨에서 확인된 값만 기록. 미확인 필드는 null + "라벨 확인 필요" 표기.
 *   추정/날조 금지(1단계 진단 로그로 실제 추출값 확인 후 fix phase 에서 정답 확정).
 *
 * 확정 소스: 호영님 리뷰 시 육안 명시분.
 */

export interface GoldenLabel {
  id: string;
  description: string;
  /** 실물 라벨에서 확인된 정답. null = 라벨 재확인 후 확정 필요(현재 미확정). */
  expected: {
    productName: string | null;
    catalogNo: string | null; // REF/Cat/Product No. 통합
    lotNo: string | null;
    expirationDate: string | null; // ISO
    brand: string | null;
    packSize: string | null;
    packUnit: string | null; // normalizePackUnit 통제 어휘 기준
    casNumber: string | null;
  };
  /** 핵심 필드(회귀 통과 필수) — 나머지는 best-effort. */
  criticalFields: Array<"productName" | "catalogNo" | "lotNo" | "expirationDate" | "packUnit">;
}

export const GOLDEN_LABELS: GoldenLabel[] = [
  {
    id: "sigma-E5134-5KG",
    description: "Sigma-Aldrich E5134 (5KG) — 곡면 병 라벨, 이전 저신뢰 사례 1",
    expected: {
      productName: null, // 라벨 확인 필요
      catalogNo: "E5134",
      lotNo: null, // 라벨 확인 필요
      expirationDate: null, // 라벨 확인 필요
      brand: "Sigma-Aldrich",
      packSize: "5",
      packUnit: "kg",
      casNumber: null, // 라벨 확인 필요
    },
    criticalFields: ["catalogNo", "packUnit"],
  },
  {
    id: "gibco-PBS-21600-044",
    description: "gibco PBS 21600-044 — 이전 저신뢰 사례 2",
    expected: {
      productName: "PBS", // gibco Phosphate Buffered Saline (라벨 정식명 확인 권장)
      catalogNo: "21600-044",
      lotNo: null, // 라벨 확인 필요
      expirationDate: null, // 라벨 확인 필요
      brand: "gibco",
      packSize: null, // 라벨 확인 필요
      packUnit: null, // 라벨 확인 필요
      casNumber: null,
    },
    criticalFields: ["productName", "catalogNo"],
  },
  {
    id: "difco-LB-broth-244620",
    description: "Difco LB Broth REF 244620 — 가장 선명한데 저신뢰(엔진 결함 대표 사례 3)",
    expected: {
      productName: "LB Broth", // BD Difco (라벨 정식명 확인 권장)
      catalogNo: "244620", // REF
      lotNo: "1348628",
      expirationDate: "2026-10-31",
      brand: "Difco", // BD Difco
      packSize: null, // 라벨 확인 필요(호영님: 500g 언급 — 확정 시 "500"/"g")
      packUnit: null, // 라벨 확인 필요
      casNumber: null,
    },
    criticalFields: ["productName", "catalogNo", "lotNo", "expirationDate"],
  },
];
