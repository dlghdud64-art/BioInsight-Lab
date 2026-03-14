/**
 * @module certification-packager
 * @description 인증 패키지 생성기 — SOC2 Type II, ISO27001 등 인증 심사를 위한 통합 패키지를 자동 구성하는 엔진
 */

/** 인증 유형 */
export type CertificationType = 'SOC2_TYPE2' | 'ISO27001' | 'CUSTOM_FRAMEWORK';

/** 인증 패키지 통제 요약 */
export interface PackageControlSummary {
  /** 통제 ID */
  controlId: string;
  /** 통제 제목 */
  title: string;
  /** 구현 상태 */
  status: string;
}

/** 인증 패키지 증거 참조 */
export interface PackageEvidenceRef {
  /** 증거 ID */
  evidenceId: string;
  /** 증거 형식 */
  format: string;
  /** 수집 일시 */
  collectedAt: Date;
}

/** 인증 패키지 테스트 요약 */
export interface PackageTestSummary {
  /** 테스트 ID */
  testId: string;
  /** 통제 ID */
  controlId: string;
  /** 결과 */
  result: string;
  /** 테스트 일시 */
  testedAt: Date;
}

/** 인증 패키지 예외 요약 */
export interface PackageExceptionSummary {
  /** 예외 ID */
  exceptionId: string;
  /** 심각도 */
  severity: string;
  /** 상태 */
  status: string;
}

/** 완전성 검증 결과 */
export interface PackageCompletenessResult {
  /** 완전 여부 */
  complete: boolean;
  /** 누락 항목 */
  missingItems: string[];
  /** 커버리지 (%) */
  coveragePercent: number;
}

/** 인증 패키지 */
export interface CertificationPackage {
  /** 패키지 ID */
  id: string;
  /** 인증 유형 */
  type: CertificationType;
  /** 감사 기간 */
  period: { start: Date; end: Date };
  /** 통제 요약 목록 */
  controls: PackageControlSummary[];
  /** 증거 참조 목록 */
  evidence: PackageEvidenceRef[];
  /** 테스트 요약 목록 */
  testResults: PackageTestSummary[];
  /** 예외 요약 목록 */
  exceptions: PackageExceptionSummary[];
  /** 생성 일시 */
  generatedAt: Date;
}

/** 인메모리 패키지 저장소 */
const packageStore: CertificationPackage[] = [];

/**
 * 인증 패키지를 생성한다.
 * @param params 패키지 구성 요소
 * @returns 생성된 인증 패키지
 */
export function generatePackage(params: Omit<CertificationPackage, 'generatedAt'>): CertificationPackage {
  const pkg: CertificationPackage = {
    ...params,
    generatedAt: new Date(),
  };
  packageStore.push(pkg);
  return pkg;
}

/**
 * 패키지의 완전성을 검증한다.
 * @param packageId 패키지 ID
 * @returns 완전성 검증 결과 또는 null
 */
export function validateCompleteness(packageId: string): PackageCompletenessResult | null {
  const pkg = packageStore.find((p) => p.id === packageId);
  if (!pkg) return null;

  const missingItems: string[] = [];

  if (pkg.controls.length === 0) missingItems.push('통제 항목이 없습니다.');
  if (pkg.evidence.length === 0) missingItems.push('증거가 없습니다.');
  if (pkg.testResults.length === 0) missingItems.push('테스트 결과가 없습니다.');

  // 통제별 증거 매핑 확인
  const controlsWithEvidence = new Set(pkg.testResults.map((t) => t.controlId));
  const controlsWithoutTest = pkg.controls.filter((c) => !controlsWithEvidence.has(c.controlId));
  if (controlsWithoutTest.length > 0) {
    missingItems.push(`테스트되지 않은 통제: ${controlsWithoutTest.map((c) => c.controlId).join(', ')}`);
  }

  const totalChecks = 3 + pkg.controls.length;
  const passedChecks = totalChecks - missingItems.length;
  const coveragePercent = Math.round((passedChecks / totalChecks) * 100);

  return {
    complete: missingItems.length === 0,
    missingItems,
    coveragePercent,
  };
}

/**
 * 패키지를 JSON 직렬화 가능한 형태로 내보낸다.
 * @param packageId 패키지 ID
 * @returns 내보낸 패키지 객체 또는 null
 */
export function exportPackage(packageId: string): Record<string, unknown> | null {
  const pkg = packageStore.find((p) => p.id === packageId);
  if (!pkg) return null;

  return {
    id: pkg.id,
    type: pkg.type,
    period: {
      start: pkg.period.start.toISOString(),
      end: pkg.period.end.toISOString(),
    },
    controls: pkg.controls,
    evidence: pkg.evidence.map((e) => ({
      ...e,
      collectedAt: e.collectedAt.toISOString(),
    })),
    testResults: pkg.testResults.map((t) => ({
      ...t,
      testedAt: t.testedAt.toISOString(),
    })),
    exceptions: pkg.exceptions,
    generatedAt: pkg.generatedAt.toISOString(),
  };
}

/**
 * 패키지 이력을 반환한다.
 * @param type 인증 유형 (선택, 미지정 시 전체)
 * @returns 패키지 배열 (최신순)
 */
export function getPackageHistory(type?: CertificationType): CertificationPackage[] {
  const pkgs = type ? packageStore.filter((p) => p.type === type) : [...packageStore];
  return pkgs.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
}
