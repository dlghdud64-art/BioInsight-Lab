/**
 * 이메일 발송 유틸리티 — Resend SDK (§11.314 Phase 2)
 *
 * Provider: Resend (resend ^6.6.0, 이미 설치됨)
 * 결정(호영님 2026-05-30): Provider=Resend, From=noreply@labaxis.co.kr
 * env: RESEND_API_KEY + EMAIL_FROM
 *
 * #vendor-email-seed-pilot — pilot vendor 분기.
 *   pilot 환경에서 실제 SMTP 발송 0 보장 ("no real outbound mail" design intent).
 *   isVendorPilot(vendorId) 매칭 시 SMTP skip + audit-only console.log + return.
 *   future-proof: Resend 전환 후에도 pilot vendor 자동 보호.
 */

import { Resend } from "resend";
import { isVendorPilot } from "@/lib/email/pilot-vendor";

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
  /**
   * #vendor-email-seed-pilot — Vendor.id (pilot 식별용).
   * isVendorPilot(vendorId) 매칭 시 SMTP skip + audit-only.
   * 다른 caller (auth verification 등) 는 vendorId 미전달 — 기존 동작 유지.
   */
  vendorId?: string;
}

// §11.314 Phase 2 — Resend 클라이언트 (런타임 초기화, API key 없으면 mock 모드)
const resend = new Resend(process.env.RESEND_API_KEY ?? "");

/**
 * 이메일 발송 — Resend SDK (production) / 콘솔 로깅 (development)
 *
 * caller 8개 모두 `await sendEmail(options)` — 시그니처 변경 0.
 * production SMTP 실패 시 throw → caller try/catch 에 전파 (silent success 금지).
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // #vendor-email-seed-pilot — pilot vendor 면 SMTP skip + audit-only.
  // future-proof: 향후 real SMTP 연동 시에도 본 분기 보존, pilot vendor
  // 의도하지 않은 발송 방지 (no real outbound mail).
  if (options.vendorId && isVendorPilot(options.vendorId)) {
    console.log("📧 [pilot dry-run] SMTP skip (no real outbound mail):", {
      to: options.to,
      vendorId: options.vendorId,
      subject: options.subject,
    });
    return;
  }

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

  // §11.314 Phase 2 — Resend 실제 발송 (production)
  const from = process.env.EMAIL_FROM ?? "noreply@labaxis.co.kr";

  // EmailAttachment → Resend attachments 포맷 변환
  const attachments = options.attachments?.map((a) => ({
    filename: a.filename,
    content:
      typeof a.content === "string"
        ? a.content // base64 string — Resend 직접 수용
        : a.content.toString("base64"), // Buffer → base64
  }));

  const { error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  });

  if (error) {
    console.error("[sendEmail] Resend error:", error);
    throw new Error(`이메일 발송 실패: ${error.message}`);
  }
}

