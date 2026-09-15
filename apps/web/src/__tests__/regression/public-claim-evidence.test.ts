/**
 * §public-claim-evidence (2026-09-15 · 릴레이 판정) · **퍼블릭 화면은 인증·규격·등급을 근거 없이 주장하지 않는다.**
 *
 * ── 왜 ──
 * 로그인 화면이 「데이터 무결성과 ISMS 가이드를 준수합니다」 · 「256-bit 엔터프라이즈급 데이터 암호화」 를,
 * FAQ 가 「… 엔터프라이즈급 데이터 보호를 제공합니다」 를 말하고 있었다. 근거가 없었다:
 *   ISMS        인증 체계 이름 · 인증 이력 0 · "준수하려는 의도" 는 로드맵이지 현재 상태가 아니다
 *   256-bit     브라우저↔서비스 TLS 1.3 협상 암호 AES-128-GCM(2026-09-15 로컬 Node → www.labaxis.co.kr 측정) ·
 *               앱 수준 암호화 어댑터는 호출자 0 · prod 키 env 없음
 *   엔터프라이즈급  근거 없는 등급 수식
 * 같은 형태가 이미 한 번 있었다 · f61c35ec 「암호화 보관」 제거(견적 스캔). **문구 하나 지우는 걸로는 재발한다.**
 *
 * ── 이 파일이 보는 것 ──
 *   퍼블릭 화면 = app/ 중 인증 필요 트리(dashboard·app·admin·settings·team·billing·api) 밖 + 그 파일들이 import 하는
 *   @/components/* 파일(한 단계). 주석 제거 후 **주장 형태** 5종을 찾는다:
 *     규격명 · 인증 획득 · 규정 준수 선언 · 등급 수식 · 비트수+암호화
 *   🔑 주장을 추가하려면 아래 EVIDENCE 에 **근거 문서 경로 · 소유자 · 만료일**을 함께 올린다(파일이 실재해야 GREEN).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. 두 단계 이상 떨어진 컴포넌트 · 동적 import · 서버에서 내려주는 문자열(DB·CMS)
 *   2. 목록에 없는 주장 형태(예: "안전하게 보관" 류 모호 주장) · f61c35ec 은 quote-scan-modal 센티널이 따로 본다
 *   3. 이미지·PDF·이메일 템플릿 속 문구
 *   4. 인증 필요 화면(앱 내부) · 거기서 "규정 준수 불가" 같은 **상태 문구**는 주장이 아니다
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const WEB = join(SRC, "..");

const PRIVATE = /^app\/(dashboard|app|admin|settings|team|billing|api)\//;

/** 주장 형태 · 이름이 아니라 형태로 찾는다 */
const CLAIM_FORMS: [string, RegExp][] = [
  ["규격명", /\b(ISMS(-P)?|ISO\s?\/?\s?(IEC\s?)?270\d{2}|SOC\s?[12]|GDPR|HIPAA|PCI[\s-]?DSS|CSAP)\b/],
  ["인증 획득", /인증(을\s*(받|획득|취득)|받은|\s*획득|\s*취득)/],
  ["규정 준수 선언", /(가이드|규정|규격|기준|표준|법규|가이드라인|요건)[^"'`<>{}\n]{0,16}준수(합니다|하고\s*있습니다|를\s*보장|하는\s*(서비스|플랫폼|보안))/],
  ["등급 수식", /(엔터프라이즈|군사|은행|금융권)\s*(급|수준|등급)|\b(enterprise|military|bank)[\s-]grade\b/i],
  ["비트수+암호화", /(\d{2,4}\s*-?\s*bit|\d{2,4}\s*비트)[^"'`<>{}\n]{0,24}(암호화|encrypt)|(암호화|encrypt)[^"'`<>{}\n]{0,24}(\d{2,4}\s*-?\s*bit|\d{2,4}\s*비트)/i],
];

/**
 * 근거가 있는 주장만 여기에 올린다 · 키 = "파일::주장 형태 라벨"
 * 🛑 비어 있는 것이 정상이다. 올릴 때 근거 문서가 실재해야 하고 만료일이 지나면 RED.
 */
const EVIDENCE: Record<string, { doc: string; owner: string; expires: string }> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function resolveComponent(spec: string): string | null {
  const base = join(SRC, spec.replace(/^@\//, ""));
  for (const c of [base + ".tsx", base + ".ts", join(base, "index.tsx"), join(base, "index.ts")]) if (existsSync(c)) return c;
  return null;
}

function publicFiles(): string[] {
  const pages = walk(join(SRC, "app")).filter((f) => !PRIVATE.test(relative(SRC, f).replace(/\\/g, "/")));
  const set = new Set(pages);
  for (const f of pages) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/from\s+["'](@\/components\/[^"']+)["']/g)) {
      const r = resolveComponent(m[1]);
      if (r) set.add(r);
    }
  }
  return [...set];
}

function claims(files: string[]) {
  const hits: string[] = [];
  for (const f of files) {
    const rel = relative(SRC, f).replace(/\\/g, "/");
    const code = stripComments(readFileSync(f, "utf8"));
    for (const [label, re] of CLAIM_FORMS) if (re.test(code)) hits.push(`${rel}::${label}`);
  }
  return hits;
}

describe("§public-claim-evidence · 퍼블릭 화면 축", () => {
  it("축이 비지 않았다 · 로그인·FAQ·랜딩이 들어 있다", () => {
    const rels = publicFiles().map((f) => relative(SRC, f).replace(/\\/g, "/"));
    expect(rels.length).toBeGreaterThan(40);
    for (const must of ["app/auth/signin/page.tsx", "app/faq/page.tsx", "app/page.tsx"]) expect(rels).toContain(must);
    expect(rels.some((r) => PRIVATE.test(r))).toBe(false);
  });
});

describe("§public-claim-evidence · 근거 없는 인증·규격·등급 주장 0", () => {
  it("🛑 근거 문서 목록에 없는 주장 형태 0", () => {
    const unbacked = claims(publicFiles()).filter((k) => !EVIDENCE[k]);
    expect(unbacked).toEqual([]);
  });

  it("근거 문서 목록의 항목은 문서가 실재하고 만료 전이다", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [k, v] of Object.entries(EVIDENCE)) {
      expect(existsSync(join(WEB, "..", "..", v.doc)), `${k} 근거 문서 없음: ${v.doc}`).toBe(true);
      expect(v.owner.length, `${k} 소유자 없음`).toBeGreaterThan(0);
      expect(v.expires >= today, `${k} 만료: ${v.expires}`).toBe(true);
    }
  });

  it("주장 형태 탐지기가 살아 있다 (알려진 옛 문구는 잡는다 · 기능 설명은 안 잡는다)", () => {
    const hit = (s: string) => CLAIM_FORMS.filter(([, re]) => re.test(s)).map(([l]) => l);
    expect(hit("데이터 무결성과 ISMS 가이드를 준수합니다.")).toEqual(["규격명", "규정 준수 선언"]);
    expect(hit("256-bit 엔터프라이즈급 데이터 암호화")).toEqual(["등급 수식", "비트수+암호화"]);
    expect(hit("ISO 27001 인증 획득")).toEqual(["규격명", "인증 획득"]);
    expect(hit("Bank-grade encryption with 256 bit keys")).toEqual(["등급 수식", "비트수+암호화"]);
    // 음성 대조 · 제품 규격을 확인하는 기능 설명 · 로그인 인증 절차 · 측정된 현재 상태
    expect(hit("규격 준수 여부 빠른 확인")).toEqual([]);
    expect(hit("인증이 필요합니다")).toEqual([]);
    expect(hit("모든 통신 TLS 암호화 (HTTPS 강제)")).toEqual([]);
  });
});

describe("§public-claim-evidence · 회귀 0 · 로그인 신뢰 항목은 측정된 사실로 남는다", () => {
  it("로그인 신뢰 항목 3개 유지 · 옛 문구 부재", () => {
    const code = stripComments(readFileSync(join(SRC, "app/auth/signin/page.tsx"), "utf8"));
    expect(code).toMatch(/text: "모든 통신 TLS 암호화 \(HTTPS 강제\)"/);
    expect(code).toMatch(/text: "주요 작업에 조직 역할별 권한 확인"/);
    expect(code).toMatch(/text: "구매-재고 운영 실시간 연결"/);
    expect(code).not.toMatch(/ISMS/);
  });
});
