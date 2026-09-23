/**
 * 운영 작업함 실데이터 — 단일 fetcher (§inbox-seed-cutoff 2026-09-22 · 호영님 판정)
 *
 * 운영 브리핑 팝업과 /dashboard/inbox 가 **같은 함수**로 읽는다. 둘이 다른 출처를 쓰면
 * 팝업엔 N건 · 작업함엔 0건 처럼 같은 개념이 두 화면에서 다른 수를 낸다.
 * 출처 = GET /api/operational-brief/inbox (로그인 사용자 스코프 · 읽기 전용).
 * 현재 연결된 종류 = 견적(공급사 응답 대기 · 응답 도착 비교 검토)뿐이다.
 *   발주·입고·재고 위험은 아직 작업함에 연결되지 않았다 — 화면은 그 사실을 문구로 밝힌다.
 */
import type { UnifiedInboxItem } from "@/lib/ops-console/inbox-adapter";

export const REAL_INBOX_ENDPOINT = "/api/operational-brief/inbox";

export async function fetchRealInboxItems(): Promise<UnifiedInboxItem[]> {
  const res = await fetch(REAL_INBOX_ENDPOINT);
  if (!res.ok) throw new Error("운영 작업함을 불러오지 못했습니다");
  const json = (await res.json()) as { items?: unknown };
  return Array.isArray(json?.items) ? (json.items as UnifiedInboxItem[]) : [];
}
