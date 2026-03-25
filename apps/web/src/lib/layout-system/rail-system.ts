/**
 * rail-system.ts
 *
 * 공통 Rail 시스템 정의.
 *
 * 우측 rail은 장식용 정보 패널이 아니라 실제 작업 보조면이다.
 * 견적 운영 큐와 재고 관리에서 잘 작동한 패턴을 공통화한다.
 *
 * @module layout-system/rail-system
 */

// ===========================================================================
// 1. Rail Role 정의
// ===========================================================================

export type RailRole =
  | 'detail'
  | 'action'
  | 'risk_blocker'
  | 'linked_context';

export interface RailDefinition {
  role: RailRole;
  label: string;
  description: string;
  /** rail 내부 필수 영역 */
  requiredZones: RailZone[];
  /** 적합한 work mode */
  applicableModes: import('./work-mode-taxonomy').WorkMode[];
  /** 최소 너비 (px) */
  minWidth: number;
  /** 닫기 가능 */
  collapsible: boolean;
}

export type RailZone =
  | 'entity_header'
  | 'status_summary'
  | 'key_fields'
  | 'action_buttons'
  | 'blocker_list'
  | 'risk_indicators'
  | 'linked_entities'
  | 'timeline_mini'
  | 'owner_info'
  | 'next_action_hint';

// ===========================================================================
// 2. 4가지 Rail 정의
// ===========================================================================

export const RAIL_DEFINITIONS: Record<RailRole, RailDefinition> = {

  // -------------------------------------------------------------------------
  // A. Detail Rail — 선택 항목 상세 정보
  // -------------------------------------------------------------------------
  detail: {
    role: 'detail',
    label: 'Detail Rail',
    description: '큐/테이블에서 선택한 항목의 핵심 정보를 우측에 표시',
    requiredZones: [
      'entity_header',
      'status_summary',
      'key_fields',
      'owner_info',
    ],
    applicableModes: ['queue_workbench', 'split_ops'],
    minWidth: 320,
    collapsible: true,
  },

  // -------------------------------------------------------------------------
  // B. Action Rail — 즉시 실행 가능한 액션 집합
  // -------------------------------------------------------------------------
  action: {
    role: 'action',
    label: 'Action Rail',
    description: '선택 항목에 대한 즉시 실행 가능 액션 + 다음 단계 안내',
    requiredZones: [
      'action_buttons',
      'next_action_hint',
    ],
    applicableModes: ['queue_workbench', 'split_ops'],
    minWidth: 280,
    collapsible: true,
  },

  // -------------------------------------------------------------------------
  // C. Risk / Blocker Rail — 차단 요소 + 리스크 표시
  // -------------------------------------------------------------------------
  risk_blocker: {
    role: 'risk_blocker',
    label: 'Risk / Blocker Rail',
    description: '현재 항목의 차단 요소, SLA 리스크, 에스컬레이션 필요 사항',
    requiredZones: [
      'blocker_list',
      'risk_indicators',
    ],
    applicableModes: ['queue_workbench', 'split_ops'],
    minWidth: 280,
    collapsible: true,
  },

  // -------------------------------------------------------------------------
  // D. Linked Context Rail — 연결된 upstream/downstream 엔티티
  // -------------------------------------------------------------------------
  linked_context: {
    role: 'linked_context',
    label: 'Linked Context Rail',
    description: '현재 항목과 연결된 상위/하위 엔티티 요약 + 이동 링크',
    requiredZones: [
      'linked_entities',
      'timeline_mini',
    ],
    applicableModes: ['queue_workbench', 'split_ops', 'analysis_console'],
    minWidth: 300,
    collapsible: true,
  },
};

// ===========================================================================
// 3. Rail Composition — Work Mode별 기본 rail 조합
// ===========================================================================

export interface RailComposition {
  /** primary rail (항상 표시) */
  primary: RailRole;
  /** secondary rail (토글 또는 탭으로 전환) */
  secondary?: RailRole;
  /** 추가 rail (하단 또는 접힘) */
  tertiary?: RailRole;
}

export const DEFAULT_RAIL_COMPOSITION: Record<string, RailComposition> = {
  queue_workbench: {
    primary: 'detail',
    secondary: 'action',
    tertiary: 'risk_blocker',
  },
  split_ops: {
    primary: 'detail',
    secondary: 'action',
    tertiary: 'linked_context',
  },
};

// ===========================================================================
// 4. Rail State
// ===========================================================================

export interface RailState {
  /** 현재 열려 있는 rail */
  activeRail: RailRole | null;
  /** 선택된 entity id */
  selectedEntityId: string | null;
  /** rail 접힘 상태 */
  collapsed: boolean;
  /** rail 너비 (사용자 조정) */
  width: number;
}

export const INITIAL_RAIL_STATE: RailState = {
  activeRail: null,
  selectedEntityId: null,
  collapsed: false,
  width: 360,
};
