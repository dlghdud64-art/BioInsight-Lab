/**
 * 벤더 견적 요청 이메일 템플릿
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * 벤더 견적 요청 이메일 템플릿
 */
export function generateVendorQuoteRequestEmail(data: {
  vendorName?: string;
  quoteTitle: string;
  itemCount: number;
  message?: string;
  responseUrl: string;
  expiresAt: Date;
}): EmailTemplate {
  const vendorGreeting = data.vendorName ? `${data.vendorName}님` : "담당자님";
  const subject = `[BioInsight Lab] 견적 요청서 회신 부탁드립니다`;

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
    .info-box { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .info-label { font-weight: 600; color: #6b7280; }
    .info-value { color: #111827; }
    .message-box { background-color: #f9fafb; padding: 16px; margin: 20px 0; border-radius: 6px; white-space: pre-wrap; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: 600; }
    .warning { color: #dc2626; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">견적 요청서</h1>
    </div>
    <div class="content">
      <p>안녕하세요, ${vendorGreeting}</p>

      <div class="info-box">
        <strong>📋 견적 요청서 정보</strong>
      </div>

      <div class="info-row">
        <span class="info-label">견적 제목:</span>
        <span class="info-value"><strong>${data.quoteTitle}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">품목 수:</span>
        <span class="info-value">${data.itemCount}개</span>
      </div>
      <div class="info-row">
        <span class="info-label">회신 마감:</span>
        <span class="info-value"><span class="warning">${new Date(data.expiresAt).toLocaleString("ko-KR")}</span></span>
      </div>

      ${data.message ? `
      <h3 style="margin-top: 20px;">요청 메시지</h3>
      <div class="message-box">${data.message}</div>
      ` : ''}

      <p style="margin-top: 20px;">아래 버튼을 클릭하여 견적 회신을 제출해주세요:</p>

      <a href="${data.responseUrl}" class="button">견적 회신하기</a>

      <div class="footer">
        <p><strong>중요:</strong> 이 링크는 ${new Date(data.expiresAt).toLocaleDateString("ko-KR")}까지 유효합니다.</p>
        <p>견적 회신은 로그인 없이 진행 가능합니다.</p>
        <p>문의사항이 있으시면 이 이메일로 회신해주세요.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
안녕하세요, ${vendorGreeting}

견적 요청서 정보:
- 견적 제목: ${data.quoteTitle}
- 품목 수: ${data.itemCount}개
- 회신 마감: ${new Date(data.expiresAt).toLocaleString("ko-KR")}

${data.message ? `요청 메시지:\n${data.message}\n\n` : ''}

아래 링크를 클릭하여 견적 회신을 제출해주세요:
${data.responseUrl}

중요: 이 링크는 ${new Date(data.expiresAt).toLocaleDateString("ko-KR")}까지 유효합니다.
견적 회신은 로그인 없이 진행 가능합니다.
문의사항이 있으시면 이 이메일로 회신해주세요.
  `.trim();

  return { subject, html, text };
}
