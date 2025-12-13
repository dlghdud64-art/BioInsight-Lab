/**
 * 이메일 발송 유틸리티
 * 실제 이메일 서비스 연동은 나중에 구현 (SendGrid, AWS SES 등)
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * 이메일 발송 (현재는 로깅만, 실제 서비스 연동 시 구현)
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // 개발 환경에서는 콘솔에만 출력
  if (process.env.NODE_ENV === "development") {
    console.log("📧 이메일 발송 (개발 모드):", {
      to: options.to,
      subject: options.subject,
      preview: options.text.substring(0, 100) + "...",
    });
    return;
  }

  // 프로덕션 환경에서는 실제 이메일 서비스 연동
  // 예: SendGrid, AWS SES, Resend 등
  // TODO: 실제 이메일 서비스 연동 구현
  
  // 임시로 로깅만 수행
  console.log("📧 이메일 발송:", {
    to: options.to,
    subject: options.subject,
  });

  // 실제 구현 예시 (SendGrid):
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: options.to,
  //   from: process.env.EMAIL_FROM,
  //   subject: options.subject,
  //   html: options.html,
  //   text: options.text,
  // });
}

