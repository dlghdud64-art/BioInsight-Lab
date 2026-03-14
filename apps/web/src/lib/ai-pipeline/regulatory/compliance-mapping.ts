/**
 * @module compliance-mapping
 * @description 컴플라이언스 매핑 엔진 — 규제 프레임워크 요구사항과 통제 항목 간 매핑, 커버리지 보고서 및 갭 식별
 */

/** 지원 프레임워크 */
export type Framework = 'SOC2' | 'ISO27001' | 'GDPR' | 'HIPAA' | 'SOX' | 'CUSTOM';

/** 매핑 갭 정보 */
export interface MappingGap {
  /** 요구사항 ID */
  requirementId: string;
  /** 갭 설명 */
  description: string;
  /** 심각도 */
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** 매핑 엔트리 — 프레임워크 요구사항과 통제 항목의 연결 */
export interface MappingEntry {
  /** 프레임워크 ID */
  frameworkId: Framework;
  /** 요구사항 ID */
  requirementId: string;
  /** 매핑된 통제 ID 목록 */
  controlIds: string[];
  /** 커버리지 비율 (%) */
  coveragePercent: number;
  /** 식별된 갭 목록 */
  gaps: MappingGap[];
}

/** 프레임워크 커버리지 보고서 */
export interface CoverageReport {
  /** 프레임워크 */
  framework: Framework;
  /** 총 요구사항 수 */
  totalRequirements: number;
  /** 완전 커버 요구사항 수 */
  fullyCovered: number;
  /** 부분 커버 요구사항 수 */
  partiallyCovered: number;
  /** 미커버 요구사항 수 */
  notCovered: number;
  /** 전체 커버리지 (%) */
  overallCoverage: number;
}

/** 프레임워크별 컴플라이언스 결과 */
export interface FrameworkCompliance {
  /** 프레임워크 */
  framework: Framework;
  /** 컴플라이언스 충족 여부 */
  compliant: boolean;
  /** 커버리지 (%) */
  coveragePercent: number;
  /** 미해결 갭 수 */
  openGaps: number;
  /** 매핑 엔트리 목록 */
  entries: MappingEntry[];
}

/** 인메모리 매핑 저장소 */
const mappingStore: MappingEntry[] = [];

/**
 * 요구사항을 통제 항목에 매핑한다.
 * @param entry 매핑 엔트리
 * @returns 저장된 매핑 엔트리
 */
export function mapRequirementToControls(entry: MappingEntry): MappingEntry {
  const idx = mappingStore.findIndex(
    (m) => m.frameworkId === entry.frameworkId && m.requirementId === entry.requirementId
  );
  if (idx !== -1) {
    mappingStore[idx] = entry;
  } else {
    mappingStore.push(entry);
  }
  return entry;
}

/**
 * 특정 프레임워크의 커버리지 보고서를 생성한다.
 * @param framework 프레임워크
 * @returns 커버리지 보고서
 */
export function getCoverageReport(framework: Framework): CoverageReport {
  const entries = mappingStore.filter((m) => m.frameworkId === framework);
  const fullyCovered = entries.filter((e) => e.coveragePercent >= 100).length;
  const partiallyCovered = entries.filter((e) => e.coveragePercent > 0 && e.coveragePercent < 100).length;
  const notCovered = entries.filter((e) => e.coveragePercent === 0).length;
  const total = entries.length;
  const overallCoverage = total > 0
    ? Math.round(entries.reduce((sum, e) => sum + e.coveragePercent, 0) / total)
    : 0;

  return {
    framework,
    totalRequirements: total,
    fullyCovered,
    partiallyCovered,
    notCovered,
    overallCoverage,
  };
}

/**
 * 특정 프레임워크의 갭을 식별한다.
 * @param framework 프레임워크
 * @returns 갭 목록
 */
export function identifyGaps(framework: Framework): MappingGap[] {
  return mappingStore
    .filter((m) => m.frameworkId === framework)
    .flatMap((m) => m.gaps);
}

/**
 * 특정 프레임워크의 전체 컴플라이언스 상태를 반환한다.
 * @param framework 프레임워크
 * @returns 프레임워크 컴플라이언스 결과
 */
export function getFrameworkCompliance(framework: Framework): FrameworkCompliance {
  const entries = mappingStore.filter((m) => m.frameworkId === framework);
  const report = getCoverageReport(framework);
  const gaps = identifyGaps(framework);

  return {
    framework,
    compliant: report.overallCoverage >= 100 && gaps.length === 0,
    coveragePercent: report.overallCoverage,
    openGaps: gaps.length,
    entries,
  };
}
