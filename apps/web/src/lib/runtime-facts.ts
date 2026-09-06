/**
 * §runtime-facts (호영님 2026-09-05, (A)) — 실패를 가르는 축을 실행 환경에서 읽는다.
 *
 * 왜:
 *   P2028 이 났는데 원인을 **확정하지 못했다.** 가설 둘을 세워 둘 다 실측으로 반증했다:
 *     ① 트랜잭션 타임아웃 → 왕복 38ms · 13왕복 ≈ 494ms. 5000ms 근처도 아니다.
 *     ② pgbouncer(6543) interactive tx 미지원 → 로컬에서 40쿼리까지 통과. 재현 실패.
 *   남은 관측은 에러 문구의 `or was obtained before disconnecting` 뿐이고,
 *   그건 **커넥션 유실** 쪽을 가리키지만 근거가 없다.
 *
 * 🛑 계측 없이 고치면 고친 게 먹었는지도 모른다(호영님).
 *   `finishReason` 을 읽고서야 잘림이 갈린 것과 같은 자리다.
 *   아래 세 축이 있으면 **다음 실패 1회로** "왕복 지연" 과 "커넥션 유실" 이 갈린다.
 *
 * 노출 원칙: 값이 아니라 **분류·형태**만 싣는다. 접속 문자열·자격증명은 절대 싣지 않는다
 *   (§scan-storage-deadend 의 blobToken 분류값 선례).
 */

/**
 * 이 함수 인스턴스가 처음 깨어난 시각.
 *
 * 🔑 모듈 최상위에서 잡으므로 **콜드스타트마다 새로 설정**된다. 웜 인스턴스에서는
 *   이전 값이 그대로 남는다 → 요청 시각과의 차이가 인스턴스 수명이다.
 *   `or was obtained before disconnecting` 가설의 판별 축: 방금 뜬 인스턴스에서만
 *   터지면 커넥션 유실, 수명과 무관하면 다른 원인이다.
 */
const INSTANCE_STARTED_AT = Date.now();

/** 이 인스턴스가 처리한 요청 수. 1이면 콜드스타트 직후다. */
let invocationCount = 0;

export interface RuntimeFacts {
  /** Vercel 리전(`icn1`·`iad1` …). 로컬은 null. DB 는 ap-northeast-1(도쿄)이다. */
  region: string | null;
  /** 이 인스턴스가 뜬 뒤 경과 ms. 작을수록 콜드스타트에 가깝다. */
  instanceAgeMs: number;
  /** 이 인스턴스의 몇 번째 요청인가. 1 = 콜드스타트 직후. */
  invocation: number;
  /**
   * `DATABASE_URL` 의 `connection_limit` 값. 없으면 null.
   * 🔑 Vercel 서버리스 권장은 1이고, 1이면 인스턴스 재활용 시
   *   커넥션이 끊긴 채로 트랜잭션이 시작될 수 있다(호영님 지적 축).
   */
  connectionLimit: number | null;
  /** pgbouncer 경유 여부 — 접속 문자열이 아니라 **형태**만. */
  pgbouncer: boolean;
  /** 접속 포트(6543 = transaction pooler · 5432 = session). 값이 아니라 형태다. */
  dbPort: number | null;
}

function parseDbUrlFacts(raw: string | undefined): Pick<
  RuntimeFacts,
  "connectionLimit" | "pgbouncer" | "dbPort"
> {
  const url = raw ?? "";
  if (!url) return { connectionLimit: null, pgbouncer: false, dbPort: null };
  const cl = url.match(/[?&]connection_limit=(\d+)/);
  const port = url.match(/:(\d{2,5})\/[^/?]*(?:\?|$)/);
  return {
    connectionLimit: cl ? Number(cl[1]) : null,
    pgbouncer: /[?&]pgbouncer=true/.test(url),
    dbPort: port ? Number(port[1]) : null,
  };
}

/** 이번 요청 시점의 실행 환경 사실. 호출할 때마다 invocation 이 하나 는다. */
export function readRuntimeFacts(): RuntimeFacts {
  invocationCount += 1;
  return {
    region: process.env.VERCEL_REGION ?? null,
    instanceAgeMs: Date.now() - INSTANCE_STARTED_AT,
    invocation: invocationCount,
    ...parseDbUrlFacts(process.env.DATABASE_URL),
  };
}

/** 실패 사유에 덧붙일 한 줄. 사람이 읽고 축을 가를 수 있게 짧게. */
export function describeRuntimeFacts(f: RuntimeFacts): string {
  return [
    `region=${f.region ?? "(로컬)"}`,
    `instanceAge=${f.instanceAgeMs}ms`,
    `invocation=${f.invocation}`,
    `connLimit=${f.connectionLimit ?? "(없음)"}`,
    `pgbouncer=${f.pgbouncer}`,
    `dbPort=${f.dbPort ?? "(없음)"}`,
  ].join(" · ");
}
