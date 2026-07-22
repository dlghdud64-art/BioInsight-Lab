"use client";

/**
 * §mobile-budgets 7b — 예산 풀 등록 시트 (모바일 공용, 진입점 3곳 단일화).
 *   진입점: ① 예산 관리 헤더 `＋ 예산 등록` ② 7a 온보딩 배너 CTA ③ 지출 분석 8a 단계 카드 `등록 ›`
 *
 * canonical: 등록 = 기존 `POST /api/budgets` 계약 그대로(모델·API 무접촉).
 * 임계 구간 = **표시 전용 규약 안내**(CategoryBudget warning 70 / soft 90 / hard 100 과 동일 수치 —
 *   저장 0, 규칙 이원화 0. PLAN P0 판정). 초과 발주 사전 차단 스위치 = v1 제외(호영님 판정 —
 *   Budget 저장처 부재, 저장 없는 컨트롤 금지 원칙).
 * onSuccess: 호출측이 자체 갱신(fetch/reload) + `["analytics-dashboard"]` invalidate 배선 —
 *   등록 즉시 예산 관리·지출 분석 양 화면 동시 갱신(활성화 2/3 전환은 기존 canonical derive).
 */

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { csrfFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function q(dateY: number, quarter: number) {
  const start = new Date(dateY, (quarter - 1) * 3, 1);
  const end = new Date(dateY, quarter * 3, 0);
  const fmt = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
  const iso = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  return { quarter, label: `${quarter}분기`, rangeText: `${fmt(start)} – ${fmt(end)}`, startIso: iso(start), endIso: iso(end) };
}

export interface BudgetRegisterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 등록 성공 시 — 호출측 갱신 + analytics invalidate 는 호출측 책임(배선 필수) */
  onSuccess: () => void;
}

export function BudgetRegisterSheet({ open, onOpenChange, onSuccess }: BudgetRegisterSheetProps) {
  const year = new Date().getFullYear();
  const currentQuarter = Math.min(4, Math.max(2, Math.ceil((new Date().getMonth() + 1) / 3)));
  const quarters = [2, 3, 4].map((n) => q(year, n));

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedQuarter, setSelectedQuarter] = useState<number>(currentQuarter);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const active = quarters.find((x) => x.quarter === selectedQuarter) ?? quarters[0];
  const cleanAmount = Number(amount.replace(/[^0-9]/g, "")) || 0;

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("예산 풀 이름을 입력해주세요."); return; }
    if (cleanAmount <= 0) { setError("분기 한도를 입력해주세요."); return; }
    setIsSubmitting(true);
    try {
      // canonical 계약: 기존 POST /api/budgets 그대로 (yearMonth 파생·조직 스코프는 서버 책임)
      const res = await csrfFetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          amount: cleanAmount,
          currency: "KRW",
          periodStart: active.startIso,
          periodEnd: active.endIso,
          projectName: null,
          description: `${year}년 ${active.label} 예산 풀`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as { error?: string })?.error || "등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      onSuccess();
      onOpenChange(false);
      setName(""); setAmount("");
    } catch {
      setError("통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="예산 풀 등록">
      {/* backdrop */}
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-slate-900/50" onClick={() => onOpenChange(false)} />
      {/* bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white max-h-[90vh] overflow-y-auto p-5 pb-8 safe-area-bottom">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-extrabold text-slate-900">예산 풀 등록</h3>
          <button type="button" aria-label="닫기" onClick={() => onOpenChange(false)} className="w-11 h-11 min-h-[44px] grid place-items-center rounded-xl text-slate-400 active:bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 풀 이름 */}
          <div>
            <label htmlFor="pool-name" className="text-[12px] font-semibold text-slate-600">풀 이름</label>
            <input
              id="pool-name"
              value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
              placeholder="예: 분자생물학팀 3분기"
              className="mt-1.5 w-full h-11 min-h-[44px] rounded-xl border border-[#e6eaf0] px-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 분기 한도 — 풀폭·우측 정렬 ₩ */}
          <div>
            <label htmlFor="pool-amount" className="text-[12px] font-semibold text-slate-600">분기 한도</label>
            <div className="relative mt-1.5">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400">₩</span>
              <input
                id="pool-amount"
                inputMode="numeric"
                value={amount ? Number(amount.replace(/[^0-9]/g, "")).toLocaleString("ko-KR") : ""}
                onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, "")); if (error) setError(null); }}
                placeholder="0"
                className="w-full h-11 min-h-[44px] rounded-xl border border-[#e6eaf0] pl-8 pr-3.5 text-right text-[15px] font-bold tabular-nums text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* 적용 기간 = 분기 세그먼트 + 실제 날짜 확인 표기 */}
          <div>
            <p className="text-[12px] font-semibold text-slate-600">적용 기간</p>
            <div className="mt-1.5 grid grid-cols-3 rounded-xl bg-[#f1f5f9] p-0.5">
              {quarters.map((x) => (
                <button
                  key={x.quarter}
                  type="button"
                  onClick={() => setSelectedQuarter(x.quarter)}
                  className={cn(
                    "h-11 min-h-[44px] rounded-[10px] text-[13px] font-semibold transition-colors",
                    selectedQuarter === x.quarter ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-slate-500 mt-1.5">{year}년 {active.label} · {active.rangeText}</p>
          </div>

          {/* 경고 임계 구간 시각화 — 표시 전용(CategoryBudget 통제 규약과 동일 수치, 저장 0) */}
          <div>
            <p className="text-[12px] font-semibold text-slate-600">경고 임계 구간</p>
            <div className="mt-1.5 flex h-3 rounded-full overflow-hidden">
              <div className="w-[70%]" style={{ background: "#dcfce7" }} />
              <div className="w-[20%]" style={{ background: "#fef9c3" }} />
              <div className="w-[10%]" style={{ background: "#fee2e2" }} />
            </div>
            <div className="flex justify-between mt-1 text-[11px]">
              <span className="text-[#15803d] font-semibold">정상 ~70%</span>
              <span style={{ color: "#a16207" }} className="font-semibold">경고 70–90%</span>
              <span style={{ color: "#b91c1c" }} className="font-semibold">차단 90%+</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 break-keep">
              카테고리 예산 통제 규약과 동일 기준이 적용됩니다 — 소진율이 구간에 도달하면 자동 경고
            </p>
          </div>

          {/* 연동 안내 */}
          <p className="text-[12px] text-slate-500 rounded-xl bg-[#f8fafc] border border-[#e6eaf0] px-3.5 py-2.5 break-keep">
            등록 즉시 예산 관리·지출 분석 화면에 반영되고, 발주 완료 건이 자동으로 집계됩니다.
          </p>

          {error && <p className="text-[12px] font-semibold" style={{ color: "#b91c1c" }}>{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-11 min-h-[44px] rounded-xl bg-[#2563eb] text-white text-[14px] font-bold active:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "등록 중..." : "예산 풀 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
