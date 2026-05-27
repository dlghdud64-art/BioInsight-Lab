/**
 * @module jurisdiction-registry
 * @description 관할권 레지스트리 — 글로벌 관할권 정보를 등록·조회·관리하는 순수 함수 모듈
 */

/** 관할권 유형 */
export type JurisdictionType = 'EU' | 'US' | 'APAC' | 'LATAM' | 'MEA' | 'CUSTOM';

/** 데이터 주권 수준 */
export type DataSovereigntyLevel = 'STRICT' | 'MODERATE' | 'FLEXIBLE';

/** 관할권 정보 */
export interface Jurisdiction {
  /** 관할권 고유 식별자 */
  id: string;
  /** 관할권 유형 */
  type: JurisdictionType;
  /** 관할권 이름 */
  name: string;
  /** 데이터 레지던시 요구 여부 */
  dataResidencyRequired: boolean;
  /** 데이터 주권 수준 */
  sovereigntyLevel: DataSovereigntyLevel;
  /** 적용 법률 목록 */
  applicableLaws: string[];
  /** 제한 사항 목록 */
  restrictions: string[];
  /** 활성화 일자 */
  activeSince: Date;
}

/** 인메모리 관할권 저장소 */
const jurisdictionStore: Jurisdiction[] = [];

/**
 * 관할권을 레지스트리에 등록한다.
 * @param jurisdiction 등록할 관할권 정보
 * @returns 등록된 관할권
 */
export function registerJurisdiction(jurisdiction: Jurisdiction): Jurisdiction {
  const existing = jurisdictionStore.findIndex((j) => j.id === jurisdiction.id);
  if (existing !== -1) {
    jurisdictionStore[existing] = jurisdiction;
  } else {
    jurisdictionStore.push(jurisdiction);
  }
  return jurisdiction;
}

/**
 * ID로 관할권을 조회한다.
 * @param id 관할권 ID
 * @returns 관할권 정보 또는 undefined
 */
export function getJurisdiction(id: string): Jurisdiction | undefined {
  return jurisdictionStore.find((j) => j.id === id);
}

/**
 * 현재 활성 상태인 관할권 목록을 반환한다.
 * @param asOf 기준 일자 (기본값: 현재)
 * @returns 활성 관할권 배열
 */
export function listActiveJurisdictions(asOf: Date = new Date()): Jurisdiction[] {
  return jurisdictionStore.filter((j) => j.activeSince <= asOf);
}

/**
 * 특정 관할권에 적용되는 법률 목록을 반환한다.
 * @param jurisdictionId 관할권 ID
 * @returns 적용 법률 배열 (관할권 미존재 시 빈 배열)
 */
export function getApplicableLaws(jurisdictionId: string): string[] {
  const j = jurisdictionStore.find((item) => item.id === jurisdictionId);
  return j ? [...j.applicableLaws] : [];
}
