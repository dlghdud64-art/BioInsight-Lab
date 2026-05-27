/**
 * @module structural-realignment-backlog
 * @description 구조적 재정렬 백로그 — Scenario 8 결과에서 발견된
 * 취약점과 갭을 체계적으로 추적하고 하드닝 이행 상태를 관리한다.
 */

// ─────────────────────────────────────────────
// 1. 백로그 항목 유형
// ─────────────────────────────────────────────

/** 백로그 우선순위 */
export type BacklogPriority =
  | "P0_CONSTITUTIONAL"     // 헌법적 결함 — 즉시 해결
  | "P1_STRUCTURAL"         // 구조적 갭 — 1주 내 해결
  | "P2_OPERATIONAL"        // 운영적 개선 — 1분기 내 해결
  | "P3_ENHANCEMENT";       // 강화 — 로드맵 반영

/** 백로그 상태 */
export type BacklogStatus =
  | "IDENTIFIED"
  | "ANALYSIS_IN_PROGRESS"
  | "FIX_PROPOSED"
  | "FIX_IN_REVIEW"
  | "FIX_APPLIED"
  | "VERIFIED_CLOSED";

/** 백로그 카테고리 */
export type BacklogCategory =
  | "CONTAINMENT_GAP"
  | "SCOPE_PRECISION"
  | "EVIDENCE_PATH"
  | "ROLE_BOUNDARY"
  | "BORDERLINE_PROTOCOL"
  | "CORE_INVARIANT"
  | "DEGRADED_MODE"
  | "DEADLOCK_HANDLING"
  | "PARTITION_RESILIENCE"
  | "REFOUNDATION_SIGNAL";

/** 백로그 항목 */
export interface BacklogItem {
  /** 항목 ID */
  itemId: string;
  /** 카테고리 */
  category: BacklogCategory;
  /** 우선순위 */
  priority: BacklogPriority;
  /** 상태 */
  status: BacklogStatus;
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 발견 시나리오 */
  discoveredInScenario: string;
  /** 영향 받는 모듈 */
  affectedModules: string[];
  /** 권장 조치 */
  recommendedAction: string;
  /** 생성 시각 */
  createdAt: Date;
  /** 마감 기한 */
  dueBy: Date | null;
  /** 해소 시각 */
  resolvedAt: Date | null;
  /** 해소자 */
  resolvedBy: string | null;
}

// ─────────────────────────────────────────────
// 2. 저장소 (production: DB-backed)
// ─────────────────────────────────────────────

const backlogStore: BacklogItem[] = [];

// ─────────────────────────────────────────────
// 3. 백로그 관리 함수
// ─────────────────────────────────────────────

/**
 * 백로그 항목을 등록한다.
 */
export function addBacklogItem(params: {
  category: BacklogCategory;
  priority: BacklogPriority;
  title: string;
  description: string;
  discoveredInScenario: string;
  affectedModules: string[];
  recommendedAction: string;
}): BacklogItem {
  const now = new Date();

  // 우선순위별 마감 기한
  const dueDays: Record<BacklogPriority, number | null> = {
    P0_CONSTITUTIONAL: 1,
    P1_STRUCTURAL: 7,
    P2_OPERATIONAL: 90,
    P3_ENHANCEMENT: null,
  };
  const days = dueDays[params.priority];
  const dueBy = days ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;

  const item: BacklogItem = {
    itemId: `BL-${Date.now()}-${backlogStore.length}`,
    ...params,
    status: "IDENTIFIED",
    createdAt: now,
    dueBy,
    resolvedAt: null,
    resolvedBy: null,
  };

  backlogStore.push(item);
  return item;
}

/**
 * 백로그 항목 상태를 갱신한다.
 */
export function updateBacklogStatus(
  itemId: string,
  status: BacklogStatus,
  resolvedBy?: string
): BacklogItem | null {
  const item = backlogStore.find((i) => i.itemId === itemId);
  if (!item) return null;

  item.status = status;
  if (status === "VERIFIED_CLOSED") {
    item.resolvedAt = new Date();
    item.resolvedBy = resolvedBy ?? "system";
  }
  return { ...item };
}

/**
 * Scenario 8 결과로부터 백로그를 자동 생성한다.
 */
export function generateBacklogFromScenario8(params: {
  vulnerabilities: string[];
  hardeningRecommendations: string[];
  roleMisalignmentCount: number;
  borderlineCaseCount: number;
  coreBypassDetected: boolean;
  failOpenDetected: boolean;
}): BacklogItem[] {
  const items: BacklogItem[] = [];

  // fail-open 감지 → P0
  if (params.failOpenDetected) {
    items.push(addBacklogItem({
      category: "CORE_INVARIANT",
      priority: "P0_CONSTITUTIONAL",
      title: "fail-open 경로 감지 — 즉시 차단 필요",
      description: "스트레스 테스트 중 fail-open 경로가 탐지됨. 헌법적 결함.",
      discoveredInScenario: "SCENARIO-8",
      affectedModules: ["constitutional-breach-simulation", "pre-execution-gate"],
      recommendedAction: "fail-open 경로를 제거하고 모든 타임아웃을 fail-close로 전환",
    }));
  }

  // core bypass → P0
  if (params.coreBypassDetected) {
    items.push(addBacklogItem({
      category: "CORE_INVARIANT",
      priority: "P0_CONSTITUTIONAL",
      title: "코어 불변량 bypass 감지",
      description: "degraded mode 또는 스트레스 상황에서 코어 bypass 가능성 탐지.",
      discoveredInScenario: "SCENARIO-8",
      affectedModules: ["degraded-mode-containment", "systemic-resilience-simulation"],
      recommendedAction: "코어 보호 경로를 인프라 독립 설계로 재검증",
    }));
  }

  // 역할 혼선 → P1
  if (params.roleMisalignmentCount > 0) {
    items.push(addBacklogItem({
      category: "ROLE_BOUNDARY",
      priority: "P1_STRUCTURAL",
      title: `역할 혼선 ${params.roleMisalignmentCount}건 탐지`,
      description: "스트레스 상황에서 역할 경계 침범이 감지됨.",
      discoveredInScenario: "SCENARIO-8",
      affectedModules: ["role-misalignment-detector"],
      recommendedAction: "역할 권한 격자 재검토 및 비상 권한 사용 임계치 조정",
    }));
  }

  // 경계선 판정 → P2
  if (params.borderlineCaseCount > 0) {
    items.push(addBacklogItem({
      category: "BORDERLINE_PROTOCOL",
      priority: "P2_OPERATIONAL",
      title: `경계선 케이스 ${params.borderlineCaseCount}건 — 판정 프로토콜 보완 필요`,
      description: "모호한 경계선 케이스가 다수 감지됨. 판정 기준 정밀화 필요.",
      discoveredInScenario: "SCENARIO-8",
      affectedModules: ["borderline-adjudication-protocol"],
      recommendedAction: "감지 규칙 정밀화 및 charter 문구 명확화 제안",
    }));
  }

  // 취약점별 백로그
  for (const vuln of params.vulnerabilities) {
    if (vuln === "UNDER_BLOCK_DETECTED") {
      items.push(addBacklogItem({
        category: "CONTAINMENT_GAP",
        priority: "P0_CONSTITUTIONAL",
        title: "차단 누락(Under-block) 감지",
        description: "일부 침해 시도가 차단되지 않음.",
        discoveredInScenario: "SCENARIO-8",
        affectedModules: ["resilience-stress-tester"],
        recommendedAction: "분류 패턴 매칭 규칙 확장 및 unknown 요청 기본 차단 적용",
      }));
    }
    if (vuln === "EVIDENCE_LOSS") {
      items.push(addBacklogItem({
        category: "EVIDENCE_PATH",
        priority: "P1_STRUCTURAL",
        title: "증적 유실 감지",
        description: "일부 차단 건에서 증적이 보존되지 않음.",
        discoveredInScenario: "SCENARIO-8",
        affectedModules: ["degraded-mode-containment"],
        recommendedAction: "증적 fallback 대기열 강화 및 flush 자동화",
      }));
    }
  }

  // 하드닝 권고사항 → P2/P3
  for (const rec of params.hardeningRecommendations) {
    items.push(addBacklogItem({
      category: "CONTAINMENT_GAP",
      priority: "P2_OPERATIONAL",
      title: rec,
      description: `Scenario 8 하드닝 권고: ${rec}`,
      discoveredInScenario: "SCENARIO-8",
      affectedModules: [],
      recommendedAction: rec,
    }));
  }

  return items;
}

// ─────────────────────────────────────────────
// 4. 조회 함수
// ─────────────────────────────────────────────

/** 전체 백로그 조회 */
export function getBacklog(): BacklogItem[] {
  return [...backlogStore];
}

/** 우선순위별 백로그 조회 */
export function getBacklogByPriority(priority: BacklogPriority): BacklogItem[] {
  return backlogStore.filter((i) => i.priority === priority);
}

/** 미해결 백로그 조회 */
export function getOpenBacklog(): BacklogItem[] {
  return backlogStore.filter((i) => i.status !== "VERIFIED_CLOSED");
}

/** 기한 초과 백로그 조회 */
export function getOverdueBacklog(): BacklogItem[] {
  const now = new Date();
  return backlogStore.filter(
    (i) => i.dueBy && i.dueBy < now && i.status !== "VERIFIED_CLOSED"
  );
}

/** 백로그 통계 */
export function getBacklogStats(): {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  byPriority: Record<BacklogPriority, number>;
  byCategory: Record<BacklogCategory, number>;
} {
  const open = backlogStore.filter((i) => i.status !== "VERIFIED_CLOSED").length;
  const now = new Date();
  const overdue = backlogStore.filter(
    (i) => i.dueBy && i.dueBy < now && i.status !== "VERIFIED_CLOSED"
  ).length;

  const byPriority: Record<string, number> = {
    P0_CONSTITUTIONAL: 0, P1_STRUCTURAL: 0, P2_OPERATIONAL: 0, P3_ENHANCEMENT: 0,
  };
  const byCategory: Record<string, number> = {};

  for (const item of backlogStore) {
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return {
    total: backlogStore.length,
    open,
    closed: backlogStore.length - open,
    overdue,
    byPriority: byPriority as Record<BacklogPriority, number>,
    byCategory: byCategory as Record<BacklogCategory, number>,
  };
}
