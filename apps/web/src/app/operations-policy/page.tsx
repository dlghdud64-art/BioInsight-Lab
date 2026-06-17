import { redirect } from "next/navigation";

/**
 * §P-leg P4 — 라우팅 cutover. 운영정책 본문은 lib/legal/legal-docs.tsx 단일 진실로 이관,
 *   표시는 /legal 탭형 허브가 담당. 구 /operations-policy 진입은 허브의 운영정책 탭(#policy)으로
 *   연결. 기존 딥링크·푸터 링크 하위호환 보존.
 */
export default function OperationsPolicyRedirect() {
  redirect("/legal#policy");
}
