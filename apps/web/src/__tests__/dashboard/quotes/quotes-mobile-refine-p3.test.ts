/**
 * §quotes-mobile-refine P3 #mobile-reminder-sheet — 4a 시트 UI + wiring sentinel
 *
 * 정본: docs/plans/PLAN_quotes-mobile-refine.md P2·P3 + 호영님 지시문(2026-07-21) §2 리마인더(4a).
 *
 * 계약:
 *   - 대상 = deriveReminderTargets(미회신만, P2 lib) · 발송 = 기존 vendor-requests POST + isReminder
 *     (경로 이원화 0) · 429 cooldown 안내 · 활동 로그 고지 = 서버 createActivityLog 실배선 사실 서술(P0-G1).
 *   - D+N 경과 배지 = yellow(색상 표기 규약 07-20) · 압박 어휘 0(3 surface 한정) · 그랩바 · CTA ≥44px ·
 *     비활성 사유 인라인(dead button 0).
 *   - page: s2 만 시트 분기, 타 stage 기존 라우팅 보존. replied 술어 단일화(supplier-avatars ← lib).
 *   - Out of Scope 준수: batch-reminder-sheet(데스크탑) 무접촉 — 톤 프리셋(reminder-5 sentinel 핀) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const SHEET = read("src/components/quotes/mobile-reminder-sheet.tsx");
const LIB = read("src/lib/quote-management/reminder-targets.ts");
const PAGE = read("src/app/dashboard/quotes/page.tsx");
const AVATARS = read("src/components/quotes/supplier-avatars.tsx");

/* ── P2 lib — 파생 규칙 ────────────────────────────────────── */
describe("§quotes-mobile-refine P2 — reminder-targets lib", () => {
  it("미회신 필터 — hasVendorReplied 부정으로만", () => {
    expect(LIB).toMatch(/filter\(\(v\) => !hasVendorReplied\(v\)\)/);
  });
  it("replied 단일 술어 export (respondedAt ∥ RESPONDED)", () => {
    expect(LIB).toMatch(/export function hasVendorReplied/);
    expect(LIB).toMatch(/v\.respondedAt != null \|\| v\.status === "RESPONDED"/);
  });
  it("daysSince — createdAt 실값에서만, 미래·미상은 null (가짜 경과일 0)", () => {
    expect(LIB).toMatch(/created <= nowMs/);
    expect(LIB).toMatch(/daysSince: number \| null/);
  });
  it("email 미상 대상 유지 + sendable=false (카운트 정직)", () => {
    expect(LIB).toMatch(/sendable: email != null/);
  });
  it("발송 페이로드 = sendable 만 {email,name} (기존 계약 정합)", () => {
    expect(LIB).toMatch(/toReminderVendorsPayload/);
  });
  it("supplier-avatars 가 동일 술어 재사용 (규칙 이원화 0)", () => {
    expect(AVATARS).toMatch(/import \{ hasVendorReplied \} from "@\/lib\/quote-management\/reminder-targets"/);
    expect(AVATARS).toMatch(/replied: hasVendorReplied\(v\)/);
    expect(AVATARS).not.toMatch(/replied: v\.respondedAt != null/);
  });
});

/* ── P3 시트 ──────────────────────────────────────────────── */
describe("§quotes-mobile-refine P3 — 리마인더 시트", () => {
  it("대상 = deriveReminderTargets (미회신 자동 필터)", () => {
    expect(SHEET).toMatch(/deriveReminderTargets\(quote\?\.vendorRequests\)/);
  });
  it("발송 = 기존 vendor-requests POST + isReminder:true (경로 이원화 0)", () => {
    expect(SHEET).toMatch(/\/api\/quotes\/\$\{quote\.id\}\/vendor-requests/);
    expect(SHEET).toMatch(/isReminder: true/);
    expect(SHEET).toMatch(/csrfFetch/);
  });
  it("429 rate-limit cooldown 안내 (placeholder 실패 0)", () => {
    expect(SHEET).toMatch(/RATE_LIMIT_EXCEEDED/);
    expect(SHEET).toMatch(/cooldownHours/);
  });
  it("헤더 문구 — '아직 회신하지 않은 공급사에게 보냅니다'", () => {
    expect(SHEET).toMatch(/아직 회신하지 않은 공급사에게 보냅니다/);
  });
  it("미회신 N곳 카운트 + 회신 0\\/1 행", () => {
    expect(SHEET).toMatch(/미회신 \{targets\.length\}곳/);
    expect(SHEET).toMatch(/회신 0\/1/);
  });
  it("D+N 경과 배지 — yellow 토큰, 실값에서만", () => {
    expect(SHEET).toMatch(/t\.daysSince != null && t\.daysSince > 0 &&/);
    expect(SHEET).toMatch(/bg-yellow-50 text-yellow-700 border border-yellow-200[\s\S]{0,80}D\+\{t\.daysSince\}/);
  });
  it("활동 로그 고지 (서버 createActivityLog 실배선 — P0-G1)", () => {
    expect(SHEET).toMatch(/발송 내역은 활동 로그에 기록됩니다/);
  });
  it("압박 어휘 0", () => {
    expect(SHEET).not.toMatch(/독려|독촉/);
  });
  it("그랩바 + CTA ≥44px + 비활성 사유 인라인 (dead button 0)", () => {
    expect(SHEET).toMatch(/h-1 w-10 rounded-full bg-slate-200/);
    expect(SHEET).toMatch(/min-h-\[48px\]/);
    expect(SHEET).toMatch(/발송 대상 없음 · 전원 회신 완료/);
    expect(SHEET).toMatch(/발송 가능 이메일 없음/);
  });
  it("전달 메시지 수정 가능 + 재응답 기한 입력 (1~30 경계)", () => {
    expect(SHEET).toMatch(/onChange=\{\(e\) => setMessage/);
    expect(SHEET).toMatch(/Math\.max\(1, Math\.min\(30/);
  });
  it("시트 재오픈 시 상태 초기화 (이전 케이스 잔존 0)", () => {
    expect(SHEET).toMatch(/useEffect[\s\S]{0,120}setMessage\(DEFAULT_MESSAGE\)/);
  });
  it("amber/orange Tailwind 0", () => {
    expect(SHEET).not.toMatch(/(bg|text|border|border-l|from|to|ring)-(amber|orange)-\d/);
  });
});

/* ── page wiring ──────────────────────────────────────────── */
describe("§quotes-mobile-refine P3 — page wiring", () => {
  it("s2 만 시트 분기, 타 stage 기존 라우팅 보존", () => {
    expect(PAGE).toMatch(/qc\.stage === "s2"[\s\S]{0,80}setMobileReminderQuote\(q\)/);
    expect(PAGE).toMatch(/handleQuoteCardSelect\(id, getOpSignals\(q\)\.ctaLabel\)/);
  });
  it("시트 렌더 + 성공 시 refetch (front-only success 0)", () => {
    expect(PAGE).toMatch(/<MobileReminderSheet/);
    expect(PAGE).toMatch(/onSuccess=\{\(\) => refetch\(\)\}/);
  });
  it("ddLabel 은 computePriority 파생 (중복 계산 저장 0)", () => {
    expect(PAGE).toMatch(/const \{ dd \} = computePriority\(qc\)/);
  });
});

/* ── Out of Scope 준수 (회귀 0) ────────────────────────────── */
describe("§quotes-mobile-refine P3 — Out of Scope 무접촉", () => {
  it("batch-reminder-sheet 톤 프리셋 보존 (reminder-5 sentinel 핀 유지)", () => {
    const batch = read("src/components/quotes/dispatch/batch-reminder-sheet.tsx");
    expect(batch).toMatch(/REMINDER_TONE_PRESETS/);
    expect(batch).toMatch(/label: "독촉"/);
  });
  it("BatchReminderSheet page 배선 보존", () => {
    expect(PAGE).toMatch(/<BatchReminderSheet/);
    expect(PAGE).toMatch(/onReminderStart=\{\(\) => setBatchReminderOpen\(true\)\}/);
  });
});
