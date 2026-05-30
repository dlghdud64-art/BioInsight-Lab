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
    const doc = new PDFDocument({ size: "A4", margin: 48, font: fontBuffer });
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
    const colX = { name: 48, qty: 280, unit: 360, total: 460 };
    doc
      .fillColor("#666")
      .text("품목", colX.name, tableTop)
      .text("수량", colX.qty, tableTop)
      .text("단가", colX.unit, tableTop)
      .text("합계", colX.total, tableTop);
    doc
      .moveTo(48, tableTop + 14)
      .lineTo(545, tableTop + 14)
      .stroke();
    doc.fillColor("#000");

    let rowY = tableTop + 20;
    for (const item of order.items) {
      const itemLabel = `${item.name}${
        item.brand ? ` (${item.brand})` : ""
      }${item.catalogNumber ? ` · ${item.catalogNumber}` : ""}`;
      doc
        .text(itemLabel, colX.name, rowY, { width: 220 })
        .text(item.quantity.toString(), colX.qty, rowY)
        .text(`₩${item.unitPrice.toLocaleString("ko-KR")}`, colX.unit, rowY)
        .text(`₩${item.lineTotal.toLocaleString("ko-KR")}`, colX.total, rowY);
      rowY += 22;
    }
    doc.moveTo(48, rowY).lineTo(545, rowY).stroke();
    rowY += 12;

    // ── 총액 ──
    doc
      .fontSize(13)
      .text(
        `총액: ₩${order.totalAmount.toLocaleString("ko-KR")}`,
        colX.unit,
        rowY,
        { align: "left" },
      );

    // ── Footer ──
    doc.moveDown(2).fontSize(9).fillColor("#999");
    doc.text(
      "본 발주서는 LabAxis 운영 시스템에서 자동 생성되었습니다.",
      { align: "center" },
    );

    doc.end();
  });
}
