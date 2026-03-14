/**
 * @module terminal-operating-charter
 * @description 최종 운영 헌장 — Phase Z 헌법적 종결의 핵심 문서.
 * 시스템의 목적, 불변 코어, 갱신 도메인, 개정 도메인, 금지된 변형,
 * 거버넌스 구조, 권리·의무, 분쟁 해결, 승계, 종결 조건, 재창설, 해석 규칙을 정의한다.
 */

/** 헌장 섹션 유형 */
export type CharterSectionType =
  | "PURPOSE"
  | "IMMUTABLE_CORE"
  | "RENEWAL_DOMAIN"
  | "AMENDMENT_DOMAIN"
  | "FORBIDDEN_MUTATIONS"
  | "GOVERNANCE_STRUCTURE"
  | "RIGHTS_AND_DUTIES"
  | "DISPUTE_RESOLUTION"
  | "SUCCESSION"
  | "CLOSURE_CONDITIONS"
  | "REFOUNDATION"
  | "INTERPRETATION";

/** 헌장 개별 섹션 */
export interface CharterSection {
  /** 섹션 유형 */
  type: CharterSectionType;
  /** 섹션 제목 */
  title: string;
  /** 섹션 내용 */
  content: string;
  /** 불변 여부 — true이면 어떠한 개정도 불가 */
  immutable: boolean;
  /** 섹션 버전 */
  version: number;
}

/** 최종 운영 헌장 */
export interface TerminalCharter {
  /** 헌장 구성 섹션 목록 */
  sections: CharterSection[];
  /** 헌장 전체 버전 */
  version: string;
  /** 비준 일시 */
  ratifiedAt: Date;
  /** 마지막 개정 일시 */
  lastAmendedAt: Date | null;
}

/** 불변 섹션 유형 목록 */
const IMMUTABLE_SECTION_TYPES: readonly CharterSectionType[] = [
  "PURPOSE",
  "IMMUTABLE_CORE",
  "FORBIDDEN_MUTATIONS",
] as const;

/** 기본 헌장 섹션 정의 */
const DEFAULT_SECTIONS: CharterSection[] = [
  {
    type: "PURPOSE",
    title: "시스템 목적",
    content: "공익 지향 바이오 인사이트 플랫폼의 안전하고 투명한 운영을 보장한다.",
    immutable: true,
    version: 1,
  },
  {
    type: "IMMUTABLE_CORE",
    title: "불변 코어",
    content:
      "승인 계보, 롤백 무결성, False-safe 격리는 영구적으로 불변이며 어떠한 수정도 차단된다.",
    immutable: true,
    version: 1,
  },
  {
    type: "RENEWAL_DOMAIN",
    title: "갱신 도메인",
    content: "신뢰 자산, 예외 허용, 위임 범위는 정기 갱신 대상이며 미갱신 시 자동 강등된다.",
    immutable: false,
    version: 1,
  },
  {
    type: "AMENDMENT_DOMAIN",
    title: "개정 도메인",
    content: "운영 절차, 거버넌스 파라미터는 9단계 개정 프로토콜을 통해 변경 가능하다.",
    immutable: false,
    version: 1,
  },
  {
    type: "FORBIDDEN_MUTATIONS",
    title: "금지된 변형",
    content:
      "불변 코어 수정, 공익 의무 축소, 감사 추적 삭제, 예외 무한 연장은 영구 금지된다.",
    immutable: true,
    version: 1,
  },
  {
    type: "GOVERNANCE_STRUCTURE",
    title: "거버넌스 구조",
    content: "다층 승인 체계, 역할 분리, 감사 독립성을 보장하는 거버넌스를 유지한다.",
    immutable: false,
    version: 1,
  },
  {
    type: "RIGHTS_AND_DUTIES",
    title: "권리와 의무",
    content: "모든 참여자는 투명성 권리와 공익 보호 의무를 동시에 갖는다.",
    immutable: false,
    version: 1,
  },
  {
    type: "DISPUTE_RESOLUTION",
    title: "분쟁 해결",
    content: "분쟁은 헌법적 기억 인덱스의 선례를 기반으로 중립 패널에 의해 해결된다.",
    immutable: false,
    version: 1,
  },
  {
    type: "SUCCESSION",
    title: "승계",
    content: "시스템 승계 시 모든 불변 코어 원칙과 영구 의무가 승계자에게 이전된다.",
    immutable: false,
    version: 1,
  },
  {
    type: "CLOSURE_CONDITIONS",
    title: "종결 조건",
    content: "모든 모호성 해소, 정규 통제 척추 완성, 갱신 루프 활성화가 종결 전제 조건이다.",
    immutable: false,
    version: 1,
  },
  {
    type: "REFOUNDATION",
    title: "재창설",
    content: "헌법적 위반 반복, 예외 부채 임계, 목적 이탈 시 통제된 재창설이 발동된다.",
    immutable: false,
    version: 1,
  },
  {
    type: "INTERPRETATION",
    title: "해석 규칙",
    content: "모호한 조항은 공익 보호 방향으로 해석하며, 모든 해석은 기록·보존된다.",
    immutable: false,
    version: 1,
  },
];

/** 인메모리 헌장 저장소 */
let charter: TerminalCharter = {
  sections: [...DEFAULT_SECTIONS],
  version: "1.0.0",
  ratifiedAt: new Date(),
  lastAmendedAt: null,
};

/**
 * 현재 헌장을 반환한다.
 * @returns 최종 운영 헌장
 */
export function getCharter(): TerminalCharter {
  return { ...charter, sections: [...charter.sections] };
}

/**
 * 특정 유형의 헌장 섹션들을 반환한다.
 * @param type - 조회할 섹션 유형
 * @returns 해당 유형의 섹션 배열
 */
export function getSectionsByType(type: CharterSectionType): CharterSection[] {
  return charter.sections.filter((s) => s.type === type);
}

/**
 * 해당 섹션 유형이 불변인지 확인한다.
 * @param type - 확인할 섹션 유형
 * @returns 불변 여부
 */
export function isImmutableSection(type: CharterSectionType): boolean {
  return IMMUTABLE_SECTION_TYPES.includes(type);
}

/**
 * 헌장의 무결성을 검증한다.
 * 모든 불변 섹션이 존재하고, 버전이 유효하며, 비준일이 설정되어 있는지 확인한다.
 * @returns { valid, errors } — 검증 결과와 오류 목록
 */
export function validateCharterIntegrity(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 모든 필수 불변 섹션 존재 확인
  for (let i = 0; i < IMMUTABLE_SECTION_TYPES.length; i++) {
    const requiredType = IMMUTABLE_SECTION_TYPES[i];
    const found = charter.sections.find((s) => s.type === requiredType);
    if (!found) {
      errors.push(`필수 불변 섹션 누락: ${requiredType}`);
    } else if (!found.immutable) {
      errors.push(`불변 섹션이 mutable로 표시됨: ${requiredType}`);
    }
  }

  // 모든 12개 섹션 유형 존재 확인
  const allTypes: CharterSectionType[] = [
    "PURPOSE",
    "IMMUTABLE_CORE",
    "RENEWAL_DOMAIN",
    "AMENDMENT_DOMAIN",
    "FORBIDDEN_MUTATIONS",
    "GOVERNANCE_STRUCTURE",
    "RIGHTS_AND_DUTIES",
    "DISPUTE_RESOLUTION",
    "SUCCESSION",
    "CLOSURE_CONDITIONS",
    "REFOUNDATION",
    "INTERPRETATION",
  ];
  for (const t of allTypes) {
    if (!charter.sections.some((s) => s.type === t)) {
      errors.push(`헌장 섹션 누락: ${t}`);
    }
  }

  // 버전 유효성
  if (!charter.version || charter.version.trim() === "") {
    errors.push("헌장 버전이 비어 있음");
  }

  // 비준일 확인
  if (!charter.ratifiedAt) {
    errors.push("비준 일시가 설정되지 않음");
  }

  return { valid: errors.length === 0, errors };
}
