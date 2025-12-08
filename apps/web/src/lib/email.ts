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