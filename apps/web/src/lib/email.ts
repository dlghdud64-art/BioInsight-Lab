// 이메일 발송 유틸리티
import { Resend } from "resend";
import { getAppUrl } from "./env";
import { QuoteReceivedEmail } from "@/emails/quote-received";
import { QuoteCompletedEmail } from "@/emails/quote-completed";
import { OrderDeliveredEmail } from "@/emails/order-delivered";

// RESEND_API_KEY 필요 - 환경변수에 설정해주세요
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@biocompare.kr";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface SendQuoteReceivedEmailParams {
  to: string;
  customerName: string;
  quoteNumber: string;
  requestDate: string;
  itemCount: number;
  totalAmount?: string;
}

interface SendQuoteCompletedEmailParams {
  to: string;
  customerName: string;
  quoteNumber: string;
  completedDate: string;
  itemCount: number;
  totalAmount?: string;
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

// 견적 확인 이메일 발송
export async function sendQuoteConfirmationToUser(
  userEmail: string,
  userName: string,
  quoteTitle: string,
  quoteId: string
): Promise<boolean> {
  const appUrl = getAppUrl();
  const quoteUrl = `${appUrl}/quotes/${quoteId}`;

  return await sendEmail({
    to: userEmail,
    subject: `견적 요청이 접수되었습니다: ${quoteTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>견적 요청이 접수되었습니다</h2>
        <p>안녕하세요, ${userName}님</p>
        <p>견적 요청 "<strong>${quoteTitle}</strong>"이(가) 성공적으로 접수되었습니다.</p>
        <p>견적 상세 정보를 확인하시려면 아래 링크를 클릭해주세요:</p>
        <p><a href="${quoteUrl}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">견적 확인하기</a></p>
        <p>감사합니다.</p>
      </div>
    `,
    text: `견적 요청 "${quoteTitle}"이(가) 접수되었습니다. 확인: ${quoteUrl}`,
  });
}

// 벤더들에게 견적 알림 이메일 발송
export async function sendQuoteNotificationToVendors(
  vendorEmails: string[],
  quoteTitle: string,
  quoteId: string
): Promise<boolean> {
  const appUrl = getAppUrl();
  const quoteUrl = `${appUrl}/vendor/quotes/${quoteId}`;

  return await sendEmail({
    to: vendorEmails,
    subject: `새로운 견적 요청: ${quoteTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>새로운 견적 요청이 접수되었습니다</h2>
        <p>안녕하세요,</p>
        <p>새로운 견적 요청 "<strong>${quoteTitle}</strong>"이(가) 접수되었습니다.</p>
        <p>견적을 확인하고 응답하시려면 아래 링크를 클릭해주세요:</p>
        <p><a href="${quoteUrl}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">견적 확인하기</a></p>
        <p>감사합니다.</p>
      </div>
    `,
    text: `새로운 견적 요청 "${quoteTitle}"이(가) 접수되었습니다. 확인: ${quoteUrl}`,
  });
}

// =====================================================
// Resend + React Email 기반 이메일 발송 함수들
// =====================================================

/**
 * 견적 요청 접수 확인 이메일 발송 (React Email 템플릿 사용)
 */
export async function sendQuoteReceivedEmail({
  to,
  customerName,
  quoteNumber,
  requestDate,
  itemCount,
  totalAmount,
}: SendQuoteReceivedEmailParams) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const appUrl = getAppUrl();

  try {
    const { data, error } = await resend.emails.send({
      from: `BioCompare <${FROM_EMAIL}>`,
      to: [to],
      subject: `[BioCompare] 견적 요청이 접수되었습니다 (요청번호: #${quoteNumber})`,
      react: QuoteReceivedEmail({
        customerName,
        quoteNumber,
        requestDate,
        itemCount,
        totalAmount,
        dashboardUrl: `${appUrl}/dashboard/quotes`,
      }),
    });

    if (error) {
      console.error("[Email] Failed to send quote received email:", error);
      return { success: false, error };
    }

    console.log("[Email] Quote received email sent successfully:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Error sending quote received email:", error);
    return { success: false, error };
  }
}

/**
 * 견적 완료 알림 이메일 발송
 */
export async function sendQuoteCompletedEmail({
  to,
  customerName,
  quoteNumber,
  completedDate,
  itemCount,
  totalAmount,
}: SendQuoteCompletedEmailParams) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const appUrl = getAppUrl();

  try {
    const { data, error } = await resend.emails.send({
      from: `BioCompare <${FROM_EMAIL}>`,
      to: [to],
      subject: `[BioCompare] 견적서가 도착했습니다! (견적번호: #${quoteNumber})`,
      react: QuoteCompletedEmail({
        customerName,
        quoteNumber,
        completedDate,
        itemCount,
        totalAmount,
        dashboardUrl: `${appUrl}/dashboard/quotes/${quoteNumber}`,
      }),
    });

    if (error) {
      console.error("[Email] Failed to send quote completed email:", error);
      return { success: false, error };
    }

    console.log("[Email] Quote completed email sent successfully:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Error sending quote completed email:", error);
    return { success: false, error };
  }
}

/**
 * 견적 거절 알림 이메일 발송
 */
export async function sendQuoteRejectedEmail({
  to,
  customerName,
  quoteNumber,
  reason,
}: {
  to: string;
  customerName: string;
  quoteNumber: string;
  reason?: string;
}) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `BioCompare <${FROM_EMAIL}>`,
      to: [to],
      subject: `[BioCompare] 견적 요청 관련 안내 (요청번호: #${quoteNumber})`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">BioCompare</h2>
          <p>${customerName} 님, 안녕하세요.</p>
          <p>요청하신 견적(#${quoteNumber})에 대해 안내드립니다.</p>
          <p>죄송합니다만, 요청하신 견적을 진행하기 어려운 상황입니다.</p>
          ${reason ? `<p><strong>사유:</strong> ${reason}</p>` : ""}
          <p>다른 문의사항이 있으시면 언제든지 연락주세요.</p>
          <p>감사합니다.</p>
          <hr style="border-color: #e2e8f0;" />
          <p style="color: #94a3b8; font-size: 12px;">
            © ${new Date().getFullYear()} BioCompare. All rights reserved.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Failed to send quote rejected email:", error);
      return { success: false, error };
    }

    console.log("[Email] Quote rejected email sent successfully:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Error sending quote rejected email:", error);
    return { success: false, error };
  }
}
/**
 * 주문 배송 완료 알림 이메일 발송
 */
export async function sendOrderDeliveredEmail({
  to,
  customerName,
  orderNumber,
  deliveredDate,
  itemCount,
  items,
}: {
  to: string;
  customerName: string;
  orderNumber: string;
  deliveredDate: string;
  itemCount: number;
  items?: Array<{
    name: string;
    quantity: number;
    brand?: string;
  }>;
}) {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const appUrl = getAppUrl();

  try {
    const { data, error } = await resend.emails.send({
      from: `BioCompare <${FROM_EMAIL}>`,
      to: [to],
      subject: `[BioCompare] 배송이 완료되었습니다! (주문번호: ${orderNumber})`,
      react: OrderDeliveredEmail({
        customerName,
        orderNumber,
        deliveredDate,
        itemCount,
        items,
        inventoryUrl: `${appUrl}/inventory`,
      }),
    });

    if (error) {
      console.error("[Email] Failed to send order delivered email:", error);
      return { success: false, error };
    }

    console.log("[Email] Order delivered email sent successfully:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("[Email] Error sending order delivered email:", error);
    return { success: false, error };
  }
}
