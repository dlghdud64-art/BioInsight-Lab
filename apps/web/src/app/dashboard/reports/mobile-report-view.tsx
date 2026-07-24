"use client";

/**
 * §mobile-reports — 모바일(<768px) 구매 리포트 전용 뷰 (호영님 핸드오프 2026-07-21, 6a/6c).
 *
 * 원칙(§0): 지출 수동 반입 UI 없음(발주 완료 자동 집계 유일) · 탭 분리 없음(단일 세로 스크롤 + 딥링크).
 * 파생: 전부 page.tsx `deriveInsights()` 산출(insights) 소비 — 임계/규칙 재구현 0 (canonical 단일점).
 * 차트: 라이브러리 0 — CSS/inline 막대만 (§4). 데스크톱(≥md)은 page.tsx 기존 뷰 무접촉.
 * 날짜/숫자: Pretendard 단일 — 모노 폰트 사용 0 (§5).
 * 기간 커스텀 날짜 편집은 모바일 v1 범위 외(프리셋 4종 + 한국어 표시) — PLAN P0 판정.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { FileDown, SlidersHorizontal, AlertTriangle, BarChart2, Layers, Activity, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// 표기 헬퍼 — §1 날짜 한국어(올해 연도 생략) · 당월 값 만원 축약
// ---------------------------------------------------------------------------

function formatKoreanDate(iso: string, omitYear: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return omitYear ? `${m}월 ${d}일` : `${y}년 ${m}월 ${d}일`;
}

export function formatKoreanDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "최근 1개월"; // API 기본 기간
  const thisYear = new Date().getFullYear();
  const omitStart = Number(startDate.slice(0, 4)) === thisYear;
  const omitEnd = Number(endDate.slice(0, 4)) === thisYear;
  return `${formatKoreanDate(startDate, omitStart)} – ${formatKoreanDate(endDate, omitEnd)}`;
}

function formatManwon(amount: number): string {
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString()}만원`;
  return formatCurrency(amount, "KRW");
}

function monthLabel(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return Number.isFinite(m) && m > 0 ? `${m}월` : ym;
}

// ---------------------------------------------------------------------------
// Props — page.tsx canonical 상태/파생만 주입 (자체 fetch 0)
// ---------------------------------------------------------------------------

interface NamedAmount { name: string; amount: number }
interface MonthlyItem { month: string; amount: number }

/** page.tsx deriveInsights() 산출 구조(소비 필드만 구조 타이핑 — 규칙 재정의 아님) */
interface MobileInsights {
  trendDelta: number;
  outlierCount: number;
  topVendorPct: number;
  topCat?: NamedAmount;
  topVendor?: NamedAmount;
  sortedCats: NamedAmount[];
  sortedVendors: NamedAmount[];
}

export interface MobileReportViewProps {
  isLoading: boolean;
  /** 조회 실패 — 빈 화면/가짜 0 대신 에러 카드 렌더(D2, P5 스모크 발견) */
  isError: boolean;
  hasData: boolean;
  totalAmount: number;
  detailCount: number;
  /** §reports-honesty P3 — 금액 미확정(회신 대기) 견적 건수. 합계 제외분을 숨기지 않고 표기. */
  pendingQuoteCount?: number;
  insights: MobileInsights;
  monthlyData: MonthlyItem[];
  categoryData: NamedAmount[];
  vendorData: NamedAmount[];
  presets: ReadonlyArray<{ id: string; label: string }>;
  activePreset: string | null;
  onPreset: (id: string) => void;
  startDate: string;
  endDate: string;
  activeFilterCount: number;
  /** page.tsx 필터 팝오버 콘텐츠 재사용(컨트롤 중복 0) */
  filterContent: ReactNode;
  onDownload: () => void;
  /** 에러 카드 재시도 — 실제 refetch(동일 프리셋 no-op 방지) */
  onRetry: () => void;
}

// ---------------------------------------------------------------------------
// 소형 파츠
// ---------------------------------------------------------------------------

/** §2 KPI 카드 — 아이콘 칩 26px · 숫자 22px · 설명 한 줄. 값 없음 = '–'(0과 구분) */
function KpiCard({
  icon,
  chipClass,
  aside,
  value,
  unit,
  valueClass,
  label,
}: {
  icon: ReactNode;
  chipClass: string;
  aside: string;
  value: string;
  unit?: string;
  valueClass?: string;
  label: string;
}) {
  return (
    <div className="bg-white border border-[#e6eaf0] rounded-2xl p-3.5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className={cn("w-[26px] h-[26px] rounded-lg grid place-items-center", chipClass)}>{icon}</span>
        <span className="text-[10px] font-semibold text-slate-400">{aside}</span>
      </div>
      <p className={cn("text-[22px] font-extrabold leading-none tracking-tight", valueClass ?? "text-slate-900")}>
        {value}
        {unit && value !== "–" && <span className="text-[13px] font-bold ml-0.5">{unit}</span>}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{label}</p>
    </div>
  );
}

/** §4 상세 분석 접힌 행 — 아이콘+제목+안내 한 줄, 우측 링크 회색 비활성 */
function CollapsedRow({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 py-3 min-h-[44px]">
      <span className="w-[26px] h-[26px] rounded-lg grid place-items-center bg-slate-100 text-slate-400 flex-none">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-700">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{hint}</p>
      </div>
      <span className="text-[11px] text-slate-300 flex-none" aria-disabled="true">›</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 본체
// ---------------------------------------------------------------------------

export function MobileReportView(props: MobileReportViewProps) {
  const {
    isLoading, isError, hasData, totalAmount, detailCount, pendingQuoteCount = 0, insights,
    monthlyData, categoryData, vendorData,
    presets, activePreset, onPreset, startDate, endDate,
    activeFilterCount, filterContent, onDownload, onRetry,
  } = props;

  const emptyPeriod = hasData && totalAmount === 0 && detailCount === 0;

  // §4-2 의존도 스택바 — 상위 2곳 + 기타 (KPI 의존도와 동일 소스: vendorData/insights)
  const vendorTotal = vendorData.reduce((s, v) => s + (v.amount || 0), 0);
  const topVendors = insights.sortedVendors.slice(0, 2);
  const etcAmount = Math.max(0, vendorTotal - topVendors.reduce((s, v) => s + v.amount, 0));
  const DEP_COLORS = ["#6d28d9", "#a78bfa", "#ddd6fe"];
  const depSegments = [...topVendors.map((v, i) => ({ name: v.name, amount: v.amount, color: DEP_COLORS[i] })), { name: "기타", amount: etcAmount, color: DEP_COLORS[2] }]
    .filter((s) => s.amount > 0);

  // §4-3 월별 추이 — 최근 3개월, 당월 강조, 막대 위 숫자 없음(§ 링크 겹침 방지)
  const last3 = monthlyData.slice(-3);
  const maxMonthly = Math.max(...last3.map((m) => m.amount), 1);
  const currentMonth = last3[last3.length - 1];
  const hasTrend = monthlyData.length >= 2; // 2개월 이상부터 렌더
  const TREND_PAST = ["#cbd5e1", "#e2e8f0"];

  // 해석 한 줄 — canonical 파생만(가짜 서사 0): 최대 카테고리 기여
  const trendNote = insights.topCat && totalAmount > 0
    ? `${(PRODUCT_CATEGORIES as Record<string, string>)[insights.topCat.name] || insights.topCat.name} 지출 비중 ${Math.round((insights.topCat.amount / totalAmount) * 100)}% 영향`
    : null;

  return (
    <div className="space-y-3">
      {/* ── §1 헤더 — 다운로드 아이콘 1개만 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight">구매 리포트</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">발주 완료 건이 자동으로 집계됩니다</p>
        </div>
        <button
          type="button"
          aria-label="리포트 CSV 다운로드"
          onClick={onDownload}
          className="w-11 h-11 min-h-[44px] rounded-xl border border-[#e6eaf0] bg-white grid place-items-center text-slate-600 active:bg-slate-50"
        >
          <FileDown className="h-5 w-5" />
        </button>
      </div>

      {/* ── §1 기간·필터 단일 카드 ── */}
      <div className="bg-white border border-[#e6eaf0] rounded-2xl p-3 space-y-2.5">
        <div className="grid grid-cols-4 rounded-xl bg-[#f1f5f9] p-0.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPreset(p.id)}
              className={cn(
                "h-11 min-h-[44px] rounded-[10px] text-[12px] font-semibold transition-colors",
                activePreset === p.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              )}
            >
              {p.label.replace("최근 ", "")}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* §1 날짜 — 본문 폰트 한국어 표기(mono 금지) */}
          <p className="text-[13px] font-medium text-slate-700">{formatKoreanDateRange(startDate, endDate)}</p>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-11 min-h-[44px] px-3 rounded-xl border border-[#e6eaf0] bg-white text-[12px] font-semibold text-slate-700"
              >
                <SlidersHorizontal className="h-4 w-4" />
                필터
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">{filterContent}</PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── 로딩 — 뱃지/숫자 placeholder 없이 스켈레톤만 ── */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#e6eaf0] rounded-2xl p-3.5 animate-pulse">
              <div className="h-[26px] w-[26px] bg-slate-100 rounded-lg mb-3" />
              <div className="h-5 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ── 조회 실패 — 모바일 dead-end 방지(D2). 재시도는 프리셋 재선택 = refetch ── */}
      {!isLoading && isError && (
        <div className="border-2 border-dashed border-[#e6eaf0] rounded-2xl bg-white/60 px-4 py-8 text-center">
          <BarChart2 className="h-8 w-8 text-slate-300 mx-auto mb-2.5" />
          <p className="text-[13px] font-semibold text-slate-600">데이터를 불러오지 못했어요</p>
          <p className="text-[12px] text-slate-400 mt-1">잠시 후 다시 시도해주세요</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 h-11 min-h-[44px] px-4 rounded-xl border border-[#e6eaf0] bg-white text-slate-700 text-[13px] font-semibold active:bg-slate-50"
          >
            다시 불러오기
          </button>
        </div>
      )}

      {/* ── §3 빈 기간 — KPI 0 나열 대신 점선 카드 ── */}
      {!isLoading && emptyPeriod && (
        <div className="border-2 border-dashed border-[#e6eaf0] rounded-2xl bg-white/60 px-4 py-8 text-center">
          <BarChart2 className="h-8 w-8 text-slate-300 mx-auto mb-2.5" />
          <p className="text-[13px] font-semibold text-slate-600">이 기간에 집계된 지출이 없어요</p>
          <p className="text-[12px] text-slate-400 mt-1">발주가 완료되면 지출이 자동으로 집계됩니다</p>
          <button
            type="button"
            onClick={() => onPreset("30d")}
            className="mt-4 h-11 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-[13px] font-semibold active:bg-blue-700"
          >
            기간을 30일로 넓히기
          </button>
        </div>
      )}

      {/* ── §2 KPI 2열 컴팩트 4장 ── */}
      {!isLoading && !emptyPeriod && hasData && (
        <div className="grid grid-cols-2 gap-2.5">
          <KpiCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            chipClass={insights.trendDelta > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}
            aside="전월 대비"
            value={monthlyData.length >= 2 ? `${insights.trendDelta > 0 ? "+" : ""}${insights.trendDelta}` : "–"}
            unit="%"
            valueClass={monthlyData.length >= 2 ? (insights.trendDelta > 0 ? "text-[#dc2626]" : "text-[#059669]") : undefined}
            label="지출 변화"
          />
          <KpiCard
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            chipClass={insights.outlierCount > 0 ? "bg-yellow-50 text-yellow-600" : "bg-slate-100 text-slate-500"}
            aside={insights.outlierCount > 0 ? "검토" : "정상"}
            value={detailCount > 0 ? String(insights.outlierCount) : "–"}
            unit="건"
            label="이상치 감지"
          />
          <KpiCard
            icon={<BarChart2 className="h-3.5 w-3.5" />}
            chipClass="bg-blue-50 text-blue-600"
            aside="이번 기간"
            value={detailCount > 0 || totalAmount > 0 ? formatManwon(totalAmount) : "–"}
            // §reports-honesty P3 — 금액 미확정 견적은 합계 제외(₩0 날조 제거). 제외분은 건수로 정직 표기.
            label={
              pendingQuoteCount > 0
                ? `확정 합계 · 회신 대기 ${pendingQuoteCount}건 미확정`
                : `기간 합계 · ${detailCount}건`
            }
          />
          <KpiCard
            icon={<Layers className="h-3.5 w-3.5" />}
            chipClass="bg-violet-50 text-violet-600"
            aside="상위 1곳"
            value={vendorData.length > 0 ? String(insights.topVendorPct) : "–"}
            unit="%"
            label="공급사 의존도"
          />
        </div>
      )}

      {/* ── §4 상세 분석 — 카드 1장, 같은 슬롯 상태 전환(행 3개, 순서 고정, 탭 없음) ── */}
      {!isLoading && hasData && (
        <div className="bg-white border border-[#e6eaf0] rounded-2xl px-4 py-1.5 divide-y divide-slate-100">
          {/* 1. 카테고리별 분석 */}
          {categoryData.length > 0 && categoryData.some((c) => c.amount > 0) ? (
            <div className="py-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[13px] font-bold text-slate-800">카테고리별 분석</p>
                <Link href="/dashboard/purchases" className="text-[12px] font-semibold text-blue-600 min-h-[44px] inline-flex items-center">
                  카테고리 검토 ›
                </Link>
              </div>
              <div className="space-y-2.5">
                {insights.sortedCats.slice(0, 3).map((cat, i) => {
                  const catTotal = categoryData.reduce((s, c) => s + (c.amount || 0), 0);
                  const pct = catTotal > 0 ? Math.round((cat.amount / catTotal) * 100) : 0;
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center text-[12px] mb-1">
                        <span className="font-semibold text-slate-700 truncate">
                          {(PRODUCT_CATEGORIES as Record<string, string>)[cat.name] || cat.name}
                        </span>
                        <span className="ml-auto text-slate-500 tabular-nums">
                          {formatCurrency(cat.amount, "KRW")} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? "#2563eb" : i === 1 ? "#60a5fa" : "#bfdbfe" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <CollapsedRow icon={<Layers className="h-3.5 w-3.5" />} title="카테고리별 분석" hint="집계된 지출이 생기면 표시돼요" />
          )}

          {/* 2. 공급사 의존도 */}
          {depSegments.length > 0 ? (
            <div className="py-3.5">
              <p className="text-[13px] font-bold text-slate-800 mb-2.5">공급사 의존도</p>
              <div className="h-3 rounded-full overflow-hidden flex">
                {depSegments.map((s) => (
                  <div key={s.name} style={{ width: `${vendorTotal > 0 ? (s.amount / vendorTotal) * 100 : 0}%`, background: s.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {depSegments.map((s) => (
                  <span key={s.name} className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                    {s.name} {vendorTotal > 0 ? Math.round((s.amount / vendorTotal) * 100) : 0}%
                  </span>
                ))}
              </div>
              {/* §4-2 60% 초과 — warm warning (yellow 토큰, KPI 의존도와 동일 소스) */}
              {insights.topVendorPct > 60 && (
                <div className="mt-2.5 rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 flex-none mt-0.5" />
                  <p className="text-[12px] text-yellow-700 leading-snug">
                    {insights.topVendor?.name} 의존도 {insights.topVendorPct}% — 대체 공급사 검토를 권장해요
                  </p>
                </div>
              )}
            </div>
          ) : (
            <CollapsedRow icon={<Activity className="h-3.5 w-3.5" />} title="공급사 의존도" hint="발주 공급사 비중을 분석해요" />
          )}

          {/* 3. 월별 지출 추이 */}
          {hasTrend ? (
            <div className="py-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-bold text-slate-800">월별 지출 추이</p>
                <Link href="/dashboard/purchases" className="text-[12px] font-semibold text-blue-600 min-h-[44px] inline-flex items-center">
                  구매내역 ›
                </Link>
              </div>
              {/* 당월 값 헤더 통합 한 줄 — 막대 위 숫자 금지 */}
              {currentMonth && (
                <p className="text-[13px] text-slate-700 mb-2.5">
                  <span className="font-extrabold">{formatManwon(currentMonth.amount)}</span>{" "}
                  <span className={cn("font-bold", insights.trendDelta > 0 ? "text-[#dc2626]" : "text-[#059669]")}>
                    {insights.trendDelta > 0 ? "+" : ""}{insights.trendDelta}%
                  </span>{" "}
                  <span className="text-slate-400">· {monthLabel(currentMonth.month)}</span>
                </p>
              )}
              <div className="flex items-end gap-3 h-20">
                {last3.map((m, i) => {
                  const isCurrent = i === last3.length - 1;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md"
                        style={{
                          height: `${Math.max(6, (m.amount / maxMonthly) * 64)}px`,
                          background: isCurrent ? "#2563eb" : TREND_PAST[i % TREND_PAST.length],
                        }}
                      />
                      <span className={cn("text-[11px]", isCurrent ? "font-bold text-slate-700" : "text-slate-400")}>
                        {monthLabel(m.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {trendNote && (
                <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                  <Activity className="h-3 w-3 flex-none" />
                  {trendNote}
                </p>
              )}
            </div>
          ) : (
            <CollapsedRow icon={<TrendingUp className="h-3.5 w-3.5" />} title="월별 지출 추이" hint="2개월 이상 쌓이면 추이가 그려져요" />
          )}
        </div>
      )}
    </div>
  );
}
