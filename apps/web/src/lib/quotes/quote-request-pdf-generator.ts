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
  /** 수신 공급사명 (있으면 표시) — 미전달 시 "(공급사 미지정)". */
  vendorName?: string;
}

/**
 * pdfkit + 한글 폰트로 견적 요청서 PDF Buffer 생성.
 *
 * Pretendard 폰트 path = apps/web/public/fonts/PretendardVariable.ttf
 * (host install 단계에서 추가). 미존재 시 Helvetica fallback (한글 깨짐).
 */
export async function generateQuoteRequestPdf(
  input: GenerateQuoteRequestPdfInput,
): Promise<Buffer> {
  const { quote, requesterName, vendorName } = input;
  const fontPath = join(process.cwd(), "public", "fonts", "PretendardVariable.ttf");

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () =>
      resolve((NodeBuffer as any).concat(chunks as unknown as Uint8Array[]) as Buffer),
    );
    doc.on("error", reject);

    // 한글 폰트 임베드 — Pretendard. 미존재 시 helvetica fallback.
    try {
      doc.registerFont("Korean", fontPath);
      doc.font("Korean");
    } catch {
      doc.font("Helvetica");
    }

    // ── Header — 견적 요청서 (Quote Request / RFQ) ──
    doc.fontSize(22).text("견적 요청서 (Quote Request)", { align: "center" });
    doc.moveDown(0.5);
    if (quote.quoteNumber) {
      doc
        .fontSize(10)
        .fillColor("#666")
        .text(`견적번호: ${quote.quoteNumber}`, { align: "right" });
    }
    doc
      .fillColor("#666")
      .text(
        `발행일: ${new Date(quote.createdAt).toLocaleDateString("ko-KR")}`,
        { align: "right" },
      );
    if (quote.validUntil) {
      doc
        .fillColor("#666")
        .text(
          `회신 기한: ${new Date(quote.validUntil).toLocaleDateString("ko-KR")}`,
          { align: "right" },
        );
    }
    doc.moveDown(1).fillColor("#000");

    // ── 수신 / 요청 정보 ──
    doc.fontSize(13).text("요청 정보", { underline: true });
    doc.moveDown(0.3).fontSize(11);
    doc.text(`수신: ${vendorName ?? "(공급사 미지정)"}`);
    doc.text(`요청자: ${requesterName ?? "구매팀"}`);
    doc.text(`제목: ${quote.title}`);
    doc.moveDown(1);

    // ── 요청 품목 표 (단가/합계 비움 — 공급사 회신 시 작성) ──
    doc.fontSize(13).text("요청 품목", { underline: true });
    doc.moveDown(0.5).fontSize(10);
    const tableTop = doc.y;
    const colX = { name: 48, spec: 280, qty: 420, price: 480 };
    doc
      .fillColor("#666")
      .text("품목", colX.name, tableTop)
      .text("규격", colX.spec, tableTop)
      .text("수량", colX.qty, tableTop)
      .text("견적가", colX.price, tableTop);
    doc
      .moveTo(48, tableTop + 14)
      .lineTo(545, tableTop + 14)
      .stroke();
    doc.fillColor("#000");

    let rowY = tableTop + 20;
    for (const item of quote.items) {
      const itemLabel = `${item.productName}${
        item.brand ? ` (${item.brand})` : ""
      }${item.catalogNumber ? ` · ${item.catalogNumber}` : ""}`;
      const specLabel = [item.specification, item.grade]
        .filter(Boolean)
        .join(" / ") || "-";
      doc
        .text(itemLabel, colX.name, rowY, { width: 220 })
        .text(specLabel, colX.spec, rowY, { width: 130 })
        .text(item.quantity.toString(), colX.qty, rowY)
        // 견적가 = 공급사 작성란 (빈 칸)
        .fillColor("#bbb")
        .text("(   )", colX.price, rowY)
        .fillColor("#000");
      // notes 가 있으면 다음 줄에 작게
      if (item.notes) {
        rowY += 14;
        doc
          .fontSize(8)
          .fillColor("#888")
          .text(`  비고: ${item.notes}`, colX.name, rowY, { width: 480 })
          .fontSize(10)
          .fillColor("#000");
      }
      rowY += 22;
    }
    doc.moveTo(48, rowY).lineTo(545, rowY).stroke();
    rowY += 12;

    // ── 요청 사유 / 비고 (quote.description) ──
    if (quote.description) {
      doc.moveDown(1).fontSize(13).text("요청 사유 / 비고", { underline: true });
      doc.moveDown(0.3).fontSize(11).text(quote.description, { width: 497 });
    }

    // ── 안내 ──
    doc.moveDown(1.5).fontSize(9).fillColor("#666");
    doc.text(
      "※ 견적가 란에 품목별 단가를 기재하여 회신 부탁드립니다.",
      { width: 497 },
    );

    // ── Footer ──
    doc.moveDown(1.5).fontSize(9).fillColor("#999");
    doc.text(
      "본 견적 요청서는 LabAxis 운영 시스템에서 자동 생성되었습니다.",
      { align: "center" },
    );

    doc.end();
  });
}
