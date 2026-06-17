/**
 * §P-leg P1 — 법적 고지 허브 데이터 계약 + 셸 sentinel
 *
 * 검증:
 *   (A) 데이터 계약 — 3문서(terms/privacy/policy) + 메타 + 법문 verbatim 무결성(특히 privacy v1.2
 *       국외이전 §5 / 위탁 §4 실수탁자 — 직전 트랙 land 보존).
 *   (B) 허브 셸 — 콘텐츠/표현 분리, 탭 스위처+슬라이딩 인디케이터, 스티키 목차, 해시 라우팅,
 *       읽기시간, 인쇄, 접근성(scroll-margin/prefers-reduced-motion).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const DOCS = readFileSync(join(ROOT, "lib/legal/legal-docs.tsx"), "utf8");
const PAGE = readFileSync(join(ROOT, "app/legal/page.tsx"), "utf8");

describe("§P-leg P1 (A) — 데이터 계약 3문서 + 메타", () => {
  it("LEGAL_DOCS 3문서 id(terms/privacy/policy)", () => {
    expect(DOCS).toMatch(/id:\s*"terms"/);
    expect(DOCS).toMatch(/id:\s*"privacy"/);
    expect(DOCS).toMatch(/id:\s*"policy"/);
    expect(DOCS).toMatch(/export const LEGAL_DOCS:\s*LegalDoc\[\]\s*=\s*\[TERMS, PRIVACY, POLICY\]/);
  });
  it("privacy v1.2 메타(국외이전 반영본)", () => {
    expect(DOCS).toMatch(/version:\s*"v1\.2"/);
    expect(DOCS).toMatch(/revised:\s*"2026\.06\.16"/);
  });
  it("terms 15조 / policy 11조 마지막 조항 존재", () => {
    expect(DOCS).toMatch(/제15조/); // terms
    expect(DOCS).toMatch(/제11조/); // policy
  });
});

describe("§P-leg P1 (A) — 법문 verbatim 무결성(직전 land 보존)", () => {
  it("privacy §5 국외이전 — 실이전 4사 + 국가 + 거부권", () => {
    expect(DOCS).toMatch(/개인정보의 국외 이전/);
    expect(DOCS).toMatch(/Vercel Inc\./);
    expect(DOCS).toMatch(/Supabase/);
    expect(DOCS).toMatch(/일본\(AWS 도쿄 리전\)/);
    expect(DOCS).toMatch(/Resend, Inc\./);
    expect(DOCS).toMatch(/국외 이전을 거부할 수 있으며/);
  });
  it("privacy §4 위탁 — 실수탁자(거짓 '해당없음' 시정본)", () => {
    expect(DOCS).toMatch(/Google LLC/);
    expect(DOCS).toMatch(/소셜 로그인\(OAuth\) 인증/);
  });
  it("CPO/사업자 placeholder 유지(휴업 대기 — 날조 금지)", () => {
    expect(DOCS).toMatch(/\[성명 \/ 직책\]/);
  });
});

describe("§P-leg P1 (B) — 허브 셸 배선", () => {
  it("콘텐츠/표현 분리 — LEGAL_DOCS 소비(법문 inline 미작성)", () => {
    expect(PAGE).toMatch(/from "@\/lib\/legal\/legal-docs"/);
    expect(PAGE).toMatch(/LEGAL_DOCS\.map/);
  });
  it("탭 스위처 + 슬라이딩 인디케이터(지시문 ①)", () => {
    expect(PAGE).toMatch(/role="tablist"/);
    expect(PAGE).toMatch(/aria-selected=\{active\}/);
    expect(PAGE).toMatch(/moveIndicator/);
    expect(PAGE).toMatch(/legal-ind/);
  });
  it("스티키 목차(248px) + 모바일 select(920↓)", () => {
    expect(PAGE).toMatch(/legal-toc/);
    expect(PAGE).toMatch(/grid-template-columns:\s*248px/);
    expect(PAGE).toMatch(/legal-toc-select/);
  });
  it("해시 라우팅(#privacy 등) + 읽기시간 + 인쇄", () => {
    expect(PAGE).toMatch(/hashchange/);
    expect(PAGE).toMatch(/readingMinutes/);
    expect(PAGE).toMatch(/window\.print\(\)/);
  });
  it("접근성 — scroll-margin(앵커) + prefers-reduced-motion", () => {
    expect(PAGE).toMatch(/scroll-margin-top/);
    expect(PAGE).toMatch(/prefers-reduced-motion/);
  });
  it("공개 페이지 셸 상속(MainLayout/Header/Footer)", () => {
    expect(PAGE).toMatch(/<MainLayout>/);
    expect(PAGE).toMatch(/<MainHeader \/>/);
    expect(PAGE).toMatch(/<MainFooter \/>/);
  });
});

describe("§P-leg P2 — 고도화 인터랙션(앵커 복사·토스트·크로스페이드)", () => {
  it("② 조항 앵커 딥링크 복사 + clipboard + 토스트", () => {
    expect(PAGE).toMatch(/copyAnchor/);
    expect(PAGE).toMatch(/navigator\.clipboard/);
    expect(PAGE).toMatch(/조항 링크가 복사되었습니다/);
    expect(PAGE).toMatch(/legal-anchor-btn/);
  });
  it("② 토스트 element(role=status, aria-live) + 자동 해제", () => {
    expect(PAGE).toMatch(/legal-toast/);
    expect(PAGE).toMatch(/role="status"/);
    expect(PAGE).toMatch(/setToast\(null\)/);
  });
  it("④ 탭 전환 크로스페이드(legalSwap) + reduced-motion 존중", () => {
    expect(PAGE).toMatch(/legalSwap/);
    expect(PAGE).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.legal-body/);
  });
  it("인쇄 시 앵커/토스트 숨김(법무 출력 정합)", () => {
    // §P-leg P3 — @media print 안에 다크→라이트 강제 규칙(color !important)이 삽입되며
    //   @media print → legal-anchor-btn 거리 120→266 확대. print-hide 의도는 보존, window 확대.
    expect(PAGE).toMatch(/@media print[\s\S]{0,400}legal-anchor-btn/);
  });
});

describe("§P-leg P3 — 다크 리딩 모드(지시문 ⑦)", () => {
  it("theme state + 토글 + localStorage + prefers-color-scheme 초기화", () => {
    expect(PAGE).toMatch(/useState<"light" \| "dark">/);
    expect(PAGE).toMatch(/toggleTheme/);
    expect(PAGE).toMatch(/lab_legal_theme/);
    expect(PAGE).toMatch(/prefers-color-scheme: dark/);
  });
  it("본문 paper 에 data-legal-theme 적용 + 토글 버튼(aria-pressed)", () => {
    expect(PAGE).toMatch(/data-legal-theme=\{theme\}/);
    expect(PAGE).toMatch(/aria-pressed=\{theme === "dark"\}/);
  });
  it("다크 팔레트 override + 네이비 셸 유지(본문만 토글)", () => {
    expect(PAGE).toMatch(/\.legal-paper\[data-legal-theme="dark"\]\s*\{\s*background:\s*#0a1124/);
    expect(PAGE).toMatch(/data-legal-theme="dark"\] \.legal-prose \{ color: #e7edf8/);
  });
  it("인쇄는 다크여도 항상 라이트(지시문 ⑦)", () => {
    expect(PAGE).toMatch(/@media print[\s\S]{0,400}data-legal-theme="dark"\][\s\S]{0,120}color: #121a2c !important/);
  });
});

describe("§P-leg P4 — 라우팅 cutover(구 페이지 → /legal#앵커)", () => {
  const rd = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
  it("구 3페이지 redirect 전환(MainLayout 본문 폐지)", () => {
    const terms = rd("app/terms/page.tsx");
    const privacy = rd("app/privacy/page.tsx");
    const policy = rd("app/operations-policy/page.tsx");
    expect(terms).toMatch(/redirect\("\/legal#terms"\)/);
    expect(privacy).toMatch(/redirect\("\/legal#privacy"\)/);
    expect(policy).toMatch(/redirect\("\/legal#policy"\)/);
    // 구 본문(MainLayout 직접 렌더) 폐지 — 단일 진실은 legal-docs.
    expect(terms).not.toMatch(/<MainLayout>/);
    expect(privacy).not.toMatch(/<MainLayout>/);
  });
  it("지시문 단축 라우트 /policy 신규(→ #policy)", () => {
    expect(rd("app/policy/page.tsx")).toMatch(/redirect\("\/legal#policy"\)/);
  });
  it("푸터 링크 = canonical /legal#앵커(redirect hop 제거)", () => {
    const footer = rd("app/_components/main-footer.tsx");
    expect(footer).toMatch(/\/legal#terms/);
    expect(footer).toMatch(/\/legal#privacy/);
    expect(footer).toMatch(/\/legal#policy/);
    expect(footer).not.toMatch(/href="\/operations-policy"/);
    expect(footer).not.toMatch(/href:\s*"\/terms"/);
  });
});
