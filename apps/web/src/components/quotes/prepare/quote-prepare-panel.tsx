"use client";

/**
 * §reorder-quote-handoff 1c — 견적 요청 발송 준비 패널 (호영님 지시문 2026-08-05).
 *
 * same-route 딥링크 패널 (`/dashboard/quotes?prepare={id}`) — 신규 라우트 아님
 * (호영님 (a)안 확정, page-per-feature 회귀 금지). 재고관리 재발주 시트에서
 * 초안 생성 직후 직행하는 도착 표면 + 리스트 카드 "공급사 지정하고 발송" 복귀 표면.
 *
 * canonical truth 경계:
 *   - 초안 = Quote(DB, 이미 생성됨). 이 패널은 표시·게이트만.
 *   - 공급사 확정·발송 = 기존 발송 인텐트(2-step, §11.279d 오발송 방지) →
 *     VendorRequestModal 이 truth. 패널의 "지정"은 게이트 통과용 선택이며
 *     저장은 발송 검토에서 일어난다 (캡션으로 정직 표기).
 *   - "나중에 하기" = 초안이 이미 발송 대기로 저장돼 있음을 알리고 닫기 (추가 쓰기 0).
 *
 * 상태: 지정 전 CTA disabled + 사유 라벨 (dead button 금지). 하이라이트는
 * justCreated(생성 직행)일 때만 1회 (재방문 미발생).
 */

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, ChevronRight } from "lucide-react";

export interface PrepareQuoteLite {
  id: string;
  /** 표시용 RFQ 번호 (page 의 quoteDisplayRef 결과 주입) */
  ref: string;
  title: string;
  createdAt?: string | null;
  items: Array<{ name: string; quantity: number }>;
  /** 출처 메타 (specialNotes — "재고관리 재발주안에서 생성 · ..."). 없으면 미표시 (가짜 금지) */
  sourceMeta?: string | null;
}

interface QuotePreparePanelProps {
  open: boolean;
  quote: PrepareQuoteLite | null;
  /** 재고관리에서 생성 직후 직행 진입 — 하이라이트 1회 + "방금 생성" 표기 */
  justCreated?: boolean;
  /** 이전 거래 공급사 추천 (데이터 있을 때만 — 없으면 행 미표시) */
  recommendedVendorName?: string | null;
  onClose: () => void;
  /** 발송 검토로 — 기존 발송 인텐트(2-step) 게이트 재사용 (직접 모달 진입 금지) */
  onProceedToDispatch: (quoteId: string) => void;
  /** 공급사 소싱 검색 진입 (기존 배선 주입 — 없으면 버튼 미노출) */
  onSearchSourcing?: () => void;
}

/** 지시문 타이포 — 날짜 연도 포함 `YYYY. M. D.` */
function formatDateWithYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function QuotePreparePanel({
  open,
  quote,
  justCreated = false,
  recommendedVendorName = null,
  onClose,
  onProceedToDispatch,
  onSearchSourcing,
}: QuotePreparePanelProps) {
  const [vendorInput, setVendorInput] = useState("");
  const [assignedVendor, setAssignedVendor] = useState<string | null>(null);

  if (!quote) return null;
  const createdLabel = formatDateWithYear(quote.createdAt);

  const assign = (name: string) => {
    const v = name.trim();
    if (!v) return;
    setAssignedVendor(v);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto"
        overlayClassName="!top-14"
        data-testid="quote-prepare-panel"
      >
        <div className="space-y-4 pb-2">
          {/* ── 헤더 ── */}
          <div>
            <p className="text-sm font-extrabold text-slate-900">견적 요청 발송 준비</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-[.03em] text-slate-500 tabular-nums">{quote.ref}</span>
              {justCreated && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  방금 재고관리에서 생성됨
                </span>
              )}
            </div>
          </div>

          {/* ── 3스텝 pill: ✓ 품목 확정 → ② 공급사 지정(활성) → ③ 발송 ── */}
          <div className="flex items-center gap-1.5" data-testid="prepare-steps">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              ✓ 품목 확정
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${assignedVendor ? "bg-emerald-50 text-emerald-700" : "bg-blue-600 text-white"}`}>
              {assignedVendor ? "✓" : "②"} 공급사 지정
            </span>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${assignedVendor ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
              ③ 발송
            </span>
          </div>

          {/* ── 품목 카드 (justCreated → 2초 블루 하이라이트 1회) ── */}
          <div
            data-testid="prepare-items-card"
            className={`rounded-lg border border-slate-200 bg-white p-3 ${justCreated ? "prepare-highlight-once" : ""}`}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <p className="text-xs font-bold text-slate-700">{quote.title}</p>
              {quote.sourceMeta && (
                <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  재고관리에서 연동
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {quote.items.map((it, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-slate-600">
                  <span className="truncate">{it.name}</span>
                  <span className="tabular-nums font-semibold text-slate-700">× {it.quantity}</span>
                </div>
              ))}
            </div>
            {(quote.sourceMeta || createdLabel) && (
              <p className="mt-2 text-[10.5px] text-slate-400">
                {[quote.sourceMeta, createdLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* ── 공급사 지정 패널 (블루 보더 활성) ── */}
          <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-3 space-y-2" data-testid="prepare-vendor-assign">
            <p className="text-xs font-bold text-slate-700">공급사 지정</p>
            <div className="flex items-center gap-2">
              <Input
                value={vendorInput}
                onChange={(e) => setVendorInput(e.target.value)}
                placeholder="공급사 이름 검색·입력"
                className="h-10 text-sm bg-white"
                data-testid="prepare-vendor-input"
              />
              <Button
                type="button"
                onClick={() => assign(vendorInput)}
                disabled={!vendorInput.trim()}
                className="h-10 min-h-[40px] px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
                data-testid="prepare-vendor-assign-cta"
              >
                지정
              </Button>
            </div>
            {recommendedVendorName && !assignedVendor && (
              <button
                type="button"
                onClick={() => assign(recommendedVendorName)}
                className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 active:scale-[0.98]"
                data-testid="prepare-vendor-recommendation"
              >
                이전 거래: <b className="text-slate-800">{recommendedVendorName}</b> · 탭해서 지정
              </button>
            )}
            {assignedVendor && (
              <p className="text-xs font-semibold text-emerald-700" data-testid="prepare-vendor-assigned">
                ✓ {assignedVendor} 지정됨
              </p>
            )}
            <div className="flex items-center gap-2">
              {onSearchSourcing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSearchSourcing}
                  className="h-9 flex-1 text-xs border-slate-300 text-slate-700"
                >
                  <Search className="h-3.5 w-3.5 mr-1" />
                  소싱에서 찾기
                </Button>
              )}
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              공급사 확정·이메일 수신처 추가는 다음 단계인 발송 검토에서 저장됩니다.
            </p>
          </div>

          {/* ── 하단 CTA: 지정 전 disabled + 사유 / 지정 시 발송 검토(기존 2-step) 연속 ── */}
          <Button
            type="button"
            data-testid="prepare-proceed-cta"
            disabled={!assignedVendor}
            onClick={() => { if (assignedVendor) onProceedToDispatch(quote.id); }}
            className="w-full h-11 min-h-[44px] text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
          >
            {assignedVendor ? "발송 검토로 →" : "발송 검토로 · 공급사 지정 필요"}
          </Button>

          {/* ── 이탈 안전 ── */}
          <button
            type="button"
            data-testid="prepare-save-later"
            onClick={onClose}
            className="block w-full py-1 text-center text-xs font-semibold text-slate-500 underline underline-offset-2 active:opacity-70"
          >
            나중에 하기 · 발송 대기로 저장
          </button>
        </div>

        {/* 하이라이트 1회 — animation-fill-mode 로 재발화 없음 (reduced motion 존중) */}
        <style>{`
          @keyframes prepareHighlightFade {
            0% { background-color: #eff6ff; border-color: #bfdbfe; }
            100% { background-color: #ffffff; border-color: #e2e8f0; }
          }
          .prepare-highlight-once { animation: prepareHighlightFade 2s ease-out 1 forwards; }
          @media (prefers-reduced-motion: reduce) {
            .prepare-highlight-once { animation: none; }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  );
}
