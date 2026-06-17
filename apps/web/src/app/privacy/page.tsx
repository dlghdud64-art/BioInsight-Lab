import { redirect } from "next/navigation";

/**
 * §P-leg P4 — 라우팅 cutover. 개인정보처리방침(v1.2) 본문은 lib/legal/legal-docs.tsx 단일 진실로
 *   이관, 표시는 /legal 탭형 허브가 담당. 구 /privacy 진입은 허브의 개인정보 탭(#privacy)으로 연결.
 *   기존 딥링크·푸터 링크 하위호환 보존.
 */
export default function PrivacyRedirect() {
  redirect("/legal#privacy");
}
