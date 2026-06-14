// §log-consolidation P3 — 활동 로그 surface 는 통합 로그 surface(/dashboard/audit,
// 활동/감사 모드 토글)로 흡수됨. 구 route 는 dead link 방지를 위해 통합 route 로
// 영구 redirect 한다. 활동 데이터(ActivityLog) 읽기 · ACTIVITY_TYPE_LABELS ·
// org 멤버 열람(admin-gate 아님) 로직은 통합 host(dashboard/audit/page.tsx 활동 모드)
// 로 이전됐다 — sentinel 활동 보존 가드도 통합 host 로 동기 이동(log-consolidation-p1.test.ts).
import { redirect } from "next/navigation";

export default function ActivityLogsRedirectPage() {
  redirect("/dashboard/audit");
}
