/**
 * §approver-axis (나)-2 — 승인 권한 역할 집합 **정본** (호영님 판정 2026-08-30).
 *
 * 왜 별도 모듈인가:
 *   정본을 처음 세운 자리는 `lib/billing/approver-routing.ts` 였는데 그 파일은
 *   모듈 최상단에서 `@/lib/db`(Prisma)를 import 한다. 조직 화면은 `"use client"` 라
 *   거기서 끌어오면 **Prisma 가 브라우저 번들에 실린다.**
 *   → 상수와 순수 판정만 여기로 내리고, 서버 쪽은 approver-routing 이 재수출한다.
 *   한 곳에서만 정의되므로 "여섯 번째 정의" 가 생기지 않는다.
 *
 * A축 = APPROVER · ADMIN · OWNER. 근거 3 (호영님 2026-08-30):
 *   ① APPROVER 가 승인 전용 역할로 이미 존재한다
 *   ② OWNER 1명뿐인 조직에서 ADMIN 이 승인 못 하면 실패 모드가 생긴다
 *      (prod 실측: OrganizationMember 1명 · 그 한 명이 ADMIN 이었다)
 *   ③ ADMIN → LAB_MANAGER 는 실험실 운영 역할이지 예산 권한이 아니다
 *
 * 🛑 이 집합의 사본을 만들지 않는다. 통일 전 실측된 정의는 5개였다:
 *      APPROVER 단독 · APPROVER+ADMIN+OWNER · ADMIN+OWNER · APPROVER+OWNER ·
 *      TeamRole.ADMIN(다른 enum · 다른 범위)
 *    같은 화면 안에서 승인권자 수가 서로 다르게 표시되던 원인이다.
 */

/** 조직 승인 권한을 갖는 역할 집합 (정본). */
export const ORG_APPROVER_ROLES = ["APPROVER", "ADMIN", "OWNER"] as const;

export type OrgApproverRole = (typeof ORG_APPROVER_ROLES)[number];

/**
 * 조직 역할이 승인 권한을 갖는가.
 * 🔑 null/undefined(비멤버)는 false — 멤버십 부재를 권한으로 읽지 않는다.
 */
export function isOrgApprover(role: string | null | undefined): boolean {
  return !!role && (ORG_APPROVER_ROLES as readonly string[]).includes(role);
}

/** 멤버 배열에서 승인권자 수를 센다. 화면·API 가 같은 계수를 쓰게 하는 자리. */
export function countOrgApprovers(
  members: ReadonlyArray<{ role?: string | null }>,
): number {
  return members.filter((m) => isOrgApprover(m?.role)).length;
}
