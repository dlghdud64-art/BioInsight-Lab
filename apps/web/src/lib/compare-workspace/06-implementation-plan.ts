/**
 * Compare & Decision Workspace — Phased Implementation Plan (V1 / V2)
 *
 * Track B 설계 문서 #7
 *
 * V1: 핵심 운영에 직접 필요한 최소 기능
 * V2: 전체 비교/온톨로지/AI 패널 확장
 *
 * 선후 관계:
 *   Track A (완료) → V1 (최소) → V2 (확장)
 */

// ══════════════════════════════════════════════════════════════════════════════
// 구현 단계 정의
// ══════════════════════════════════════════════════════════════════════════════

export type ImplementationPhase =
  | "TRACK_A"   // 완료
  | "V1"        // 최소 기능
  | "V2";       // 전체 확장

export interface PhaseItem {
  phase: ImplementationPhase;
  layerId: string;
  feature: string;
  description: string;
  dependencies: string[];
  estimatedFiles: string[];
  priority: number;         // 1 = 최우선
  status: "COMPLETE" | "PLANNED" | "DEFERRED";
}

// ══════════════════════════════════════════════════════════════════════════════
// Track A — 완료
// ══════════════════════════════════════════════════════════════════════════════

export const TRACK_A_ITEMS: PhaseItem[] = [
  {
    phase: "TRACK_A",
    layerId: "P7-1",
    feature: "운영 상태선 잠금",
    description: "4개 도메인 상태 정의, 전이 규칙, 자동화, Prisma 스키마",
    dependencies: [],
    estimatedFiles: [
      "src/lib/operations/state-definitions.ts",
      "src/lib/operations/state-machine.ts",
      "src/lib/operations/state-transition-logger.ts",
      "src/lib/operations/automation.ts",
      "prisma/schema.prisma",
    ],
    priority: 1,
    status: "COMPLETE",
  },
  {
    phase: "TRACK_A",
    layerId: "P7-2",
    feature: "CTA 연결표 잠금",
    description: "20개 CTA, 7개 화면, visibility/disabled 헬퍼",
    dependencies: ["P7-1"],
    estimatedFiles: [
      "src/lib/operations/cta-definitions.ts",
      "src/lib/operations/cta-helpers.ts",
    ],
    priority: 2,
    status: "COMPLETE",
  },
  {
    phase: "TRACK_A",
    layerId: "P7-3",
    feature: "대시보드/작업함 큐 잠금",
    description: "6개 정규 큐, 우선순위, 레이아웃 존",
    dependencies: ["P7-1", "P7-2"],
    estimatedFiles: [
      "src/lib/operations/queue-definitions.ts",
    ],
    priority: 3,
    status: "COMPLETE",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// V1 — 최소 기능 (Core Operations에 직접 필요)
// ══════════════════════════════════════════════════════════════════════════════

export const V1_ITEMS: PhaseItem[] = [
  {
    phase: "V1",
    layerId: "L1-V1",
    feature: "문서 업로드 기본 기능",
    description: "견적서/SDS 업로드, DocumentRecord 저장, 버전 관리",
    dependencies: ["TRACK_A"],
    estimatedFiles: [
      "src/lib/compare-workspace/document-store.ts",
      "src/app/api/documents/route.ts",
      "src/app/api/documents/[id]/route.ts",
    ],
    priority: 1,
    status: "PLANNED",
  },
  {
    phase: "V1",
    layerId: "L2-V1",
    feature: "기본 정규화 (제품/견적)",
    description: "제품 카탈로그 + 견적서 canonical field 추출 (AI pipeline)",
    dependencies: ["L1-V1"],
    estimatedFiles: [
      "src/lib/compare-workspace/normalizer-product.ts",
      "src/lib/compare-workspace/normalizer-quote.ts",
    ],
    priority: 2,
    status: "PLANNED",
  },
  {
    phase: "V1",
    layerId: "L3-V1",
    feature: "제품 vs 제품 비교",
    description: "두 제품의 canonical field 비교, structured diff 출력",
    dependencies: ["L2-V1"],
    estimatedFiles: [
      "src/lib/compare-workspace/diff-engine.ts",
    ],
    priority: 3,
    status: "PLANNED",
  },
  {
    phase: "V1",
    layerId: "L6-V1a",
    feature: "공급사 문의 이메일 초안",
    description: "비교 맥락 기반 이메일 초안 생성 (최소 draft 기능)",
    dependencies: ["L3-V1"],
    estimatedFiles: [
      "src/lib/compare-workspace/vendor-inquiry-draft.ts",
    ],
    priority: 4,
    status: "PLANNED",
  },
  {
    phase: "V1",
    layerId: "L6-V1b",
    feature: "검토 요청 / 승인 요청",
    description: "팀 내 검토/승인 요청 기능",
    dependencies: ["TRACK_A"],
    estimatedFiles: [
      "src/lib/compare-workspace/review-request.ts",
      "src/app/api/communications/route.ts",
    ],
    priority: 5,
    status: "PLANNED",
  },
  {
    phase: "V1",
    layerId: "IF-V1",
    feature: "비교 → 견적 요청 CTA 연결",
    description: "비교 결과에서 최적 제품 선택 후 CTA-S2 트리거",
    dependencies: ["L3-V1", "P7-2"],
    estimatedFiles: [
      "src/lib/compare-workspace/compare-to-quote-bridge.ts",
    ],
    priority: 6,
    status: "PLANNED",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// V2 — 전체 확장
// ══════════════════════════════════════════════════════════════════════════════

export const V2_ITEMS: PhaseItem[] = [
  {
    phase: "V2",
    layerId: "L1-V2",
    feature: "문서 수집 확장 (SDS/COA/프로토콜)",
    description: "SDS, COA, 프로토콜 파싱 + 버전 관리 확장",
    dependencies: ["L1-V1"],
    estimatedFiles: [
      "src/lib/compare-workspace/normalizer-sds.ts",
      "src/lib/compare-workspace/normalizer-coa.ts",
      "src/lib/compare-workspace/normalizer-protocol.ts",
    ],
    priority: 1,
    status: "DEFERRED",
  },
  {
    phase: "V2",
    layerId: "L4-V2",
    feature: "온톨로지 엔진 (entity resolution)",
    description: "CAS 매칭, 이름 유사도, 대체 관계 해석",
    dependencies: ["L2-V1"],
    estimatedFiles: [
      "src/lib/compare-workspace/ontology-engine.ts",
      "src/lib/compare-workspace/ontology-resolvers.ts",
    ],
    priority: 2,
    status: "DEFERRED",
  },
  {
    phase: "V2",
    layerId: "L5-V2",
    feature: "AI 작업 패널 전체 구현",
    description: "비교 결과 + 온톨로지 + citation 기반 판단 지원 패널",
    dependencies: ["L3-V1", "L4-V2"],
    estimatedFiles: [
      "src/lib/compare-workspace/work-panel-generator.ts",
      "src/components/compare-workspace/WorkPanel.tsx",
    ],
    priority: 3,
    status: "DEFERRED",
  },
  {
    phase: "V2",
    layerId: "L3-V2",
    feature: "비교 엔진 확장 (견적 vs 견적, SDS vs SDS)",
    description: "다양한 비교 유형 지원, significance 자동 분류",
    dependencies: ["L1-V2", "L3-V1"],
    estimatedFiles: [
      "src/lib/compare-workspace/diff-engine-extended.ts",
    ],
    priority: 4,
    status: "DEFERRED",
  },
  {
    phase: "V2",
    layerId: "L6-V2",
    feature: "운영 커뮤니케이션 전체 구현",
    description: "이슈 공유, 재발주 검토, 상태 전이 연결",
    dependencies: ["L6-V1a", "L6-V1b"],
    estimatedFiles: [
      "src/lib/compare-workspace/communication-engine.ts",
      "src/app/api/communications/[id]/route.ts",
    ],
    priority: 5,
    status: "DEFERRED",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 완료 기준 요약
// ══════════════════════════════════════════════════════════════════════════════

export const COMPLETION_CRITERIA = {
  designPhase: {
    description: "설계 문서 7종 완료",
    items: [
      "00-workspace-ia.ts — IA 구조 정의",
      "01-canonical-schema.ts — 정규화 스키마 정의",
      "02-ontology-draft.ts — 온톨로지 엔터티/관계 정의",
      "03-diff-output-spec.ts — 비교 엔진 출력 스펙",
      "04-ai-work-panel-contract.ts — AI 패널 계약",
      "05-operational-communication-contract.ts — 커뮤니케이션 계약 (P7-4)",
      "06-implementation-plan.ts — V1/V2 구현 계획",
    ],
    status: "COMPLETE" as const,
  },
  v1Phase: {
    description: "Core Operations에 필요한 최소 기능",
    criteria: [
      "문서 업로드 + 기본 정규화 작동",
      "제품 vs 제품 비교 structured diff 생성",
      "비교 → 견적 요청 CTA 연결",
      "공급사 문의 이메일 초안 생성",
      "검토/승인 요청 기능 작동",
    ],
    status: "PLANNED" as const,
  },
  v2Phase: {
    description: "전체 비교/온톨로지/AI 패널 확장",
    criteria: [
      "SDS/COA/프로토콜 파싱 지원",
      "온톨로지 entity resolution 작동",
      "AI 작업 패널 citation 기반 출력",
      "다양한 비교 유형 지원",
      "운영 커뮤니케이션 ↔ 상태 전이 연결",
    ],
    status: "DEFERRED" as const,
  },
} as const;
