/**
 * §pricing-refresh P2 — Free 한도 enforce(광고=차단 정직성) + grandfather cutoff
 *
 * 현재 한도는 광고-only(enforce 0 = fake). 본 helper 가 생성 시점 실차단.
 *   - grandfather: env PRICING_ENFORCE_CUTOFF(ISO date) 이후 가입자만 enforce.
 *     미설정/무효 = 전원 grandfather(enforce 0 = 현행 무해). §inbound-rfq P5 flag gate 패턴 정합.
 *   - plan: org Subscription(없으면 FREE). 유료(maxX=null) = 무제한 통과.
 *   - 카운트: RFQ = 이번 달(createdAt>=월초), 재고 = 누적 총 품목. (§pricing-redesign: PO 한도 폐기)
 *   - 초과 시 PlanLimitError throw → 라우트가 429 + 한도·사용량·업그레이드 안내(정직).
 */

import { db } from "@/lib/db";
import { SubscriptionPlan, getPlanLimits } from "@/lib/plans";
import type { TrackingMode } from "@/lib/inventory/tracking-mode";

// §pricing-redesign — "orders"(PO) kind 제거. §pricing-enforce-p2 — "labelScan" 추가.
export type PlanLimitKind = "quotes" | "inventory" | "labelScan";

const KIND_LABEL: Record<PlanLimitKind, string> = {
  quotes: "견적 요청(RFQ)",
  inventory: "재고 품목",
  labelScan: "라벨 스캔",
};

/** 한도 초과 시 throw. 라우트가 instanceof 분기로 429 + 안내 응답. */
export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT";
  constructor(
    public readonly kind: PlanLimitKind,
    public readonly limit: number,
    public readonly used: number,
  ) {
    const unit = kind === "inventory" ? "품목" : kind === "labelScan" ? "회" : "건";
    const per = kind === "inventory" ? "" : "/월";
    super(
      `무료 플랜 ${KIND_LABEL[kind]} 한도(${limit}${unit}${per})에 도달했습니다. ` +
        `현재 ${used}${unit} 사용 중 — 계속하려면 플랜을 업그레이드해 주세요.`,
    );
    this.name = "PlanLimitError";
  }
}

/** org Subscription 으로 plan 판정. 없으면 FREE(billing route 패턴 정합). */
async function resolvePlan(userId: string): Promise<SubscriptionPlan> {
  const membership = await db.organizationMember.findFirst({
    where: { userId },
    select: {
      organization: { select: { subscription: { select: { plan: true } } } },
    },
  });
  const raw = membership?.organization?.subscription?.plan;
  return raw && ["FREE", "TEAM", "ORGANIZATION"].includes(raw)
    ? (raw as SubscriptionPlan)
    : SubscriptionPlan.FREE;
}

/**
 * 생성 직전 호출. 한도 초과면 PlanLimitError throw.
 * grandfather/유료/무제한/env미설정은 조용히 통과(무해).
 */
export async function enforcePlanLimit(
  userId: string,
  kind: PlanLimitKind,
): Promise<void> {
  // grandfather cutoff — env 미설정/무효 = 전원 grandfather(enforce 0).
  const cutoffRaw = process.env.PRICING_ENFORCE_CUTOFF;
  if (!cutoffRaw) return;
  const cutoff = new Date(cutoffRaw);
  if (Number.isNaN(cutoff.getTime())) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (!user) return; // 방어 — 사용자 미확인 시 차단하지 않음
  if (user.createdAt < cutoff) return; // 시행일 이전 가입자 = grandfather 보존

  const plan = await resolvePlan(userId);
  const limits = getPlanLimits(plan);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  let limit: number | null;
  let used: number;
  if (kind === "quotes") {
    limit = limits.maxQuotesPerMonth;
    if (limit === null) return; // 무제한
    used = await db.quote.count({ where: { userId, createdAt: { gte: monthStart } } });
  } else if (kind === "labelScan") {
    // §pricing-enforce-p2 — 라벨 스캔 월 한도(Free 10/이상 null). 이번달 LabelScanEvent count.
    limit = limits.maxLabelScansPerMonth;
    if (limit === null) return; // 무제한(Basic 이상)
    used = await db.labelScanEvent.count({ where: { userId, createdAt: { gte: monthStart } } });
  } else {
    limit = limits.maxItems;
    if (limit === null) return;
    used = await db.productInventory.count({ where: { userId } }); // 누적 총 품목
  }

  // 생성 전 체크: 이미 limit 도달이면 새 1건 추가가 한도 초과 → 차단.
  if (used >= limit) {
    throw new PlanLimitError(kind, limit, used);
  }
}

/**
 * §pricing-enforce-p2 (호영님 2026-06-27) — 추적 모드 플랜 게이팅.
 *   LOT / GMP_STRICT 는 plan.allowedTrackingModes 에 포함된 플랜(Pro)만 설정 가능.
 *   QUANTITY 는 모든 플랜 허용(다운그레이드 자유). 미허용 시 throw → 라우트 403 + 품위 안내.
 *   read-only plan 조회만(migration 0). grandfather 없음(파일럿, 호영님 결정).
 */
export class TrackingModePlanError extends Error {
  readonly code = "TRACKING_MODE_PLAN";
  constructor(
    public readonly mode: TrackingMode,
    public readonly plan: SubscriptionPlan,
  ) {
    super(
      `${mode} 추적 모드는 Pro 플랜에서만 사용할 수 있습니다. ` +
        `LOT / GMP 추적이 필요하면 플랜을 업그레이드해 주세요.`,
    );
    this.name = "TrackingModePlanError";
  }
}

/** 설정 직전 호출. 미허용 plan 이 LOT/GMP_STRICT 설정 시 TrackingModePlanError throw. */
export async function assertTrackingModeAllowed(
  userId: string,
  mode: TrackingMode,
): Promise<void> {
  if (mode === "QUANTITY") return; // 항상 허용
  const plan = await resolvePlan(userId);
  const limits = getPlanLimits(plan);
  if (!limits.allowedTrackingModes.includes(mode)) {
    throw new TrackingModePlanError(mode, plan);
  }
}
