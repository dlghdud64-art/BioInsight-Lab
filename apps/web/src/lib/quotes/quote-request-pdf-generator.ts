/**
 * §11.314-b #quote-request-pdf — 견적 요청서(RFQ) PDF generator.
 *
 * 호영님 §11.308 확인요청 → 옵션 C (PDF 생성 + mailto MVP):
 *   공급사에게 보낼 견적 요청서를 PDF 로 생성. 사용자가 다운로드 후
 *   메일로 직접 첨부 전송 (mailto). 실제 SMTP 자동 발송(Phase 2)은 후속.
 *
 * §11.314-b 패턴: lib/orders/po-pdf-generator.ts 복제 정합.
 *   - pdfkit 기반 + Pretendard 한글 폰트 임베드
 *   - canonical truth = Quote (DB). PDF 는 derived projection (snapshot).
 *   - 견적 "요청"서이므로 단가/합계 비움 (공급사가 회신 시 채움).
 *
 * 의존: pdfkit (^0.18.0 설치됨), public/fonts/PretendardVariable.ttf
 */

import PDFDocument from "pdfkit";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Buffer as NodeBuffer } from "node:buffer";

/** 견적 요청서 PDF generator 입력. caller 는 items(product join) 포함 Quote 전달. */
export interface GenerateQuoteRequestPdfInput {
  quote: {
    id: string;
    quoteNumber: string | null;
    title: string;
    description: string | null;
    validUntil: Date | string | null;
    createdAt: Date | string;
    items: Array<{
      productName: string;
      brand: string | null;
      catalogNumber: string | null;
      specification: string | null;
      grade: string | null;
      quantity: number;
      notes: string | null;
    }>;
  };
  /** 요청자 (구매 요청자) 표시용 — 미전달 시 "구매팀" fallback. */
  requesterName?: string;
  /** 수신 공급사명 (있으면 표시) — 미전달 시 수신처 빈칸 표기. */
  vendorName?: string;
  /** §rfq-doc-redesign 발신 기관명 (Organization.name). */
  institutionName?: string;
  /** §rfq-doc-redesign 담당 실명 (User.name) — 미입력 시 route 에서 다운로드 차단. */
  contactName?: string;
  /** §rfq-doc-redesign 담당 전화 (User.phone). */
  contactPhone?: string;
  /** §rfq-doc-redesign 회신 기한 N일 (발송 모달 응답 요청 기한, 기본 14). 발행일+N 계산. */
  replyDeadlineDays?: number;
  /** §rfq-doc-redesign RFQ 표시번호 (Quote.quoteNumber → RFQ-{YYMM}-{XXXX} 결정적 변환). */
  rfqDisplayRef?: string;
  /** §rfq-doc-redesign 회신 주소 — route 가 canonical 인프라(buildRfqReplyAddress: rfq+<token>@inbound.<domain>)
   *  또는 요청자 이메일(직접수신 폴백)로 전달. generator 는 주소를 합성하지 않는다(UNMATCHED 방지). */
  replyAddress?: string;
  /** §rfq-doc-redesign true=자동수신(rfq+token, inbound parse 매칭) → "자동 전달·기록" 문구.
   *  false/미전달=요청자 직접수신 → 자동 문구 미표기. */
  replyAutoCapture?: boolean;
}

/**
 * pdfkit + 한글 폰트로 견적 요청서 PDF Buffer 생성.
 *
 * §11.326 (호영님 P0, 2026-05-30) — Pretendard 폰트 다중 경로 fallback + Helvetica fallback 제거.
 *   옛: try { register } catch { Helvetica } → Vercel 번들에 Helvetica.afm 없으면 500 ENOENT silent.
 *   신: 후보 경로 3개 (process.cwd() / monorepo root / __dirname relative) 차례로 시도 →
 *       미발견 시 명확한 throw (한글 깨짐 silent 회피).
 *   next.config.js outputFileTracingIncludes 와 함께 적용 (public/fonts/** Vercel 강제 포함).
 */
function resolvePretendardPath(): string {
  const candidates = [
    join(process.cwd(), "public", "fonts", "PretendardVariable.ttf"),
    join(process.cwd(), "apps", "web", "public", "fonts", "PretendardVariable.ttf"),
    join(__dirname, "..", "..", "..", "public", "fonts", "PretendardVariable.ttf"),
  ];
  for (const path of candidates) {
    try {
      if (existsSync(path)) return path;
    } catch {
      // existsSync 자체 throw 는 무시 (다음 후보 시도)
    }
  }
  throw new Error(
    `[§11.326] Pretendard 폰트 미발견 — 후보: ${candidates.join(" | ")}. ` +
      `Vercel: next.config.js experimental.outputFileTracingIncludes 확인. ` +
      `로컬: apps/web/public/fonts/PretendardVariable.ttf 존재 확인.`,
  );
}

export async function generateQuoteRequestPdf(
  input: GenerateQuoteRequestPdfInput,
): Promise<Buffer> {
  const {
    quote, requesterName, vendorName,
    institutionName, contactName, contactPhone,
    replyDeadlineDays, rfqDisplayRef, replyAddress, replyAutoCapture,
  } = input;
  // §11.326 Phase 4 (시나리오 3 root cause B-1):
  //   PDFKit constructor `new PDFDocument({...})` 가 default font 'Helvetica' 즉시 auto-load
  //   → Vercel 번들에 Helvetica.afm 없음 → 500 ENOENT (registerFont 호출 전 발생).
  //   호영님 가설 B-1 확정: constructor `font` option 에 Pretendard Buffer 직접 전달 →
  //   Helvetica auto-load 차단.
  const fontPath = resolvePretendardPath();
  const fontBuffer = readFileSync(fontPath);

  return new Promise<Buffer>((resolve, reject) => {
    // §11.326 Phase 4 — `font: fontBuffer` 로 constructor 단계에서 Pretendard 등록.
    //   PDFKit source: `this.font(options.font || 'Helvetica')` — font option 없으면
    //   Helvetica fallback (null/false 도 fallback). Buffer 전달이 유일한 robust fix.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = new PDFDocument({ size: "A4", margin: 48, font: fontBuffer as any });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () =>
      resolve((NodeBuffer as any).concat(chunks as unknown as Uint8Array[]) as Buffer),
    );
    doc.on("error", reject);

    // §11.326 Phase 4 — Korean alias 등록 (다른 코드 경로 font 참조 호환).
    //   constructor 에서 fontBuffer 이미 사용 중이므로 registerFont 는 alias 명명용.
    doc.registerFont("Korean", fontBuffer);
    doc.font("Korean");

    // ═══ §rfq-doc-redesign — 견적 요청서(RFQ) 공식 문서 (시각 truth: 견적 요청서 리디자인 (단독).html) ═══
    //   pdfkit 수동 테이블 (신규 dep/HTML→PDF 금지 — CLAUDE.md sandbox install 금지).
    const PAGE_MARGIN = 48;
    const L = PAGE_MARGIN;
    const R = doc.page.width - PAGE_MARGIN;
    const W = R - L;
    const BOTTOM = doc.page.height - 52;
    const C = {
      dark: "#0f172a", border: "#cbd5e1", labelBg: "#f8fafc", panelBg: "#f1f5f9",
      slate: "#475569", slate2: "#334155", muted: "#94a3b8", sub: "#64748b",
      red: "#b91c1c", blue: "#2563eb",
    };
    // §rfq-doc-redesign — keep-all: 각 어절(공백 구분) 내부에 word-joiner 삽입 →
    //   pdfkit 이 어절 중간(예: "견"/"적")에서 줄바꿈하지 않도록 강제. 공백에서만 개행.
    const WJ = "\u2060";
    const ka = (str: string): string =>
      String(str).split(" ").map((t) => (t.includes("@") || t.length > 24 ? t : t.split("").join(WJ))).join(" ");
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())}.`;
    const issued = new Date(quote.createdAt);
    const deadlineDays =
      typeof replyDeadlineDays === "number" && replyDeadlineDays > 0 ? replyDeadlineDays : 14;
    const deadline = new Date(issued.getTime() + deadlineDays * 86400000);
    const deriveRfq = (qn: string | null | undefined): string => {
      if (qn) {
        const m = qn.match(/(\d{4})(\d{2})\d{2}-?([A-Za-z0-9]+)/);
        if (m) return `RFQ-${m[1].slice(2)}${m[2]}-${m[3]}`.toUpperCase();
        return `RFQ-${qn.replace(/^Q-?/i, "")}`.toUpperCase();
      }
      return `RFQ-${quote.id.slice(0, 8)}`.toUpperCase();
    };
    const rfqRef = (rfqDisplayRef ?? deriveRfq(quote.quoteNumber)).toUpperCase();
    const replyTo = replyAddress ?? "";
    const recipient = vendorName && vendorName.trim() ? vendorName.trim() : null;
    const institution =
      institutionName && institutionName.trim() ? institutionName.trim() : (quote.title || "요청 기관");
    const contact =
      contactName && contactName.trim()
        ? contactName.trim()
        : requesterName && requesterName.trim()
        ? requesterName.trim()
        : "";
    const phone = contactPhone && contactPhone.trim() ? contactPhone.trim() : "";

    let y = PAGE_MARGIN;

    // ── 1. 레터헤드 ──
    doc.fillColor(C.blue).fontSize(11).text("LabAxis", L, y, { characterSpacing: 0.5 });
    doc.fillColor(C.dark).fontSize(24).text("견 적 요 청 서", L, y + 15, { characterSpacing: 1 });
    const infoW = 210, infoLabelW = 62, infoX = R - infoW, infoRowH = 17;
    const infoRows: Array<[string, string, ("mono" | "red")?]> = [
      ["문서번호", rfqRef, "mono"],
      ["발행일", fmt(issued)],
      ["회신 기한", `${fmt(deadline)} (${deadlineDays}일)`, "red"],
    ];
    let iy = y;
    infoRows.forEach(([label, val, kind]) => {
      doc.rect(infoX, iy, infoLabelW, infoRowH).fill(C.labelBg);
      doc.fillColor("#000");
      doc.lineWidth(0.8).rect(infoX, iy, infoLabelW, infoRowH).stroke(C.border);
      doc.lineWidth(0.8).rect(infoX + infoLabelW, iy, infoW - infoLabelW, infoRowH).stroke(C.border);
      doc.fillColor(C.slate).fontSize(9).text(label, infoX + 6, iy + 4.5, { width: infoLabelW - 8 });
      doc.fillColor(kind === "red" ? C.red : "#1e293b").fontSize(9.5)
        .text(ka(val), infoX + infoLabelW + 7, iy + 4.5, { width: infoW - infoLabelW - 12 });
      iy += infoRowH;
    });
    doc.fillColor("#000");
    const headBottom = Math.max(y + 46, iy + 5);
    doc.lineWidth(2.5).moveTo(L, headBottom).lineTo(R, headBottom).stroke(C.dark);
    y = headBottom + 14;

    // ── 2. 수신 / 발신 2단 ──
    const colW = (W - 14) / 2;
    const boxH = 52;
    const drawParty = (x: number, header: string, name: string, sub: string) => {
      doc.rect(x, y, colW, 20).fill(C.panelBg);
      doc.fillColor("#000");
      doc.lineWidth(1).rect(x, y, colW, boxH).stroke(C.border);
      doc.moveTo(x, y + 20).lineTo(x + colW, y + 20).stroke(C.border);
      doc.fillColor(C.slate2).fontSize(9.5).text(ka(header), x + 12, y + 6, { width: colW - 20 });
      doc.fillColor(C.dark).fontSize(11.5).text(ka(name), x + 12, y + 27, { width: colW - 20 });
      doc.fillColor(C.slate).fontSize(9.5).text(ka(sub), x + 12, y + 42, { width: colW - 20 });
      doc.fillColor("#000");
    };
    drawParty(
      L, "수신 (공급사)",
      recipient ? `${recipient} 귀중` : "(수신처 기재)",
      recipient ? "담당: 영업부 견적 담당자님" : "담당: 견적 담당자님",
    );
    const fromSub = [contact ? `담당 ${contact}` : "", phone].filter(Boolean).join(" · ");
    drawParty(L + colW + 14, "발신 (요청 기관)", institution, fromSub || " ");
    y += boxH + 13;

    // ── 3. 인사 문단 ──
    doc.fillColor(C.slate2).fontSize(10.5).text(
      ka("아래 품목에 대한 견적을 요청드립니다. 귀사 견적서 양식으로 회신 기한 내 회신 부탁드리며, 단가·납기·최소 주문 수량·견적 유효기간을 포함해 주세요."),
      L, y, { width: W, lineGap: 3 },
    );
    y = doc.y + 12;
    doc.fillColor("#000");

    // ── 4. 품목 표 (다크 헤더 · 가격열 없음) ──
    const cols = [
      { label: "No", w: 30, align: "center" as const },
      { label: "품목명 / 제조사·카탈로그 번호", w: W - 30 - 66 - 44 - 150, align: "left" as const },
      { label: "규격", w: 66, align: "center" as const },
      { label: "수량", w: 44, align: "center" as const },
      { label: "요청 사항", w: 150, align: "left" as const },
    ];
    const hH = 22;
    let cx = L;
    doc.rect(L, y, W, hH).fill(C.dark);
    doc.fillColor("#fff").fontSize(10);
    cols.forEach((c) => {
      doc.text(ka(c.label), cx + 6, y + 6.5, { width: c.w - 12, align: c.align });
      cx += c.w;
    });
    doc.fillColor("#000");
    y += hH;
    quote.items.forEach((it, idx) => {
      const nameMain = it.productName;
      const nameSub = [it.brand, it.catalogNumber].filter(Boolean).join(" · ");
      const spec = [it.specification, it.grade].filter(Boolean).join(" / ") || "—";
      const req = ka("단가·납기·최소 주문 수량");
      doc.fontSize(10.5);
      const h1 = doc.heightOfString(nameMain, { width: cols[1].w - 12 });
      doc.fontSize(9);
      const h2 = nameSub ? doc.heightOfString(nameSub, { width: cols[1].w - 12 }) + 2 : 0;
      doc.fontSize(10);
      const hReq = doc.heightOfString(req, { width: cols[4].w - 12 });
      const rowH = Math.max(h1 + h2 + 12, hReq + 12, 26);
      if (y + rowH > BOTTOM) { doc.addPage(); y = PAGE_MARGIN; }
      let bx = L;
      cols.forEach((c) => { doc.lineWidth(0.8).rect(bx, y, c.w, rowH).stroke(C.border); bx += c.w; });
      let px = L;
      doc.fillColor(C.slate2).fontSize(10)
        .text(String(idx + 1), px + 4, y + (rowH - 10) / 2, { width: cols[0].w - 8, align: "center" });
      px += cols[0].w;
      doc.fillColor(C.dark).fontSize(10.5).text(ka(nameMain), px + 6, y + 6, { width: cols[1].w - 12 });
      if (nameSub)
        doc.fillColor(C.sub).fontSize(9).text(ka(nameSub), px + 6, y + 6 + h1 + 1, { width: cols[1].w - 12 });
      px += cols[1].w;
      doc.fillColor(C.slate2).fontSize(10)
        .text(ka(spec), px + 4, y + (rowH - 10) / 2, { width: cols[2].w - 8, align: "center" });
      px += cols[2].w;
      doc.text(String(it.quantity), px + 4, y + (rowH - 10) / 2, { width: cols[3].w - 8, align: "center" });
      px += cols[3].w;
      doc.fillColor(C.slate).fontSize(10)
        .text(req, px + 6, y + (rowH - hReq) / 2, { width: cols[4].w - 12 });
      doc.fillColor("#000");
      y += rowH;
    });
    y += 6;

    // ── 5. 각주 ──
    doc.fillColor(C.muted).fontSize(9)
      .text("※ 견적 금액은 부가세 포함 여부를 명기해 주세요.", L, y, { width: W });
    y = doc.y + 12;
    doc.fillColor("#000");

    // ── 6. 조건 표 (회신 방법 / 요청 조건 / 비고) ──
    const termLabelW = 88;
    const bigo = [
      "수량 할인 조건이 있으면 함께 기재 부탁드립니다 · 문의는 위 회신 주소로 답장",
      quote.description && quote.description.trim() ? quote.description.trim() : "",
    ].filter(Boolean).join(" · ");
    const terms: Array<[string, string]> = [
      ["회신 방법", replyTo
        ? `${replyTo} 로 귀사 견적서 회신${replyAutoCapture ? " (회신 즉시 요청 기관에 자동 전달·기록됩니다)" : " (요청 기관 담당자에게 직접 도착합니다)"}`
        : "요청 기관 담당자 이메일로 귀사 견적서 회신 부탁드립니다"],
      ["요청 조건", "견적 유효기간 30일 이상 · 납품 장소: 요청 기관 연구실 · 결제: 세금계산서 발행 후 익월"],
      ["비고", bigo],
    ];
    doc.fontSize(9.5);
    terms.forEach(([label, val]) => {
      const vh = doc.heightOfString(val, { width: W - termLabelW - 20 });
      const rowH = Math.max(vh + 12, 24);
      if (y + rowH > BOTTOM) { doc.addPage(); y = PAGE_MARGIN; }
      doc.rect(L, y, termLabelW, rowH).fill(C.labelBg);
      doc.fillColor("#000");
      doc.lineWidth(0.8).rect(L, y, termLabelW, rowH).stroke(C.border);
      doc.lineWidth(0.8).rect(L + termLabelW, y, W - termLabelW, rowH).stroke(C.border);
      doc.fillColor(C.slate).fontSize(9.5).text(ka(label), L + 10, y + 6, { width: termLabelW - 16 });
      doc.fillColor(C.slate2).fontSize(9.5)
        .text(ka(val), L + termLabelW + 10, y + 6, { width: W - termLabelW - 20 });
      doc.fillColor("#000");
      y += rowH;
    });
    y += 22;

    // ── 7. 결문 (도장/서명란 없음) ──
    if (y + 84 > BOTTOM) { doc.addPage(); y = PAGE_MARGIN; }
    doc.fillColor(C.slate2).fontSize(11)
      .text(ka("위와 같이 견적을 요청합니다."), L, y, { width: W, align: "center" });
    y = doc.y + 16;
    const closing = contact ? `${institution}      담당 ${contact}` : institution;
    doc.fillColor(C.dark).fontSize(12.5).text(ka(closing), L, y, { width: W, align: "center" });
    y = doc.y + 10;

    // ── 8. 푸터 ──
    const footerY = Math.max(y + 14, doc.page.height - 70);
    doc.lineWidth(1).moveTo(L, footerY).lineTo(R, footerY).stroke("#e2e8f0");
    doc.fillColor(C.muted).fontSize(8.5).text(
      ka(`본 견적 요청서는 LabAxis에서 자동 생성되었습니다 · labaxis.co.kr · 문서번호 ${rfqRef}`),
      L, footerY + 5, { width: W, align: "center" },
    );
    doc.fillColor("#000");

    doc.end();
  });
}
