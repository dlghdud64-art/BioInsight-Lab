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
 * 현재 연결된 DB 가 운영 인스턴스인가.
 *
 * `DATABASE_URL` 과 `DIRECT_URL` 중 **하나라도** 운영 패턴이면 true.
 * (마이그레이션은 DIRECT_URL 을 쓰므로 둘 다 봐야 한다)
 */
export function isProductionDatabase(): boolean {
  const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  if (urls.length === 0) return false;
  return urls.some((u) => PRODUCTION_DB_HOST.test(u) && !LOCAL_DB_HOST.test(u));
}

/**
 * 파괴적/대량 쓰기 동작에 명시 확인을 요구해야 하는가.
 *
 * DB host 가 주 기준이고 `NODE_ENV` 는 보조다 — 둘 중 하나라도 해당하면 요구한다.
 */
export function requiresDestructiveConfirmation(): boolean {
  return isProductionDatabase() || process.env.NODE_ENV === "production";
}
