/**
 * §quote-scan-public-storage P0-b2 (호영님 2026-09-13 승인) ·
 * **OCR 원본(견적서·라벨)은 public 으로 올리지 않고, 브라우저는 blob URL 을 받지 않는다.**
 *
 * ── 왜 ──
 * 2026-09-12 실측: `uploadOcrImage` · `uploadOcrPdf` 가 `access: "public"` 에 키가 `…/${hash}.ext` 였다.
 *   · SHA-256 키는 접근 통제가 아니다. 견적서는 공급사가 여러 고객에게 보내므로
 *     **같은 파일을 가진 누구나 URL 을 재현**할 수 있었다(호영님 등급 상향).
 *   · coa-recognize 가 그 URL 을 응답 JSON 에 싣고, 화면이 `<img src>` 에 넣었다 →
 *     DOM·네트워크 탭에 노출되고 인증 없이 열렸다(prod 6건 · 백업 시 http 200).
 *
 * ── 이 파일이 보는 것 ──
 *   1. 업로드 2곳 private + 비결정적 키
 *   2. 프록시가 조직 대조 → 감사 → 스트림 순서로 연다
 *   3. coa-recognize 응답이 blob URL 이 아니라 프록시 경로다
 *
 * ── 이 파일이 안 보는 것 (조항 11 · 자기 한계) ──
 *   1. **이미 나간 옛 public blob 6건** · 코드가 닫지 못한다. 재업로드 + 옛 blob 삭제(데이터 단계)가
 *      닫고, 판정은 "옛 URL 이 404" 로 한다(정적 검사 불가).
 *   2. 런타임 권한 · 실제 403 은 라우트 실행이 판정한다.
 *   3. 다른 API 가 OcrJob.imageUrl 을 새로 싣는 경로 · 아래 3번은 coa-recognize 만 본다.
 *      2026-09-13 전수: OcrJob.imageUrl 을 응답에 싣는 API 는 coa-recognize 1곳이었다.
 * 상호 참조: 발주서·회신 첨부는 `po-document-private-access.test.ts`(P0-b1).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), "utf8"));

const STORE = "src/lib/ocr/image-storage.ts";
const PROXY = "src/app/api/ocr/jobs/[jobId]/image/route.ts";
const RECOGNIZE = "src/app/api/receiving-drafts/[id]/coa-recognize/route.ts";

/** 함수 본문을 블록으로 연다(4원칙 ⑤) · 인자 괄호를 먼저 닫고 본문 중괄호를 연다. */
function fnBlock(src: string, head: string): string {
  const start = src.indexOf(head);
  expect(start, `${head} 없음`).toBeGreaterThan(-1);
  let i = src.indexOf("(", start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) break;
  }
  const open = src.indexOf("{", i);
  depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error(`${head} 본문 닫힘 없음`);
}

describe("§quote-scan-public-storage P0-b2 · 업로드는 private · 키는 재현 불가", () => {
  const src = read(STORE);
  // 경로 각각 단언한다 · 하나만 되돌아가도 유출 경로 부활이다(OR 로 묶지 않는다).
  for (const head of ["export async function uploadOcrImage(", "export async function uploadOcrPdf("]) {
    it(`🛑 ${head.slice(22, -1)} · access private (public 0)`, () => {
      const body = fnBlock(src, head);
      expect(body).toMatch(/access:\s*"private"/);
      expect(body).not.toMatch(/access:\s*"public"/);
    });

    it(`🛑 ${head.slice(22, -1)} · blob 키에 파일 해시가 없다 (randomUUID)`, () => {
      const body = fnBlock(src, head);
      const key = body.match(/const key = `([^`]*)`/);
      expect(key, "key 선언 없음").not.toBeNull();
      expect(key![1]).toMatch(/\$\{randomUUID\(\)\}/);
      expect(key![1]).not.toMatch(/hash/i);
    });
  }

  it("🔑 해시는 여전히 계산해 반환한다 (캐시는 DB imageHash 로 찾는다 · 키와 분리)", () => {
    expect(fnBlock(src, "export async function uploadOcrImage(")).toMatch(/return \{ url: result\.url, hash, provider \}/);
    expect(fnBlock(src, "export async function uploadOcrPdf(")).toMatch(/return \{ url: result\.url, hash, provider \}/);
  });
});

describe("§quote-scan-public-storage P0-b2 · 열람은 프록시가 조직 대조·감사와 함께 한다", () => {
  const src = read(PROXY);
  const streamAt = src.indexOf("blob.stream as unknown");

  it("🛑 조직 멤버십 대조 후에만 연다 (다른 조직 403 · 스트림보다 앞)", () => {
    expect(streamAt).toBeGreaterThan(-1);
    expect(src).toMatch(/organizationMember\.findFirst\(\{\s*where:\s*\{\s*userId:\s*session\.user\.id,\s*organizationId:\s*job\.organizationId/);
    const forbid = src.indexOf("status: 403");
    expect(forbid).toBeGreaterThan(-1);
    expect(forbid).toBeLessThan(streamAt);
    expect(src).toMatch(/if \(!membership\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\)/);
  });

  it("🔑 열람도 감사 대상이다 (enforceAction · complete 가 스트림보다 앞 · 조직 포함)", () => {
    const enf = src.indexOf("enforceAction({");
    const done = src.indexOf("enforcement.complete({ organizationId: job.organizationId })");
    expect(enf).toBeGreaterThan(src.indexOf("status: 403"));
    expect(done).toBeGreaterThan(enf);
    expect(done).toBeLessThan(streamAt);
  });

  it("🛑 private 접근으로 읽고 공유 캐시에 남기지 않는다", () => {
    expect(src).toMatch(/get\(\s*job\.imageUrl,\s*\{\s*access:\s*"private"\s*\}\s*\)/);
    expect(src).toMatch(/"Cache-Control":\s*"private, no-store"/);
    // blob URL 로 리다이렉트하면 프록시가 무의미해진다.
    expect(src).not.toMatch(/NextResponse\.redirect/);
  });
});

describe("§quote-scan-public-storage P0-b2 · 응답에 blob URL 을 싣지 않는다", () => {
  const src = read(RECOGNIZE);

  it("🛑 coa-recognize 의 imageUrl 은 프록시 경로다", () => {
    expect(src).toMatch(/imageUrl = job\?\.imageUrl \? `\/api\/ocr\/jobs\/\$\{job\.id\}\/image` : null/);
  });

  it("🛑 OcrJob.imageUrl 원문을 그대로 대입·반환하는 형태 0", () => {
    // 옛 판본: imageUrl = job?.imageUrl ?? null
    expect(src).not.toMatch(/imageUrl\s*=\s*job\??\.imageUrl\s*(\?\?|;)/);
    expect(src).not.toMatch(/imageUrl:\s*job\??\.imageUrl\b/);
  });
});
