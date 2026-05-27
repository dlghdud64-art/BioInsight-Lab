/**
 * 규제 정보 링크 유틸리티
 * 제품별 규제 정보 매핑 및 검색
 */

export interface RegulationLink {
  id: string;
  name: string;
  url: string;
  description?: string;
}

/**
 * 공통 규제 포털 링크
 */
export const COMMON_REGULATION_LINKS: RegulationLink[] = [
  {
    id: "mfds",
    name: "식약처 포털",
    url: "https://www.mfds.go.kr",
    description: "식품의약품안전처 공식 포털",
  },
  {
    id: "nifds",
    name: "식약처 안전정보포털",
    url: "https://www.nifds.go.kr",
    description: "국립식품의약품안전평가원 안전정보포털",
  },
  {
    id: "me",
    name: "환경부 화학물질안전원",
    url: "https://www.me.go.kr",
    description: "환경부 화학물질안전원",
  },
  {
    id: "kchem",
    name: "화학물질안전원",
    url: "https://www.kchem.or.kr",
    description: "화학물질안전원",
  },
];

/**
 * 제품 카테고리별 규제 정보 링크 매핑
 */
export function getRegulationLinksForProduct(
  productName?: string,
  catalogNumber?: string,
  category?: string
): RegulationLink[] {
  const links: RegulationLink[] = [...COMMON_REGULATION_LINKS];

  // 카테고리별 추가 링크
  if (category === "REAGENT") {
    links.push({
      id: "reagent-search",
      name: "시약 규제 정보 검색",
      url: `https://www.mfds.go.kr/brd/m_99/list.do?searchType=${encodeURIComponent(productName || "")}`,
      description: "식약처 시약 규제 정보 검색",
    });
  }

  // 카탈로그 번호 기반 검색 링크
  if (catalogNumber) {
    links.push({
      id: "catalog-search",
      name: "카탈로그 번호 검색",
      url: `https://www.mfds.go.kr/brd/m_99/list.do?searchType=${encodeURIComponent(catalogNumber)}`,
      description: `카탈로그 번호 "${catalogNumber}" 검색`,
    });
  }

  return links;
}

/**
 * 제품명 기반 규제 정보 검색 URL 생성
 */
export function generateRegulationSearchUrl(
  productName: string,
  portal: "mfds" | "nifds" | "me" | "kchem" = "mfds"
): string {
  const encodedName = encodeURIComponent(productName);

  switch (portal) {
    case "mfds":
      return `https://www.mfds.go.kr/brd/m_99/list.do?searchType=${encodedName}`;
    case "nifds":
      return `https://www.nifds.go.kr/search.do?q=${encodedName}`;
    case "me":
      return `https://www.me.go.kr/search.do?q=${encodedName}`;
    case "kchem":
      return `https://www.kchem.or.kr/search.do?q=${encodedName}`;
    default:
      return `https://www.mfds.go.kr/brd/m_99/list.do?searchType=${encodedName}`;
  }
}

