/**
 * policy-learning-loop.ts
 * 정책 학습 루프 — 비용·품질·신뢰도·제외규칙 분석 결과를 종합하여
 * 최적화 제안(proposal)을 생성하고, 안전 강화 제안은 즉시 적용,
 * 완화 제안은 experiment-runner를 통해 검증한다.
 */

import { runCostQualityAnalysis } from "./cost-quality-analyzer";
import { computeModelAllocation } from "./model-allocation-engine";
import { tuneConfidenceBands } from "./confidence-band-tuner";
import { runExclusionLearning } from "./exclusion-learning";
import { evaluateOptimizationProposal } from "./optimization-approval";
import { createExperiment } from "./experiment-runner";

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** 개별 제안 참조 */
export interface ProposalReference {
  proposalId: string;
  source: "COST_QUALITY" | "MODEL_ALLOCATION" | "CONFIDENCE_BAND" | "EXCLUSION";
  direction: "TIGHTENING" | "LOOSENING" | "EXCLUSION_ADD" | "EXCLUSION_REMOVE";
  description: string;
  autoApplicable: boolean; // 안전 강화 → true, 완화 → false
}

/** 학습 사이클 결과 */
export interface LearningCycleResult {
  cycleId: string;
  documentType: string;
  runAt: Date;
  proposals: ProposalReference[];
  summary: string;
}

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

/** 고유 ID 생성 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 안전 강화(tightening, exclusion ADD) 여부 판별
 * RULE: 안전 강화 제안은 자동 적용 가능, 완화 제안은 실험 필수
 */
function isSafetyHardening(direction: ProposalReference["direction"]): boolean {
  return direction === "TIGHTENING" || direction === "EXCLUSION_ADD";
}

// ──────────────────────────────────────────────
// 인메모리 저장소 (production: DB-backed)
// ──────────────────────────────────────────────
const cycleHistory: LearningCycleResult[] = [];

// ──────────────────────────────────────────────
// 메인 학습 사이클
// ──────────────────────────────────────────────

/**
 * 학습 사이클 실행
 * 1. 비용·품질 분석기 호출
 * 2. 모델 할당 엔진 호출
 * 3. 신뢰도 밴드 튜너 호출
 * 4. 제외 학습기 호출
 * 5. 제안 집계 및 자동 적용 / 실험 분기 처리
 */
export async function runLearningCycle(
  documentType: string
): Promise<LearningCycleResult> {
  const cycleId = generateId("cycle");
  const proposals: ProposalReference[] = [];

  // ── 1) 비용·품질 분석 ──
  const costQualityResult = await runCostQualityAnalysis(documentType);
  for (const p of costQualityResult.proposals ?? []) {
    proposals.push({
      proposalId: generateId("prop"),
      source: "COST_QUALITY",
      direction: p.direction,
      description: p.description,
      autoApplicable: isSafetyHardening(p.direction),
    });
  }

  // ── 2) 모델 할당 최적화 ──
  const allocationResult = await computeModelAllocation(documentType);
  for (const p of allocationResult.proposals ?? []) {
    proposals.push({
      proposalId: generateId("prop"),
      source: "MODEL_ALLOCATION",
      direction: p.direction,
      description: p.description,
      autoApplicable: isSafetyHardening(p.direction),
    });
  }

  // ── 3) 신뢰도 밴드 조정 ──
  const bandResult = await tuneConfidenceBands(documentType);
  for (const p of bandResult.proposals ?? []) {
    proposals.push({
      proposalId: generateId("prop"),
      source: "CONFIDENCE_BAND",
      direction: p.direction,
      description: p.description,
      autoApplicable: isSafetyHardening(p.direction),
    });
  }

  // ── 4) 제외 규칙 학습 ──
  const exclusionResult = await runExclusionLearning(documentType);
  for (const p of exclusionResult.proposals ?? []) {
    proposals.push({
      proposalId: generateId("prop"),
      source: "EXCLUSION",
      direction: p.direction,
      description: p.description,
      autoApplicable: isSafetyHardening(p.direction),
    });
  }

  // ── 5) 제안별 분기 처리 ──
  for (const proposal of proposals) {
    if (proposal.autoApplicable) {
      // 안전 강화 제안 → 즉시 적용 (승인 매트릭스 통과)
      evaluateOptimizationProposal(proposal);
    } else {
      // 완화 제안 → 실험 파이프라인으로 전달
      createExperiment(proposal.proposalId, proposal.direction);
    }
  }

  const result: LearningCycleResult = {
    cycleId,
    documentType,
    runAt: new Date(),
    proposals,
    summary: `[${documentType}] 학습 사이클 완료: 총 ${proposals.length}건 제안 ` +
      `(자동 적용 ${proposals.filter((p) => p.autoApplicable).length}건, ` +
      `실험 필요 ${proposals.filter((p) => !p.autoApplicable).length}건)`,
  };

  // 이력 저장
  cycleHistory.push(result);

  return result;
}

/**
 * 학습 사이클 이력 조회
 */
export function getLearningCycleHistory(): LearningCycleResult[] {
  return [...cycleHistory];
}
