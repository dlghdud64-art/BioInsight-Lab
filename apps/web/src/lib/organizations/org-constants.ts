/**
 * §org-management-redesign P1 — 조직 관리 공유 상수(유형·상세 탭)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md)
 *
 * ORG_TYPES = 기존 organizationType 저장값(한국어 라벨) 유지 — back-compat(기존 orgs 데이터 orphan 0).
 *   품질관리는 "QC/QA 품질관리"로 이미 존재(시안 "품질관리 추가" 충족). 시안 prototype 코드 택소노미
 *   (lab/qc/...)로의 교체는 기존 데이터 영향 → 별도 결정(미적용).
 * ORG_DETAIL_TABS = 시안 5탭 라벨(상세 same-canvas 탭).
 */

export const ORG_TYPES = [
  "R&D 연구소",
  "QC/QA 품질관리",
  "시험·검사 기관",
  "대학 연구실",
  "기타",
] as const;

export type OrgType = (typeof ORG_TYPES)[number];

export const ORG_DETAIL_TABS = [
  "개요",
  "멤버 및 접근",
  "승인 및 초대",
  "활동 및 감사",
  "정책 및 설정",
] as const;

export type OrgDetailTab = (typeof ORG_DETAIL_TABS)[number];
