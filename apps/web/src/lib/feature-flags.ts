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
  /**
   * §purchasing-hide (호영님 P1 2026-06-23) — 발주/구매 라이브 표면 노출.
   * 기본 false = 진입점 숨김(hide, not delete). 도메인(구매담당자 ≠ 직접구매자)
   * 미정의 stage 가 거짓 흐름을 보이지 않도록 차단. DB/orders/procurement/API 라우트는
   * 존치. 되살리기: false→true flip 또는 NEXT_PUBLIC_FF_PURCHASING="true".
   */
  ENABLE_PURCHASING: boolean;
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
  // §purchasing-hide — 발주/구매 표면 기본 숨김.
  ENABLE_PURCHASING: false,
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
  // §purchasing-hide — preview route 에서도 발주/구매는 숨김 유지(계약 preview 와 무관).
  //   되살리기는 DEFAULT flip 또는 env override 로만.
  ENABLE_PURCHASING: false,
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
  // §purchasing-hide — 발주/구매 표면 되살리기 env override.
  if (process.env.NEXT_PUBLIC_FF_PURCHASING === 'true') {
    env.ENABLE_PURCHASING = true;
  }
  return env;
}
