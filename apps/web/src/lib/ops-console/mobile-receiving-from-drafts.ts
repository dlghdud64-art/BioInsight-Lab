/**
 * 모바일 입고 카드 — **정본(ReceivingDraft)에서 파생** · §receiving-mobile-canonical (2026-09-22 · 호영님 판정)
 *
 * 🛑 모바일 입고는 ops-console 시드(receivingBatches)로 그려졌다. 데스크톱은 같은 화면에서
 *    정본(GET /api/receiving-drafts)을 쓰고 있었으므로, 한 화면이 기기에 따라 다른 세계를 보여줬다.
 *    시드에는 실재하지 않는 입고 1건(RCV-2026-0031 · Thermo Fisher Scientific · 3라인)이 들어 있어
 *    모든 사용자의 휴대폰에 떴고, 「재고 반영」 은 시드 스토어만 바꾸는 경로였다(저장 0).
 *
 * 지금: 데스크톱 케이스 목록(buildReceivingCaseList)의 **같은 행**에서 카드를 만든다.
 *   두 화면의 건수·차단 사유가 같은 함수에서 나온다.
 *
 * 원칙(옛 시드 뷰모델에서 승계):
 *   · 신규 truth 저장 0 — 호출 시 재계산하는 파생 projection.
 *   · RCV 1건 = 카드 1장. 해결된 사유는 배열에서 소멸(취소선 잔류 없음).
 *   · 시간 파생(overdue)은 nowIso 주입 — 순수성·테스트 결정성.
 *
 * 정직 표기: 입고안에는 RCV 채번이 없다. 표시 번호는 발주번호이며 데스크톱과 같은 값이다.
 */
import { RECEIVING_SLA_DEFAULTS } from "../review-queue/receiving-inbound-contract";
import type { ReceivingCaseRow } from "./receiving-desktop-view-model";
import type {
  MobileReceivingBlocker,
  MobileReceivingCard,
  MobileReceivingSummary,
} from "./mobile-receiving-view-model";

const SLA_HOURS = RECEIVING_SLA_DEFAULTS.inspectionHoursAfterArrival;

/** 필수 조치(문서·검수) → 체크리스트 줄. 문서 줄이 먼저다(해결 순서: 문서 → 검수). */
function blockersOf(row: ReceivingCaseRow): MobileReceivingBlocker[] {
  const docs = row.actions.filter((a) => a.kind === "doc");
  const inspections = row.actions.filter((a) => a.kind === "inspection");
  const out: MobileReceivingBlocker[] = docs.map((a) => ({
    kind: "doc" as const,
    label: a.shortLabel,
    detail: a.label,
    dependsOnUnresolved: false,
  }));
  for (const a of inspections) {
    out.push({
      kind: "inspection" as const,
      label: a.shortLabel,
      detail: a.label,
      // 문서가 남아 있으면 검수 줄은 회색 — 선행 조치 먼저.
      dependsOnUnresolved: docs.length > 0,
    });
  }
  return out;
}

function isOverdue(submittedAt: string | null, nowIso: string): boolean {
  if (!submittedAt) return false;
  const t = new Date(submittedAt).getTime();
  if (Number.isNaN(t)) return false;
  return new Date(nowIso).getTime() - t > SLA_HOURS * 3600_000;
}

export function buildMobileReceivingCardFromCase(
  row: ReceivingCaseRow,
  nowIso: string,
): MobileReceivingCard {
  const blockers = blockersOf(row);
  const overdue = isOverdue(row.submittedAt, nowIso);
  return {
    id: row.id,
    receivingNumber: row.displayNumber,
    vendorName: row.vendorName,
    lineCount: row.lineCount,
    receivedAt: row.submittedAt ?? "",
    blockers,
    blockerCount: blockers.length,
    // 「반영 준비됨」 은 정본 판정(postable)만 따른다 — 차단 줄이 비었다는 것과 같은 뜻이 아니다
    // (회신 대기 상태는 조치 목록이 비어 있어도 반영 대상이 아니다).
    status: row.postable ? "ready" : "blocked",
    // 첨부 시트 프리셋은 정본 문서 목록에서 따로 채운다(라인별 미첨부 세트는 입고안 계약에 없다).
    missingDocs: [],
    isOverdue: overdue,
    overdueLabel: overdue ? `${SLA_HOURS}시간 초과` : `${SLA_HOURS}시간 이내`,
  };
}

/** 리스트 + KPI 단일 소스. 정렬: 차단 먼저 → 지연 먼저 → 도착 오래된 순(도착 미상은 뒤). */
export function buildMobileReceivingSummaryFromCases(
  rows: ReceivingCaseRow[],
  nowIso: string,
): MobileReceivingSummary {
  const cards = rows
    .filter((r) => !r.isDone)
    .map((r) => buildMobileReceivingCardFromCase(r, nowIso))
    .sort((a, b) => {
      const ga = a.status === "blocked" ? 0 : 1;
      const gb = b.status === "blocked" ? 0 : 1;
      if (ga !== gb) return ga - gb;
      const oa = a.isOverdue ? 0 : 1;
      const ob = b.isOverdue ? 0 : 1;
      if (oa !== ob) return oa - ob;
      if (!a.receivedAt) return 1;
      if (!b.receivedAt) return -1;
      return a.receivedAt.localeCompare(b.receivedAt);
    });

  return {
    cards,
    blockedCount: cards.filter((c) => c.status === "blocked").length,
    readyCount: cards.filter((c) => c.status === "ready").length,
  };
}
