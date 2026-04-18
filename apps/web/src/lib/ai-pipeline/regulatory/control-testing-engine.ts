/**
 * @module control-testing-engine
 * @description 통제 테스트 엔진 — 규제 통제 항목에 대한 자동/수동/하이브리드 테스트 실행, 스케줄링 및 이력 관리
 */

/** 테스트 유형 */
export type TestType = 'AUTOMATED' | 'MANUAL' | 'HYBRID';

/** 테스트 결과 */
export type TestResult = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_TESTED';

/** 테스트 발견 사항 */
export interface TestFinding {
  /** 발견 사항 설명 */
  description: string;
  /** 심각도 */
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  /** 권고사항 */
  recommendation: string;
}

/** 통제 테스트 */
export interface ControlTest {
  /** 테스트 ID */
  id: string;
  /** 통제 ID */
  controlId: string;
  /** 테스트 유형 */
  testType: TestType;
  /** 테스트 결과 */
  result: TestResult;
  /** 테스트 일시 */
  testedAt: Date;
  /** 테스트 수행자 */
  testedBy: string;
  /** 발견 사항 목록 */
  findings: TestFinding[];
  /** 다음 테스트 예정일 */
  nextTestDue: Date;
}

/** 인메모리 테스트 저장소 */
const testStore: ControlTest[] = [];

/**
 * 통제 테스트를 실행(기록)한다.
 * @param test 테스트 정보
 * @returns 기록된 테스트
 */
export function executeTest(test: ControlTest): ControlTest {
  testStore.push(test);
  return test;
}

/**
 * 다음 테스트를 스케줄링한다 (기존 테스트의 nextTestDue 갱신).
 * @param controlId 통제 ID
 * @param nextTestDue 다음 테스트 예정일
 * @returns 갱신된 최신 테스트 또는 null
 */
export function scheduleTest(controlId: string, nextTestDue: Date): ControlTest | null {
  const tests = testStore
    .filter((t) => t.controlId === controlId)
    .sort((a, b) => b.testedAt.getTime() - a.testedAt.getTime());

  if (tests.length === 0) return null;
  tests[0].nextTestDue = nextTestDue;
  return tests[0];
}

/**
 * 특정 통제의 테스트 이력을 반환한다.
 * @param controlId 통제 ID
 * @returns 테스트 이력 배열 (최신순)
 */
export function getTestHistory(controlId: string): ControlTest[] {
  return testStore
    .filter((t) => t.controlId === controlId)
    .sort((a, b) => b.testedAt.getTime() - a.testedAt.getTime());
}

/**
 * 테스트 기한이 초과된 통제 목록을 반환한다.
 * @param referenceDate 기준 일시 (기본: 현재)
 * @returns 기한 초과 테스트 배열
 */
export function getOverdueTests(referenceDate?: Date): ControlTest[] {
  const now = referenceDate ?? new Date();

  // 각 통제별 최신 테스트만 확인
  const latestByControl = new Map<string, ControlTest>();
  for (const test of testStore) {
    const existing = latestByControl.get(test.controlId);
    if (!existing || test.testedAt.getTime() > existing.testedAt.getTime()) {
      latestByControl.set(test.controlId, test);
    }
  }

  return Array.from(latestByControl.values()).filter((t) => t.nextTestDue < now);
}
