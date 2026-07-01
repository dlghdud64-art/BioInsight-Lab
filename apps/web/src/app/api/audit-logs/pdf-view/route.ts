import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAuditLogs } from "@/lib/audit/audit-logger";
import {
  AUDIT_EVENT_LABELS,
  AUDIT_TONE_CLASSES,
} from "@/lib/audit/event-labels";
import { AuditEventType } from "@prisma/client";

/**
 * §11.109 #audit-pdf-server-side-render
 *
 * GET /api/audit-logs/pdf-view
 *
 * 정형 PDF 양식 (회사 헤더 + 인쇄 시각 + 필터 컨디션 + 로그 테이블 +
 * 서명란 + 페이지 번호) 의 server-side rendered HTML 응답.
 *
 * 운영자 use case:
 *   1. /dashboard/audit 의 "정형 PDF" 버튼 클릭
 *   2. 새 탭으로 본 endpoint 진입
 *   3. 자동 window.print() trigger → "PDF로 저장" 선택
 *   4. 인쇄본은 컴플라이언스 보존 용도 (서명란 + 페이지 번호)
 *
 * 디자인 결정:
 *   - puppeteer / @react-pdf/renderer 의존성 회피 (Vercel cold-start
 *     최소화 + 한국어 폰트 native 사용)
 *   - browser print 의존 → §11.89 와 동일 path 이지만 server-side
 *     formatted layout (정형 양식 보장)
 *   - §11.130 brand logo (Bio-Insight.png) header 좌측 + 디지털 서명
 *     watermark footer 에 회사 정보 보강.
 */

// audit-logs page 의 권한 체크와 동일 패턴
async function checkAccess(userId: string, organizationId?: string | null, viewerUserId?: string) {
  if (organizationId) {
    const isOrgAdmin = await db.organizationMember.findFirst({
      where: { userId, organizationId, role: "ADMIN" },
    });
    return !!isOrgAdmin;
  }
  // self-view 또는 system admin
  return viewerUserId === userId;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const userId = searchParams.get("userId");
    const eventType = searchParams.get("eventType") as AuditEventType | null;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

    // 권한: ADMIN || self-view || org admin
    const isSelfView = userId && userId === session.user.id;
    if (!isSelfView && session.user.role !== "ADMIN") {
      if (!organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const allowed = await checkAccess(session.user.id, organizationId);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await getAuditLogs({
      organizationId: organizationId || undefined,
      userId: userId || undefined,
      eventType: eventType || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search: search || undefined,
      limit,
      offset: 0,
    });

    const logs = result.logs ?? [];
    const printedAt = new Date();
    const periodLabel = startDate
      ? `${startDate.slice(0, 10)} ~ ${endDate ? endDate.slice(0, 10) : "현재"}`
      : "전체 기간";
    const eventTypeLabel =
      eventType && AUDIT_EVENT_LABELS[eventType]
        ? AUDIT_EVENT_LABELS[eventType].label
        : "전체 액션";

    // HTML render
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>LabAxis 감사 추적 (Audit Trail) — ${printedAt.toLocaleDateString("ko-KR")}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  @media print {
    .no-print { display: none !important; }
    body { background: white; color: black; }
  }
  body {
    font-family: -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
    color: #1e293b;
    font-size: 11px;
    line-height: 1.4;
    margin: 0;
    padding: 24px;
    background: #f8fafc;
  }
  .doc {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 32px;
    border: 1px solid #e2e8f0;
  }
  header.report-header {
    border-bottom: 2px solid #1e293b;
    padding-bottom: 12px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  header.report-header .logo {
    height: 36px;
    width: auto;
    max-width: 100px;
    flex-shrink: 0;
  }
  header.report-header .title-block { flex: 1; }
  header h1 {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
  }
  header .subtitle { font-size: 11px; color: #64748b; }
  .digital-watermark {
    margin-top: 18px;
    text-align: center;
    font-size: 9px;
    color: #94a3b8;
    letter-spacing: 0.05em;
  }
  .digital-watermark strong { color: #475569; }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 24px;
    margin-bottom: 16px;
    font-size: 10.5px;
  }
  .meta-grid dt {
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9.5px;
    margin-bottom: 2px;
  }
  .meta-grid dd { margin: 0 0 4px 0; color: #0f172a; }
  table.log-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
  }
  table.log-table th {
    background: #f1f5f9;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
    padding: 6px 8px;
    text-align: left;
    border: 1px solid #e2e8f0;
  }
  table.log-table td {
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    font-size: 10px;
  }
  table.log-table tr.fail td { background: #fef2f2; }
  .action-badge {
    display: inline-block;
    padding: 1px 6px;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    color: #475569;
    background: #f8fafc;
  }
  .footer-block {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px dashed #cbd5e1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  .signature-row {
    margin-top: 16px;
    padding-top: 36px;
    border-top: 1px solid #1e293b;
    text-align: center;
    font-size: 10px;
    color: #475569;
  }
  .toolbar {
    max-width: 800px;
    margin: 0 auto 16px auto;
    padding: 12px;
    background: #1e293b;
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
  }
  .toolbar button {
    background: white;
    color: #0f172a;
    border: none;
    padding: 6px 14px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 12px;
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <span>인쇄 다이얼로그에서 "PDF로 저장"을 선택하세요.</span>
    <button onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  <article class="doc">
    <header class="report-header">
      <img src="/brand/Bio-Insight.png" alt="LabAxis" class="logo" />
      <div class="title-block">
        <h1>LabAxis 감사 추적 (Audit Trail)</h1>
        <div class="subtitle">컴플라이언스 보존 양식 — 운영자 검토용</div>
      </div>
    </header>

    <dl class="meta-grid">
      <div><dt>인쇄 시각</dt><dd>${printedAt.toLocaleString("ko-KR")}</dd></div>
      <div><dt>조회 기간</dt><dd>${periodLabel}</dd></div>
      <div><dt>액션 유형</dt><dd>${eventTypeLabel}</dd></div>
      <div><dt>총 건수</dt><dd>${logs.length.toLocaleString("ko-KR")}건${logs.length >= limit ? ` (최대 ${limit}건 표시)` : ""}</dd></div>
      ${search ? `<div style="grid-column: 1 / -1;"><dt>검색어</dt><dd>${escapeHtml(search)}</dd></div>` : ""}
    </dl>

    <table class="log-table">
      <thead>
        <tr>
          <th style="width: 110px;">일시</th>
          <th style="width: 90px;">액션</th>
          <th style="width: 110px;">작업자</th>
          <th>대상</th>
          <th>변경 / 사유</th>
          <th style="width: 60px;">결과</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map((log: any) => {
          const meta = AUDIT_EVENT_LABELS[log.eventType] ?? { label: log.action || log.eventType, tone: "register" };
          const time = new Date(log.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "medium" });
          const actor = log.user?.name || log.user?.email || "시스템";
          const target = log.entityId ? `${log.entityType} (${String(log.entityId).slice(0, 8)})` : log.entityType;
          let reason = log.action;
          if (log.metadata && typeof log.metadata === "object") {
            const m = log.metadata as Record<string, unknown>;
            if (typeof m.reason === "string") reason = m.reason;
            else if (typeof m.description === "string") reason = m.description;
          }
          if (!log.success && log.errorMessage) reason = `[실패] ${log.errorMessage}`;
          const failClass = log.success === false ? "fail" : "";
          return `<tr class="${failClass}">
            <td style="font-family: monospace; font-size: 9px;">${escapeHtml(time)}</td>
            <td><span class="action-badge">${escapeHtml(meta.label)}</span></td>
            <td>${escapeHtml(actor)}</td>
            <td style="word-break: keep-all;">${escapeHtml(target ?? "—")}</td>
            <td style="word-break: keep-all;">${escapeHtml(reason ?? "—")}</td>
            <td style="text-align: center; font-weight: 600; color: ${log.success === false ? "#b91c1c" : "#059669"};">${log.success === false ? "실패" : "성공"}</td>
          </tr>`;
        }).join("\n        ")}
      </tbody>
    </table>

    <div class="footer-block">
      <div>
        <p style="margin: 0; font-size: 10px; color: #64748b; line-height: 1.5;">
          본 문서는 LabAxis Research Sourcing Platform 의 audit log canonical
          truth 기반 컴플라이언스 인쇄 양식입니다. 인쇄 시점의 데이터를 기준
          으로 작성되었으며, 향후 추가 변경 사항은 별도 인쇄 본으로 보관합니다.
        </p>
      </div>
      <div>
        <div class="signature-row">검토자 서명 / Reviewer Signature</div>
        <div class="signature-row">결재자 서명 / Approver Signature</div>
      </div>
    </div>

    <!-- §11.130 디지털 서명 watermark — bioinsightlab.com 식별성 + 인쇄본 출처 표기 -->
    <div class="digital-watermark">
      <strong>LabAxis Audit System</strong> · bioinsightlab.com · 인쇄본 출처
      <span style="font-family: monospace;">${printedAt.toISOString()}</span>
    </div>
  </article>
  <script>
    // 자동 인쇄 dialog trigger (옵션) — onload 후 약간 delay
    if (new URLSearchParams(window.location.search).get("autoPrint") === "1") {
      setTimeout(() => window.print(), 400);
    }
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[audit-logs/pdf-view] error:", error);
    return NextResponse.json(
      { error: "PDF 양식 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}

// HTML escape (간단한 sanitize — 운영자 검색어 등 inject 차단)
function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
