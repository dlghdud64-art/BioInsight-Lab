/**
 * interaction-surfaces.ts
 *
 * Interaction Surface 3종 정의.
 *
 * Right Rail / Center Work Window / Full Detail Console의
 * 역할, 밀도, 허용 액션, 복귀 방식, refresh 규칙을 분리한다.
 *
 * 원칙:
 * - 작업이 페이지 전환 없이 더 빨리 끝난다
 * - 사용자가 "지금 이 목록 안에서 처리 중"이라는 감각을 유지한다
 * - 3종 surface가 서로 역할이 겹치지 않는다
 *
 * @module layout-system/interaction-surfaces
 */

// ===========================================================================
// 1. Surface Type
// ===========================================================================

export type InteractionSurface =
  | 'right_rail'
  | 'center_work_window'
  | 'full_detail_console';

// ===========================================================================
// 2. Surface Definition
// ===========================================================================

export interface SurfaceDefinition {
  surface: InteractionSurface;
  label: string;
  description: string;
  /** 정보 밀도 */
  density: 'compact' | 'focused' | 'full';
  /** 부모 큐 위에서 열리는가 (overlay) */
  overlay: boolean;
  /** 부모 큐 보이는가 */
  parentVisible: boolean;
  /** 허용 액션 복잡도 */
  allowedComplexity: 'inspect_only' | 'single_action' | 'focused_workflow' | 'deep_workflow';
  /** 닫았을 때 복귀 방식 */
  returnBehavior: ReturnBehavior;
  /** parent refresh 방식 */
  parentRefresh: ParentRefreshMode;
}

export type ReturnBehavior =
  | 'dismiss'              // rail/overlay 닫기 → 큐 그대로
  | 'close_to_parent'      // work window 닫기 → 큐 + filter/scroll 유지
  | 'navigate_back';       // full detail → 브라우저 back → 큐 복귀

export type ParentRefreshMode =
  | 'immediate_row'        // 해당 행만 즉시 갱신
  | 'immediate_queue'      // 큐 전체 갱신
  | 'deferred_on_return'   // 복귀 시 갱신
  | 'optimistic_then_confirm'; // optimistic → 서버 확인 후 반영

// ===========================================================================
// 3. 3종 Surface 정의
// ===========================================================================

export const SURFACE_DEFINITIONS: Record<InteractionSurface, SurfaceDefinition> = {

  // -------------------------------------------------------------------------
  // A. Right Rail — 큐 옆 빠른 확인/단순 액션
  // -------------------------------------------------------------------------
  right_rail: {
    surface: 'right_rail',
    label: 'Right Rail',
    description: '큐/테이블 옆에서 선택 항목을 빠르게 확인하고 단순 액션 실행',
    density: 'compact',
    overlay: false,
    parentVisible: true,
    allowedComplexity: 'single_action',
    returnBehavior: 'dismiss',
    parentRefresh: 'immediate_row',
  },

  // -------------------------------------------------------------------------
  // B. Center Work Window — 집중 작업 surface
  // -------------------------------------------------------------------------
  center_work_window: {
    surface: 'center_work_window',
    label: 'Center Work Window',
    description: '큐 위에서 열리는 집중 작업 화면. 검토/승인/발행 등 focused workflow 수행',
    density: 'focused',
    overlay: true,
    parentVisible: false,      // backdrop으로 가림
    allowedComplexity: 'focused_workflow',
    returnBehavior: 'close_to_parent',
    parentRefresh: 'optimistic_then_confirm',
  },

  // -------------------------------------------------------------------------
  // C. Full Detail Console — 전체 상세 페이지
  // -------------------------------------------------------------------------
  full_detail_console: {
    surface: 'full_detail_console',
    label: 'Full Detail Console',
    description: '전체 페이지로 이동하는 깊은 상세 화면. 복잡한 multi-step 작업 전용',
    density: 'full',
    overlay: false,
    parentVisible: false,
    allowedComplexity: 'deep_workflow',
    returnBehavior: 'navigate_back',
    parentRefresh: 'deferred_on_return',
  },
};

// ===========================================================================
// 4. Right Rail 적합/금지 규칙
// ===========================================================================

export const RIGHT_RAIL_RULES = {
  suitable: [
    'row quick inspect',
    'blocker/reason 확인',
    'owner/next action 확인',
    'linked entity preview',
    'low-risk single action (상태 변경, 담당자 지정)',
    'quick note/comment 추가',
  ] as const,
  forbidden: [
    '긴 multi-step form',
    '복잡한 비교/검토',
    'deep execution flow 전체',
    '대량 데이터 입력',
    '승인/반려 판단이 필요한 의사결정',
  ] as const,
};

// ===========================================================================
// 5. Center Work Window 적합/금지 규칙
// ===========================================================================

export const WORK_WINDOW_RULES = {
  suitable: [
    '공급사 비교 및 선택',
    '승인/반려/검토 판단',
    '발주 발행 전 최종 확인',
    '입고 검수/lot/문서 입력',
    '재주문 생성 전 review',
    '안전 조치 승인/처리',
    'partial posting 확인',
    'owner reassignment',
    'blocker resolve (단일)',
    'escalation 실행',
  ] as const,
  forbidden: [
    '단순 알림/확인 modal',
    '화면 전체를 복사한 상세 페이지',
    '깊은 설정/정책 관리',
    '감사 이력 전체 조회',
    'multi-entity 동시 편집',
  ] as const,
};

// ===========================================================================
// 6. Full Detail Console 적합 규칙
// ===========================================================================

export const FULL_DETAIL_RULES = {
  suitable: [
    '긴 문맥이 필요한 의사결정',
    'linked entity 다수 참조',
    'multi-step execution flow',
    'audit/history-heavy task',
    'deep analysis with charts',
    '복수 문서 첨부/관리',
    '정책/규칙 편집',
  ] as const,
};
