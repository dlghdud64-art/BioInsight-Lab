/**
 * §scan-storage-deadend (2026-09-02) — Blob 토큰 **유효성** 프로브.
 *
 * 왜 별 모듈인가: 이 저장소에서 같은 오진이 세 번 났다 —
 *   ① `ready` 가 env 존재만 보고 "업로드 가능" 을 함의
 *   ② UI 가 jobId null 을 "저장소 미설정" 으로 단정
 *   ③ `hasBlobToken: true` 초록불인데 실제 호출은 401(Access denied)
 * 공통 형태는 **존재를 유효성으로 읽은 것**이다. 그래서 이 축은 문자열이 아니라
 * 실제 호출 결과로만 판정한다.
 *
 * 비용·남용 방어: /api/health 는 인증이 없다. 매 호출마다 외부 API 를 때리면
 *   공개 엔드포인트가 비용·부하 벡터가 된다. 그래서
 *   · 명시 요청(`?storage=probe`)일 때만 실행하고
 *   · 결과를 60초 캐시한다(연타해도 1회).
 *   미요청 시 `tokenValid: null` = **미측정**이다. 측정하지 않은 것에 초록불을 주지 않는다.
 */

export interface BlobTokenProbeResult {
  /** true=유효 · false=거부 · null=미측정(요청 안 했거나 토큰 자체가 없음) */
  tokenValid: boolean | null;
  /** 실패 시 실제 메시지(진단축 — 지어내지 않는다) */
  tokenError: string | null;
  /** 캐시된 결과를 돌려줬는지 */
  cached: boolean;
}

const TTL_MS = 60_000;
let cache: { at: number; result: BlobTokenProbeResult } | null = null;

export const BLOB_TOKEN_MARKER = "vercel_blob_rw_";

export interface BlobTokenShape {
  /**
   * 🛑 원문 15자를 그대로 내보내지 않는다 — 값이 blob 토큰이 **아닐 때** 그 15자는
   *    다른 서비스의 진짜 시크릿 앞부분이 된다(/api/health 는 공개다).
   *    판별에 필요한 건 "그 마커로 시작하는가" 뿐이므로 분류값만 돌려준다.
   *    "vercel_blob_rw_" = 마커 일치 · "other" = 불일치 · null = 값 없음
   */
  blobTokenPrefix: string | null;
  /** 전체 길이 — 붙여넣기 잘림 판별(정상 토큰은 대략 70자 이상). */
  blobTokenLength: number;
  /** 앞뒤 공백·따옴표 오염 없음. false = 붙여넣기 오염(따옴표·개행 포함). */
  blobTokenClean: boolean | null;
}

/** 토큰 값의 **형태**만 기술한다 — 시크릿 문자는 한 글자도 반환하지 않는다. */
export function describeBlobToken(token: string | undefined): BlobTokenShape {
  if (!token) {
    return { blobTokenPrefix: null, blobTokenLength: 0, blobTokenClean: null };
  }
  const clean = token.trim() === token && !/^["']|["']$/.test(token);
  return {
    blobTokenPrefix: token.startsWith(BLOB_TOKEN_MARKER) ? BLOB_TOKEN_MARKER : "other",
    blobTokenLength: token.length,
    blobTokenClean: clean,
  };
}

/**
 * 토큰 접두사에서 store id 만 뽑는다 — `vercel_blob_rw_<storeId>_<secret>`.
 * 비밀 부분은 절대 반환하지 않는다. Vercel Storage 탭의 store 와 대조하기 위한 식별자.
 */
export function extractBlobStoreId(token: string | undefined): string | null {
  if (!token) return null;
  const m = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  return m ? m[1] : null;
}

/** 실제 Blob API 를 1회 호출해 토큰 유효성을 잰다. 실패해도 throw 하지 않는다. */
export async function probeBlobToken(
  requested: boolean,
): Promise<BlobTokenProbeResult> {
  if (!requested) {
    return { tokenValid: null, tokenError: null, cached: false };
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { tokenValid: null, tokenError: "token absent", cached: false };
  }
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { ...cache.result, cached: true };
  }
  let result: BlobTokenProbeResult;
  try {
    // 읽기 1건만 — 쓰기 없음(진단이 데이터를 만들지 않는다).
    const { list } = await import("@vercel/blob");
    await list({ limit: 1 });
    result = { tokenValid: true, tokenError: null, cached: false };
  } catch (err) {
    result = {
      tokenValid: false,
      tokenError: (err as Error).message,
      cached: false,
    };
  }
  cache = { at: Date.now(), result };
  return result;
}
