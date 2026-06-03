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
 * vendor email 의 PDF 첨부 (또는 다른 binary). Resend SDK 가 attachment field 를
 * 정합 송부 (filename + content Buffer/string + path?). §11.314-b 견적 PDF 발송.
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
  /** §11.348-SEND-A — 회신 주소(연구소/요청자). 미설정 시 from(noreply)만. A 명의 정합. */
  replyTo?: string;
}

// §11.314 Phase 2 — Resend 클라이언트 lazy 초기화 (RESEND_API_KEY 있을 때만 생성, 빌드 타임 throw 방지)
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY env 미설정 — Vercel 환경 변수를 확인하세요.");
    _resend = new Resend(apiKey);
  }
  return _resend;
}

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

  // 개발 환경에서는 콘솔에만 출력 (sandbox 보호)
  if (process.env.NODE_ENV === "development") {
    console.log("📧 이메일 발송 (개발 모드):", {
      to: options.to,
      subject: options.subject,
      preview: options.text.substring(0, 100) + "...",
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        byteSize: typeof a.content === "string" ? a.content.length : a.content.length,
      })),
    });
    return;
  }

  // §11.314 Phase 2 — production Resend SDK 발송
  const from = process.env.EMAIL_FROM ?? "noreply@labaxis.co.kr";
  const resend = getResend();

  const { data, error } = await resend.emails.send({
    from,
    // §11.348-SEND-A — replyTo 있으면 전달(공급사 답장 → 연구소). 없으면 from(noreply)만.
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  if (error) {
    // silent success 금지 — caller try/catch 에 전파.
    throw new Error(`Resend SMTP 발송 실패: ${error.message ?? JSON.stringify(error)}`);
  }

  console.log("📧 이메일 발송 완료 (Resend):", {
    to: options.to,
    subject: options.subject,
    messageId: data?.id,
  });
}
