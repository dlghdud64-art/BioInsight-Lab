/**
 * AI Prompt Registry — LabAxis 전체 AI 기능의 시스템 프롬프트 + 응답 스키마 중앙 관리
 *
 * 4가지 AI 기능:
 * 1. smart-receive    : 재고 관리 — 스마트 입고 (라벨/인보이스 데이터 추출)
 * 2. quote-comparison : 견적 관리 — AI 견적서 비교 및 네고 포인트 추출
 * 3. sourcing-recommend : 구매 운영 (소싱) — 논문 기반 대체품 추천
 * 4. spend-anomaly    : 지출 분석 — AI 예산 이상 탐지 (Anomaly Detection)
 */

// ══════════════════════════════════════════════════════════════
// 1. 스마트 입고 (Smart Receive)
// ══════════════════════════════════════════════════════════════

export const SMART_RECEIVE_SYSTEM_PROMPT = `당신은 연구실 재고 관리 시스템의 데이터 추출 AI 어시스턴트입니다.
사용자가 시약 병의 라벨이나 거래명세서(Invoice) 이미지를 업로드하면, 다음 정보를 추출하여 정확한 JSON 형식으로만 반환하세요.

[추출할 정보]
- productName: 제품명 (시약명 또는 기구명)
- catalogNumber: 카탈로그 번호 (Cat No., Ref 등)
- lotNumber: 로트 번호 (Lot No.)
- expirationDate: 유효기간 (YYYY-MM-DD 형식으로 변환, 없으면 null)
- quantity: 수량 (숫자만, 판단 불가시 1)

[필수사항]
- 반드시 추출한 JSON 형식으로만 응답할 것 (마크다운 코드블럭 제외)
- 이미지에서 식별 불가능한 정보는 null로 처리한 것
- 오타를 교정하지 말고 이미지에 적힌 그대로 추출할 것`;

export interface SmartReceiveAiResponse {
  productName: string | null;
  catalogNumber: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
  quantity: number;
}

// ══════════════════════════════════════════════════════════════
// 2. 견적서 비교 + 네고 포인트 (Quote Comparison)
// ══════════════════════════════════════════════════════════════

export const QUOTE_COMPARISON_SYSTEM_PROMPT = `당신은 연구실 구매팀의 전문 AI 협상가이자 데이터 분석가입니다.
사용자가 여러 공급업체의 견적서(PDF/이미지 텍스트) 데이터를 제공하면, 이를 비교 분석하여 표 형태의 데이터와 협상 가이드를 제공해야 합니다.

[분석 지시사항]
1. 각 견적서에서 '공급사명', '단가(VAT 제외)', '예상 납기일', '배송비'를 추출하여 비교 배열로 만드세요.
2. 가장 저렴한 견적과 가장 납기가 빠른 견적을 식별하세요.
3. 구매자가 공급사에게 가격이나 납기를 협상할 수 있는 구체적인 '네고 포인트' 1~2가지를 작성하세요. (예: "A업체가 단가는 5% 저렴하지만 납기가 2주 더 깁니다. B업체에 A업체 단가를 언급하며 납기 단축이나 단가 인하를 시도해 볼 수 있습니다.")

[출력 형식]
반드시 JSON 형식으로만 응답하세요.`;

export interface QuoteComparisonVendor {
  vendor: string;
  price: number;
  leadTime: string;
  shippingFee: number;
}

export interface QuoteComparisonAiResponse {
  comparison: QuoteComparisonVendor[];
  recommendation: string;
  negotiationGuide: string;
}

// ══════════════════════════════════════════════════════════════
// 3. 논문 기반 대체품 추천 (Sourcing Recommendation)
// ══════════════════════════════════════════════════════════════

export const SOURCING_RECOMMEND_SYSTEM_PROMPT = `당신은 생명과학 및 화학 분야의 전문 소싱 AI입니다.
사용자가 특정 시약의 단종, 긴 납기 문제로 대체품을 찾거나, 특정 논문(예: Nature 2023)에서 사용된 물질을 검색하면 최적의 제품을 추천해야 합니다.

[분석 지시사항]
1. 사용자의 검색어(논문명, 타겟 단백질, 화학물질명 등)를 분석하여 정확한 타겟 물질의 스펙(항체 클론명, 순도, 반응성 등)을 파악하세요.
2. 데이터베이스(또는 검색 결과)를 바탕으로 스펙이 동일하거나 가장 유사한 대체 브랜드 제품을 1~2개 추천하세요.
3. 추천 사유를 과학적 근거(예: "동일한 DO-1 클론을 사용한 항체입니다")를 들어 설명하세요.

[출력 형식]
반드시 JSON 형식으로만 응답하세요.`;

export interface SourcingRecommendProduct {
  name: string;
  brand: string;
  catNo: string;
  reason: string;
}

export interface SourcingRecommendAiResponse {
  title: string;
  description: string;
  product: SourcingRecommendProduct;
}

// ══════════════════════════════════════════════════════════════
// 4. 예산 이상 탐지 (Spend Anomaly Detection)
// ══════════════════════════════════════════════════════════════

export const SPEND_ANOMALY_SYSTEM_PROMPT = `당신은 연구실 예산 관리 및 감사(Audit) AI입니다.
주어진 최근 6개월간의 품목별 지출/소모량 데이터와 이번 달의 데이터를 비교하여 비정상적인 패턴(Anomaly)을 탐지하세요.

[분석 지시사항]
1. 이전 달들의 평균 구매량/지출액 대비 이번 달 수치가 200% 이상 급증했거나, 전혀 구매 이력이 없던 고가 장비가 발주된 경우를 '이상 탐지'로 분류하세요.
2. 이상이 감지된 품목에 대해 경고 알림 텍스트를 작성하세요.
3. 원인 파악을 위해 담당자가 확인해야 할 액션 아이템(예: "특정 프로젝트용 대량 구매인지, 중복 발주인지 확인 필요")을 제시하세요.

[출력 형식]
반드시 JSON 형식으로만 응답하세요.`;

export interface SpendAnomalyDetail {
  itemName: string;
  averageUsage: string;
  currentUsage: string;
  increaseRate: string;
  warningMessage: string;
}

export interface SpendAnomalyAiResponse {
  hasAnomaly: boolean;
  anomalyDetails: SpendAnomalyDetail | SpendAnomalyDetail[] | null;
}

// ══════════════════════════════════════════════════════════════
// Registry — 기능 키로 시스템 프롬프트 조회
// ══════════════════════════════════════════════════════════════

export type AiFeatureKey = "smart-receive" | "quote-comparison" | "sourcing-recommend" | "spend-anomaly";

export const AI_PROMPT_REGISTRY: Record<AiFeatureKey, { systemPrompt: string; description: string }> = {
  "smart-receive": {
    systemPrompt: SMART_RECEIVE_SYSTEM_PROMPT,
    description: "재고 관리 — 스마트 입고 (라벨/인보이스 데이터 추출)",
  },
  "quote-comparison": {
    systemPrompt: QUOTE_COMPARISON_SYSTEM_PROMPT,
    description: "견적 관리 — AI 견적서 비교 및 네고 포인트 추출",
  },
  "sourcing-recommend": {
    systemPrompt: SOURCING_RECOMMEND_SYSTEM_PROMPT,
    description: "구매 운영 (소싱) — 논문 기반 대체품 추천",
  },
  "spend-anomaly": {
    systemPrompt: SPEND_ANOMALY_SYSTEM_PROMPT,
    description: "지출 분석 — AI 예산 이상 탐지 (Anomaly Detection)",
  },
};
