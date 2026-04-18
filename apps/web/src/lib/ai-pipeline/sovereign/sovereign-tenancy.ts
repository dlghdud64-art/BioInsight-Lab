/**
 * @module sovereign-tenancy
 * @description 주권 테넌시 관리 — 테넌트별 데이터 주권 격리 수준 및 컴플라이언스 프로파일 관리
 */

/** 격리 수준 */
export type IsolationLevel = 'FULL_ISOLATION' | 'LOGICAL_SEPARATION' | 'SHARED_WITH_ENCRYPTION';

/** 주권 테넌트 프로파일 */
export interface SovereignTenant {
  /** 테넌트 고유 ID */
  tenantId: string;
  /** 소속 관할권 ID */
  jurisdictionId: string;
  /** 데이터 저장 리전 */
  dataRegion: string;
  /** 격리 수준 */
  isolationLevel: IsolationLevel;
  /** 컴플라이언스 프로파일 이름 */
  complianceProfile: string;
  /** 제한 사항 목록 */
  restrictions: string[];
}

/** 테넌트 컴플라이언스 검증 결과 */
export interface TenantComplianceResult {
  tenantId: string;
  compliant: boolean;
  violations: string[];
  checkedAt: Date;
}

/** 인메모리 테넌트 저장소 */
const tenantStore: SovereignTenant[] = [];

/**
 * 주권 테넌트를 등록한다.
 * @param tenant 등록할 테넌트 정보
 * @returns 등록된 테넌트
 */
export function registerTenant(tenant: SovereignTenant): SovereignTenant {
  const idx = tenantStore.findIndex((t) => t.tenantId === tenant.tenantId);
  if (idx !== -1) {
    tenantStore[idx] = tenant;
  } else {
    tenantStore.push(tenant);
  }
  return tenant;
}

/**
 * 테넌트 프로파일을 조회한다.
 * @param tenantId 테넌트 ID
 * @returns 테넌트 프로파일 또는 undefined
 */
export function getTenantProfile(tenantId: string): SovereignTenant | undefined {
  return tenantStore.find((t) => t.tenantId === tenantId);
}

/**
 * 테넌트의 격리 수준을 변경한다.
 * @param tenantId 테넌트 ID
 * @param newLevel 새 격리 수준
 * @returns 업데이트된 테넌트 또는 undefined
 */
export function updateIsolation(
  tenantId: string,
  newLevel: IsolationLevel,
): SovereignTenant | undefined {
  const tenant = tenantStore.find((t) => t.tenantId === tenantId);
  if (!tenant) return undefined;
  tenant.isolationLevel = newLevel;
  return { ...tenant };
}

/**
 * 테넌트 컴플라이언스를 검증한다.
 * @param tenantId 테넌트 ID
 * @returns 컴플라이언스 검증 결과
 */
export function validateTenantCompliance(tenantId: string): TenantComplianceResult {
  const tenant = tenantStore.find((t) => t.tenantId === tenantId);
  if (!tenant) {
    return {
      tenantId,
      compliant: false,
      violations: ['테넌트를 찾을 수 없습니다'],
      checkedAt: new Date(),
    };
  }

  const violations: string[] = [];

  if (tenant.isolationLevel === 'SHARED_WITH_ENCRYPTION' && !tenant.complianceProfile) {
    violations.push('공유 암호화 모드에서는 컴플라이언스 프로파일이 필수입니다');
  }

  if (!tenant.dataRegion) {
    violations.push('데이터 리전이 지정되지 않았습니다');
  }

  return {
    tenantId,
    compliant: violations.length === 0,
    violations,
    checkedAt: new Date(),
  };
}
