/**
 * §quotes-mobile-refine P2 #reminder-targets — 리마인더 대상 파생 (순수 함수, DB 무접촉)
 *
 * 정본: docs/plans/PLAN_quotes-mobile-refine.md Phase 2 + 호영님 지시문(2026-07-21) §2 리마인더(4a).
 *   지시문 규칙: "대상은 **미회신 공급사만** 자동 필터. 회신 완료 공급사 제외." + D+N 경과 배지.
 *
 * canonical 규칙 단일화:
 *   - replied 판정은 `hasVendorReplied` 하나로 통일 — supplier-avatars.toSuppliers 가 이 술어를
 *     import 해 사용(파생 규칙 이원화 0). lib → component 역참조 없음(레이어 정방향).
 *   - 발송 계약은 기존 `POST /api/quotes/[id]/vendor-requests` (`isReminder: true`) 재사용 —
 *     서버가 `quote_request_resend` 거버넌스·리마인더 템플릿·24h rate-limit·활동 로그를 이미 보유(P0-G1).
 *
 * 정직성:
 *   - daysSince 는 createdAt 실값에서만 계산. 미상이면 null(가짜 경과일 0) — UI 는 배지 생략.
 *   - email 미상 대상도 목록에 남긴다(사실 그대로 노출) — sendable=false 로 표시해
 *     발송 페이로드에서만 제외. 숨기면 "미회신 N곳" 카운트가 거짓이 된다.
 */

const DAY_MS = 86_400_000;

export interface VendorRequestLike {
  vendorName?: string | null;
  vendorEmail?: string | null;
  respondedAt?: string | Date | null;
  status?: string | null;
  createdAt?: string | Date | null;
}

/** replied 판정 단일 술어 — toSuppliers(supplier-avatars)와 공유. */
export function hasVendorReplied(v: Pick<VendorRequestLike, "respondedAt" | "status">): boolean {
  return v.respondedAt != null || v.status === "RESPONDED";
}

export interface ReminderTarget {
  /** 발송 대상 이메일. 미상이면 null — sendable=false, 페이로드 제외. */
  email: string | null;
  /** 표시명 — vendorName → email 도메인 → "공급사" (toSuppliers 와 동일 fallback). */
  name: string;
  /** 아바타 이니셜(표시명 첫 글자). */
  initial: string;
  /** 요청 후 경과일(D+N). createdAt 미상이면 null — 배지 생략(가짜 경과일 0). */
  daysSince: number | null;
  /** email 보유 = 발송 가능. */
  sendable: boolean;
}

/** 미회신 공급사만 반환(우선 지시문 규칙). 회신 완료는 제외. */
export function deriveReminderTargets(
  vendorRequests: VendorRequestLike[] | undefined,
  now: Date = new Date(),
): ReminderTarget[] {
  const nowMs = now.getTime();
  return (vendorRequests ?? [])
    .filter((v) => !hasVendorReplied(v))
    .map((v) => {
      const email = v.vendorEmail?.trim() || null;
      const name =
        v.vendorName?.trim() ||
        (email ? email.split("@")[1] || email : "공급사");
      let daysSince: number | null = null;
      if (v.createdAt != null) {
        const created = new Date(v.createdAt).getTime();
        if (Number.isFinite(created) && created <= nowMs) {
          daysSince = Math.floor((nowMs - created) / DAY_MS);
        }
      }
      return { email, name, initial: name.slice(0, 1), daysSince, sendable: email != null };
    });
}

/** 발송 페이로드 (기존 vendor-requests 계약 정합 — batch-reminder-sheet 와 동일 형태). */
export function toReminderVendorsPayload(
  targets: ReminderTarget[],
): Array<{ email: string; name: string }> {
  return targets
    .filter((t): t is ReminderTarget & { email: string } => t.sendable && t.email != null)
    .map((t) => ({ email: t.email, name: t.name }));
}
