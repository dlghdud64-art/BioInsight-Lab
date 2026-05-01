/**
 * §11.92 stale inventory page truth-conflict cleanup.
 *
 * Canonical inventory surface = `/dashboard/inventory`.
 * 이 파일은 §11.85~91 #inventory-model-consolidation 이후 dead route 였으나
 * working tree 에 잔존 — 963 lines stale page 가 deep-link `/inventory` 를
 * 가짐. 외부 caller 0 (audit 결과) 이지만 SEO/북마크 호환성을 위해 redirect-only
 * 로 swap (서버사이드 redirect, render 0).
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function InventoryLegacyRedirect() {
  redirect("/dashboard/inventory");
}
