/**
 * §11.228b #reminder-enhancement — 호영님 v2 P0 메일 리마인더 강화 3 sub-항목
 *
 * 호영님 spec:
 *   (1) Template 강화 — server isReminder wiring + Reminder 전용 template +
 *       days_since_request escalation tone
 *   (2) Reason 입력 — BatchReminderSheet Textarea label/placeholder 보강
 *   (3) Rate-limit — 24h 내 같은 quote+vendor 차단 (createdAt lookup)
 *
 * canonical truth lock:
 *   - QuoteVendorRequest schema 변경 0 (createdAt 기반 cooldown lookup)
 *   - 기존 generateVendorQuoteRequestEmail 시그니처 보존 (initial flow 영향 0)
 *   - 기존 vendor-requests POST 구조 (zod + 3-source ownership + activity log) 보존
 *   - BatchReminderSheet UI 시그니처 보존 (client → server isReminder=true 이미 land)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(
  __dirname,
  "../../../app/api/quotes/[id]/vendor-requests/route.ts",
);
const TEMPLATES_PATH = resolve(
  __dirname,
  "../../../lib/email/vendor-request-templates.ts",
);
const SHEET_PATH = resolve(
  __dirname,
  "../../../components/quotes/dispatch/batch-reminder-sheet.tsx",
);

const route = readFileSync(ROUTE_PATH, "utf8");
const templates = readFileSync(TEMPLATES_PATH, "utf8");
const sheet = readFileSync(SHEET_PATH, "utf8");

describe("§11.228b #1 — server isReminder + Zod schema 확장", () => {
  it("CreateVendorRequestsSchema 안 isReminder boolean optional field", () => {
    expect(route).toMatch(/isReminder\s*:\s*z\.boolean\(\)/);
  });

  it("validation.data destructure 에 isReminder 포함", () => {
    expect(route).toMatch(/const\s*\{[\s\S]{0,200}isReminder[\s\S]{0,80}\}\s*=\s*validation\.data/);
  });
});

describe("§11.228b #2 — Rate-limit cooldown (24h, createdAt 기반)", () => {
  it("REMINDER_COOLDOWN_HOURS 또는 24 hour 상수", () => {
    // 24 hour 표현: 24 * 60 * 60 * 1000 OR REMINDER_COOLDOWN_HOURS=24
    expect(route).toMatch(/(REMINDER_COOLDOWN_HOURS|24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|24h cooldown|cooldown[\s\S]{0,80}24)/i);
  });

  it("isReminder 분기 안 quoteVendorRequest.findFirst (이전 발송 lookup)", () => {
    expect(route).toMatch(/quoteVendorRequest\.findFirst|quoteVendorRequest\.findMany[\s\S]{0,200}vendorEmail/);
  });

  it("rate-limit 차단 시 429 status response", () => {
    expect(route).toMatch(/status:\s*429/);
  });

  it("rate-limit error code RATE_LIMIT_EXCEEDED 또는 동등 마커", () => {
    expect(route).toMatch(/(RATE_LIMIT_EXCEEDED|rate.limit|cooldown)/i);
  });
});

describe("§11.228b #3 — Reminder template 분기 (isReminder true → Reminder email)", () => {
  it("server route 안 isReminder 분기 (generateVendorQuoteReminderEmail 호출)", () => {
    expect(route).toMatch(/generateVendorQuoteReminderEmail/);
  });

  it("templates.ts 안 generateVendorQuoteReminderEmail export", () => {
    expect(templates).toMatch(/export\s+function\s+generateVendorQuoteReminderEmail/);
  });

  it("Reminder template params 에 daysSinceRequest 포함", () => {
    expect(templates).toMatch(/daysSinceRequest\s*[:?]\s*number/);
  });

  it("Reminder template subject — '리마인더' 또는 're:' 또는 '재요청' tone", () => {
    expect(templates).toMatch(/(리마인더|재요청|re:|회신.*기한|기한.*다가)/i);
  });

  it("기존 generateVendorQuoteRequestEmail 보존 (initial flow 영향 0)", () => {
    expect(templates).toMatch(/export\s+function\s+generateVendorQuoteRequestEmail/);
  });
});

describe("§11.228b #4 — client UX 보강 (Textarea label/placeholder + 429 toast)", () => {
  it("Textarea label 변경 — '발송 사유' 또는 '추가 메시지' 명시", () => {
    expect(sheet).toMatch(/(발송 사유|추가 메시지|리마인더 사유|메시지 \(선택\)[\s\S]{0,100}발송|발송[\s\S]{0,100}사유)/);
  });

  it("client 4xx (429 rate-limit) error 분기 — 명확 toast", () => {
    // sendReminderForQuote 안 response.status === 429 or rateLimit error 분기
    expect(sheet).toMatch(/(429|RATE_LIMIT|rate.limit|24시간|cooldown)/i);
  });

  it("server isReminder: true 전송 보존 (이미 §11.228 land)", () => {
    expect(sheet).toMatch(/isReminder:\s*true/);
  });
});

describe("§11.228b #5 — invariant 보존", () => {
  it("server 3-source ownership check 보존 (user / org / guest)", () => {
    expect(route).toMatch(/checkQuoteAccess/);
  });

  it("server enforceAction quote_request_resend 보존", () => {
    expect(route).toMatch(/quote_request_resend/);
  });

  it("activity log EMAIL_SENT 보존", () => {
    expect(route).toMatch(/EMAIL_SENT/);
  });

  it("BatchReminderSheet Promise.allSettled 보존", () => {
    expect(sheet).toMatch(/Promise\.allSettled/);
  });

  it("BatchReminderSheet eligibleQuotes filter (responseCount === 0) 보존", () => {
    expect(sheet).toMatch(/responses\?\.length\s*\?\?\s*0\)\s*===\s*0|responses\.length\s*===\s*0/);
  });

  it("§11.228b trace marker comment", () => {
    expect(route).toMatch(/§11\.228b[\s\S]{0,300}(reminder|cooldown|rate.limit|리마인더)/i);
  });
});
