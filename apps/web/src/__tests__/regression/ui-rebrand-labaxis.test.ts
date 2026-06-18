/**
 * §ui-rebrand(호영님, 2026-06-17 승인) — UI/알림 BioCompare→LabAxis + labaxis.io→labaxis.co.kr
 *
 * §email-rebrand(발송 템플릿) 후속. 사용자 노출 UI·알림 발송물·연락처 도메인 정합.
 *   - 발송물(notifications): action-executor·event-dispatcher 알림 메일 BioCompare→LabAxis.
 *   - 공개 표시: share 토큰 페이지/메타 "AI BioCompare"→LabAxis.
 *   - 연락처 도메인: mailto·회사정보·목업의 labaxis.io(미verified 구도메인) → labaxis.co.kr(verified).
 * 주의: api/inbound/sendgrid webhook 등 기능 파일(군3)은 본 스윕 제외 — 별도 신중 처리.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// labaxis.io 도메인 정합 대상(15) + 발송물/공개표시(4).
const DOMAIN_FILES = [
  "app/about/page.tsx",
  "app/admin/page.tsx",
  "app/dashboard/support-center/page.tsx",
  "app/faq/page.tsx",
  "app/help/page.tsx",
  "app/not-found.tsx",
  "app/_components/main-footer.tsx",
  "app/_components/mobile-floating-cta.tsx",
  "app/vendor/login/page.tsx",
  "app/api/quotes/[id]/detail/route.ts",
  "components/auth/user-menu.tsx",
  "components/dashboard/Header.tsx",
  "components/quotes/quote-document.tsx",
  "lib/plans.ts",
];

const BRAND_FILES = [
  "lib/notifications/action-executor.ts",
  "lib/notifications/event-dispatcher.ts",
  "app/share/[token]/page.tsx",
  "app/share/[token]/layout.tsx",
];

describe("§ui-rebrand — labaxis.io 구도메인 0(labaxis.co.kr 정합)", () => {
  for (const rel of DOMAIN_FILES) {
    it(`${rel} — labaxis.io 0`, () => {
      expect(read(rel)).not.toMatch(/labaxis\.io/);
    });
  }
});

describe("§ui-rebrand — 사용자 노출 연락처 support@ 단일(Zoho 수신, 별칭 난립 0)", () => {
  // 호영님 결정: 발송=Resend, 수신=Zoho support@labaxis.co.kr 단일함.
  //   사용자 노출 mailto·회사정보 연락처는 contact@/info@/sales@ 별칭 없이 support@ 로 통일.
  //   (admin@=목업 actor 계정, noreply@=발송 from 설명은 예외 — 본 검사 대상 파일에 없음)
  const CONTACT_FILES = [
    "app/about/page.tsx",
    "app/help/page.tsx",
    "app/_components/main-footer.tsx",
    "app/_components/mobile-floating-cta.tsx",
    "components/quotes/quote-document.tsx",
    "lib/plans.ts",
    "app/api/quotes/[id]/detail/route.ts",
  ];
  for (const rel of CONTACT_FILES) {
    it(`${rel} — contact@/info@/sales@ 별칭 0(support@ 단일)`, () => {
      expect(read(rel)).not.toMatch(/(contact|info|sales)@labaxis\.co\.kr/);
    });
  }
});

describe("§ui-rebrand — 발송물·공개표시 BioCompare 0(LabAxis 정합)", () => {
  for (const rel of BRAND_FILES) {
    it(`${rel} — BioCompare 0`, () => {
      expect(read(rel)).not.toMatch(/BioCompare/);
    });
  }
  it("알림 발송물 LabAxis 브랜드 정합(action-executor·event-dispatcher)", () => {
    expect(read("lib/notifications/action-executor.ts")).toMatch(/\[LabAxis\]/);
    expect(read("lib/notifications/event-dispatcher.ts")).toMatch(/\[LabAxis\]/);
  });
});
