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