/**
 * §org-management-redesign P1 — 조직 관리 공유 상수(유형·상세 탭)
 *   (PLAN: docs/plans/PLAN_org-management-redesign.md)
 *
 * ORG_TYPES = 기존 organizationType 저장값(한국어 라벨) 유지 — back-compat(기존 orgs 데이터 orphan 0).
 *   품질관리는 "QC/QA 품질관리"로 이미 존재(시안 "품질관리 추가" 충족). 시안 prototype 코드 택소노미
 *   (lab/qc/...)로의 교체는 기존 데이터 영향 → 별도 결정(미적용).
 * ORG_DETAIL_TABS = 상세 same-canvas 4탭 라벨.
 *   "활동 및 감사" 는 v2 리뷰(호영님 2026-08-30)로 은퇴 — 사이드바 전역 통합 로그
 *   (/dashboard/audit)와 중복인 빈 껍데기였다. 조직 활동은 개요 최근 활동 요약 +
 *   전체 활동 로그 딥링크(?org= 조직 필터)가 대체한다.
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
  "정책 및 설정",
] as const;

export type OrgDetailTab = (typeof ORG_DETAIL_TABS)[number];
