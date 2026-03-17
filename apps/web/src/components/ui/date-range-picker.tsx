"use client";

import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onDateChange: (startDate: string, endDate: string) => void;
  className?: string;
}

type PresetKey = "today" | "last7" | "last30" | "thisMonth" | "lastMonth" | "last3Months";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "오늘" },
  { key: "last7", label: "최근 7일" },
  { key: "last30", label: "최근 30일" },
  { key: "thisMonth", label: "이번 달" },
  { key: "lastMonth", label: "지난달" },
  { key: "last3Months", label: "지난 3개월" },
];

function getPresetRange(preset: PresetKey): { from: Date; to: Date } {
  const today = new Date();
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: subDays(today, 6), to: today };
    case "last30":
      return { from: subDays(today, 29), to: today };
    case "thisMonth":
      return { from: startOfMonth(today), to: today };
    case "lastMonth": {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "last3Months":
      return { from: new Date(today.getFullYear(), today.getMonth() - 2, 1), to: today };
  }
}

export function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  className,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(() => {
    if (startDate && endDate) {
      return {
        from: new Date(startDate),
        to: new Date(endDate),
      };
    }
    return undefined;
  });

  React.useEffect(() => {
    if (startDate && endDate) {
      setDate({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
  }, [startDate, endDate]);

  const [open, setOpen] = React.useState(false);

  // Mobile sheet states
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = React.useState(false);
  const [mobileMonth, setMobileMonth] = React.useState<Date>(new Date());
  const [mobileTempDate, setMobileTempDate] = React.useState<DateRange | undefined>(undefined);

  const handleDateSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      onDateChange(
        format(range.from, "yyyy-MM-dd"),
        format(range.to, "yyyy-MM-dd")
      );
      setOpen(false);
    } else if (range?.from) {
      onDateChange(format(range.from, "yyyy-MM-dd"), "");
    }
  };

  const handlePreset = (preset: PresetKey) => {
    const { from, to } = getPresetRange(preset);
    const range = { from, to };
    setDate(range);
    onDateChange(format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd"));
    setOpen(false);
    setMobileSheetOpen(false);
  };

  // Mobile calendar handlers
  const openMobileCalendar = () => {
    setMobileTempDate(date);
    setMobileMonth(date?.from || new Date());
    setMobileCalendarOpen(true);
  };

  const handleMobileCalendarSelect = (range: DateRange | undefined) => {
    setMobileTempDate(range);
  };

  const applyMobileCalendar = () => {
    if (mobileTempDate?.from && mobileTempDate?.to) {
      setDate(mobileTempDate);
      onDateChange(
        format(mobileTempDate.from, "yyyy-MM-dd"),
        format(mobileTempDate.to, "yyyy-MM-dd")
      );
    }
    setMobileCalendarOpen(false);
    setMobileSheetOpen(false);
  };

  const resetMobileCalendar = () => {
    setMobileTempDate(undefined);
  };

  const triggerLabel = date?.from ? (
    date.to ? (
      <>
        {format(date.from, "yyyy.MM.dd", { locale: ko })} -{" "}
        {format(date.to, "yyyy.MM.dd", { locale: ko })}
      </>
    ) : (
      format(date.from, "yyyy.MM.dd", { locale: ko })
    )
  ) : (
    <span>기간 선택</span>
  );

  return (
    <div className={cn("grid gap-2", className)}>
      {/* ── Desktop: Popover with 2-month calendar ── */}
      <div className="hidden md:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {triggerLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 shadow-none" align="start">
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-4">
                {PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreset(p.key)}
                    className="text-xs h-8"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                locale={ko}
                captionLayout="dropdown"
                fromYear={2015}
                toYear={2030}
                className="rounded-md border-0"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Mobile: Preset pills + "직접 선택" full-screen sheet ── */}
      <div className="md:hidden">
        <Button
          variant="outline"
          onClick={() => setMobileSheetOpen(true)}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>

        {/* Mobile date picker sheet */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl px-4 pb-6">
            <SheetHeader className="pb-3">
              <SheetTitle className="text-base">기간 선택</SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                빠른 선택 또는 직접 날짜를 지정하세요.
              </SheetDescription>
            </SheetHeader>

            {/* Preset pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handlePreset(p.key)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-slate-800 text-slate-300 hover:bg-blue-950/30 hover:border-blue-700 hover:text-blue-400 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Current selection display */}
            {date?.from && (
              <div className="mb-4 p-3 rounded-lg bg-blue-950/20 border border-blue-900/40">
                <p className="text-xs text-blue-400 font-medium">
                  {format(date.from, "yyyy.MM.dd", { locale: ko })}
                  {date.to && <> ~ {format(date.to, "yyyy.MM.dd", { locale: ko })}</>}
                </p>
              </div>
            )}

            {/* "직접 선택" button */}
            <Button
              variant="outline"
              className="w-full h-10 text-sm gap-2"
              onClick={openMobileCalendar}
            >
              <CalendarIcon className="h-4 w-4" />
              직접 선택
            </Button>
          </SheetContent>
        </Sheet>

        {/* Full-screen calendar sheet */}
        <Sheet open={mobileCalendarOpen} onOpenChange={setMobileCalendarOpen}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl flex flex-col px-0">
            <SheetHeader className="px-4 pb-2">
              <SheetTitle className="text-base">날짜 범위 선택</SheetTitle>
              <SheetDescription className="sr-only">시작일과 종료일을 선택하세요.</SheetDescription>
            </SheetHeader>

            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const prev = new Date(mobileMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  setMobileMonth(prev);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold text-slate-300">
                {format(mobileMonth, "yyyy년 M월", { locale: ko })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  const next = new Date(mobileMonth);
                  next.setMonth(next.getMonth() + 1);
                  setMobileMonth(next);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Selected range display */}
            <div className="px-4 py-2 text-center">
              <p className="text-xs text-slate-500">
                {mobileTempDate?.from ? (
                  <>
                    <span className="font-medium text-slate-300">
                      {format(mobileTempDate.from, "MM.dd", { locale: ko })}
                    </span>
                    {mobileTempDate.to ? (
                      <>
                        {" ~ "}
                        <span className="font-medium text-slate-300">
                          {format(mobileTempDate.to, "MM.dd", { locale: ko })}
                        </span>
                      </>
                    ) : (
                      " ~ 종료일 선택"
                    )}
                  </>
                ) : (
                  "시작일을 선택하세요"
                )}
              </p>
            </div>

            {/* Single-month calendar */}
            <div className="flex-1 overflow-y-auto flex justify-center px-2">
              <Calendar
                mode="range"
                month={mobileMonth}
                onMonthChange={setMobileMonth}
                selected={mobileTempDate}
                onSelect={handleMobileCalendarSelect}
                numberOfMonths={1}
                locale={ko}
                className="rounded-md border-0"
              />
            </div>

            {/* Bottom fixed bar: 초기화 + 적용 */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-800 bg-slate-900">
              <Button
                variant="outline"
                className="flex-1 h-10 text-sm"
                onClick={resetMobileCalendar}
              >
                초기화
              </Button>
              <Button
                className="flex-1 h-10 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!mobileTempDate?.from || !mobileTempDate?.to}
                onClick={applyMobileCalendar}
              >
                적용
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
