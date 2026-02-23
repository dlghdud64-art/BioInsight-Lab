"use client";

import * as React from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onDateChange: (startDate: string, endDate: string) => void;
  className?: string;
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

  const handleDateSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      onDateChange(
        format(range.from, "yyyy-MM-dd"),
        format(range.to, "yyyy-MM-dd")
      );
    } else if (range?.from) {
      // 시작일만 선택된 경우
      onDateChange(format(range.from, "yyyy-MM-dd"), "");
    }
  };

  // 프리셋 핸들러
  const handlePreset = (preset: "today" | "thisWeek" | "thisMonth" | "last3Months") => {
    const today = new Date();
    let from: Date;
    let to: Date = today;

    switch (preset) {
      case "today":
        from = today;
        to = today;
        break;
      case "thisWeek":
        from = new Date(today);
        from.setDate(today.getDate() - today.getDay()); // 이번 주 월요일
        to = today;
        break;
      case "thisMonth":
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = today;
        break;
      case "last3Months":
        from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        to = today;
        break;
    }

    const range = { from, to };
    setDate(range);
    onDateChange(format(from, "yyyy-MM-dd"), format(to, "yyyy-MM-dd"));
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
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
            {date?.from ? (
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
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 shadow-lg" align="start">
          <div className="p-4">
            {/* 프리셋 버튼 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("today")}
                className="text-xs h-8"
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("thisWeek")}
                className="text-xs h-8"
              >
                이번 주
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("thisMonth")}
                className="text-xs h-8"
              >
                이번 달
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreset("last3Months")}
                className="text-xs h-8"
              >
                지난 3개월
              </Button>
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
  );
}

