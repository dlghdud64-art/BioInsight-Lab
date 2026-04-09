/**
 * POST /api/ai/impact-analysis
 *
 * 발주 승인 직전 What-if 시뮬레이션 + Gemini 리스크 평가.
 *
 * 흐름:
 *   1. simulateOrderImpact()로 결정론적 before/after snapshot 계산
 *   2. Gemini API로 자연어 리스크 리포트 생성
 *   3. Gemini 실패/키 미설정 시 결정론적 요약(summary.bulletPoints)을 fallback으로 반환
 *
 * canonical truth는 mutate하지 않는다 — 본 route는 read-only.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  simulateOrderImpact,
  type ImpactAnalysisInput,
  type ImpactAnalysisSimulation,
} from "@/lib/ai/impact-analysis-engine";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const IMPACT_ANALYSIS_PROMPT = `You are an AI Financial Controller and Inventory Analyst for a Korean research lab procurement system (LabAxis).

A purchase order is awaiting approval. Below is the deterministic before/after simulation result. Use it to write a concise risk report in Korean.

Order item: {itemName}
Order amount: {orderAmount} KRW

Budget snapshot (before):
- total: {budgetTotal} KRW
- spent + committed: {budgetConsumed} KRW
- available: {budgetBeforeAvailable} KRW
- utilization: {budgetBeforeUtil}%
- predicted depletion: {budgetBeforeDepletion}

Budget snapshot (after this approval):
- available: {budgetAfterAvailable} KRW
- utilization: {budgetAfterUtil}%
- predicted depletion: {budgetAfterDepletion}
- depletion advanced by: {depletionAdvancedDays} days
- risk level: {riskBefore} → {riskAfter}

Inventory snapshot:
- current days of supply (before): {invBeforeDays} days
- current days of supply (after receiving): {invAfterDays} days
- below reorder point now: {belowReorderPoint}

Task:
1. Explain in 2-3 sentences how this approval will accelerate budget depletion (구체적인 일수/금액 인용).
2. Explain in 1-2 sentences the impact on inventory turnover (재고 회전율).
3. Give one actionable recommendation (승인/검토/차단 중 하나).

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "budgetImpactReport": "string in Korean (2-3 sentences)",
  "inventoryImpactReport": "string in Korean (1-2 sentences)",
  "recommendation": "string in Korean — APPROVE | REVIEW | BLOCK 중 하나로 시작",
  "severity": "ok" | "review" | "blocked"
}`;

interface ImpactAnalysisAPIResult {
  simulation: ImpactAnalysisSimulation;
  report: {
    budgetImpactReport: string;
    inventoryImpactReport: string;
    recommendation: string;
    severity: "ok" | "review" | "blocked";
  };
  source: "gemini" | "local";
}

// ── Local fallback: deterministic summary → text report ───────────

function buildLocalReport(sim: ImpactAnalysisSimulation): ImpactAnalysisAPIResult["report"] {
  const budget = sim.budget;
  const inventory = sim.inventory;

  const budgetImpactReport = budget
    ? budget.depletionAdvancedDays > 0
      ? `이 발주를 승인하면 예산 가용액이 ${formatKRW(budget.before.available)}에서 ${formatKRW(budget.after.available)}로 감소하며, 예상 고갈 시점이 약 ${budget.depletionAdvancedDays}일 앞당겨집니다. 소진율은 ${budget.before.utilizationPercent}% → ${budget.after.utilizationPercent}%로 상승합니다.`
      : `이 발주는 예산 가용액을 ${formatKRW(budget.before.available)}에서 ${formatKRW(budget.after.available)}로 변경하지만, 예상 고갈 시점에는 큰 변화가 없습니다.`
    : "예산 정보가 없어 영향 분석을 생략합니다.";

  const inventoryImpactReport = inventory
    ? inventory.before.belowReorderPoint
      ? `현재 재고가 재주문 임계 이하(${inventory.before.daysOfSupply}일분)이며, 발주 수령 후 ${inventory.after.daysOfSupply}일분으로 회복됩니다.`
      : `재고 일수는 ${inventory.before.daysOfSupply}일에서 ${inventory.after.daysOfSupply}일로 변경됩니다.`
    : "재고 정보가 없어 회전율 분석을 생략합니다.";

  const recommendation =
    sim.summary.severity === "blocked"
      ? "BLOCK — 예산 초과 또는 임계 위반으로 승인을 차단하고 예산 재배정을 요청하세요."
      : sim.summary.severity === "review"
        ? "REVIEW — 위험 신호가 있어 추가 검토 후 승인하세요."
        : "APPROVE — 영향이 정상 범위 내이며 승인 가능합니다.";

  return {
    budgetImpactReport,
    inventoryImpactReport,
    recommendation,
    severity: sim.summary.severity,
  };
}

function formatKRW(value: number): string {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

// ── Route Handler ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body: ImpactAnalysisInput = await request.json();

    if (!body.orderId || !body.itemName || body.orderAmount == null) {
      return NextResponse.json(
        { success: false, error: "orderId, itemName, orderAmount 필수" },
        { status: 400 },
      );
    }

    // 1. 결정론적 시뮬레이션 (절대 mutate하지 않음)
    const simulation = simulateOrderImpact(body);

    // 2. Gemini 호출 (선택)
    if (GEMINI_API_KEY && simulation.budget) {
      try {
        const b = simulation.budget;
        const inv = simulation.inventory;
        const prompt = IMPACT_ANALYSIS_PROMPT
          .replace("{itemName}", body.itemName)
          .replace("{orderAmount}", String(body.orderAmount))
          .replace("{budgetTotal}", String(b.before.total))
          .replace("{budgetConsumed}", String(b.before.spent + b.before.committed))
          .replace("{budgetBeforeAvailable}", String(b.before.available))
          .replace("{budgetBeforeUtil}", String(b.before.utilizationPercent))
          .replace("{budgetBeforeDepletion}", b.before.predictedDepletionDate ?? "예상 안 됨")
          .replace("{budgetAfterAvailable}", String(b.after.available))
          .replace("{budgetAfterUtil}", String(b.after.utilizationPercent))
          .replace("{budgetAfterDepletion}", b.after.predictedDepletionDate ?? "예상 안 됨")
          .replace("{depletionAdvancedDays}", String(b.depletionAdvancedDays))
          .replace("{riskBefore}", b.riskBefore)
          .replace("{riskAfter}", b.riskAfter)
          .replace("{invBeforeDays}", String(inv?.before.daysOfSupply ?? "N/A"))
          .replace("{invAfterDays}", String(inv?.after.daysOfSupply ?? "N/A"))
          .replace("{belowReorderPoint}", String(inv?.before.belowReorderPoint ?? false));

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
            }),
          },
        );

        if (res.ok) {
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          const result: ImpactAnalysisAPIResult = {
            simulation,
            report: {
              budgetImpactReport: parsed.budgetImpactReport ?? "",
              inventoryImpactReport: parsed.inventoryImpactReport ?? "",
              recommendation: parsed.recommendation ?? "",
              severity: parsed.severity ?? simulation.summary.severity,
            },
            source: "gemini",
          };
          return NextResponse.json({ success: true, data: result });
        }
      } catch {
        // Gemini 실패 시 fallback
      }
    }

    // 3. Local fallback
    const result: ImpactAnalysisAPIResult = {
      simulation,
      report: buildLocalReport(simulation),
      source: "local",
    };
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impact analysis 수행 중 오류" },
      { status: 500 },
    );
  }
}
