// 이메일 발송 유틸리티
import { getAppUrl } from "./env";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // SendGrid 또는 다른 이메일 서비스 사용
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@bioinsightlab.com";

  if (!apiKey) {
    console.warn("SENDGRID_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    console.log("이메일 내용:", options);
    return false;
  }

  try {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: recipients.map((to) => ({
          to: [{ email: to }],
          subject: options.subject,
        })),
        from: { email: fromEmail },
        content: [
          {
            type: "text/html",
            value: options.html,
          },
          ...(options.text
            ? [
                {
                  type: "text/plain",
                  value: options.text,
                },
              ]
            : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${response.status} ${error}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function generateQuoteEmailHTML(quote: any, user: any) {
  const items = quote.items || [];
  const deliveryDate = quote.deliveryDate
    ? new Date(quote.deliveryDate).toLocaleDateString("ko-KR")
    : "미정";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .product-item { background-color: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #2563eb; }
        .label { font-weight: bold; color: #374151; }
        .value { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>견적 요청 알림</h1>
        </div>
        <div class="content">
          <p>안녕하세요,</p>
          <p>새로운 견적 요청이 접수되었습니다.</p>
          
          <h2>요청 정보</h2>
          <div class="value">
            <span class="label">요청자:</span> ${user.name || user.email}
          </div>
          <div class="value">
            <span class="label">견적 제목:</span> ${quote.title}
          </div>
          ${quote.message ? `<div class="value"><span class="label">요청 내용:</span><br>${quote.message}</div>` : ""}
          ${quote.messageEn ? `<div class="value"><span class="label">Request (English):</span><br>${quote.messageEn}</div>` : ""}
          <div class="value">
            <span class="label">납기 희망일:</span> ${deliveryDate}
          </div>
          ${quote.deliveryLocation ? `<div class="value"><span class="label">납품 장소:</span> ${quote.deliveryLocation}</div>` : ""}
          ${quote.specialNotes ? `<div class="value"><span class="label">특이사항:</span><br>${quote.specialNotes}</div>` : ""}
          
          <h2>요청 제품 (${items.length}개)</h2>
          ${items
            .map(
              (item: any) => `
            <div class="product-item">
              <div class="value"><strong>${item.product.name}</strong></div>
              ${item.product.brand ? `<div class="value">브랜드: ${item.product.brand}</div>` : ""}
              ${item.product.catalogNumber ? `<div class="value">카탈로그 번호: ${item.product.catalogNumber}</div>` : ""}
              <div class="value">수량: ${item.quantity}개</div>
              ${item.notes ? `<div class="value">비고: ${item.notes}</div>` : ""}
            </div>
          `
            )
            .join("")}
          
          <p style="margin-top: 20px;">
            <a href="${getAppUrl()}/dashboard/quotes/${quote.id}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              견적 상세 보기
            </a>
          </p>
        </div>
        <div class="footer">
          <p>이 이메일은 BioInsight Lab 플랫폼에서 자동으로 발송되었습니다.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendQuoteNotificationToVendors(quote: any, vendorEmails: string[]) {
  if (vendorEmails.length === 0) return;

  const user = quote.user;
  const html = generateQuoteEmailHTML(quote, user);

  return sendEmail({
    to: vendorEmails,
    subject: `[BioInsight Lab] 새로운 견적 요청: ${quote.title}`,
    html,
    text: `새로운 견적 요청이 접수되었습니다.\n\n견적 제목: ${quote.title}\n요청자: ${user.name || user.email}\n\n상세 내용은 웹사이트에서 확인하실 수 있습니다.`,
  });
}

export async function sendQuoteConfirmationToUser(quote: any, user: any) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>견적 요청이 접수되었습니다</h1>
        </div>
        <div class="content">
          <p>안녕하세요, ${user.name || "고객"}님,</p>
          <p>견적 요청이 성공적으로 접수되었습니다.</p>
          <p><strong>견적 제목:</strong> ${quote.title}</p>
          <p>공급사로부터 견적을 받으면 알림을 드리겠습니다.</p>
          <p>
            <a href="${getAppUrl()}/dashboard/quotes/${quote.id}" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
              견적 현황 보기
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    subject: `[BioInsight Lab] 견적 요청 접수 완료: ${quote.title}`,
    html,
    text: `견적 요청이 성공적으로 접수되었습니다.\n\n견적 제목: ${quote.title}\n\n상세 내용은 웹사이트에서 확인하실 수 있습니다.`,
  });
}



interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // SendGrid 또는 다른 이메일 서비스 사용
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@bioinsightlab.com";

  if (!apiKey) {
    console.warn("SENDGRID_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    console.log("이메일 내용:", options);
    return false;
  }

  try {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: recipients.map((to) => ({
          to: [{ email: to }],
          subject: options.subject,
        })),
        from: { email: fromEmail },
        content: [
          {
            type: "text/html",
            value: options.html,
          },
          ...(options.text
            ? [
                {
                  type: "text/plain",
                  value: options.text,
                },
              ]
            : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${response.status} ${error}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function generateQuoteEmailHTML(quote: any, user: any) {
  const items = quote.items || [];
  const deliveryDate = quote.deliveryDate
    ? new Date(quote.deliveryDate).toLocaleDateString("ko-KR")
    : "미정";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .product-item { background-color: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #2563eb; }
        .label { font-weight: bold; color: #374151; }
        .value { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>견적 요청 알림</h1>
        </div>
        <div class="content">
          <p>안녕하세요,</p>
          <p>새로운 견적 요청이 접수되었습니다.</p>
          
          <h2>요청 정보</h2>
          <div class="value">
            <span class="label">요청자:</span> ${user.name || user.email}
          </div>
          <div class="value">
            <span class="label">견적 제목:</span> ${quote.title}
          </div>
          ${quote.message ? `<div class="value"><span class="label">요청 내용:</span><br>${quote.message}</div>` : ""}
          ${quote.messageEn ? `<div class="value"><span class="label">Request (English):</span><br>${quote.messageEn}</div>` : ""}
          <div class="value">
            <span class="label">납기 희망일:</span> ${deliveryDate}
          </div>
          ${quote.deliveryLocation ? `<div class="value"><span class="label">납품 장소:</span> ${quote.deliveryLocation}</div>` : ""}
          ${quote.specialNotes ? `<div class="value"><span class="label">특이사항:</span><br>${quote.specialNotes}</div>` : ""}
          
          <h2>요청 제품 (${items.length}개)</h2>
          ${items
            .map(
              (item: any) => `
            <div class="product-item">
              <div class="value"><strong>${item.product.name}</strong></div>
              ${item.product.brand ? `<div class="value">브랜드: ${item.product.brand}</div>` : ""}
              ${item.product.catalogNumber ? `<div class="value">카탈로그 번호: ${item.product.catalogNumber}</div>` : ""}
              <div class="value">수량: ${item.quantity}개</div>
              ${item.notes ? `<div class="value">비고: ${item.notes}</div>` : ""}
            </div>
          `
            )
            .join("")}
          
          <p style="margin-top: 20px;">
            <a href="${getAppUrl()}/dashboard/quotes/${quote.id}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              견적 상세 보기
            </a>
          </p>
        </div>
        <div class="footer">
          <p>이 이메일은 BioInsight Lab 플랫폼에서 자동으로 발송되었습니다.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendQuoteNotificationToVendors(quote: any, vendorEmails: string[]) {
  if (vendorEmails.length === 0) return;

  const user = quote.user;
  const html = generateQuoteEmailHTML(quote, user);

  return sendEmail({
    to: vendorEmails,
    subject: `[BioInsight Lab] 새로운 견적 요청: ${quote.title}`,
    html,
    text: `새로운 견적 요청이 접수되었습니다.\n\n견적 제목: ${quote.title}\n요청자: ${user.name || user.email}\n\n상세 내용은 웹사이트에서 확인하실 수 있습니다.`,
  });
}

export async function sendQuoteConfirmationToUser(quote: any, user: any) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>견적 요청이 접수되었습니다</h1>
        </div>
        <div class="content">
          <p>안녕하세요, ${user.name || "고객"}님,</p>
          <p>견적 요청이 성공적으로 접수되었습니다.</p>
          <p><strong>견적 제목:</strong> ${quote.title}</p>
          <p>공급사로부터 견적을 받으면 알림을 드리겠습니다.</p>
          <p>
            <a href="${getAppUrl()}/dashboard/quotes/${quote.id}" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
              견적 현황 보기
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    subject: `[BioInsight Lab] 견적 요청 접수 완료: ${quote.title}`,
    html,
    text: `견적 요청이 성공적으로 접수되었습니다.\n\n견적 제목: ${quote.title}\n\n상세 내용은 웹사이트에서 확인하실 수 있습니다.`,
  });
}



interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // SendGrid 또는 다른 이메일 서비스 사용
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@bioinsightlab.com";

  if (!apiKey) {
    console.warn("SENDGRID_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    console.log("이메일 내용:", options);
    return false;
  }

  try {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: recipients.map((to) => ({
          to: [{ email: to }],
          subject: options.subject,
        })),
        from: { email: fromEmail },
        content: [
          {
            type: "text/html",
            value: options.html,
          },
          ...(options.text
            ? [
                {
                  type: "text/plain",
                  value: options.text,
                },
              ]
            : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${response.status} ${error}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function generateQuoteEmailHTML(quote: any, user: any) {
  const items = quote.items || [];
  const deliveryDate = quote.deliveryDate
    ? new Date(quote.deliveryDate).toLocaleDateString("ko-KR")
    : "미정";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
        .product-item { background-color: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #2563eb; }
        .label { font-weight: bold; color: #374151; }
        .value { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>견적 요청 알림</h1>
        </div>
        <div class="content">
          <p>안녕하세요,</p>
          <p>새로운 견적 요청이 접수되었습니다.</p>
          
          <h2>요청 정보</h2>
          <div class="value">
            <span class="label">요청자:</span> ${user.name || user.email}
          </div>
          <div class="value">
            <span class="label">견적 제목:</span> ${quote.title}
          </div>
          ${quote.message ? `<div class="value"><span class="label">요청 내용:</span><br>${quote.message}</div>` : ""}
          ${quote.messageEn ? `<div class="value"><span class="label">Request (English):</span><br>${quote.messageEn}</div>` : ""}
          <div class="value">
            <span class="label">납기 희망일:</span> ${deliveryDate}
          </div>
          ${quote.deliveryLocation ? `<div class="value"><span class="label">납품 장소:</span> ${quote.deliveryLocation}</div>` : ""}
          ${quote.specialNotes ? `<div class="value"><span class="label">특이사항:</span><br>${quote.specialNotes}</div>` : ""}
          
          <h2>요청 제품 (${items.length}개)</h2>
          ${items
            .map(
              (item: any) => `
            <div class="product-item">
              <div class="value"><strong>${item.product.name}</strong></div>
              ${item.product.brand ? `<div class="value">브랜드: ${item.product.brand}</div>` : ""}
              ${item.product.catalogNumber ? `<div class="value">카탈로그 번호: ${item.product.catalogNumber}</div>` : ""}
              <div class="value">수량: ${item.quantity}개</div>
              ${item.notes ? `<div class="value">비고: ${item.notes}</div>` : ""}
            </div>
          `
            )
            .join("")}
          
          <p style="margin-top: 20px;">
            <a href="${getAppUrl()}/dashboard/quotes/${quote.id}" 
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              견적 상세 보기
            </a>
          </p>
        </div>
        <div class="footer">
          <p>이 이메일은 BioInsight Lab 플랫폼에서 자동으로 발송되었습니다.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendQuoteNotificationToVendors(quote: any, vendorEmails: string[]) {
  if (vendorEmails.length === 0) return;

  const user = quote.user;
  const html = generateQuoteEmailHTML(quote, user);

  return sendEmail({
    to: vendorEmails,
    subject: `[BioInsight Lab] 새로운 견적 요청: ${quote.title}`,
    html,
    text: `새로운 견적 요청이 접수되었습니다.\n\n견적 제목: ${quote.title}\n요청자: ${user.name || user.email}\n\n상세 내용은 웹사이트에서 확인하실 수 있습니다.`,
  });
}

export async function sendQuoteConfirmationToUser(quote: any, user: any) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>견적 요청이 접수되었습니다</h1>
        </div>
        <div class="content">
          <p>안녕하세요, ${user.name || "고객"}님,</p>
          <p>견적 요청이 성공적으로 접수되었습니다.</p>
          <p><strong>견적 제목:</strong> ${quote.title}</p>
          <p>공급사로부터 견적을 받으면 알림을 드리겠습니다.</p>
          <p>
            <a href="${getAppUrl()}/dashboard/quotes/${quote.id}" 
               style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
              견적 현황 보기
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    subject: `[BioInsight Lab] 견적 요청 접수 완료: ${quote.title}`,
    html,
    text: `견적 요청이 성공적으로 접수되었습니다.\n\n견적 제목: ${quote.title}\n\n상세 내용은 웹사이트에서 확인하실 수 있습니다.`,
  });
}

