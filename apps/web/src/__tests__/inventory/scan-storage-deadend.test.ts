import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §scan-storage-deadend (2026-09-02 호영님 실측 · 3회 연속 등록 실패) —
 *
 * 배경: 이미지 저장소(STORAGE_PROVIDER) 미설정이면 runOcrPipeline 이 업로드를 skip 해
 *   OcrJob 이 생성되지 않고(jobId null), smart-receiving 는 ocrJobId 를 필수(400)로 받는다.
 *   그래서 "인식은 성공한 것처럼 보이고 마지막 등록에서만 실패" 하는 dead end 가 났다 —
 *   placeholder success 의 변형이다.
 *
 * 잠그는 계약:
 *   1) jobId 가 없으면 등록 버튼이 **비활성** (누르고 나서 실패시키지 않는다)
 *   2) 차단 사유를 **미리** 화면에 노출 + 버튼 라벨에 인라인(툴팁 금지 — 레포 선례)
 *   3) 발주 매핑 경로(selectedOrderId)는 ocrJobId 를 쓰지 않으므로 이 차단에서 제외
 *   4) /api/health 가 저장소 상태를 노출 — 대시보드 접근 없이 원인(키 vs 토큰)을 가른다
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const HEALTH = "src/app/api/health/route.ts";
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

describe("§scan-storage-deadend (1) — jobId 없으면 등록 잠금", () => {
  it("storageBlocked 파생 — jobId null + 발주 매핑 아님", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/const scanJobId = scanResult\?\.ocrMetadata\?\.jobId \?\? null;/);
    expect(src).toMatch(/const storageBlocked = !selectedOrderId && !scanJobId;/);
  });

  it("등록 버튼 disabled 에 storageBlocked 포함 (①접두사: aria- 제외)", () => {
    const src = stripComments(read(MODAL));
    // ② 창 시작점 — 여는 태그(<Button)부터 열어 속성 앞부분을 창 안에 둔다.
    const btn = src.match(
      /<Button[\s\S]{0,160}?data-testid="smart-receiving-submit-cta"[\s\S]{0,1200}?className=/,
    )?.[0];
    expect(btn, "submit 버튼 창").toBeTruthy();
    expect(btn!).toMatch(/(?<!aria-)disabled=\{[\s\S]{0,120}?storageBlocked/);
  });
});

describe("§scan-storage-deadend (2) — 사유를 미리 드러낸다", () => {
  it("차단 안내 블록 실재 (인식 화면에서 등록 전에 노출)", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/storageBlocked && \(/);
    expect(src).toMatch(/data-testid="srm-storage-blocked"/);
    // 사유를 단정하지 않는다 — jobId null 원인은 저장소 외에도 있다(OcrJob.create 실패 등).
    expect(src).toMatch(/인식 작업 기록이 남지 않아 입고 등록을 완료할 수 없습니다/);
    expect(src).not.toMatch(/저장소가 설정되지 않아/);
    expect(src).toMatch(/ocrMetadata\?\.skipReason/);
  });

  it("버튼 라벨에 차단 사유 인라인 (툴팁 금지 선례)", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/storageBlocked\s*\?\s*"입고 등록 · 인식 기록 없음"/);
  });
});

describe("§scan-storage-deadend (3) — health 진단 축", () => {
  it("provider · hasBlobToken · ready 노출 (값이 아니라 존재 여부)", () => {
    const src = stripComments(read(HEALTH));
    expect(src).toMatch(/provider: process\.env\.STORAGE_PROVIDER \|\| null/);
    expect(src).toMatch(/hasBlobToken: !!process\.env\.BLOB_READ_WRITE_TOKEN/);
    // 이름이 측정 내용과 일치해야 한다 — env 존재만 보면서 "ready"(업로드 가능)를
    // 함의하면 거짓 신호가 된다(2026-09-02 호영님 지적, 내 설계 결함 정정).
    expect(src).toMatch(/envConfigured:/);
    expect(src).not.toMatch(/^\s*ready:/m);
    // 토큰 값 자체는 절대 내보내지 않는다.
    expect(src).not.toMatch(/BLOB_READ_WRITE_TOKEN\?\.slice|token: process\.env\.BLOB_READ_WRITE_TOKEN[^!]/);
  });
});

describe("§scan-storage-deadend (4) — 실패 사유 전달 경로 (지어내지 않는다)", () => {
  const PIPELINE = "src/lib/ocr/run-quote-ocr-pipeline.ts";
  const ROUTE = "src/app/api/quotes/parse-image/route.ts";

  it("파이프라인이 각 catch 의 사유를 skipReason 으로 캡처", () => {
    const src = stripComments(read(PIPELINE));
    expect(src).toMatch(/skipReason = `image-upload: \$\{\(uploadErr as Error\)\.message\}`/);
    expect(src).toMatch(/skipReason = `ocrjob-create: \$\{\(dbErr as Error\)\.message\}`/);
    expect(src).toMatch(/return \{[\s\S]{0,200}?skipReason,/);
  });

  it("라우트가 ocrMetadata 로 사유를 실어 보낸다", () => {
    const src = stripComments(read(ROUTE));
    expect(src).toMatch(/skipReason: pipelineResult\.skipReason \?\? null/);
  });
});

describe("§scan-storage-deadend (5) — @vercel/blob 번들 파싱 회피 (원인 조치)", () => {
  const NEXT_CONFIG = "next.config.js";
  const PKG = "package.json";

  it("서버 외부 패키지로 선언 — 번들러가 ESM/private field 를 파싱하지 않는다", () => {
    // 증상: `image-upload: Unexpected identifier '#H'` (skipReason 계측이 포착).
    //   @vercel/blob 2.x = ESM + private class field. Next 14 서버 번들 경로에서 파싱 실패.
    const src = read(NEXT_CONFIG);
    expect(src).toMatch(/serverComponentsExternalPackages:\s*\[[^\]]*'@vercel\/blob'/);
    // 기존 외부화 대상 회귀 0.
    expect(src).toMatch(/'pdf-parse'/);
    expect(src).toMatch(/'pdfjs-dist'/);
  });

  it("engines.node 가 라이브러리 요구(>=20)를 선언한다", () => {
    const pkg = JSON.parse(read(PKG));
    expect(pkg.engines?.node).toBe(">=20.0.0");
  });

  it("health 가 런타임 Node 버전을 노출 — 버전 가설을 관측으로 가른다", () => {
    expect(stripComments(read("src/app/api/health/route.ts"))).toMatch(
      /node: process\.version/,
    );
  });
});

describe("§scan-storage-deadend (6) — 존재 ≠ 유효 (3회차 오진 정정)", () => {
  const HEALTH2 = "src/app/api/health/route.ts";
  const PROBE = "src/lib/health/blob-token-probe.ts";

  it("tokenValid 는 실호출로만 판정 — 미요청 시 null(미측정)", () => {
    const src = stripComments(read(PROBE));
    expect(src).toMatch(/tokenValid: null, probeError: null, cached: false/);
    expect(src).toMatch(/await list\(\{ limit: 1 \}\)/);
    expect(src).toMatch(/tokenValid: true/);
    expect(src).toMatch(/tokenValid: false/);
  });

  it("공개 엔드포인트 방어 — 명시 요청 + 캐시", () => {
    const health = stripComments(read(HEALTH2));
    // 인자 없는 GET() 직접 호출(기존 sentinel)도 살아야 하므로 optional + 안전 파싱.
    // 시그니처는 required(Next 타입 검사) + 런타임 방어(인자 없는 GET() 직접 호출 보존).
    expect(health).toMatch(/export async function GET\(request: Request\)/);
    expect(health).toMatch(/\(request as Request \| undefined\)\?\.url/);
    expect(health).toMatch(/searchParams\.get\("storage"\) === "probe"/);
    const probe = stripComments(read(PROBE));
    expect(probe).toMatch(/TTL_MS = 60_000/);
    expect(probe).toMatch(/Date\.now\(\) - cache\.at < TTL_MS/);
  });

  it("진단이 데이터를 만들지 않는다 — 쓰기(put) 호출 0", () => {
    expect(stripComments(read(PROBE))).not.toMatch(/\bput\(/);
  });

  it("health 가 tokenValid·blobStoreId 를 노출 (대조 축)", () => {
    const health = stripComments(read(HEALTH2));
    expect(health).toMatch(/blobStoreId: extractBlobStoreId\(process\.env\.BLOB_READ_WRITE_TOKEN\)/);
    expect(health).toMatch(/\.\.\.\(await probeBlobToken\(wantsStorageProbe\)\)/);
  });
});
