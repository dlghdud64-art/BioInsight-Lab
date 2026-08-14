/**
 * §dev-prod-db-separation — **데이터가 어디로 가는지**로 판정하는 가드
 *
 * 배경 (2026-08-10 실측):
 *   로컬 개발 환경의 `.env` 가 Supabase **운영 인스턴스**를 직접 가리키고 있다.
 *   ```
 *   DATABASE_URL host = aws-1-ap-northeast-1.pooler.supabase.com:6543
 *   DIRECT_URL   host = aws-1-ap-northeast-1.pooler.supabase.com:5432
 *   ```
 *
 *   이 상태에서 `NODE_ENV === "production"` 기반 가드는 **무력하다**.
 *   로컬은 `NODE_ENV=development` 이므로 가드가 통과시키고, 쓰기는 운영 DB 로 간다.
 *   실제로 `admin/seed` 의 프로덕션 가드가 이 구멍으로 빠져나가고 있었다.
 *
 * 원칙:
 *   **`NODE_ENV` 는 코드가 어디서 도는지를 말할 뿐, 데이터가 어디로 가는지를 말하지 않는다.**
 *   파괴적 동작의 주 기준은 **DB host** 다. `NODE_ENV` 는 보조로만 함께 본다.
 */

/** 운영 DB 로 판정하는 host 패턴 */
const PRODUCTION_DB_HOST = /(pooler\.supabase\.com|\.supabase\.co)/i;

/** 로컬로 인정하는 host 패턴 (명시 허용) */
const LOCAL_DB_HOST = /(localhost|127\.0\.0\.1|host\.docker\.internal)/i;

/**
 * §dev-prod-db-separation 2단계 (2026-08-12) — **호스트만으로는 갈리지 않는다**
 *
 * 실측: 개발용 Supabase 프로젝트를 만들어 `.env` 를 바꿨는데 가드가 **여전히
 * 운영으로 판정**했다. 두 프로젝트가 같은 `pooler.supabase.com` 을 쓰기 때문이다.
 * 호스트 패턴은 "Supabase 인가" 만 답하고 "**어느 프로젝트인가**" 는 답하지 못한다.
 *
 * 그래서 **project ref** 로 갈린다. Supabase 연결 문자열의 사용자명이
 * `postgres.<projectRef>` 형태다.
 *
 * ⚠️ 설계 원칙 — **fail-closed, 그리고 "어느 것이 개발인지" 를 이름으로 지정한다.**
 *   · `DEV_DATABASE_PROJECT_REF` 가 **현재 URL 의 ref 와 일치할 때만** 개발로 본다
 *   · 값이 없거나 다르면 **운영으로 판정**(기존 동작 유지)
 *   · boolean 플래그가 아니라 **ref 이름**이라, 이 변수를 운영 환경에 실수로 복사해도
 *     ref 가 달라 아무 효과가 없다. 그것이 boolean 대신 이름을 쓴 이유다
 *   · 값은 **비밀이 아니다**(프로젝트 식별자). 비밀번호는 여기서 다루지 않는다
 */
const SUPABASE_PROJECT_REF = /postgres\.([a-z0-9]{16,})/i;

function projectRefOf(url: string): string | null {
  const m = url.match(SUPABASE_PROJECT_REF);
  return m ? m[1].toLowerCase() : null;
}

/** 이 URL 이 "개발 프로젝트로 명시 지정된" 것인가. */
function isDeclaredDevProject(url: string): boolean {
  const declared = process.env.DEV_DATABASE_PROJECT_REF?.trim().toLowerCase();
  if (!declared) return false;
  const ref = projectRefOf(url);
  return ref !== null && ref === declared;
}

/**
 * 현재 연결된 DB 가 운영 인스턴스인가.
 *
 * `DATABASE_URL` 과 `DIRECT_URL` 중 **하나라도** 운영이면 true.
 * (마이그레이션은 DIRECT_URL 을 쓰므로 둘 다 봐야 한다 — 한쪽만 개발로 바꾼
 *  어긋난 상태도 운영으로 잡힌다. 의도된 보수성이다.)
 */
export function isProductionDatabase(): boolean {
  const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  if (urls.length === 0) return false;
  return urls.some(
    (u) =>
      PRODUCTION_DB_HOST.test(u) &&
      !LOCAL_DB_HOST.test(u) &&
      !isDeclaredDevProject(u),
  );
}

/**
 * 파괴적/대량 쓰기 동작에 명시 확인을 요구해야 하는가.
 *
 * DB host 가 주 기준이고 `NODE_ENV` 는 보조다 — 둘 중 하나라도 해당하면 요구한다.
 */
export function requiresDestructiveConfirmation(): boolean {
  return isProductionDatabase() || process.env.NODE_ENV === "production";
}
