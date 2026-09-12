/**
 * §quote-scan-public-storage P0-b1 (호영님 2026-09-12 승인) —
 * **발주서·공급사 회신 첨부는 public 으로 올리지 않는다. 열람은 프록시가 감사와 함께 한다.**
 *
 * ── 왜 ──
 * 2026-09-12 전수: Vercel Blob 업로드 4곳이 전부 `access: "public"` 이었다.
 *   발주서 PDF   키가 `{prefix}/{orderNumber}.pdf` — **발주번호는 비밀이 아니다**
 *                (화면·이메일·PDF 본문에 찍히고 공급사에게도 보낸다) → URL 조립 가능.
 *   회신 첨부    공급사 견적 PDF(단가·거래 조건).
 * prod 실측: 두 경로 모두 0건이라 **데이터 위험 0 인 지금이 닫을 수 있는 창**이었다.
 *
 * ── 왜 서명 URL 이 아니라 프록시인가 (호영님) ──
 *   ① 요구가 없다 — 서명 URL 은 인증 없는 제3자에게 한시 공개하는 도구다. 발주서는 내부 문서다.
 *   ② 감사 축 — 프록시면 **누가 언제 열었는지** enforceAction 에 남는다. 서명 URL 은 발급만 남는다.
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. OCR 견적 이미지·PDF 2곳은 아직 public 이다 — prod 6건이 걸려 있어 전환 + URL 재발급이
 *      한 묶음이어야 한다(P0-b2 · 호영님 승인 대기). 여기서 단언하면 승인 전에 강제된다.
 *   2. 런타임 권한 — 정적 검사다. 실제 403 응답은 라우트 실행이 판정한다.
 *   3. Vercel Blob 외 provider(supabase · s3)는 아직 미구현 경로다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => stripComments(readFileSync(join(WEB_ROOT, rel), "utf8"));

const PO_STORE = "src/lib/orders/po-pdf-storage.ts";
const REPLY_STORE = "src/lib/email/quote-reply-attachment-storage.ts";
const PROXY = "src/app/api/orders/[id]/po-document/route.ts";
const TRACKING = "src/components/orders/order-tracking-section.tsx";

describe("§quote-scan-public-storage P0-b1 · 업로드는 private 다", () => {
  it("🛑 발주서 PDF 를 public 으로 올리지 않는다", () => {
    const src = read(PO_STORE);
    expect(src).toMatch(/access:\s*"private"/);
    expect(src).not.toMatch(/access:\s*"public"/);
  });

  it("🛑 공급사 회신 첨부를 public 으로 올리지 않는다", () => {
    const src = read(REPLY_STORE);
    expect(src).toMatch(/access:\s*"private"/);
    expect(src).not.toMatch(/access:\s*"public"/);
  });

  it("🛑 발주서 키는 비결정적이다 (발주번호로 조립할 수 없다 · private 과 두 겹)", () => {
    const src = read(PO_STORE);
    expect(src).toMatch(/randomUUID\(\)/);
    // 옛 키: `${prefix}/${input.filename}` — 발주번호가 그대로 키였다
    expect(src).not.toMatch(/const key = `\$\{prefix\}\/\$\{input\.filename\}`/);
  });
});

describe("§quote-scan-public-storage P0-b1 · 열람은 프록시가 감사와 함께 한다", () => {
  const src = read(PROXY);

  it("🛑 조직 대조 후에만 연다 (다른 조직 발주서 403)", () => {
    expect(src).toMatch(/organizationMember\.findFirst/);
    expect(src).toMatch(/status:\s*403/);
    // 대조가 스트림 전달보다 앞이어야 한다
    expect(src.indexOf("status: 403")).toBeLessThan(src.indexOf("blob.stream"));
  });

  it("🔑 열람도 감사 대상이다 (enforceAction + complete · 조직 포함)", () => {
    expect(src).toMatch(/enforceAction\(\{/);
    expect(src).toMatch(/enforcement\.complete\(\{\s*organizationId:\s*order\.organizationId/);
    // complete 가 스트림 전달보다 앞 — 내보내고 나서 기록하면 실패 시 흔적이 없다
    expect(src.indexOf("enforcement.complete(")).toBeLessThan(src.indexOf("blob.stream"));
  });

  it("🛑 private 접근으로 읽는다 (public URL 을 되쓰지 않는다)", () => {
    expect(src).toMatch(/get\(\s*order\.poDocumentUrl,\s*\{\s*access:\s*"private"\s*\}\s*\)/);
    expect(src).toMatch(/Content-Disposition/);
  });

  it("🛑 화면이 storage URL 을 직접 열지 않는다 (프록시 경로를 연다)", () => {
    const tracking = read(TRACKING);
    expect(tracking).toMatch(/window\.open\(`\/api\/orders\/\$\{order\.id\}\/po-document`/);
    expect(tracking).not.toMatch(/window\.open\(order\.poDocumentUrl/);
  });
});
