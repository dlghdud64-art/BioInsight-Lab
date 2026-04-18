/**
 * Compare & Decision Workspace — Information Architecture
 *
 * Track B 설계 문서 #1
 *
 * LabAxis의 의사결정 워크스페이스 전체 구조를 정의한다.
 * 문서/제품 비교 → 해석 → 검토/승인/문의 → 구매/재고 액션으로 이어지는
 * 전체 정보 흐름과 레이어 분리를 명시한다.
 *
 * ┌─────────────────────────────────────────────────────┐
 * │                   Track A (구현 완료)                 │
 * │  P7-1 상태선 · P7-2 CTA · P7-3 큐 · 운영 루프        │
 * └──────────────────────┬──────────────────────────────┘
 *                        │ feeds into
 * ┌──────────────────────▼──────────────────────────────┐
 * │              Track B (설계 문서 — 후순위 구현)         │
 * │                                                      │
 * │  L1  문서 수집          ← upload / link / version    │
 * │  L2  정규화             ← raw → canonical fields    │
 * │  L3  비교 엔진          ← structured diff            │
 * │  L4  온톨로지 매핑       ← entity resolution         │
 * │  L5  AI 작업 패널       ← summary + action hints    │
 * │  L6  운영 커뮤니케이션   ← review / inquiry / share  │
 * │       (P7-4)                                         │
 * └─────────────────────────────────────────────────────┘
 *
 * 선후 관계:
 *   Track A 운영 루프 잠금 → Track B V1 구현 → Track B V2 확장
 *   예외: A 트랙에 직접 필요한 최소 컴포넌트는 선반영 가능
 */

// ══════════════════════════════════════════════════════════════════════════════
// 워크스페이스 레이어 정의
// ══════════════════════════════════════════════════════════════════════════════

export type WorkspaceLayer =
  | "DOCUMENT_INGESTION"        // L1: 문서 수집
  | "NORMALIZATION"             // L2: 정규화
  | "DIFF_ENGINE"               // L3: 비교 엔진
  | "ONTOLOGY_MAPPING"          // L4: 온톨로지 매핑
  | "AI_WORK_PANEL"             // L5: AI 작업 패널
  | "OPERATIONAL_COMMUNICATION"; // L6: 운영 커뮤니케이션 (P7-4)

export interface LayerDefinition {
  layer: WorkspaceLayer;
  label: string;
  description: string;
  inputs: string[];
  outputs: string[];
  dependencies: WorkspaceLayer[];
  specFile: string;
}

export const WORKSPACE_LAYERS: LayerDefinition[] = [
  {
    layer: "DOCUMENT_INGESTION",
    label: "문서 수집",
    description: "제품 카탈로그, 견적서, SDS/MSDS, COA, 프로토콜, 입고/구매 문서의 업로드·연결·버전 관리",
    inputs: ["uploaded files", "linked URLs", "email attachments"],
    outputs: ["DocumentRecord with provenance"],
    dependencies: [],
    specFile: "01-canonical-schema.ts",
  },
  {
    layer: "NORMALIZATION",
    label: "정규화",
    description: "원본 문서 표현을 canonical schema로 변환. raw source와 normalized field 연결 유지",
    inputs: ["DocumentRecord"],
    outputs: ["NormalizedEntity with confidence + provenance"],
    dependencies: ["DOCUMENT_INGESTION"],
    specFile: "01-canonical-schema.ts",
  },
  {
    layer: "DIFF_ENGINE",
    label: "비교 엔진",
    description: "두 문서/제품/견적/스펙 간 차이를 구조적으로 추출. raw diff + structured diff + significance",
    inputs: ["NormalizedEntity[]"],
    outputs: ["DiffResult with significance + actionability"],
    dependencies: ["NORMALIZATION"],
    specFile: "03-diff-output-spec.ts",
  },
  {
    layer: "ONTOLOGY_MAPPING",
    label: "온톨로지 매핑",
    description: "표기가 달라도 같은 엔터티인지, 대체 가능성이 있는지 해석",
    inputs: ["NormalizedEntity[]", "DiffResult"],
    outputs: ["EntityResolution with relationship type"],
    dependencies: ["NORMALIZATION"],
    specFile: "02-ontology-draft.ts",
  },
  {
    layer: "AI_WORK_PANEL",
    label: "AI 작업 패널",
    description: "비교 결과와 문서 맥락을 사람이 빠르게 판단할 수 있게 정리. source citation 필수",
    inputs: ["DiffResult", "EntityResolution", "NormalizedEntity[]"],
    outputs: ["WorkPanelView with actions + citations"],
    dependencies: ["DIFF_ENGINE", "ONTOLOGY_MAPPING"],
    specFile: "04-ai-work-panel-contract.ts",
  },
  {
    layer: "OPERATIONAL_COMMUNICATION",
    label: "운영 커뮤니케이션 (P7-4)",
    description: "비교/견적/구매/입고/재고 맥락에서 검토·승인·문의·이슈 공유를 바로 실행",
    inputs: ["WorkPanelView", "entity context", "user decision"],
    outputs: ["CommunicationRecord with state + activity log"],
    dependencies: ["AI_WORK_PANEL"],
    specFile: "05-operational-communication-contract.ts",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Track A ↔ Track B 인터페이스 포인트
// ══════════════════════════════════════════════════════════════════════════════

export const TRACK_A_B_INTERFACES = [
  {
    interfaceId: "IF-1",
    description: "비교 결과 → 견적 요청 CTA",
    trackA: "CTA-S2 (REQUEST_QUOTE from search)",
    trackB: "L3 DiffEngine → 최적 제품 선택 후 견적 CTA",
    v1Scope: true,
  },
  {
    interfaceId: "IF-2",
    description: "공급사 문의 → 이메일 초안",
    trackA: "EMAIL_DRAFT_GENERATED activity log",
    trackB: "L6 OperationalCommunication → vendor inquiry draft",
    v1Scope: true,
  },
  {
    interfaceId: "IF-3",
    description: "활동 로그 연결",
    trackA: "logStateTransition / logCTAExecution",
    trackB: "L6 CommunicationRecord → activity log",
    v1Scope: true,
  },
  {
    interfaceId: "IF-4",
    description: "온톨로지 → 제품 대체 관계",
    trackA: "Product search / compare",
    trackB: "L4 substitute_for / variant_of 관계",
    v1Scope: false,
  },
  {
    interfaceId: "IF-5",
    description: "AI 패널 → 구매 승인 맥락",
    trackA: "CTA-P2 (APPROVE_PURCHASE)",
    trackB: "L5 WorkPanel → 비교 근거 + 추천 첨부",
    v1Scope: false,
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 대상 문서 유형
// ══════════════════════════════════════════════════════════════════════════════

export type DocumentCategory =
  | "PRODUCT_CATALOG"
  | "VENDOR_QUOTE"
  | "SDS_MSDS"
  | "COA"
  | "PROTOCOL"
  | "RECEIVING_DOCUMENT"
  | "PURCHASE_DOCUMENT";

export const DOCUMENT_CATEGORIES: Record<DocumentCategory, string> = {
  PRODUCT_CATALOG: "제품 카탈로그",
  VENDOR_QUOTE: "공급사 견적서",
  SDS_MSDS: "SDS / MSDS",
  COA: "분석 성적서 (COA)",
  PROTOCOL: "실험 프로토콜",
  RECEIVING_DOCUMENT: "입고 관련 문서",
  PURCHASE_DOCUMENT: "구매 관련 문서",
};
