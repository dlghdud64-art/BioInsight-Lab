/**
 * @module regulatory-control-matrix
 * @description 규제 통제 매트릭스 — 조직의 규제 통제 항목을 등록·관리하고 프레임워크별 갭 분석을 수행하는 엔진
 */

/** 통제 카테고리 */
export type ControlCategory = 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'COMPENSATING';

/** 통제 구현 상태 */
export type ControlStatus = 'IMPLEMENTED' | 'PARTIALLY_IMPLEMENTED' | 'PLANNED' | 'NOT_APPLICABLE';

/** 통제 증거 */
export interface ControlEvidence {
  /** 증거 ID */
  evidenceId: string;
  /** 증거 설명 */
  description: string;
  /** 수집 일시 */
  collectedAt: Date;
}

/** 규제 통제 항목 */
export interface RegulatoryControl {
  /** 통제 ID */
  controlId: string;
  /** 통제 카테고리 */
  category: ControlCategory;
  /** 통제 제목 */
  title: string;
  /** 통제 설명 */
  description: string;
  /** 구현 상태 */
  status: ControlStatus;
  /** 책임자 */
  owner: string;
  /** 연관 프레임워크 목록 */
  framework: string[];
  /** 마지막 테스트 일시 */
  lastTestedAt: Date | null;
  /** 증거 목록 */
  evidence: ControlEvidence[];
}

/** 갭 분석 결과 */
export interface ControlGapAnalysis {
  /** 총 통제 수 */
  totalControls: number;
  /** 구현 완료 수 */
  implemented: number;
  /** 부분 구현 수 */
  partiallyImplemented: number;
  /** 계획 중 수 */
  planned: number;
  /** 해당 없음 수 */
  notApplicable: number;
  /** 구현율 (%) */
  coveragePercent: number;
  /** 미구현 통제 목록 */
  gaps: RegulatoryControl[];
}

/** 인메모리 통제 저장소 */
const controlStore: RegulatoryControl[] = [];

/**
 * 새로운 규제 통제 항목을 등록한다.
 * @param control 등록할 통제 항목
 * @returns 등록된 통제 항목
 */
export function registerControl(control: RegulatoryControl): RegulatoryControl {
  const existing = controlStore.findIndex((c) => c.controlId === control.controlId);
  if (existing !== -1) {
    controlStore[existing] = control;
  } else {
    controlStore.push(control);
  }
  return control;
}

/**
 * 통제 항목의 상태를 갱신한다.
 * @param controlId 통제 ID
 * @param status 새로운 상태
 * @returns 갱신된 통제 항목 또는 null
 */
export function updateControlStatus(controlId: string, status: ControlStatus): RegulatoryControl | null {
  const control = controlStore.find((c) => c.controlId === controlId);
  if (!control) return null;
  control.status = status;
  return control;
}

/**
 * 특정 프레임워크에 해당하는 통제 항목 목록을 반환한다.
 * @param framework 프레임워크 이름
 * @returns 해당 프레임워크의 통제 항목 배열
 */
export function getControlsByFramework(framework: string): RegulatoryControl[] {
  return controlStore.filter((c) => c.framework.includes(framework));
}

/**
 * 전체 또는 특정 프레임워크에 대한 갭 분석을 수행한다.
 * @param framework 프레임워크 이름 (선택, 미지정 시 전체)
 * @returns 갭 분석 결과
 */
export function getControlGapAnalysis(framework?: string): ControlGapAnalysis {
  const controls = framework ? getControlsByFramework(framework) : [...controlStore];
  const implemented = controls.filter((c) => c.status === 'IMPLEMENTED').length;
  const partiallyImplemented = controls.filter((c) => c.status === 'PARTIALLY_IMPLEMENTED').length;
  const planned = controls.filter((c) => c.status === 'PLANNED').length;
  const notApplicable = controls.filter((c) => c.status === 'NOT_APPLICABLE').length;
  const applicable = controls.length - notApplicable;
  const coveragePercent = applicable > 0 ? Math.round((implemented / applicable) * 100) : 0;
  const gaps = controls.filter((c) => c.status !== 'IMPLEMENTED' && c.status !== 'NOT_APPLICABLE');

  return {
    totalControls: controls.length,
    implemented,
    partiallyImplemented,
    planned,
    notApplicable,
    coveragePercent,
    gaps,
  };
}
