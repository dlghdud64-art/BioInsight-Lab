/**
 * P1 Backlog — 타입 정의만 (구현 안 함)
 * 다음 단계에서 구현할 기능 목록.
 */

export enum P1Feature {
  SECOND_DOCTYPE_EXPANSION = "SECOND_DOCTYPE_EXPANSION",
  THRESHOLD_TUNING_PROPOSAL = "THRESHOLD_TUNING_PROPOSAL",
  EXCLUSION_LEARNING_PROPOSAL = "EXCLUSION_LEARNING_PROPOSAL",
  REVIEW_ROUTING_OPTIMIZER = "REVIEW_ROUTING_OPTIMIZER",
  COST_QUALITY_ANALYZER = "COST_QUALITY_ANALYZER",
  MINIMAL_PORTFOLIO_CAPACITY_VIEW = "MINIMAL_PORTFOLIO_CAPACITY_VIEW",
  MINIMAL_MODEL_ALLOCATION_ENGINE = "MINIMAL_MODEL_ALLOCATION_ENGINE",
}

export interface P1BacklogItem {
  feature: P1Feature;
  title: string;
  description: string;
  prerequisite: string;
  estimatedEffort: "S" | "M" | "L" | "XL";
  priority: number;
}

/** P1 백로그 항목 반환 */
export function getP1Backlog(): P1BacklogItem[] {
  return [
    {
      feature: P1Feature.SECOND_DOCTYPE_EXPANSION,
      title: "두 번째 DocType 확장 (INVOICE)",
      description:
        "QUOTE가 STABLE에 도달한 후, INVOICE에 대해 동일 canary 경로 적용.",
      prerequisite: "QUOTE STABLE 확인",
      estimatedEffort: "M",
      priority: 1,
    },
    {
      feature: P1Feature.THRESHOLD_TUNING_PROPOSAL,
      title: "Confidence Threshold 튜닝 제안",
      description:
        "Shadow/Active 데이터 기반으로 최적 confidence threshold를 자동 계산하여 제안.",
      prerequisite: "최소 500건 처리 로그",
      estimatedEffort: "M",
      priority: 2,
    },
    {
      feature: P1Feature.EXCLUSION_LEARNING_PROPOSAL,
      title: "Exclusion 패턴 학습 제안",
      description:
        "반복적으로 mismatch가 발생하는 vendor/template 패턴을 자동 감지하여 exclusion 목록에 추가 제안.",
      prerequisite: "최소 200건 mismatch 로그",
      estimatedEffort: "L",
      priority: 3,
    },
    {
      feature: P1Feature.REVIEW_ROUTING_OPTIMIZER,
      title: "Review Routing 최적화",
      description:
        "Human review가 필요한 건을 담당자별로 라우팅하는 최적화 로직.",
      prerequisite: "Review queue 운영 경험 1개월+",
      estimatedEffort: "M",
      priority: 4,
    },
    {
      feature: P1Feature.COST_QUALITY_ANALYZER,
      title: "비용/품질 분석기",
      description:
        "AI 처리 비용(토큰) 대비 품질(confidence, mismatch rate) 분석 대시보드.",
      prerequisite: "최소 1000건 처리 로그 + 비용 데이터",
      estimatedEffort: "M",
      priority: 5,
    },
    {
      feature: P1Feature.MINIMAL_PORTFOLIO_CAPACITY_VIEW,
      title: "최소 포트폴리오 용량 뷰",
      description:
        "docType별 AI 처리 용량과 현재 사용률 시각화.",
      prerequisite: "Active mode 운영 경험 2주+",
      estimatedEffort: "S",
      priority: 6,
    },
    {
      feature: P1Feature.MINIMAL_MODEL_ALLOCATION_ENGINE,
      title: "최소 모델 배분 엔진",
      description:
        "docType/complexity별 최적 AI 모델(gpt-4o-mini vs gpt-4o) 자동 선택.",
      prerequisite: "두 모델 모두 shadow 데이터 확보",
      estimatedEffort: "XL",
      priority: 7,
    },
  ];
}
