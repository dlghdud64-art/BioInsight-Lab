/**
 * 문명 규모 신뢰 앵커 (Civilizational Trust Anchor)
 *
 * 시스템 전반의 신뢰 기반을 구성하는 불변 앵커 포인트를 관리합니다.
 * 헌법적·수학적·제도적·합의 기반의 신뢰 앵커를 설정하고 검증합니다.
 */

/** 신뢰 앵커 유형 */
export type TrustAnchorType =
  | "CONSTITUTIONAL"
  | "MATHEMATICAL"
  | "INSTITUTIONAL"
  | "CONSENSUS";

/** 신뢰 앵커 */
export interface TrustAnchor {
  id: string;
  type: TrustAnchorType;
  /** 앵커가 보장하는 원칙 */
  principle: string;
  /** 검증 방법 설명 */
  verificationMethod: string;
  establishedAt: Date;
  /** 불변 여부 — true이면 수정/삭제 불가 */
  immutable: boolean;
  /** 보증인 목록 */
  endorsedBy: string[];
  active: boolean;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const anchors: TrustAnchor[] = [];

let nextId = 1;
function genId(): string {
  return `ta-${Date.now()}-${nextId++}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 새 신뢰 앵커를 설정합니다.
 * @param params 앵커 생성 파라미터
 * @returns 생성된 TrustAnchor
 */
export function establishAnchor(params: {
  type: TrustAnchorType;
  principle: string;
  verificationMethod: string;
  immutable?: boolean;
  endorsedBy?: string[];
}): TrustAnchor {
  const anchor: TrustAnchor = {
    id: genId(),
    type: params.type,
    principle: params.principle,
    verificationMethod: params.verificationMethod,
    establishedAt: new Date(),
    immutable: params.immutable ?? false,
    endorsedBy: params.endorsedBy ?? [],
    active: true,
  };
  anchors.push(anchor);
  return anchor;
}

/**
 * 앵커의 유효성을 검증합니다.
 * @param anchorId 검증할 앵커 ID
 * @returns 검증 성공 여부와 메시지
 */
export function verifyAnchor(anchorId: string): {
  valid: boolean;
  message: string;
} {
  const anchor = anchors.find((a) => a.id === anchorId);
  if (!anchor) {
    return { valid: false, message: "앵커를 찾을 수 없습니다." };
  }
  if (!anchor.active) {
    return { valid: false, message: "비활성 앵커입니다." };
  }
  if (anchor.endorsedBy.length === 0) {
    return {
      valid: false,
      message: "보증인이 없어 신뢰를 보장할 수 없습니다.",
    };
  }
  return { valid: true, message: "앵커가 유효합니다." };
}

/**
 * 특정 앵커의 신뢰 체인을 반환합니다.
 * 같은 타입의 활성 앵커를 설정 시각 순서로 반환합니다.
 * @param anchorId 기준 앵커 ID
 */
export function getAnchorChain(anchorId: string): TrustAnchor[] {
  const anchor = anchors.find((a) => a.id === anchorId);
  if (!anchor) return [];
  return anchors
    .filter((a) => a.type === anchor.type && a.active)
    .sort((a, b) => a.establishedAt.getTime() - b.establishedAt.getTime());
}

/**
 * 모든 활성 앵커를 반환합니다.
 */
export function listActiveAnchors(): TrustAnchor[] {
  return anchors.filter((a) => a.active);
}
