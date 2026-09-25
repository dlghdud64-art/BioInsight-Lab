/**
 * feature-flags.ts
 *
 * Feature flag 관리 — 계약 작업 격리 + 점진적 재도입 제어.
 *
 * 규칙:
 * - 기본값은 항상 false (baseline 안전 모드)
 * - 계약 기능은 flag가 true일 때만 활성화
 * - preview route에서만 flag를 override
 * - 기본 /app/dashboard route에서는 flag 기본값(false) 유지
 *
 * @module feature-flags
 */

// ===========================================================================
// 1. Flag Definitions
// ===========================================================================

export interface FeatureFlags {
  /** 계약형 대시보드 전체 교체 (Today Operating Hub) */
  ENABLE_CONTRACT_DASHBOARD: boolean;
  /** 계약형 shell / sidebar / navigation */
  ENABLE_CONTRACT_SHELL: boolean;
  /** Today Hub compact strip (dashboard 상단 위젯) */
  ENABLE_TODAY_HUB_STRIP: boolean;
  /** 계약형 module landing surfaces */
  ENABLE_CONTRACT_MODULE_LANDING: boolean;
  /** 계약형 execution console (detail shells) */
  ENABLE_CONTRACT_EXECUTION_CONSOLE: boolean;
  /** Inbox orchestration (contract-era work queue) */
  ENABLE_CONTRACT_INBOX: boolean;
  /** Sourcing flow strip */
  ENABLE_SOURCING_FLOW_STRIP: boolean;
  /* 🛑 은퇴 §purchasing-flag-retired (2026-09-25 · 호영님 판정) — ENABLE_PURCHASING.
   *   §purchasing-hide(2026-06-23)가 「진입점 숨김(hide, not delete)」 으로 도입한 플래그다.
   *   그 뒤 발주 표면이 **차례로 삭제**됐다(§po-ui-removed · §purchases-ui-removed ·
   *   §order-entry-removed · §admin-order-create-removed · §funnel-s5-removed).
   *   숨길 대상이 0 이 되자 플래그의 on 가지는 **켜면 404 로 가는 코드**가 됐다 —
   *   보존이 아니라 잔재였다. 소비자 4곳(파이프라인 단계·재무 KPI·재고 바로 발주·대시보드 라벨)의
   *   on 가지를 지우고 플래그를 뺀다.
   *   🔑 API·DB 는 그대로다. 되살리는 절차는 docs/plans/QUEUE_concierge-purchasing.md 에 있다. */
}

// ===========================================================================
// 2. Defaults (baseline safe mode)
// ===========================================================================

export const DEFAULT_FLAGS: FeatureFlags = {
  ENABLE_CONTRACT_DASHBOARD: false,
  ENABLE_CONTRACT_SHELL: false,
  ENABLE_TODAY_HUB_STRIP: false,
  ENABLE_CONTRACT_MODULE_LANDING: false,
  ENABLE_CONTRACT_EXECUTION_CONSOLE: false,
  ENABLE_CONTRACT_INBOX: false,
  ENABLE_SOURCING_FLOW_STRIP: false,
};

// ===========================================================================
// 3. Preview Override (contract preview route에서만 사용)
// ===========================================================================

export const PREVIEW_FLAGS: FeatureFlags = {
  ENABLE_CONTRACT_DASHBOARD: true,
  ENABLE_CONTRACT_SHELL: true,
  ENABLE_TODAY_HUB_STRIP: true,
  ENABLE_CONTRACT_MODULE_LANDING: true,
  ENABLE_CONTRACT_EXECUTION_CONSOLE: true,
  ENABLE_CONTRACT_INBOX: true,
  ENABLE_SOURCING_FLOW_STRIP: true,
};

// ===========================================================================
// 4. Runtime Flag Resolution
// ===========================================================================

let _overrides: Partial<FeatureFlags> = {};

/** preview route에서 flag override 설정 */
export function setFlagOverrides(overrides: Partial<FeatureFlags>): void {
  _overrides = { ...overrides };
}

/** flag override 초기화 (baseline 복귀) */
export function resetFlagOverrides(): void {
  _overrides = {};
}

/** flag 값 조회 */
export function getFlag<K extends keyof FeatureFlags>(key: K): boolean {
  return _overrides[key] ?? DEFAULT_FLAGS[key];
}

/** 전체 flag 스냅샷 */
export function getAllFlags(): FeatureFlags {
  return { ...DEFAULT_FLAGS, ..._overrides };
}

// ===========================================================================
// 5. Env-based Override (빌드 타임)
// ===========================================================================

/**
 * 환경변수 기반 flag 로드.
 * NEXT_PUBLIC_FF_CONTRACT_DASHBOARD=true 형태로 사용.
 */
export function loadEnvFlags(): Partial<FeatureFlags> {
  const env: Partial<FeatureFlags> = {};
  if (process.env.NEXT_PUBLIC_FF_CONTRACT_DASHBOARD === 'true') {
    env.ENABLE_CONTRACT_DASHBOARD = true;
  }
  if (process.env.NEXT_PUBLIC_FF_CONTRACT_SHELL === 'true') {
    env.ENABLE_CONTRACT_SHELL = true;
  }
  if (process.env.NEXT_PUBLIC_FF_TODAY_HUB_STRIP === 'true') {
    env.ENABLE_TODAY_HUB_STRIP = true;
  }
  return env;
}
