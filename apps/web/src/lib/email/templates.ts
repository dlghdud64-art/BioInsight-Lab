/**
 * 이메일 알림 템플릿
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * 재고 부족 알림 이메일 템플릿
 */
export function generateLowStockAlertEmail(data: {
  productName: string;
  catalogNumber: string | null;
  currentQuantity: number;
  unit: string;
  safetyStock: number;
  location: string | null;
  inventoryUrl: string;
}): EmailTemplate {
  const subject = `[재고 부족 알림] ${data.productName} 재고가 부족합니다`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f97316; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .alert-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">재고 부족 알림</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>⚠️ 재고가 안전 재고량 이하로 떨어졌습니다.</strong>
      </div>
      
      <h2 style="margin-top: 0;">${data.productName}</h2>
      
      <div class="info-row">
        <span class="info-label">카탈로그 번호:</span>
        <span class="info-value">${data.catalogNumber || "정보 없음"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">현재 재고:</span>
        <span class="info-value"><strong>${data.currentQuantity} ${data.unit}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">안전 재고량:</span>
        <span class="info-value">${data.safetyStock} ${data.unit}</span>
      </div>
      ${data.location ? `
      <div class="info-row">
        <span class="info-label">보관 위치:</span>
        <span class="info-value">${data.location}</span>
      </div>
      ` : ""}
      
      <a href="${data.inventoryUrl}" class="button">재고 관리 페이지로 이동</a>
      
      <div class="footer">
        <p>이 알림은 재고 관리 시스템에서 자동으로 발송되었습니다.</p>
        <p>알림 설정을 변경하려면 재고 관리 페이지에서 설정을 수정하세요.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
재고 부족 알림

${data.productName}의 재고가 안전 재고량 이하로 떨어졌습니다.

카탈로그 번호: ${data.catalogNumber || "정보 없음"}
현재 재고: ${data.currentQuantity} ${data.unit}
안전 재고량: ${data.safetyStock} ${data.unit}
${data.location ? `보관 위치: ${data.location}` : ""}

재고 관리 페이지: ${data.inventoryUrl}

이 알림은 재고 관리 시스템에서 자동으로 발송되었습니다.
알림 설정을 변경하려면 재고 관리 페이지에서 설정을 수정하세요.
  `.trim();

  return { subject, html, text };
}

/**
 * 견적 응답 알림 이메일 템플릿
 */
export function generateQuoteResponseEmail(data: {
  quoteTitle: string;
  vendorName: string;
  totalPrice: number | null;
  currency: string;
  message: string | null;
  quoteUrl: string;
  responseDate: Date;
}): EmailTemplate {
  const subject = `[견적 응답] ${data.vendorName}에서 견적을 보냈습니다`;
  
  const priceText = data.totalPrice 
    ? `${data.totalPrice.toLocaleString("ko-KR")} ${data.currency}`
    : "가격 문의";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .info-box { background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .price-highlight { font-size: 24px; font-weight: bold; color: #2563eb; margin: 10px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">견적 응답 알림</h1>
    </div>
    <div class="content">
      <div class="info-box">
        <strong>📧 새로운 견적 응답이 도착했습니다.</strong>
      </div>
      
      <h2 style="margin-top: 0;">${data.quoteTitle}</h2>
      
      <div class="info-row">
        <span class="info-label">벤더:</span>
        <span class="info-value"><strong>${data.vendorName}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">견적 금액:</span>
        <span class="price-highlight">${priceText}</span>
      </div>
      <div class="info-row">
        <span class="info-label">응답 일시:</span>
        <span class="info-value">${new Date(data.responseDate).toLocaleString("ko-KR")}</span>
      </div>
      ${data.message ? `
      <div style="margin-top: 20px; padding: 16px; background-color: #f8fafc; border-radius: 6px;">
        <strong>벤더 메시지:</strong>
        <p style="margin-top: 8px; white-space: pre-wrap;">${data.message}</p>
      </div>
      ` : ""}
      
      <a href="${data.quoteUrl}" class="button">견적 상세 보기</a>
      
      <div class="footer">
        <p>이 알림은 견적 관리 시스템에서 자동으로 발송되었습니다.</p>
        <p>알림 설정을 변경하려면 대시보드 설정에서 수정하세요.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
견적 응답 알림

${data.vendorName}에서 "${data.quoteTitle}" 견적에 응답했습니다.

견적 금액: ${priceText}
응답 일시: ${new Date(data.responseDate).toLocaleString("ko-KR")}
${data.message ? `\n벤더 메시지:\n${data.message}` : ""}

견적 상세 보기: ${data.quoteUrl}

이 알림은 견적 관리 시스템에서 자동으로 발송되었습니다.
알림 설정을 변경하려면 대시보드 설정에서 수정하세요.
  `.trim();

  return { subject, html, text };
}

/**
 * 구매 완료 알림 이메일 템플릿
 */
export function generatePurchaseCompleteEmail(data: {
  quoteTitle: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  purchaseDate: Date;
  quoteUrl: string;
}): EmailTemplate {
  const subject = `[구매 완료] ${data.quoteTitle} 구매가 완료되었습니다`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .success-box { background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .price-highlight { font-size: 24px; font-weight: bold; color: #10b981; margin: 10px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">구매 완료</h1>
    </div>
    <div class="content">
      <div class="success-box">
        <strong>✅ 구매가 성공적으로 완료되었습니다.</strong>
      </div>
      
      <h2 style="margin-top: 0;">${data.quoteTitle}</h2>
      
      <div class="info-row">
        <span class="info-label">구매 금액:</span>
        <span class="price-highlight">${data.totalAmount.toLocaleString("ko-KR")} ${data.currency}</span>
      </div>
      <div class="info-row">
        <span class="info-label">품목 수:</span>
        <span class="info-value"><strong>${data.itemCount}개</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">구매 일시:</span>
        <span class="info-value">${new Date(data.purchaseDate).toLocaleString("ko-KR")}</span>
      </div>
      
      <a href="${data.quoteUrl}" class="button">구매 운영 보기</a>

      <div class="footer">
        <p>이 알림은 구매 관리 시스템에서 자동으로 발송되었습니다.</p>
        <p>구매 운영 화면에서 상세 내역을 확인할 수 있습니다.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
구매 완료 알림

"${data.quoteTitle}" 구매가 완료되었습니다.

구매 금액: ${data.totalAmount.toLocaleString("ko-KR")} ${data.currency}
품목 수: ${data.itemCount}개
구매 일시: ${new Date(data.purchaseDate).toLocaleString("ko-KR")}

구매 운영 보기: ${data.quoteUrl}

이 알림은 구매 관리 시스템에서 자동으로 발송되었습니다.
구매 운영 화면에서 상세 내역을 확인할 수 있습니다.
  `.trim();

  return { subject, html, text };
}

// ──────────────────────────────────────────────────────────
// §11.209d-notification — Purchase approval email templates
// ──────────────────────────────────────────────────────────

function formatAmount(n: number, currency: string): string {
  if (currency === "KRW") return `₩${n.toLocaleString("ko-KR")}`;
  return `${n.toLocaleString("en-US")} ${currency}`;
}

/**
 * §11.209d-notification — 결재 요청 email (approver 대상).
 */
export function generatePurchaseApprovalRequestEmail(data: {
  approverName: string;
  requesterName: string;
  quoteTitle: string;
  totalAmount: number | null;
  currency: string;
  quoteUrl: string;
}): EmailTemplate {
  const subject = `[결재 요청] ${data.quoteTitle} — ${data.requesterName}`;
  const amount = data.totalAmount != null ? formatAmount(data.totalAmount, data.currency) : "—";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin-top: 24px; font-weight: 600; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">결재 요청</h2>
    </div>
    <div class="content">
      <p>${data.approverName}님,</p>
      <p><strong>${data.requesterName}</strong>님이 견적 결재를 요청했습니다.</p>
      <div class="info-row"><span class="info-label">견적 제목</span><span class="info-value">${data.quoteTitle}</span></div>
      <div class="info-row"><span class="info-label">요청자</span><span class="info-value">${data.requesterName}</span></div>
      <div class="info-row"><span class="info-label">총 금액</span><span class="info-value">${amount}</span></div>
      <p style="margin-top: 24px;">아래 링크에서 결재 검토 후 승인 또는 반려 처리해 주세요.</p>
      <a href="${data.quoteUrl}" class="button">결재 검토</a>
      <div class="footer">이 알림은 LabAxis 구매 운영 시스템에서 자동으로 발송되었습니다.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
[결재 요청] ${data.quoteTitle}

${data.approverName}님,
${data.requesterName}님이 견적 결재를 요청했습니다.

- 견적 제목: ${data.quoteTitle}
- 요청자: ${data.requesterName}
- 총 금액: ${amount}

결재 검토: ${data.quoteUrl}

아래 링크에서 결재 검토 후 승인 또는 반려 처리해 주세요.
  `.trim();

  return { subject, html, text };
}

/**
 * §11.209d-notification — 결재 승인 email (requester 대상).
 */
export function generatePurchaseApprovedEmail(data: {
  requesterName: string;
  approverName: string;
  quoteTitle: string;
  totalAmount: number | null;
  currency: string;
  quoteUrl: string;
}): EmailTemplate {
  const subject = `[결재 승인 완료] ${data.quoteTitle}`;
  const amount = data.totalAmount != null ? formatAmount(data.totalAmount, data.currency) : "—";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #059669; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .button { display: inline-block; padding: 12px 24px; background-color: #059669; color: white !important; text-decoration: none; border-radius: 6px; margin-top: 24px; font-weight: 600; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">결재 승인 완료</h2>
    </div>
    <div class="content">
      <p>${data.requesterName}님,</p>
      <p><strong>${data.approverName}</strong>님이 견적을 승인했습니다. 이제 발주 전환이 가능합니다.</p>
      <div class="info-row"><span class="info-label">견적 제목</span><span class="info-value">${data.quoteTitle}</span></div>
      <div class="info-row"><span class="info-label">결재자</span><span class="info-value">${data.approverName}</span></div>
      <div class="info-row"><span class="info-label">총 금액</span><span class="info-value">${amount}</span></div>
      <p style="margin-top: 24px;">구매 운영 화면에서 발주 전환을 진행해 주세요.</p>
      <a href="${data.quoteUrl}" class="button">발주 진행</a>
      <div class="footer">이 알림은 LabAxis 구매 운영 시스템에서 자동으로 발송되었습니다.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
[결재 승인 완료] ${data.quoteTitle}

${data.requesterName}님,
${data.approverName}님이 견적을 승인했습니다. 이제 발주 전환이 가능합니다.

- 견적 제목: ${data.quoteTitle}
- 결재자: ${data.approverName}
- 총 금액: ${amount}

발주 진행: ${data.quoteUrl}

구매 운영 화면에서 발주 전환을 진행해 주세요.
  `.trim();

  return { subject, html, text };
}

/**
 * §11.209d-notification — 결재 반려 email (requester 대상 + reason).
 */
export function generatePurchaseRejectedEmail(data: {
  requesterName: string;
  approverName: string;
  quoteTitle: string;
  totalAmount: number | null;
  currency: string;
  rejectionReason: string;
  quoteUrl: string;
}): EmailTemplate {
  const subject = `[결재 반려] ${data.quoteTitle}`;
  const amount = data.totalAmount != null ? formatAmount(data.totalAmount, data.currency) : "—";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 24px; border-radius: 8px 8px 0 0; }
    .content { background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .reason-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin-top: 20px; border-radius: 4px; }
    .reason-label { font-weight: 600; color: #991b1b; margin-bottom: 8px; }
    .reason-text { color: #1f2937; line-height: 1.6; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white !important; text-decoration: none; border-radius: 6px; margin-top: 24px; font-weight: 600; }
    .footer { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">결재 반려</h2>
    </div>
    <div class="content">
      <p>${data.requesterName}님,</p>
      <p><strong>${data.approverName}</strong>님이 견적 결재를 반려했습니다. 재요청 또는 대안 검토가 필요합니다.</p>
      <div class="info-row"><span class="info-label">견적 제목</span><span class="info-value">${data.quoteTitle}</span></div>
      <div class="info-row"><span class="info-label">결재자</span><span class="info-value">${data.approverName}</span></div>
      <div class="info-row"><span class="info-label">총 금액</span><span class="info-value">${amount}</span></div>
      <div class="reason-box">
        <div class="reason-label">반려 사유</div>
        <div class="reason-text">${data.rejectionReason}</div>
      </div>
      <p style="margin-top: 24px;">반려 사유를 검토 후 수정 후 재요청 또는 대안 견적 검토를 진행해 주세요.</p>
      <a href="${data.quoteUrl}" class="button">견적 확인</a>
      <div class="footer">이 알림은 LabAxis 구매 운영 시스템에서 자동으로 발송되었습니다.</div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
[결재 반려] ${data.quoteTitle}

${data.requesterName}님,
${data.approverName}님이 견적 결재를 반려했습니다. 재요청 또는 대안 검토가 필요합니다.

- 견적 제목: ${data.quoteTitle}
- 결재자: ${data.approverName}
- 총 금액: ${amount}

반려 사유:
${data.rejectionReason}

견적 확인: ${data.quoteUrl}

반려 사유를 검토 후 수정 후 재요청 또는 대안 견적 검토를 진행해 주세요.
  `.trim();

  return { subject, html, text };
}

