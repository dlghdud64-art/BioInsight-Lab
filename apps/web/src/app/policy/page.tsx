import { redirect } from "next/navigation";

/**
 * §P-leg P4 — 라우팅 cutover. 지시문 단축 라우트 /policy → 허브 운영정책 탭(#policy).
 *   (구 /operations-policy 와 동일 목적지, 지시문 /legal·/terms·/privacy·/policy 정합.)
 */
export default function PolicyRedirect() {
  redirect("/legal#policy");
}
