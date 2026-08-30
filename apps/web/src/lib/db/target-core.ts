/**
 * §prisma-target-helper — DB 대상 확정의 **공통 핵심** (호영님 판정 A: 승계·통합).
 *
 * 왜 이 파일이 생겼나:
 *   `scripts/smoke/guard.ts` 와 `scripts/pilot/guard.ts` 가 **같은 기계**를 두 벌
 *   가지고 있었다 — URL 파싱 · Supabase project-ref 추출 · allow-list 파싱.
 *   `extractSupabaseProjectRef` 는 두 파일에 **글자까지 같은 사본**이었다
 *   (408 vs 406 바이트 — 차이는 빈 줄뿐).
 *   (나)-2 에서 승인 권한 정의 5개를 1개로 모은 것과 같은 방향이다:
 *   **정본 한 곳 + 나머지는 그것을 쓴다.**
 *
 * 🛑 정책은 여기 없다. 이 파일은 **키 이름을 모른다.**
 *   smoke 는 "prod ref 가 allow-list 에 있으면 거부"(prod 금지),
 *   pilot 은 "opt-in 토큰이 있어야 prod 허용" — **방향이 반대**다.
 *   둘 중 하나를 정본으로 고르면 다른 하나의 정책이 죽는다. 그래서 고르지 않고
 *   **공통 기계만** 내렸다. 각 wrapper 가 자기 env 키와 실패 사유를 그대로 소유한다.
 *   → 기존 guard 의 export 이름 · env 키 · 실패 사유 union · 메시지 문안은 **불변**이고,
 *     그 24개 단위 테스트가 이 통합의 회귀 증거다.
 *
 * 순수 함수만 둔다 — process.exit 도 console 도 없다.
 *
 * 🛑 위치가 `scripts/lib` 이 아니라 `src/lib/db` 인 이유 (2026-08-31 정정):
 *   `src/lib/security/production-database.ts` 가 이 파서를 쓰는데, 그 파일은
 *   `auth.ts` 가 import 하는 **런타임 경로**다. `tsconfig.include` 는 `src` 뿐이고
 *   `src → scripts` import 는 이 저장소에 **선례가 0** 이다(반대 방향만 있다:
 *   `scripts/db-guard.ts → ../src/lib/security/...`).
 *   런타임 코드가 스크립트 디렉터리를 물면 번들 축이 뒤집힌다 — 그래서 src 로 내린다.
 */

/** 쉼표 구분 allow-list 를 정규화한다. 빈 항목·공백은 버린다. */
export function parseAllowList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Supabase 연결 URL 에서 project-ref 를 뽑는다.
 *
 * 지원 형태 (ADR-001 Option B = Supabase):
 *   - Pooler:  postgresql://postgres.<REF>:pw@aws-0-REGION.pooler.supabase.com:6543/postgres
 *   - Direct:  postgresql://postgres:pw@db.<REF>.supabase.co:5432/postgres
 *
 * 비-Supabase URL(localhost 등)은 null 을 돌려준다 — 호출자가 거부한다.
 */
export function extractSupabaseProjectRef(u: URL): string | null {
  const username = decodeURIComponent(u.username || "");
  if (username.startsWith("postgres.")) {
    const ref = username.slice("postgres.".length);
    if (ref.length > 0) return ref;
  }

  const host = u.hostname;
  const directMatch = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (directMatch) return directMatch[1];

  return null;
}

export type RefResolution =
  | { readonly ok: true; readonly projectRef: string }
  | { readonly ok: false; readonly reason: "unparseable_url"; readonly parseError: string }
  | { readonly ok: false; readonly reason: "project_ref_not_extractable" };

/**
 * 원시 URL 문자열 → project-ref.
 *
 * 🔑 실패 사유는 **중립 이름**으로 돌려준다. wrapper 가 자기 env 키를 넣어
 *   메시지를 만든다 — 그래야 기존 guard 의 문안이 한 글자도 안 바뀐다.
 */
export function resolveProjectRef(rawUrl: string): RefResolution {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    return {
      ok: false,
      reason: "unparseable_url",
      parseError: err instanceof Error ? err.message : String(err),
    };
  }

  const projectRef = extractSupabaseProjectRef(parsed);
  if (!projectRef) return { ok: false, reason: "project_ref_not_extractable" };

  return { ok: true, projectRef };
}
