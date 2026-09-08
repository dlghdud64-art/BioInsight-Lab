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
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";
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

/**
 * org Subscription 으로 plan 판정. 없으면 FREE(billing route 패턴 정합).
 *
 * §invite-flow Phase 2-7 — **조직을 여기서 다시 고르지 않는다.**
 *   이전에는 `findFirst({ where: { userId } })` 로 첫 멤버십을 골랐다. 그러면 호출자가
 *   이미 활성 조직을 정해 쓰고 있어도 **한도 판정만 다른 조직의 플랜**으로 날 수 있다 —
 *   호출자는 org-B 에 견적을 만드는데 한도는 org-A 플랜으로 재는 상태다.
 *   그래서 조직은 **호출자가 결정해 넘긴다**(지시문: "헬퍼 안에서 다시 해석하면 호출자와
 *   다른 조직을 고를 수 있다"). 넘어오지 않으면(하위 호환) 활성 조직으로 해석한다.
 */
async function resolvePlan(
  userId: string,
  organizationId?: string | null,
): Promise<SubscriptionPlan> {
  const orgId = organizationId ?? (await resolveActiveOrganizationId({ userId }));
  if (!orgId) return SubscriptionPlan.FREE;
  const membership = await db.organizationMember.findFirst({
    where: { userId, organizationId: orgId },
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
 * §billing-redesign P1: 한도·사용량 **계산 단일점**.
 *
 * 왜 여기(같은 파일)인가: 이 계산식은 enforce(생성 차단)와 /billing 화면(사용량 표시)이
 *   함께 쓴다. 두 곳이 각자 세면 화면이 "3/3 한도 도달" 이라 말하는데 생성은 통과하는
 *   (또는 그 반대) 어긋남이 조용히 생긴다. 실제로 §billing-surface-unify 이전 판본이
 *   `quotesLimit: 10` 을 지어내 한 화면이 한도를 3 이라고도 10 이라고도 말했다.
 *   별도 모듈로 빼지 않는 이유는 sentinel 이 이 파일의 계산식 문자열을 핀하고 있어서다
 *   (label-scan-quota-p2b:49 등). 계약을 옮기지 않고 호출자만 늘린다.
 *
 * enforce 는 kind 1개만 세고(생성 경로 1쿼리 유지), 화면은 4지표를 각각 부른다.
 */
export function planLimitFor(
  kind: PlanLimitKind,
  limits: ReturnType<typeof getPlanLimits>,
): number | null {
  if (kind === "quotes") return limits.maxQuotesPerMonth;
  if (kind === "labelScan") return limits.maxLabelScansPerMonth;
  return limits.maxItems;
}

/** 이번 달 1일 00:00(로컬). 월 한도의 기준점. */
export function planUsageMonthStart(): Date {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

/** kind 별 현재 사용량. 한도 비교와 화면 표시가 **같은 쿼리**를 쓴다. */
export async function countUsageFor(
  kind: PlanLimitKind,
  userId: string,
): Promise<number> {
  const monthStart = planUsageMonthStart();
  if (kind === "quotes") {
    return db.quote.count({ where: { userId, createdAt: { gte: monthStart } } });
  }
  if (kind === "labelScan") {
    // §pricing-enforce-p2 — 라벨 스캔 월 한도(Free 10/이상 null). 이번달 LabelScanEvent count.
    return db.labelScanEvent.count({ where: { userId, createdAt: { gte: monthStart } } });
  }
  return db.productInventory.count({ where: { userId } }); // 누적 총 품목
}

/**
 * 생성 직전 호출. 한도 초과면 PlanLimitError throw.
 * grandfather/유료/무제한/env미설정은 조용히 통과(무해).
 */
export async function enforcePlanLimit(
  userId: string,
  kind: PlanLimitKind,
  /** 호출자가 결정한 조직. 미전달이면 활성 조직으로 해석(하위 호환). §invite-flow Phase 2-7 */
  organizationId?: string | null,
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

  const plan = await resolvePlan(userId, organizationId);
  const limits = getPlanLimits(plan);

  const limit = planLimitFor(kind, limits);
  if (limit === null) return; // 무제한

  const used = await countUsageFor(kind, userId);

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
