/**
 * @module data-residency-manager
 * @description 데이터 레지던시 매니저 — 관할권별 데이터 저장 위치 규칙 정의 및 컴플라이언스 검증
 */

/** 데이터 레지던시 규칙 */
export interface ResidencyRule {
  /** 규칙 고유 ID */
  id: string;
  /** 관할권 ID */
  jurisdictionId: string;
  /** 데이터 분류 (예: PII, FINANCIAL, HEALTH) */
  dataCategory: string;
  /** 허용된 리전 목록 */
  allowedRegions: string[];
  /** 차단된 리전 목록 */
  blockedRegions: string[];
  /** 암호화 필수 여부 */
  encryptionRequired: boolean;
}

/** 데이터 위치 정보 */
export interface DataLocation {
  /** 데이터 고유 ID */
  dataId: string;
  /** 현재 저장 리전 */
  currentRegion: string;
  /** 데이터 분류 */
  category: string;
  /** 암호화 여부 */
  encrypted: boolean;
  /** 마지막 검증 시각 */
  lastVerifiedAt: Date;
}

/** 레지던시 위반 정보 */
export interface ResidencyViolation {
  dataId: string;
  ruleId: string;
  violation: string;
  detectedAt: Date;
}

/** 레지던시 보고서 */
export interface ResidencyReport {
  totalLocations: number;
  compliantCount: number;
  violationCount: number;
  violations: ResidencyViolation[];
  generatedAt: Date;
}

/** 인메모리 규칙 저장소 */
const ruleStore: ResidencyRule[] = [];

/** 인메모리 데이터 위치 저장소 */
const locationStore: DataLocation[] = [];

/**
 * 데이터 레지던시 규칙을 정의한다.
 * @param rule 규칙 정보
 * @returns 저장된 규칙
 */
export function defineResidencyRule(rule: ResidencyRule): ResidencyRule {
  const idx = ruleStore.findIndex((r) => r.id === rule.id);
  if (idx !== -1) {
    ruleStore[idx] = rule;
  } else {
    ruleStore.push(rule);
  }
  return rule;
}

/**
 * 데이터 위치가 레지던시 규칙을 준수하는지 검사한다.
 * @param location 데이터 위치 정보
 * @param jurisdictionId 관할권 ID
 * @returns 준수 여부와 위반 목록
 */
export function checkResidencyCompliance(
  location: DataLocation,
  jurisdictionId: string,
): { compliant: boolean; violations: ResidencyViolation[] } {
  const applicableRules = ruleStore.filter(
    (r) => r.jurisdictionId === jurisdictionId && r.dataCategory === location.category,
  );

  const violations: ResidencyViolation[] = [];

  for (const rule of applicableRules) {
    if (rule.allowedRegions.length > 0 && !rule.allowedRegions.includes(location.currentRegion)) {
      violations.push({
        dataId: location.dataId,
        ruleId: rule.id,
        violation: `리전 ${location.currentRegion}은(는) 허용 목록에 없습니다`,
        detectedAt: new Date(),
      });
    }

    if (rule.blockedRegions.includes(location.currentRegion)) {
      violations.push({
        dataId: location.dataId,
        ruleId: rule.id,
        violation: `리전 ${location.currentRegion}은(는) 차단 목록에 포함되어 있습니다`,
        detectedAt: new Date(),
      });
    }

    if (rule.encryptionRequired && !location.encrypted) {
      violations.push({
        dataId: location.dataId,
        ruleId: rule.id,
        violation: '암호화가 필수이나 데이터가 암호화되지 않았습니다',
        detectedAt: new Date(),
      });
    }
  }

  return { compliant: violations.length === 0, violations };
}

/**
 * 모든 데이터 위치에서 레지던시 위반 사항을 반환한다.
 * @param jurisdictionId 관할권 ID
 * @returns 위반 목록
 */
export function getViolations(jurisdictionId: string): ResidencyViolation[] {
  const allViolations: ResidencyViolation[] = [];
  for (const loc of locationStore) {
    const result = checkResidencyCompliance(loc, jurisdictionId);
    allViolations.push(...result.violations);
  }
  return allViolations;
}

/**
 * 데이터를 다른 리전으로 마이그레이션(위치 업데이트)한다.
 * @param dataId 데이터 ID
 * @param targetRegion 대상 리전
 * @returns 업데이트된 위치 정보 또는 undefined
 */
export function migrateData(dataId: string, targetRegion: string): DataLocation | undefined {
  const loc = locationStore.find((l) => l.dataId === dataId);
  if (!loc) return undefined;
  loc.currentRegion = targetRegion;
  loc.lastVerifiedAt = new Date();
  return { ...loc };
}

/**
 * 레지던시 보고서를 생성한다.
 * @param jurisdictionId 관할권 ID
 * @returns 레지던시 보고서
 */
export function getResidencyReport(jurisdictionId: string): ResidencyReport {
  const violations = getViolations(jurisdictionId);
  const violatedDataIds = new Set(violations.map((v) => v.dataId));

  return {
    totalLocations: locationStore.length,
    compliantCount: locationStore.length - violatedDataIds.size,
    violationCount: violatedDataIds.size,
    violations,
    generatedAt: new Date(),
  };
}
