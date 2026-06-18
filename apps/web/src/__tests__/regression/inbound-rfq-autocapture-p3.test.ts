/**
 * §inbound-rfq-autocapture P3 (PLAN_inbound-rfq-autocapture) — quotes 회신 표시 UI(same-canvas)
 *
 * 자동수신 QuoteReply 를 quotes 상세 "received" 탭 최상단에 읽기 전용 섹션으로 흡수.
 *   - 조회 API: GET /api/quotes/[id]/email-replies (QuoteReply + 첨부, owner/org 권한).
 *   - 컴포넌트: useQuery + csrfFetch, loading/error/empty 3상태, 첨부 메타 표시.
 *   - same-canvas: 기존 received 탭 흡수(신규 page/탭 0). 다운로드 dead button 미배치(서명 URL 후속).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const API = read("app/api/quotes/[id]/email-replies/route.ts");
const COMP = read("components/quotes/email-replies-section.tsx");
const PAGE = read("app/quotes/[id]/page.tsx");

describe("§inbound-rfq-autocapture P3 — 조회 API", () => {
  it("GET + QuoteReply findMany + 첨부 + receivedAt desc", () => {
    expect(API).toMatch(/export async function GET/);
    expect(API).toMatch(/quoteReply\.findMany/);
    expect(API).toMatch(/attachments:/);
    expect(API).toMatch(/orderBy:\s*\{\s*receivedAt:\s*"desc"\s*\}/);
  });
  it("권한 — owner OR org member(2-source)", () => {
    expect(API).toMatch(/verifyQuoteAccess/);
    expect(API).toMatch(/organizationMember\.findFirst/);
    expect(API).toMatch(/Access denied/);
  });
});

describe("§inbound-rfq-autocapture P3 — 회신 섹션 컴포넌트", () => {
  it("useQuery + csrfFetch(email-replies) 조회", () => {
    expect(COMP).toMatch(/useQuery/);
    expect(COMP).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/email-replies`\)/);
  });
  it("loading / error(재시도) / empty(컴팩트 muted) 3상태", () => {
    expect(COMP).toMatch(/query\.isLoading/);
    expect(COMP).toMatch(/query\.isError/);
    expect(COMP).toMatch(/replies\.length === 0/);
    expect(COMP).toMatch(/아직 수신된 이메일 회신이 없습니다/);
  });
  it("첨부 메타 표시(파일명·크기) + 회신 원문", () => {
    expect(COMP).toMatch(/r\.attachments\.map/);
    expect(COMP).toMatch(/fmtSize/);
    expect(COMP).toMatch(/r\.bodyText/);
  });
  it("다운로드 dead button 미배치 — 첨부는 span(title) 표시만(href/download 0)", () => {
    expect(COMP).not.toMatch(/href=\{[^}]*\.(path|url)/);
    expect(COMP).not.toMatch(/download=/);
  });
});

describe("§inbound-rfq-autocapture P3 — same-canvas 흡수(page-per-feature 0)", () => {
  it("page.tsx import + received 탭 흡수", () => {
    expect(PAGE).toMatch(/import \{ EmailRepliesSection \} from "@\/components\/quotes\/email-replies-section"/);
    expect(PAGE).toMatch(/<EmailRepliesSection quoteId=\{quoteId\} \/>/);
  });
  it("회귀 0 — received 탭 + 벤더 견적 입력 보존", () => {
    expect(PAGE).toMatch(/TabsContent value="received"/);
    expect(PAGE).toMatch(/벤더 견적 입력/);
  });
});
