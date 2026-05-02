/**
 * §11.191 #operational-inbox-hidden-redirect (Option 2)
 *
 * 운영작업함 페이지 deprecated (호영님 합의). canonical 운영 surface 는
 * (a) 메인 dashboard (today-hub-strip + KPI) + (b) per-surface ContextPanel
 * rail + (c) §11.181 OperationalBriefPopup. /dashboard/inbox 는 standalone
 * page-per-feature 로 더 이상 노출하지 않으나 41 caller (lib/ops-console
 * filter route + page filter chip + operational-detail-shell returnHref) 의
 * URL 호환성 보존을 위해 server-side redirect 로 silent 흡수.
 *
 * §11.190b/c 는 별도 batch — page-per-feature surface (PO/receiving detail)
 * 에 4-cell pattern 이 fit 하지 않아 defer (ADR 동시 entry).
 *
 * Out of scope (§11.191b/c):
 *   - filter route (filter_state/filter_owner/module=*) → canonical
 *     destination 분산 매핑 (현재 query param 무시 + /dashboard 로 흡수)
 *   - 41 caller URL 직접 정합 (today-hub-strip/operational-detail-shell/
 *     stock-risk/receiving/purchase-orders link rewrite)
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OperationalInboxLegacyRedirect() {
  redirect("/dashboard");
}
