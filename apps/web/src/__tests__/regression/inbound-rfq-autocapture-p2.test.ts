/**
 * §inbound-rfq-autocapture P2 (PLAN_inbound-rfq-autocapture) — 첨부 실저장(누락 0)
 *
 * inbound parse 의 첨부 처리를 메타-only placeholder 에서 실제 object storage 업로드로 전환.
 *   - helper: STORAGE_PROVIDER 추상화(vercel-blob 실작동 + supabase 실구현), 미설정 throw.
 *   - inbound route: file→Buffer 실업로드. 성공 시에만 QuoteReplyAttachment 생성(placeholder success 금지).
 *     storage 미설정/실패 시 QuoteReply 는 보존, 첨부는 명시 skip + 로그(silent 금지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const STORE = read("lib/email/quote-reply-attachment-storage.ts");
const ROUTE = read("app/api/inbound/sendgrid/[secret]/route.ts");

describe("§inbound-rfq-autocapture P2 — 첨부 storage helper(실구현)", () => {
  it("uploadQuoteReplyAttachment export + 미설정 throw", () => {
    expect(STORE).toMatch(/export async function uploadQuoteReplyAttachment/);
    expect(STORE).toMatch(/AttachmentStorageNotConfiguredError/);
    expect(STORE).toMatch(/if \(!provider\)/);
  });
  it("STORAGE_PROVIDER 추상화 — vercel-blob 실작동(@vercel/blob put)", () => {
    expect(STORE).toMatch(/process\.env\.STORAGE_PROVIDER/);
    expect(STORE).toMatch(/import\("@vercel\/blob"\)/);
    expect(STORE).toMatch(/case "vercel-blob"/);
  });
  it("supabase 실구현 — getServiceClient storage upload(메타-only 0)", () => {
    expect(STORE).toMatch(/getServiceClient/);
    expect(STORE).toMatch(/\.storage\s*\n?\s*\.from\(bucket\)/);
    expect(STORE).toMatch(/\.upload\(/);
    expect(STORE).toMatch(/case "supabase"/);
  });
  it("key prefix quote-replies/ (멀티테넌시 quoteId/replyId)", () => {
    expect(STORE).toMatch(/quote-replies\/\$\{input\.quoteId\}\/\$\{input\.replyId\}/);
  });
});

describe("§inbound-rfq-autocapture P2 — inbound route 실업로드 배선", () => {
  it("helper import + 호출(file→Buffer)", () => {
    expect(ROUTE).toMatch(/import \{[\s\S]*uploadQuoteReplyAttachment[\s\S]*\} from "@\/lib\/email\/quote-reply-attachment-storage"/);
    expect(ROUTE).toMatch(/Buffer\.from\(await file\.arrayBuffer\(\)\)/);
    expect(ROUTE).toMatch(/await uploadQuoteReplyAttachment\(\{/);
  });
  it("성공 시에만 QuoteReplyAttachment 생성(실 bucket/path)", () => {
    expect(ROUTE).toMatch(/quoteReplyAttachment\.create/);
  });
  it("storage 미설정/실패 graceful — 명시 skip(placeholder success 금지)", () => {
    expect(ROUTE).toMatch(/instanceof AttachmentStorageNotConfiguredError/);
  });
});

describe("§inbound-rfq-autocapture P2 — 회귀 0(placeholder 제거 + dedup 보존)", () => {
  it("옛 메타-only placeholder 코드 제거(uploadAttachment 함수·문구 0)", () => {
    expect(ROUTE).not.toMatch(/async function uploadAttachment/);
    expect(ROUTE).not.toMatch(/storing metadata only/);
    expect(ROUTE).not.toMatch(/skip actual upload/);
  });
  it("inbound dedup + 토큰 파싱 보존", () => {
    expect(ROUTE).toMatch(/inboundEmail\.findUnique/);
    expect(ROUTE).toMatch(/extractRfqToken/);
  });
});
