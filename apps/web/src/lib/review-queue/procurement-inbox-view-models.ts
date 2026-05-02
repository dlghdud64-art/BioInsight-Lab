/**
 * §11.191f #operational-inbox-dead-export-cleanup
 *
 * 본 file (procurement-inbox-view-models.ts) 은 운영작업함 (/dashboard/inbox)
 * 페이지가 deprecated (§11.191 hidden redirect → /dashboard) 되며 함께
 * dead 가 됐다. caller chain audit (`grep buildProcurementInboxView |
 * procurement-inbox-view-models | ProcurementInbox` apps/web/src) 결과
 * 외부 caller 0 — entire module dead export.
 *
 * FUSE filesystem readonly 로 직접 file 삭제 불가. content 를 deprecated
 * marker 만 남기고 future commit 에서 git tree 에서 제거 예정.
 *
 * domain 모델 (`procurement-inbox-contract.ts`) 은 보존 — 향후 다른
 * surface 에서 InboxItem / TodayPrioritySummary 등 재사용 가능.
 */

export {};
