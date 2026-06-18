"use client";

/**
 * §inbound-rfq-autocapture P3 — 공급사 이메일 자동수신 회신 표시(received 탭 흡수)
 *
 * GET /api/quotes/[id]/email-replies(QuoteReply + 첨부) 조회 후 읽기 전용 목록.
 *   - same-canvas: quotes 상세 received 탭 최상단 섹션(신규 page/탭 0).
 *   - canonical = QuoteReply(DB). 수동 가격입력과 별개 — 운영자가 회신 원문 보고 입력에 반영.
 *   - 첨부: 파일명·크기 메타 표시만. 다운로드 버튼은 서명 URL(P2 storage) 연결 전까지 미배치
 *     (dead button 금지 — 표시는 정보, 실제 다운로드는 후속).
 *   - 상태: loading 스켈레톤 / error 재시도 / empty 컴팩트 muted.
 */

import { csrfFetch } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { Mail, Paperclip, RotateCw } from "lucide-react";

interface ReplyAttachment {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  bucket: string;
  path: string;
}
interface EmailReply {
  id: string;
  vendorName: string | null;
  fromEmail: string;
  subject: string;
  bodyText: string | null;
  receivedAt: string;
  attachments: ReplyAttachment[];
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function EmailRepliesSection({ quoteId }: { quoteId: string }) {
  const query = useQuery<{ replies: EmailReply[]; count: number }>({
    queryKey: ["email-replies", quoteId],
    queryFn: async () => {
      const res = await csrfFetch(`/api/quotes/${quoteId}/email-replies`);
      if (!res.ok) throw new Error("회신을 불러오지 못했습니다.");
      return res.json();
    },
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-bd bg-pg animate-pulse" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-red-700">이메일 회신을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 h-9 text-[13px] font-semibold text-white hover:bg-red-700"
        >
          <RotateCw className="h-3.5 w-3.5" />
          재시도
        </button>
      </div>
    );
  }

  const replies = query.data?.replies ?? [];

  // empty — 컴팩트 muted(큰 일러스트/긴 문구 금지).
  if (replies.length === 0) {
    return (
      <div className="rounded-lg border border-bd bg-pg/50 px-3 py-2.5 flex items-center gap-2 text-xs text-slate-500">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        아직 수신된 이메일 회신이 없습니다. 공급사가 견적 요청 메일에 회신하면 여기에 자동으로 표시됩니다.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-200 mb-1 flex items-center gap-1.5">
        <Mail className="h-4 w-4 text-blue-400" />
        공급사 이메일 회신
        <span className="text-slate-500 font-normal">· {replies.length}건</span>
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        공급사가 견적 요청 메일에 회신한 내용입니다. 가격은 아래 ‘벤더 견적 입력’에 기록하세요.
      </p>
      <div className="space-y-2 mb-6">
        {replies.map((r) => (
          <div key={r.id} className="rounded-lg border border-bd bg-pg p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-200 truncate">
                {r.vendorName || r.fromEmail}
              </span>
              <span className="text-[11px] text-slate-500 shrink-0 tabular-nums">{fmtDate(r.receivedAt)}</span>
            </div>
            {r.vendorName && (
              <p className="text-[11px] text-slate-500 mb-1 truncate">{r.fromEmail}</p>
            )}
            <p className="text-[13px] font-medium text-slate-300 mb-1 truncate">{r.subject}</p>
            {r.bodyText && (
              <p className="text-[13px] text-slate-400 line-clamp-3 whitespace-pre-wrap break-words">
                {r.bodyText}
              </p>
            )}
            {r.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 rounded-md border border-bd bg-pg/60 px-2 py-1 text-[11px] text-slate-400"
                    title={`${a.fileName} (${fmtSize(a.sizeBytes)})`}
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[160px] truncate">{a.fileName}</span>
                    <span className="text-slate-500">· {fmtSize(a.sizeBytes)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
