/**
 * 이메일 발송 유틸리티
 * 실제 이메일 서비스 연동은 나중에 구현 (SendGrid, AWS SES 등)
 */

/**
 * #post-approval-purchase-order-flow Phase 3.x-attach — email attachment.
 * vendor email 의 PDF 첨부 (또는 다른 binary). 호영님 host config 후
 * 실제 mailer (Resend / SendGrid / SES) 가 attachment field 를 정합 송부.
 * 현재 mock sender 는 metadata 만 console log.
 */
export interface EmailAttachment {
  /** 첨부 파일명 (확장자 포함). 예: "ORD-20260506-AB12.pdf" */
  filename: string;
  /** 첨부 binary — Buffer 또는 base64 string. mailer 마다 호환 형식 다름. */
  content: Buffer | string;
  /** MIME content type. 예: "application/pdf". */
  contentType: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** 첨부 파일 목록 — optional, mailer 미지원 시 silent drop. */
  attachments?: EmailAttachment[];
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
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        byteSize:
          typeof a.content === "string" ? a.content.length : a.content.length,
      })),
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

