/**
 * #post-approval-purchase-order-flow Phase 3.2 — vendor 별 PO email template.
 *
 * vendor 에게 발주 사실 + 발주 detail 을 한글 본문으로 통보. PDF 첨부는
 * 별도 mini-batch (Phase 3.x-attach) — 본 template 은 inline body 만
 * (품목 표 + 총액 + 발주번호 + 예상 배송일 + 발주자).
 *
 * canonical truth = Order (DB). Email = derived projection (snapshot).
 * 기존 generatePurchase*Email 패턴 정합 (templates.ts).
 */

import type { EmailTemplate } from "./templates";

/** PO vendor email 입력. caller 는 Order (vendor + items) 풀어서 전달. */
export interface GeneratePoVendorEmailInput {
  vendorName: string;
  /** vendor 영문명 (있을 때 subject 에 병기). */
  vendorNameEn?: string | null;
  orderNumber: string;
  totalAmount: number;
  /** 발주자 (구매 요청자) 표시. */
  requesterName?: string | null;
  /** 발주자 이메일 — vendor 의 회신 안내용. */
  requesterEmail?: string | null;
  /** 예상 배송일 (ISO string 또는 Date). */
  expectedDelivery?: Date | string | null;
  /** 발주 메모/비고. */
  notes?: string | null;
  items: Array<{
    name: string;
    brand?: string | null;
    catalogNumber?: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  /** PO PDF 다운로드 URL — 차후 attach 또는 link. 미전달 시 link 미표시. */
  pdfDownloadUrl?: string | null;
}

/**
 * vendor 에게 보낼 PO email 본문 생성. EmailTemplate { subject, html, text }
 * 반환 — 기존 sendEmail() caller 가 그대로 사용.
 */
export function generatePoVendorEmail(
  data: GeneratePoVendorEmailInput,
): EmailTemplate {
  const subject = `[발주서] ${data.orderNumber} — ${data.vendorName}${
    data.vendorNameEn ? ` (${data.vendorNameEn})` : ""
  }`;

  const expectedLine = data.expectedDelivery
    ? new Date(data.expectedDelivery).toLocaleDateString("ko-KR")
    : "협의 후 결정";
  const requesterLine = data.requesterName ?? "구매팀";
  const requesterContactLine = data.requesterEmail
    ? `<a href="mailto:${data.requesterEmail}">${data.requesterEmail}</a>`
    : "(별도 문의 채널 안내 예정)";

  const itemRowsHtml = data.items
    .map(
      (it) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
            ${escape(it.name)}${it.brand ? ` (${escape(it.brand)})` : ""}${
              it.catalogNumber ? ` · ${escape(it.catalogNumber)}` : ""
            }
          </td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${it.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">₩${it.unitPrice.toLocaleString("ko-KR")}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">₩${it.lineTotal.toLocaleString("ko-KR")}</td>
        </tr>`,
    )
    .join("");

  const itemRowsText = data.items
    .map(
      (it) =>
        `  - ${it.name}${it.brand ? ` (${it.brand})` : ""}${
          it.catalogNumber ? ` · ${it.catalogNumber}` : ""
        }  · 수량: ${it.quantity}  · 단가: ₩${it.unitPrice.toLocaleString(
          "ko-KR",
        )}  · 합계: ₩${it.lineTotal.toLocaleString("ko-KR")}`,
    )
    .join("\n");

  const pdfLinkHtml = data.pdfDownloadUrl
    ? `<p style="margin:12px 0;"><a href="${data.pdfDownloadUrl}" style="color:#4f46e5;text-decoration:underline;">발주서 PDF 다운로드</a></p>`
    : "";
  const pdfLinkText = data.pdfDownloadUrl
    ? `\n발주서 PDF 다운로드: ${data.pdfDownloadUrl}\n`
    : "";

  const notesBlock = data.notes
    ? `<p style="margin:12px 0;color:#374151;"><strong>비고:</strong> ${escape(data.notes)}</p>`
    : "";
  const notesText = data.notes ? `\n비고: ${data.notes}\n` : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Pretendard", sans-serif; color: #1f2937; line-height: 1.6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
    .meta { color: #6b7280; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { background: #f3f4f6; padding: 8px; text-align: left; font-size: 13px; color: #374151; }
    .total { font-size: 18px; font-weight: 700; color: #4f46e5; text-align: right; padding-top: 12px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">발주서 (Purchase Order)</h2>
      <p class="meta">발주번호: <strong>${escape(data.orderNumber)}</strong></p>
    </div>

    <p>안녕하세요, <strong>${escape(data.vendorName)}</strong> 담당자님.</p>
    <p>아래 품목으로 발주를 요청드립니다. 확인 후 회신 부탁드립니다.</p>

    <table>
      <thead>
        <tr>
          <th>품목</th>
          <th style="text-align:right;">수량</th>
          <th style="text-align:right;">단가</th>
          <th style="text-align:right;">합계</th>
        </tr>
      </thead>
      <tbody>${itemRowsHtml}
      </tbody>
    </table>

    <p class="total">총액: ₩${data.totalAmount.toLocaleString("ko-KR")}</p>

    <p style="margin:16px 0;color:#374151;">
      <strong>예상 배송일:</strong> ${expectedLine}<br/>
      <strong>발주자:</strong> ${escape(requesterLine)}<br/>
      <strong>회신 연락처:</strong> ${requesterContactLine}
    </p>

    ${notesBlock}
    ${pdfLinkHtml}

    <div class="footer">
      본 메일은 LabAxis 운영 시스템에서 자동 발송되었습니다.
    </div>
  </div>
</body>
</html>`.trim();

  const text = `
[발주서] ${data.orderNumber} — ${data.vendorName}${
    data.vendorNameEn ? ` (${data.vendorNameEn})` : ""
  }

안녕하세요, ${data.vendorName} 담당자님.
아래 품목으로 발주를 요청드립니다. 확인 후 회신 부탁드립니다.

[발주 품목]
${itemRowsText}

총액: ₩${data.totalAmount.toLocaleString("ko-KR")}

예상 배송일: ${expectedLine}
발주자: ${requesterLine}
회신 연락처: ${data.requesterEmail ?? "(별도 문의 채널 안내 예정)"}
${notesText}${pdfLinkText}
— 본 메일은 LabAxis 운영 시스템에서 자동 발송되었습니다.
`.trim();

  return { subject, html, text };
}

/** XSS 방어 — 단순 escape (vendor name / item name 안 < > & 등). */
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
