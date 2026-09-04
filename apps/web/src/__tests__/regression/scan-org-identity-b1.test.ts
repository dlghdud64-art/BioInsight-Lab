/**
 * §scan-org-identity B-1 (호영님 2026-09-04) — OcrJob 조직 정합 + 캐시 격리.
 *
 * 왜 이 형태인가:
 *   구 sentinel 은 `ocrOrgMatches` 같은 **구현 이름**을 잠갔고, 그 구현이 실제로는
 *   조직 자리의 userId 끼리 비교하고 있었다. 성립한 적 없는 계약이 GREEN 이었던 것이
 *   이 결함의 수명을 늘렸다. 그래서 여기서는 문자열 계약 대신 **부재를 전수로 검증**한다.
 *
 * 잠그는 것:
 *   1) organizationId 자리에 user 식별자가 들어가는 지점이 레포 전역 **0곳**
 *   2) 캐시 조회에 조직 조건이 실재 — 이번 배치 1순위(보안). §11.402 참조
 *   3) 생성 3곳·조회 2곳이 resolver 결과를 쓴다 (경로 각각 · OR 금지)
 *   4) 조직 0 은 조용히 통과하지 않는다 (422 + 명시 코드)
 *   5) Phase 4a 주석은 앵커임이 **주석 자체에** 적혀 있다
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

/**
 * 주석을 **공백으로** 치환한다(삭제 아님 — 줄 번호 보존).
 * 🛑 이걸 안 하면 결함을 설명한 주석이 스스로 잡힌다.
 *    2026-09-04 실측: 교정을 끝냈는데도 스캐너가 5건을 보고했고, 전부 "구: ..." 주석이었다.
 */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + " ".repeat(m.length - p1.length));
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      walkTsFiles(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const PARSE_IMAGE = "src/app/api/quotes/parse-image/route.ts";
const PARSE_PDF = "src/app/api/quotes/parse-pdf/route.ts";
const SCAN_LABEL = "src/app/api/inventory/scan-label/route.ts";
const OCR_CORRECT = "src/app/api/ocr/correct/[jobId]/route.ts";
const OCR_RETRY = "src/app/api/ocr/retry/[jobId]/route.ts";
const IMAGE_STORAGE = "src/lib/ocr/image-storage.ts";

describe("§scan-org-identity B-1 — organizationId 자리에 user 식별자 0곳 (전역 전수)", () => {
  it("프로덕션 코드 전역에서 0곳이다 (구현 이름 계약이 아니라 부재 검증)", () => {
    const files = walkTsFiles(join(REPO_ROOT, "src"));
    const re = /organizationId\s*:\s*((?:session\.)?user(?:\?)?\.id|userId|user\.id)\b/g;
    const hits: string[] = [];
    for (const f of files) {
      const code = blankComments(readFileSync(f, "utf8"));
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(code))) {
        const line = code.slice(0, m.index).split("\n").length;
        hits.push(`${f.slice(f.indexOf("src")).replace(/\\/g, "/")}:${line}  → ${m[1]}`);
      }
    }
    // 2026-09-04 이전 실측: 5곳(parse-image·parse-pdf·scan-label·ocr/correct·ocr/retry).
    expect(hits, `조직 자리에 user 식별자:\n${hits.join("\n")}`).toHaveLength(0);
  });
});

describe("§scan-org-identity B-1 — 캐시 조직 격리 (1순위 · 보안)", () => {
  it("findCachedOcrJob where 절에 organizationId 가 실재한다", () => {
    const src = read(IMAGE_STORAGE);
    const idx = src.indexOf("export async function findCachedOcrJob(");
    expect(idx).toBeGreaterThan(-1);
    // 창은 where 여는 자리부터(② 창 시작점). 주석은 공백으로 남으므로 폭을 넉넉히 잡는다 —
    // 좁게 잡으면 설명 주석 길이에 단언이 좌우된다(구현이 아니라 주석이 게이트를 흔든다).
    const win = blankComments(src.slice(idx, idx + 1600));
    const whereIdx = win.indexOf("where: {");
    expect(whereIdx).toBeGreaterThan(-1);
    const whereBlock = win.slice(whereIdx, whereIdx + 900);
    expect(whereBlock).toMatch(/\borganizationId,/);
    expect(whereBlock).toMatch(/\bimageHash,/);
  });

  it("organizationId 는 **필수 인자**다 — 선택이면 다음 호출부가 구멍을 다시 연다", () => {
    const src = read(IMAGE_STORAGE);
    expect(src).toMatch(
      /findCachedOcrJob\(\s*imageHash: string,\s*type: OcrJobType,\s*organizationId: string,\s*\)/,
    );
    // 기본값·선택 인자 형태로 회귀 차단.
    expect(blankComments(src)).not.toMatch(/organizationId\?:\s*string/);
  });

  it("호출부 3곳 전부 조직을 넘긴다 (경로 각각)", () => {
    // ④ OR 로 묶지 않는다 — 하나가 끊기는 것도 유출 경로 부활이다.
    const quote = read("src/lib/ocr/run-quote-ocr-pipeline.ts");
    expect(quote).toMatch(/findCachedOcrJob\(pdfHash, "QUOTE", input\.organizationId\)/);
    expect(quote).toMatch(/findCachedOcrJob\(imageHash, "QUOTE", input\.organizationId\)/);
    expect(read("src/lib/ocr/run-ocr-pipeline.ts")).toMatch(
      /findCachedOcrJob\(imageHash, input\.type, input\.organizationId\)/,
    );
  });
});

describe("§scan-org-identity B-1 — 생성 3곳이 실제 조직을 쓴다", () => {
  it("parse-image", () => {
    const src = read(PARSE_IMAGE);
    expect(src).toMatch(/resolveActiveOrganizationId\(\{ userId: session\.user\.id \}\)/);
    expect(src).toMatch(/organizationId: scanOrganizationId,/);
  });

  it("parse-pdf", () => {
    const src = read(PARSE_PDF);
    expect(src).toMatch(/resolveActiveOrganizationId\(\{ userId: session\.user\.id \}\)/);
    expect(src).toMatch(/organizationId: scanOrganizationId,/);
  });

  it("scan-label — 이미 해석된 값을 재사용한다 (이중 resolve 금지)", () => {
    const src = read(SCAN_LABEL);
    expect(src).toMatch(/organizationId: activeOrganizationId,/);
    // resolve 호출은 1회뿐이어야 한다 — 두 번이면 한도와 기록이 다른 조직으로 갈린다.
    const calls = blankComments(src).match(/resolveActiveOrganizationId\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });
});

describe("§scan-org-identity B-1 — 조회 2곳 동반 교정 (404 회귀 차단)", () => {
  it("ocr/correct 필터가 resolver 결과를 쓴다", () => {
    const src = read(OCR_CORRECT);
    expect(src).toMatch(/const lookupOrganizationId = await resolveActiveOrganizationId\(/);
    expect(src).toMatch(/organizationId: lookupOrganizationId,/);
  });

  it("ocr/retry 필터가 resolver 결과를 쓴다", () => {
    const src = read(OCR_RETRY);
    expect(src).toMatch(/const lookupOrganizationId = await resolveActiveOrganizationId\(/);
    expect(src).toMatch(/organizationId: lookupOrganizationId,/);
  });
});

describe("§scan-org-identity B-1 — 조직 0 은 조용히 통과하지 않는다", () => {
  it("5곳 모두 422 + NO_ORGANIZATION 으로 거절한다", () => {
    // 생성 3 + 조회 2. 하나라도 조용히 흘리면 오염이 다시 쌓인다.
    for (const rel of [PARSE_IMAGE, PARSE_PDF, SCAN_LABEL, OCR_CORRECT, OCR_RETRY]) {
      const src = read(rel);
      expect(src, rel).toMatch(/code: "NO_ORGANIZATION"/);
      expect(src, rel).toMatch(/status: 422/);
    }
  });
});

describe("§scan-org-identity B-1 — Phase 4a 주석은 앵커임을 스스로 말한다", () => {
  it("남은 주석은 '완료 이력' 또는 '모듈 식별자'로 성격이 적혀 있다", () => {
    // 호영님 2026-09-04: 주석은 **상태**를 말해야지 의도를 말하면 안 된다.
    //   `Phase 5 에서 정합` 같은 의도 서술이 오히려 "알고 있는 부채" 로 보여 긴급성을 낮췄다.
    for (const rel of [SCAN_LABEL, PARSE_IMAGE, PARSE_PDF]) {
      const src = read(rel);
      const idx = src.indexOf("§11.290 Phase 4a");
      expect(idx, rel).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 400), rel).toMatch(/완료 이력|sentinel anchor/);
    }
    for (const rel of ["src/lib/ocr/run-ocr-pipeline.ts", "src/lib/ocr/run-quote-ocr-pipeline.ts"]) {
      const src = read(rel);
      const idx = src.indexOf("§11.290 Phase 4a");
      expect(src.slice(idx, idx + 300), rel).toMatch(/모듈 식별자/);
    }
  });

  it("'Phase 5 에서 정합' 형태의 미완료 의도 서술이 남아 있지 않다", () => {
    for (const rel of [SCAN_LABEL, OCR_RETRY]) {
      const src = read(rel);
      // 이번 교정 설명 안의 인용(`구: ...`)은 이력이므로 허용 — 지시 형태만 막는다.
      expect(src, rel).not.toMatch(/Phase 5 에서 실제 organizationId 정합[^`]*$/m);
    }
  });
});
