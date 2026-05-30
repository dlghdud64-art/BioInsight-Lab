/**
 * #post-approval-purchase-order-flow Phase 2.2 — PO PDF generator helper.
 *
 * vendor 별 Order 의 발주서를 한글 PDF 로 생성. pdfkit 기반.
 *
 * canonical truth = Order (DB). PDF 는 derived projection (snapshot) — actual
 * Order data 변경 0. caller 는 generated Buffer 를 HTTP response 로 stream
 * 또는 storage upload (storage upload 는 Phase 2.3 별도 mini-batch).
 *
 * 한글 폰트:
 *   - Pretendard Variable .ttf 임베드 (apps/web/public/fonts/PretendardVariable.ttf)
 *   - host install 단계에서 폰트 파일 추가 필요 (별도 mini-batch 또는 CDN fetch)
 *
 * 의존:
 *   - pdfkit (host npm install 필요): `npm install pdfkit @types/pdfkit`
 *
 * Lock:
 *   - vendor 정보 + orderNumber + items 표 + 총액 표시
 *   - 한글 폰트 임베드 (Pretendard 또는 NotoSansKR)
 *   - PDFA 호환 0 (단순 viewing PDF)
 */

// pdfkit dynamic import 패턴 — host install 후 정상 작동.
// build-time 에서는 module 미존재 시 typecheck error (host install 후 해소).
import PDFDocument from "pdfkit";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
// §11.239 — pdfkit type 정의가 global Buffer (typeof Buffer) 를 namespace
// merge 로 가리는 케이스 존재. node:buffer 의 Buffer 를 NodeBuffer alias 로
// import 해 static concat 안전 호출. runtime 동작 0 변경.
import { Buffer as NodeBuffer } from "node:buffer";

/** PO PDF generator 입력. caller 는 vendor / items 포함된 Order 전달. */
export interface GeneratePoPdfInput {
  order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    notes: string | null;
    expectedDelivery: Date | string | null;
    createdAt: Date | string;
    vendor: {
      id: string;
      name: string;
      nameEn: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    items: Array<{
      name: string;
      brand: string | null;
      catalogNumber: string | null;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
  /** 발주자 (구매 요청자) 표시용 — 미전달 시 "구매팀" fallback. */
  requesterName?: string;
}

/**
 * pdfkit + 한글 폰트로 PO PDF Buffer 생성.
 *
 * §11.326 (호영님 P0, 2026-05-30) — Pretendard 폰트 다중 경로 fallback + Helvetica fallback 제거.
 *   옛: try { register } catch { Helvetica } → Vercel 번들에 Helvetica.afm 없으면 500 ENOENT silent.
 *   신: 후보 경로 3개 차례로 시도 → 미발견 시 명확한 throw (한글 깨짐 silent 회피).
 *   quote-request-pdf-generator.ts 와 동일 패턴. next.config.js outputFileTracingIncludes 정합.
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

export async function generatePoPdf(input: GeneratePoPdfInput): Promise<Buffer> {
  const { order, requesterName } = input;
  // §11.326 Phase 4 (시나리오 3 root cause B-1):
  //   PDFKit constructor `new PDFDocument({...})` 가 default font 'Helvetica' 즉시 auto-load
  //   → Vercel 번들에 Helvetica.afm 없음 → 500 ENOENT (registerFont 호출 전 발생).
  //   호영님 가설 B-1 확정: constructor `font` option 에 Pretendard Buffer 직접 전달 →
  //   Helvetica auto-load 차단. quote-request-pdf-generator 와 동일 패턴.
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
    // §11.238 / §11.239 — Buffer.concat type drift (pdfkit type 가 global
    //   Buffer namespace 와 merge 되며 typeof Buffer 의 static concat 가림).
    //   any cast 로 production-grade Buffer.concat 직접 호출. runtime 동작 0 변경.
    doc.on("end", () =>
      resolve((NodeBuffer as any).concat(chunks as unknown as Uint8Array[]) as Buffer),
    );
    doc.on("error", reject);

    // §11.326 Phase 4 — Korean alias 등록 (다른 코드 경로 font 참조 호환).
    //   constructor 에서 fontBuffer 이미 사용 중이므로 registerFont 는 alias 명명용.
    doc.registerFont("Korean", fontBuffer);
    doc.font("Korean");

    // §11.329 — 레이아웃 상수(하드코딩 제거). A4 595 − margin 48×2 = 499.
    const PAGE_MARGIN = 48;
    const contentLeft = PAGE_MARGIN;
    const contentRight = doc.page.width - PAGE_MARGIN; // 547
    const contentWidth = contentRight - contentLeft;   // 499
    const BOTTOM_LIMIT = doc.page.height - 80;
    const COL = {
      name: { x: contentLeft, w: 230 },
      qty: { x: contentLeft + 230, w: 70 },
      unit: { x: contentLeft + 300, w: 99 },
      total: { x: contentLeft + 399, w: 100 },
    } as const;
    const ensureSpace = (rowY: number, need = 24): number => {
      if (rowY + need > BOTTOM_LIMIT) {
        doc.addPage();
        return doc.y;
      }
      return rowY;
    };

    // ── Header — 발주서 (Purchase Order) 한글 ──
    doc.fontSize(22).text("발주서 (Purchase Order)", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#666")
      .text(`발주번호: ${order.orderNumber}`, { align: "right" });
    doc
      .fillColor("#666")
      .text(
        `발행일: ${new Date(order.createdAt).toLocaleDateString("ko-KR")}`,
        { align: "right" },
      );
    doc.moveDown(1).fillColor("#000");

    // ── Vendor 정보 ──
    doc.fontSize(13).text("공급사 (Vendor)", { underline: true });
    doc.moveDown(0.3).fontSize(11);
    if (order.vendor) {
      doc.text(`상호: ${order.vendor.name}`);
      if (order.vendor.nameEn) doc.text(`영문: ${order.vendor.nameEn}`);
      if (order.vendor.email) doc.text(`이메일: ${order.vendor.email}`);
      if (order.vendor.phone) doc.text(`전화: ${order.vendor.phone}`);
    } else {
      doc.fillColor("#999").text("(공급사 지정 없음)").fillColor("#000");
    }
    doc.moveDown(1);

    // ── 발주 정보 ──
    doc.fontSize(13).text("발주 정보", { underline: true });
    doc.moveDown(0.3).fontSize(11);
    doc.text(`발주자: ${requesterName ?? "구매팀"}`);
    if (order.expectedDelivery) {
      doc.text(
        `예상 배송일: ${new Date(order.expectedDelivery).toLocaleDateString("ko-KR")}`,
      );
    }
    if (order.notes) doc.text(`비고: ${order.notes}`);
    doc.moveDown(1);

    // ── Item 표 ──
    doc.fontSize(13).text("발주 품목", { underline: true });
    doc.moveDown(0.5).fontSize(10);
    const tableTop = doc.y;
    doc
      .fillColor("#666")
      .text("품목", COL.name.x, tableTop, { width: COL.name.w })
      .text("수량", COL.qty.x, tableTop, { width: COL.qty.w, align: "right" })
      .text("단가", COL.unit.x, tableTop, { width: COL.unit.w, align: "right" })
      .text("합계", COL.total.x, tableTop, { width: COL.total.w, align: "right" });
    doc
      .moveTo(contentLeft, tableTop + 14)
      .lineTo(contentRight, tableTop + 14)
      .stroke();
    doc.fillColor("#000");

    let rowY = tableTop + 20;
    for (const item of order.items) {
      rowY = ensureSpace(rowY);
      const itemLabel = `${item.name}${
        item.brand ? ` (${item.brand})` : ""
      }${item.catalogNumber ? ` · ${item.catalogNumber}` : ""}`;
      doc
        .text(itemLabel, COL.name.x, rowY, { width: COL.name.w })
        .text(item.quantity.toString(), COL.qty.x, rowY, { width: COL.qty.w, align: "right" })
        .text(`₩${item.unitPrice.toLocaleString("ko-KR")}`, COL.unit.x, rowY, { width: COL.unit.w, align: "right" })
        .text(`₩${item.lineTotal.toLocaleString("ko-KR")}`, COL.total.x, rowY, { width: COL.total.w, align: "right" });
      rowY += 22;
    }
    rowY = ensureSpace(rowY);
    doc.moveTo(contentLeft, rowY).lineTo(contentRight, rowY).stroke();
    rowY += 12;

    // ── 총액 ──
    rowY = ensureSpace(rowY, 30);
    doc
      .fontSize(13)
      .text(
        `총액: ₩${order.totalAmount.toLocaleString("ko-KR")}`,
        contentLeft,
        rowY,
        { width: contentWidth, align: "right" },
      );

    // ── Footer ──
    doc.moveDown(2).fontSize(9).fillColor("#999");
    doc.text(
      "본 발주서는 LabAxis 운영 시스템에서 자동 생성되었습니다.",
      contentLeft,
      doc.y,
      { width: contentWidth, align: "center" },
    );

    doc.end();
  });
}
