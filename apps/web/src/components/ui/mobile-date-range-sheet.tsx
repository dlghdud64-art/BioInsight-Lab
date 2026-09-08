"use client";

/**
 * §mobile-residual-5 1c — 기간 직접 설정 바텀 시트 (호영님 핸드오프 2026-09-07).
 *
 * 구조: MobileSheet 셸 + 시작일/종료일 2필드(활성 필드 블루 보더+링) + 미니 캘린더 +
 *   하단 `MM-DD ~ MM-DD · N일` 실시간 표기 + 적용.
 * 탭 순서: 시작일 → 종료일(자동 전환). 범위 = #eff6ff 밴드, 양 끝 진한 블루.
 * 검증: validateCustomRange(종료>시작 · 최대 1년) — 위반 시 적용 disabled + 사유 라벨.
 * canonical 날짜 상태는 호출 화면(page.tsx) 소유 — 시트 내부 draft 는 적용 전 임시 UI 상태.
 *   (§global-filters FilterSheet 와 같은 controlled 규약)
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import {
  formatPeriodRow,
  parseIsoDate,
  toIsoDate,
  validateCustomRange,
} from "@/lib/reports/period-label";

export interface MobileDateRangeSheetProps {
  open: boolean;
  onClose: () => void;
  /** 현재 적용된 기간(열릴 때 draft 초기값) */
  startDate: string;
  endDate: string;
  onApply: (startIso: string, endIso: string) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Field = "start" | "end";

export function MobileDateRangeSheet({ open, onClose, startDate, endDate, onApply }: MobileDateRangeSheetProps) {
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [activeField, setActiveField] = useState<Field>("start");
  // 캘린더 표시 월(1일 고정)
  const [viewMonth, setViewMonth] = useState<Date>(() => monthOf(parseIsoDate(startDate) ?? new Date()));

  // 열릴 때 draft 리셋(controlled) — 시작일부터
  useEffect(() => {
    if (!open) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setActiveField("start");
    setViewMonth(monthOf(parseIsoDate(startDate) ?? new Date()));
  }, [open, startDate, endDate]);

  const valid = useMemo(() => validateCustomRange(draftStart, draftEnd), [draftStart, draftEnd]);
  const startMs = parseIsoDate(draftStart)?.getTime();
  const endMs = parseIsoDate(draftEnd)?.getTime();

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);

  const pickDay = (d: Date) => {
    const iso = toIsoDate(d);
    if (activeField === "start") {
      setDraftStart(iso);
      // 시작일이 기존 종료일 이후면 종료일 비움(역순 방지 → 종료일 재선택 유도)
      if (endMs != null && d.getTime() >= endMs) setDraftEnd("");
      setActiveField("end");
    } else {
      // 종료일 탭인데 시작일보다 앞이면 시작일로 재지정(탭 순서 유지)
      if (startMs != null && d.getTime() <= startMs) {
        setDraftStart(iso);
        setDraftEnd("");
        setActiveField("end");
        return;
      }
      setDraftEnd(iso);
    }
  };

  const monthLabel = `${viewMonth.getFullYear()}년 ${viewMonth.getMonth() + 1}월`;
  const resultLabel = draftStart && draftEnd ? formatPeriodRow(draftStart, draftEnd) : "기간을 선택하세요";

  return (
    <MobileSheet open={open} onClose={onClose} title="기간 직접 설정">
      <div className="flex flex-col gap-3">
        {/* 시작일 / 종료일 */}
        <div className="grid grid-cols-2 gap-2.5">
          {(["start", "end"] as const).map((f) => {
            const label = f === "start" ? "시작일" : "종료일";
            const value = f === "start" ? draftStart : draftEnd;
            const active = activeField === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setActiveField(f)}
                aria-pressed={active}
                className="text-left"
              >
                <span className="block text-[11px] font-bold text-slate-700 mb-1.5">{label}</span>
                <span
                  className={cn(
                    "flex h-11 items-center rounded-[11px] border px-3 text-[14px] font-bold tabular-nums",
                    active
                      ? "border-[1.5px] border-blue-600 text-slate-900 shadow-[0_0_0_3px_rgba(37,99,235,.1)]"
                      : "border-[#e2e8f0] text-slate-900",
                    !value && "text-slate-400 font-medium",
                  )}
                >
                  {value || "YYYY-MM-DD"}
                </span>
              </button>
            );
          })}
        </div>

        {/* 미니 캘린더 */}
        <div className="rounded-[13px] border border-[#eef2f7] px-3.5 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 touch-manipulation"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[12.5px] font-extrabold text-slate-900">{monthLabel}</span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 touch-manipulation"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400 mb-1">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center text-[11.5px] tabular-nums" role="grid" aria-label={monthLabel}>
            {cells.map((c) => {
              const ms = c.date.getTime();
              const isStart = startMs != null && ms === startMs;
              const isEnd = endMs != null && ms === endMs;
              const inRange = startMs != null && endMs != null && ms > startMs && ms < endMs;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="gridcell"
                  aria-selected={isStart || isEnd}
                  onClick={() => pickDay(c.date)}
                  className={cn(
                    "h-8 w-full touch-manipulation",
                    !c.inMonth && "text-slate-300",
                    c.inMonth && !isStart && !isEnd && !inRange && "text-slate-700",
                    inRange && "bg-[#eff6ff] text-slate-700",
                    isStart && "bg-blue-600 text-white font-extrabold rounded-l-lg",
                    isEnd && "bg-blue-600 text-white font-extrabold rounded-r-lg",
                    isStart && !draftEnd && "rounded-lg",
                  )}
                >
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* 결과 + 적용 */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-slate-500 tabular-nums">{resultLabel}</p>
            {draftStart && draftEnd && !valid.ok && (
              <p className="text-[11px] text-red-600 mt-0.5" role="alert">{valid.reason}</p>
            )}
          </div>
          <button
            type="button"
            disabled={!valid.ok}
            onClick={() => {
              if (!valid.ok) return;
              onApply(draftStart, draftEnd);
              onClose();
            }}
            className="h-[42px] shrink-0 rounded-[11px] bg-blue-600 px-5 text-[13px] font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation active:scale-95"
          >
            적용
          </button>
        </div>
      </div>
    </MobileSheet>
  );
}

// ---------------------------------------------------------------------------
// 캘린더 헬퍼
// ---------------------------------------------------------------------------

function monthOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** 6주 × 7일 = 42칸(앞뒤 달 채움) */
function buildMonthCells(month: Date): Array<{ key: string; date: Date; inMonth: boolean }> {
  const first = monthOf(month);
  const offset = first.getDay(); // 일요일 시작
  const cells: Array<{ key: string; date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + i);
    cells.push({ key: toIsoDate(date), date, inMonth: date.getMonth() === first.getMonth() });
  }
  return cells;
}
