/**
 * §onboarding-blocker 3a — 가입 시 자동 생성되는 조직의 **임시 이름** 단일 출처
 *
 * 배경 (실측 2026-08-12):
 *   가입 직후 사용자는 조직이 0 이고, 조직 생성이 workspace 를 만드는 **유일 경로**라
 *   권한 공집합 · 멤버십 요구 라우트 37개 차단 · workspaceId 요구 라우트 17개 빔 상태로
 *   퍼블릭 랜딩에 남았다. 유도 화면조차 없었다.
 *
 * 호영님 결정 (2026-08-12) — **자동 생성 + 즉시 이름 확인**:
 *   · 자동 생성만 하고 이름을 지어내면 §fabricated-data-surface 에 닿는다
 *   · 유도 화면 단독은 실험실 사용자가 "조직" 개념 앞에서 이탈한다
 *   → 시스템이 **제안**하고 사용자가 **확정**한다. 확정 전에는 임시임이 화면에 드러난다.
 *
 * ⚠️ **회사명을 추측하지 않는다.** 이메일 도메인에서 회사를 유추하면, 틀렸을 때
 *   사용자가 "얘가 우리 회사를 안다고 착각하나" 를 느낀다(호영님). 표시 이름 또는
 *   이메일 **로컬파트**만 쓴다.
 *
 * ⚠️ 임시 여부를 **스키마 플래그로 저장하지 않는다** — 3a 는 스키마 무관 범위다.
 *   대신 "이름이 아직 이 함수의 산출물과 같은가" 로 판정한다(`isProvisionalOrgName`).
 *   사용자가 무엇으로든 바꾸면 임시가 아니다. 기본값 그대로 확정한 경우는 계속
 *   임시로 보이지만, 그 오탐은 배너 1줄이므로 **없는 정보를 지어내는 것보다 낫다**.
 */

const SUFFIX = " 조직";

/** 이메일 로컬파트(도메인 제외) 또는 표시 이름에서 기본 라벨을 만든다. */
function baseLabel(user: { name?: string | null; email?: string | null }): string | null {
  const displayName = user.name?.trim();
  if (displayName) return displayName;

  const email = user.email?.trim();
  if (!email) return null;
  // ⚠️ 로컬파트만. `@` 뒤(도메인 = 회사 추측 재료)는 **쓰지 않는다**.
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  // 구분자를 공백으로만 정리한다 — 이름을 꾸미지 않는다.
  return local.replace(/[._-]+/g, " ").trim() || null;
}

/**
 * 자동 생성 조직의 임시 이름. 도출 불가면 `null` —
 * **지어내지 않는다.** 호출자는 null 이면 자동 생성을 건너뛰고 사용자가 직접 만들게 한다.
 */
export function deriveDefaultOrgName(
  user: { name?: string | null; email?: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  const base = baseLabel(user);
  return base ? `${base}${SUFFIX}` : null;
}

/**
 * 이 조직 이름이 아직 **시스템 제안 그대로**인가 (= 사용자가 확정하지 않았는가).
 * 이름 확인 프롬프트·배너의 단일 판정 근거다.
 */
export function isProvisionalOrgName(
  orgName: string | null | undefined,
  user: { name?: string | null; email?: string | null } | null | undefined,
): boolean {
  if (!orgName) return false;
  const derived = deriveDefaultOrgName(user);
  if (!derived) return false;
  return orgName.trim() === derived;
}
