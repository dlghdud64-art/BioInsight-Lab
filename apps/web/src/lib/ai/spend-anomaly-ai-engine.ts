/**
 * 지출 분석 — AI 예산 이상 탐지 (Anomaly Detection) 엔진
 *
 * 입력: 최근 6개월 품목별 지출/소모량 + 이번 달 데이터
 * 출력: SpendAnomalyResult (이상 탐지 결과 + 경고 + 액션 아이템)
 */

import {
  SPEND_ANOMALY_SYSTEM_PROMPT,
  type SpendAnomalyAiResponse,
  type SpendAnomalyDetail,
} from "./ai-prompt-registry";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

export interface MonthlySpendRecord {
  month: string; // "2025-01" 형식
  itemName: string;
  quantity: number;
  totalAmount: number;
  category?: string;
}

export interface SpendAnomalyInput {
  /** 최근 6개월 지출 데이터 */
  historicalData: MonthlySpendRecord[];
  /** 이번 달 데이터 */
  currentMonthData: MonthlySpendRecord[];
  /** 분석 대상 기간 */
  analysisMonth: string; // "2025-07"
}

export interface SpendAnomalyResult {
  success: boolean;
  response: SpendAnomalyAiResponse | null;
  /** 로컬 계산 결과 (AI 미사용 시 fallback) */
  localAnalysis: {
    anomalies: LocalAnomalyItem[];
    totalAnomalyCount: number;
    highRiskCount: number;
  };
  error?: string;
}

export interface LocalAnomalyItem {
  itemName: string;
  category?: string;
  avgQuantity: number;
  avgAmount: number;
  currentQuantity: number;
  currentAmount: number;
  quantityIncreaseRate: number; // %
  amountIncreaseRate: number; // %
  anomalyType: "spike" | "new_high_value" | "frequency_change";
  severity: "high" | "medium" | "low";
  message: string;
}

// ══════════════════════════════════════════════════════════════
// Local Analysis (AI 호출 없이 동작하는 fallback)
// ══════════════════════════════════════════════════════════════

/** 품목별 평균 집계 */
function computeItemAverages(records: MonthlySpendRecord[]): Map<string, { avgQty: number; avgAmt: number; months: number }> {
  const grouped = new Map<string, { totalQty: number; totalAmt: number; months: Set<string> }>();

  for (const r of records) {
    const existing = grouped.get(r.itemName);
    if (existing) {
      existing.totalQty += r.quantity;
      existing.totalAmt += r.totalAmount;
      existing.months.add(r.month);
    } else {
      grouped.set(r.itemName, {
        totalQty: r.quantity,
        totalAmt: r.totalAmount,
        months: new Set([r.month]),
      });
    }
  }

  const result = new Map<string, { avgQty: number; avgAmt: number; months: number }>();
  for (const [name, data] of grouped) {
    const monthCount = data.months.size || 1;
    result.set(name, {
      avgQty: Math.round(data.totalQty / monthCount),
      avgAmt: Math.round(data.totalAmt / monthCount),
      months: monthCount,
    });
  }
  return result;
}

export function computeLocalAnomalyAnalysis(input: SpendAnomalyInput): SpendAnomalyResult["localAnalysis"] {
  const averages = computeItemAverages(input.historicalData);
  const anomalies: LocalAnomalyItem[] = [];

  // 이번 달 품목별 집계
  const currentByItem = new Map<string, { qty: number; amt: number; category?: string }>();
  for (const r of input.currentMonthData) {
    const existing = currentByItem.get(r.itemName);
    if (existing) {
      existing.qty += r.quantity;
      existing.amt += r.totalAmount;
    } else {
      currentByItem.set(r.itemName, { qty: r.quantity, amt: r.totalAmount, category: r.category });
    }
  }

  for (const [itemName, current] of currentByItem) {
    const avg = averages.get(itemName);

    if (!avg) {
      // 신규 고가 품목
      if (current.amt > 500000) {
        anomalies.push({
          itemName,
          category: current.category,
          avgQuantity: 0,
          avgAmount: 0,
          currentQuantity: current.qty,
          currentAmount: current.amt,
          quantityIncreaseRate: 0,
          amountIncreaseRate: 0,
          anomalyType: "new_high_value",
          severity: current.amt > 2000000 ? "high" : "medium",
          message: `이전 구매 이력이 없는 고가 품목이 발주되었습니다 (${current.amt.toLocaleString()}원). 프로젝트용 대량 구매인지, 중복 발주인지 확인이 필요합니다.`,
        });
      }
      continue;
    }

    // 수량 급증 체크 (200% 이상)
    const qtyRate = avg.avgQty > 0 ? Math.round((current.qty / avg.avgQty) * 100) : 0;
    const amtRate = avg.avgAmt > 0 ? Math.round((current.amt / avg.avgAmt) * 100) : 0;

    if (qtyRate >= 200 || amtRate >= 200) {
      const severity: LocalAnomalyItem["severity"] =
        qtyRate >= 500 || amtRate >= 500 ? "high" :
        qtyRate >= 300 || amtRate >= 300 ? "medium" : "low";

      anomalies.push({
        itemName,
        category: current.category,
        avgQuantity: avg.avgQty,
        avgAmount: avg.avgAmt,
        currentQuantity: current.qty,
        currentAmount: current.amt,
        quantityIncreaseRate: qtyRate,
        amountIncreaseRate: amtRate,
        anomalyType: "spike",
        severity,
        message: `평균 대비 수량 ${qtyRate}%, 금액 ${amtRate}% 급증. ${severity === "high" ? "즉시 확인이 필요합니다." : "담당자 확인을 권장합니다."}`,
      });
    }
  }

  // severity 순 정렬
  const severityOrder = { high: 0, medium: 1, low: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    anomalies,
    totalAnomalyCount: anomalies.length,
    highRiskCount: anomalies.filter((a) => a.severity === "high").length,
  };
}

// ══════════════════════════════════════════════════════════════
// AI 기반 이상 탐지 (서버사이드 API 호출용 유틸)
// ══════════════════════════════════════════════════════════════

/**
 * 이상 탐지 요청 메시지 빌드 (AI에 전달할 user prompt)
 */
export function buildSpendAnomalyUserPrompt(input: SpendAnomalyInput): string {
  const lines: string[] = [
    `[분석 기간] ${input.analysisMonth}`,
    "",
    "[최근 6개월 품목별 지출 데이터]",
  ];

  // 품목별 요약
  const averages = computeItemAverages(input.historicalData);
  for (const [name, avg] of averages) {
    lines.push(`- ${name}: 월평균 수량 ${avg.avgQty}개, 월평균 금액 ${avg.avgAmt.toLocaleString()}원 (${avg.months}개월 데이터)`);
  }

  lines.push("");
  lines.push("[이번 달 지출 데이터]");
  for (const r of input.currentMonthData) {
    lines.push(`- ${r.itemName}: 수량 ${r.quantity}개, 금액 ${r.totalAmount.toLocaleString()}원`);
  }

  lines.push("");
  lines.push("위 데이터를 비교 분석하여 이상 패턴을 탐지하고, 경고 알림 및 액션 아이템을 포함한 JSON을 반환해주세요.");

  return lines.join("\n");
}

/**
 * AI 응답 JSON 파싱
 */
export function parseSpendAnomalyResponse(raw: string): SpendAnomalyAiResponse | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as SpendAnomalyAiResponse;

    if (typeof parsed.hasAnomaly !== "boolean") return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * 로컬 fallback 전체 결과 생성
 */
export function buildLocalSpendAnomalyResult(input: SpendAnomalyInput): SpendAnomalyResult {
  const localAnalysis = computeLocalAnomalyAnalysis(input);

  // 로컬 결과를 SpendAnomalyAiResponse 형태로 매핑
  const anomalyDetails: SpendAnomalyDetail[] = localAnalysis.anomalies.map((a) => ({
    itemName: a.itemName,
    averageUsage: a.anomalyType === "new_high_value" ? "구매 이력 없음" : `월평균 ${a.avgQuantity}개 / ${a.avgAmount.toLocaleString()}원`,
    currentUsage: `${a.currentQuantity}개 / ${a.currentAmount.toLocaleString()}원`,
    increaseRate: a.anomalyType === "new_high_value" ? "신규" : `수량 ${a.quantityIncreaseRate}% / 금액 ${a.amountIncreaseRate}%`,
    warningMessage: a.message,
  }));

  return {
    success: true,
    response: localAnalysis.anomalies.length > 0
      ? { hasAnomaly: true, anomalyDetails: anomalyDetails.length === 1 ? anomalyDetails[0] : anomalyDetails }
      : { hasAnomaly: false, anomalyDetails: null },
    localAnalysis,
  };
}

/**
 * 시스템 프롬프트 getter
 */
export function getSpendAnomalySystemPrompt(): string {
  return SPEND_ANOMALY_SYSTEM_PROMPT;
}
