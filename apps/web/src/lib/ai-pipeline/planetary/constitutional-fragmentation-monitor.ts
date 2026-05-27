/**
 * 헌법적 파편화 감시기 (Constitutional Fragmentation Monitor)
 *
 * 어댑터 우회, 의미론적 표류, 은밀한 확장, 한계 침식, 버전 분기를 감지.
 * 어댑터를 통한 로컬 헌법적 한계 우회 시도를 감지하고 거부(REJECT).
 */

/** 파편화 위험 유형 */
export type FragmentationRisk =
  | "ADAPTER_BYPASS"
  | "SEMANTIC_DRIFT"
  | "HIDDEN_WIDENING"
  | "LIMITATION_EROSION"
  | "VERSION_DIVERGENCE";

/** 심각도 */
export type FragmentationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 파편화 경보 */
export interface FragmentationAlert {
  /** 고유 식별자 */
  id: string;
  /** 위험 유형 */
  risk: FragmentationRisk;
  /** 심각도 */
  severity: FragmentationSeverity;
  /** 영향받는 네트워크 목록 */
  affectedNetworks: string[];
  /** 증거 */
  evidence: string;
  /** 감지 시각 */
  detectedAt: number;
  /** 완화 시각 (null이면 미완화) */
  mitigatedAt: number | null;
}

/** 네트워크 스냅샷 (감시 대상) */
export interface NetworkSnapshot {
  /** 네트워크 ID */
  networkId: string;
  /** 프로토콜 버전 */
  protocolVersion: string;
  /** 허용 행동 목록 */
  allowedActions: string[];
  /** 한계 수 */
  limitationCount: number;
  /** 어댑터 목록 */
  adapters: string[];
}

// ─── 인메모리 저장소 ───
const alertStore: FragmentationAlert[] = [];
const baselineSnapshots = new Map<string, NetworkSnapshot>();

/**
 * 파편화 전체 스캔
 */
export function scanForFragmentation(
  snapshots: NetworkSnapshot[]
): FragmentationAlert[] {
  const newAlerts: FragmentationAlert[] = [];

  for (const snapshot of snapshots) {
    // 기준 스냅샷과 비교
    const baseline = baselineSnapshots.get(snapshot.networkId);

    if (baseline) {
      // 어댑터 우회 감지
      const adapterAlert = detectAdapterBypass(snapshot, baseline);
      if (adapterAlert) newAlerts.push(adapterAlert);

      // 의미론적 표류 감지
      const driftAlert = detectSemanticDrift(snapshot, baseline);
      if (driftAlert) newAlerts.push(driftAlert);

      // 한계 침식 감지
      if (snapshot.limitationCount < baseline.limitationCount) {
        const alert = createAlert(
          "LIMITATION_EROSION",
          snapshot.limitationCount === 0 ? "CRITICAL" : "HIGH",
          [snapshot.networkId],
          `한계 수 감소: ${baseline.limitationCount} → ${snapshot.limitationCount}`
        );
        newAlerts.push(alert);
      }

      // 버전 분기 감지
      if (snapshot.protocolVersion !== baseline.protocolVersion) {
        const alert = createAlert(
          "VERSION_DIVERGENCE",
          "MEDIUM",
          [snapshot.networkId],
          `프로토콜 버전 변경: ${baseline.protocolVersion} → ${snapshot.protocolVersion}`
        );
        newAlerts.push(alert);
      }
    }

    // 현재 스냅샷을 기준으로 업데이트
    baselineSnapshots.set(snapshot.networkId, { ...snapshot });
  }

  alertStore.push(...newAlerts);
  return newAlerts;
}

/**
 * 어댑터 우회 감지 — 어댑터를 통한 헌법적 한계 우회 시도 감지
 */
export function detectAdapterBypass(
  current: NetworkSnapshot,
  baseline: NetworkSnapshot
): FragmentationAlert | null {
  // 어댑터가 추가되면서 허용 행동이 확대된 경우 → 우회 의심
  const newAdapters = current.adapters.filter(
    (a) => !baseline.adapters.includes(a)
  );
  const newActions = current.allowedActions.filter(
    (a) => !baseline.allowedActions.includes(a)
  );

  if (newAdapters.length > 0 && newActions.length > 0) {
    return createAlert(
      "ADAPTER_BYPASS",
      "CRITICAL",
      [current.networkId],
      `새 어댑터 [${newAdapters.join(", ")}] 추가와 동시에 새 행동 [${newActions.join(", ")}] 확대 감지. 우회 의심.`
    );
  }

  return null;
}

/**
 * 의미론적 표류 감지 — 허용 행동이 은밀히 확대된 경우
 */
export function detectSemanticDrift(
  current: NetworkSnapshot,
  baseline: NetworkSnapshot
): FragmentationAlert | null {
  const widened = current.allowedActions.filter(
    (a) => !baseline.allowedActions.includes(a)
  );

  if (widened.length > 0 && current.adapters.length === baseline.adapters.length) {
    return createAlert(
      "HIDDEN_WIDENING",
      "HIGH",
      [current.networkId],
      `어댑터 변경 없이 허용 행동이 확대됨: [${widened.join(", ")}]`
    );
  }

  return null;
}

/**
 * 파편화 추세 조회
 */
export function getFragmentationTrend(
  lastN?: number
): { risk: FragmentationRisk; count: number }[] {
  const source = lastN ? alertStore.slice(-lastN) : alertStore;
  const counts = new Map<FragmentationRisk, number>();

  for (const alert of source) {
    counts.set(alert.risk, (counts.get(alert.risk) ?? 0) + 1);
  }

  return [...counts.entries()].map(([risk, count]) => ({ risk, count }));
}

// ─── 헬퍼 ───
function createAlert(
  risk: FragmentationRisk,
  severity: FragmentationSeverity,
  affectedNetworks: string[],
  evidence: string
): FragmentationAlert {
  return {
    id: `frag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    risk,
    severity,
    affectedNetworks,
    evidence,
    detectedAt: Date.now(),
    mitigatedAt: null,
  };
}
