/**
 * §billing-surface-unify (호영님 2026-09-07) — `/dashboard/billing` 은 `/billing` 으로 보낸다.
 *
 * 이 자리에 있던 것: 199줄짜리 **정적 목업**. `useQuery`·`fetch`·`db` 호출이 0이고
 * 인바운드 링크도 0이었다(전수 grep). 화면에 박혀 있던 값:
 *
 *     통합 청구        ₩ 12,450,000
 *     미납 금액        ₩ 0 · "모두 결제 완료"   ← 초록 체크
 *     발행된 세금계산서 (건수)
 *
 * 🛑 어제까지는 이게 안 부딪혔다 — 실제 미수도 0이었기 때문에 **둘 다 거짓이라 조용했다.**
 *   2026-09-07 §plan-change-claim DML 로 T1 에 진짜 미수 89,000원(DRAFT)이 생기자
 *   한 제품이 미납 금액을 두 개로 말하기 시작했다. `/billing` 은 89,000원, 여기는 ₩0.
 *   "발행된 세금계산서" 는 더 나쁘다 — 발행 배선(`taxInvoiceEmail` 소비처)이 아예 없다.
 *
 * 처방(호영님): 삭제 또는 `/billing` 리다이렉트. **빈 화면이 거짓 숫자보다 낫다.**
 *   리다이렉트를 택했다 — 인바운드 링크는 0이지만 북마크·외부 링크가 404 가 되지 않고,
 *   결제 표면을 하나로 모으는 방향과도 맞다.
 *
 * 🔑 `/dashboard/:path*` 는 미들웨어 인증 게이트 안이므로(§auth-page-gate)
 *   비로그인은 여기 닿기 전에 로그인으로 간다. 이 리다이렉트는 로그인 사용자용이다.
 */
import { redirect } from "next/navigation";

export default function DashboardBillingPage() {
  redirect("/billing");
}
