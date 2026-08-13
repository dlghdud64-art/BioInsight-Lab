/**
 * Workspace slug 생성 유틸
 *
 * Workspace.slug 는 URL-friendly 식별자로, schema 상 `@unique` + 정규식
 * `^[a-z0-9-]+$`, `min 2 chars` 를 만족해야 한다.
 * 본 유틸은 Organization 이름을 기반으로 후보 slug 를 만들고, 충돌 시
 * 숫자 suffix → 랜덤 hex suffix 순으로 폴백한다.
 *
 * 트랜잭션 안에서 호출될 수 있도록 `Prisma.TransactionClient` 를 받는다.
 */
import type { Prisma } from "@prisma/client";

/**
 * §onboarding-blocker 3a — `node:crypto` → **전역 Web Crypto** (2026-08-12).
 *
 * 이유: 이 모듈은 `lib/api/organizations.ts` → `auth.ts` → **`middleware.ts`** 로
 *   전이 import 된다. 미들웨어는 **Edge 런타임**이라 `node:` 스킴을 번들할 수 없고,
 *   3a 에서 `auth.ts` 가 `createOrganization` 을 부르기 시작하자 곧바로
 *   `Module build failed: UnhandledSchemeError: Reading from "node:crypto"` 로 빌드가 깨졌다.
 *
 *   §execution-id-collision 에서 같은 판단을 이미 했다(클라이언트 번들 보호).
 *   여기서는 이유가 하나 더 있다 — **Edge 런타임**.
 *
 * 산출물 동형: 이전 `randomBytes(4).toString("hex")` 와 같은 **8자리 hex**.
 */
function randomHex4(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** slug 후보의 최대 길이 — 충돌 suffix 여유 10자 확보 */
const SLUG_BASE_MAX = 40;
/** 최종 slug 의 최대 길이 (DB 컬럼 길이 제한보다 충분히 작게 유지) */
const SLUG_FINAL_MAX = 50;

/**
 * 임의 문자열을 slug 후보로 정규화한다.
 * - 소문자화
 * - 영문/숫자가 아닌 모든 문자를 하이픈으로 치환
 * - 연속 하이픈 축약 + 양끝 하이픈 제거
 * - SLUG_BASE_MAX 길이로 절단
 *
 * 한글·공백 등만 있는 입력은 빈 문자열을 반환한다.
 */
export function normalizeSlugBase(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, SLUG_BASE_MAX);
  return cleaned.length >= 2 ? cleaned : "";
}

/**
 * Organization 이름 → 충돌 없는 Workspace slug.
 * 트랜잭션 클라이언트를 받아 DB 조회를 트랜잭션에 귀속시킨다.
 */
export async function generateUniqueWorkspaceSlug(
  tx: Prisma.TransactionClient,
  organizationName: string,
): Promise<string> {
  const fallbackBase = () => `org-${randomHex4()}`;
  const base = normalizeSlugBase(organizationName) || fallbackBase();

  // 1차: base 그대로
  if (!(await tx.workspace.findUnique({ where: { slug: base } }))) {
    return base;
  }

  // 2~20: 숫자 suffix
  for (let n = 2; n <= 20; n++) {
    const candidate = `${base}-${n}`.slice(0, SLUG_FINAL_MAX);
    if (!(await tx.workspace.findUnique({ where: { slug: candidate } }))) {
      return candidate;
    }
  }

  // 21차 이상: 랜덤 hex (충돌 가능성 사실상 0)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomHex4()}`.slice(0, SLUG_FINAL_MAX);
    if (!(await tx.workspace.findUnique({ where: { slug: candidate } }))) {
      return candidate;
    }
  }

  // 최후의 수단: 완전 랜덤
  return fallbackBase();
}
