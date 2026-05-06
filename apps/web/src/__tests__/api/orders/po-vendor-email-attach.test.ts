/**
 * #post-approval-purchase-order-flow Phase 3.x-attach — RED→GREEN test
 *
 * vendor email 의 PDF 첨부. 직전 Phase 3.2 의 한글 본문 만 → PDF binary
 * 첨부 추가. EmailOptions.attachments field 확장 (backward compat) + route
 * 안 generatePoPdf 호출 + Sharing 0 (server-side).
 *
 * canonical truth = Order (DB), Email + PDF = derived projection.
 * 호영님 host config (Resend/SendGrid) 후 실제 첨부 송부 — 본 batch 는
 * source layer 정합 + mock fallback 호환.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const SENDER = "src/lib/email/sender.ts";
const ROUTE = "src/app/api/orders/[id]/send-email/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 3.x-attach — sender.ts", () => {
  it("EmailOptions 에 optional `attachments` field 추가", () => {
    const src = read(SENDER);
    expect(src).toMatch(/attachments\?:\s*[\s\S]*?filename[\s\S]*?content/);
  });

  it("attachments 의 content type — Buffer 또는 base64 string 명시", () => {
    const src = read(SENDER);
    expect(src).toMatch(/Buffer|Uint8Array|base64|string/);
  });
});

describe("#post-approval-purchase-order-flow Phase 3.x-attach — send-email route", () => {
  it("`generatePoPdf` import 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import\s*\{[\s\S]*?generatePoPdf[\s\S]*?\}\s+from/);
  });

  it("`generatePoPdf` 호출 — PDF Buffer 생성", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/generatePoPdf\s*\(/);
  });

  it("sendEmail 호출 시 attachments 전달 — orderNumber.pdf", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail[\s\S]*?attachments/);
    expect(src).toMatch(/\.pdf|orderNumber/);
  });

  it("audit metadata 안 attachmentByteSize 표시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/attachmentByteSize|byteSize|attachmentSize/);
  });
});
