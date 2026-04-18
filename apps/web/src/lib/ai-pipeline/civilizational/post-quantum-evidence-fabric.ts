/**
 * 포스트 양자 증거 패브릭 (Post-Quantum Evidence Fabric)
 *
 * 양자 컴퓨팅 시대에 대비한 증거 생성·검증·마이그레이션 시스템입니다.
 * 다양한 해시 알고리즘을 지원하며, 양자 저항성 준비 상태를 평가합니다.
 */

/** 지원 해시 알고리즘 */
export type HashAlgorithm =
  | "SHA256"
  | "SHA3_512"
  | "CRYSTALS_DILITHIUM"
  | "SPHINCS_PLUS";

/** 양자 저항 증거 */
export interface QuantumResistantEvidence {
  id: string;
  /** 증거 원본 콘텐츠 */
  content: string;
  /** 사용된 해시 알고리즘 */
  algorithm: HashAlgorithm;
  /** 해시 값 */
  hash: string;
  timestamp: Date;
  /** 증인 서명 목록 */
  witnessSignatures: string[];
  /** 양자 저항 알고리즘으로 마이그레이션 가능 여부 */
  migrationReady: boolean;
}

/** 양자 준비 상태 평가 결과 */
export interface QuantumReadinessReport {
  totalEvidence: number;
  quantumResistantCount: number;
  migrationReadyCount: number;
  readinessScore: number;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const evidenceStore: QuantumResistantEvidence[] = [];

let nextId = 1;
function genId(): string {
  return `qe-${Date.now()}-${nextId++}`;
}

/** 간이 해시 생성 (순수 함수, 외부 의존성 없음) */
function simpleHash(content: string, algorithm: HashAlgorithm): string {
  let h = 0;
  const seed = algorithm.length;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) - h + content.charCodeAt(i) * seed) | 0;
  }
  return `${algorithm}:${Math.abs(h).toString(16).padStart(16, "0")}`;
}

const QUANTUM_RESISTANT_ALGOS: HashAlgorithm[] = [
  "CRYSTALS_DILITHIUM",
  "SPHINCS_PLUS",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 새로운 양자 저항 증거를 생성합니다.
 * @param content 증거 콘텐츠
 * @param algorithm 해시 알고리즘
 * @param witnessSignatures 증인 서명 배열
 */
export function createEvidence(
  content: string,
  algorithm: HashAlgorithm,
  witnessSignatures: string[] = []
): QuantumResistantEvidence {
  const evidence: QuantumResistantEvidence = {
    id: genId(),
    content,
    algorithm,
    hash: simpleHash(content, algorithm),
    timestamp: new Date(),
    witnessSignatures,
    migrationReady: !QUANTUM_RESISTANT_ALGOS.includes(algorithm),
  };
  evidenceStore.push(evidence);
  return evidence;
}

/**
 * 기존 증거의 해시 알고리즘을 마이그레이션합니다.
 * @param evidenceId 증거 ID
 * @param newAlgorithm 새 해시 알고리즘
 */
export function migrateHashAlgorithm(
  evidenceId: string,
  newAlgorithm: HashAlgorithm
): QuantumResistantEvidence | null {
  const ev = evidenceStore.find((e) => e.id === evidenceId);
  if (!ev) return null;
  ev.algorithm = newAlgorithm;
  ev.hash = simpleHash(ev.content, newAlgorithm);
  ev.migrationReady = !QUANTUM_RESISTANT_ALGOS.includes(newAlgorithm);
  return ev;
}

/**
 * 증거의 무결성을 검증합니다.
 * @param evidenceId 증거 ID
 */
export function verifyIntegrity(evidenceId: string): {
  valid: boolean;
  message: string;
} {
  const ev = evidenceStore.find((e) => e.id === evidenceId);
  if (!ev) return { valid: false, message: "증거를 찾을 수 없습니다." };
  const expected = simpleHash(ev.content, ev.algorithm);
  if (ev.hash !== expected) {
    return { valid: false, message: "해시 불일치 — 변조 가능성이 있습니다." };
  }
  return { valid: true, message: "무결성 검증 통과." };
}

/**
 * 시스템 전체의 양자 저항 준비 상태를 평가합니다.
 */
export function assessQuantumReadiness(): QuantumReadinessReport {
  const total = evidenceStore.length;
  const qrCount = evidenceStore.filter((e) =>
    QUANTUM_RESISTANT_ALGOS.includes(e.algorithm)
  ).length;
  const migReady = evidenceStore.filter((e) => e.migrationReady).length;
  const score = total === 0 ? 0 : qrCount / total;

  let recommendation: string;
  if (score >= 0.8) recommendation = "양자 저항 준비 완료";
  else if (score >= 0.5) recommendation = "마이그레이션을 계속 진행하십시오";
  else recommendation = "양자 저항 알고리즘 채택이 시급합니다";

  return {
    totalEvidence: total,
    quantumResistantCount: qrCount,
    migrationReadyCount: migReady,
    readinessScore: Math.round(score * 100) / 100,
    recommendation,
  };
}
