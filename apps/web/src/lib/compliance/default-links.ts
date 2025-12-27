/**
 * 기본(공통) 규제 링크 목록
 * 모든 사용자에게 기본으로 제공되는 규제/안전 관련 링크
 */

export interface DefaultComplianceLink {
  id: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  icon?: string;
}

export const DEFAULT_COMPLIANCE_LINKS: DefaultComplianceLink[] = [
  {
    id: "kfda",
    title: "식품의약품안전처 (식약처)",
    url: "https://www.mfds.go.kr",
    description: "식품, 의약품, 화장품 등 안전 규제 정보",
    tags: ["규제", "식약처", "의약품"],
    icon: "🏛️"
  },
  {
    id: "ncis",
    title: "화학물질종합정보시스템",
    url: "https://icis.me.go.kr",
    description: "화학물질 정보, 제한금지 물질 조회",
    tags: ["화학물질", "규제", "환경부"],
    icon: "🧪"
  },
  {
    id: "msds-nier",
    title: "MSDS 통합검색 (국립환경과학원)",
    url: "https://msds.kosha.or.kr",
    description: "물질안전보건자료(MSDS) 통합 검색 시스템",
    tags: ["MSDS", "SDS", "안전"],
    icon: "📋"
  },
  {
    id: "kosha",
    title: "안전보건공단 (KOSHA)",
    url: "https://www.kosha.or.kr",
    description: "산업안전보건법, 작업환경 측정, PPE 정보",
    tags: ["산안법", "안전", "PPE"],
    icon: "🦺"
  },
  {
    id: "kosha-msds",
    title: "KOSHA MSDS 검색",
    url: "https://msds.kosha.or.kr/MSDSInfo/kcic/msdsSearch.do",
    description: "한국산업안전보건공단 MSDS 검색",
    tags: ["MSDS", "SDS", "검색"],
    icon: "🔍"
  },
  {
    id: "chemical-info",
    title: "화학물질정보시스템 (NCIS)",
    url: "https://ncis.nier.go.kr",
    description: "국내 화학물질 유통량, 유해성 정보 조회",
    tags: ["화학물질", "유해성", "정보"],
    icon: "📊"
  },
  {
    id: "reach",
    title: "EU REACH 규제",
    url: "https://echa.europa.eu/regulations/reach",
    description: "유럽 화학물질 등록·평가·허가·제한 규제",
    tags: ["REACH", "EU", "수출"],
    icon: "🇪🇺"
  },
  {
    id: "nfpa",
    title: "NFPA 다이아몬드 (미국)",
    url: "https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=704",
    description: "NFPA 704 표준 - 위험물 표시",
    tags: ["NFPA", "위험", "표시"],
    icon: "💎"
  },
  {
    id: "ghs",
    title: "GHS (국제조화시스템)",
    url: "https://www.unece.org/trans/danger/publi/ghs/ghs_welcome_e.html",
    description: "화학물질 분류 및 표지 국제조화시스템",
    tags: ["GHS", "분류", "국제"],
    icon: "🌐"
  },
  {
    id: "waste-disposal",
    title: "폐기물관리법 (환경부)",
    url: "https://me.go.kr",
    description: "화학물질 폐기 절차 및 규정",
    tags: ["폐기", "환경", "규제"],
    icon: "♻️"
  },
  {
    id: "lab-safety-guide",
    title: "실험실 안전환경 구축에 관한 법률",
    url: "https://www.law.go.kr",
    description: "연구실 안전관리 법률 및 지침",
    tags: ["실험실", "안전", "법률"],
    icon: "🔬"
  },
  {
    id: "ppe-guide",
    title: "개인보호구 착용 가이드 (KOSHA)",
    url: "https://www.kosha.or.kr/kosha/data/guideline.do",
    description: "화학물질별 개인보호장비 선택 가이드",
    tags: ["PPE", "보호구", "안전"],
    icon: "🥽"
  }
];

/**
 * 태그별로 기본 링크 필터링
 */
export function getDefaultLinksByTags(tags: string[]): DefaultComplianceLink[] {
  if (!tags || tags.length === 0) {
    return DEFAULT_COMPLIANCE_LINKS;
  }

  return DEFAULT_COMPLIANCE_LINKS.filter(link =>
    link.tags.some(tag => tags.includes(tag))
  );
}

/**
 * ID로 기본 링크 찾기
 */
export function getDefaultLinkById(id: string): DefaultComplianceLink | undefined {
  return DEFAULT_COMPLIANCE_LINKS.find(link => link.id === id);
}
