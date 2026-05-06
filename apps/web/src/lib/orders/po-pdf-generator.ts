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
 * Pretendard 폰트 path = apps/web/public/fonts/PretendardVariable.ttf
 * (host install 단계에서 추가). 미존재 시 Helvetica fallback (한글 깨짐).
 */
export async function generatePoPdf(input: GeneratePoPdfInput): Promise<Buffer> {
  const { order, requesterName } = input;
  const fontPath = join(process.cwd(), "public", "fonts", "PretendardVariable.ttf");

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // 한글 폰트 임베드 — Pretendard. 미존재 시 helvetica fallback.
    try {
      doc.registerFont("Korean", fontPath);
      doc.font("Korean");
    } catch {
      // host 폰트 미설치 시 fallback — 한글 깨짐 위험. 운영 alarm.
      doc.font("Helvetica");
    }

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
