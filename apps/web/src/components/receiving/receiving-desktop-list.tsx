"use client";

/**
 * §11.334 P2 — 입고 목록 데스크탑 리디자인 (시안: 입고 목록 웹 리디자인.html)
 *
 * 파이프라인 퍼널 + 탭툴바 + 카드 리스트. 데이터는 ModuleLandingItem[] projection.
 * 파생은 receiving-list-view-model(순수함수). canonical 재고 truth 대체 0.
 * 행클릭 = onRowClick(기존 라우트 이동 유지 — 드로어는 P3). 헤더 액션/모달은 P4.
 */
import { useMemo, useState } from "react";
import {
  Package,
  Clock,
  AlertTriangle,
  Check,
  ClipboardCheck,
  ChevronRight,
} from "lucide-react";
import type { ModuleLandingItem } from "@/lib/ops-console/module-landing-adapter";
import {
  buildReceivingFunnel,
  buildReceivingTabCounts,
  resolveReceivingFocusIndex,
  resolveReceivingRowVisual,
  type ReceivingRowTone,
} from "@/lib/receiving/receiving-list-view-model";

type TabKey = "actionable" | "all" | "done";

const TONE_STAT: Record<ReceivingRowTone, string> = {
  rose: "bg-rose-50 text-rose-700",
  amber: "bg-[#fdf3ec] text-[#b45821]",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-500",
};

const TONE_BADGE: Record<ReceivingRowTone, string> = {
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-[#fdf3ec] text-[#b45821] border-[#f3d4bf]",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatIcon({ tone }: { tone: ReceivingRowTone }) {
  const cls = "h-5 w-5";
  if (tone === "rose") return <AlertTriangle className={cls} />;
  if (tone === "amber") return <ClipboardCheck className={cls} />;
  if (tone === "blue") return <Check className={cls} />;
  if (tone === "emerald") return <Package className={cls} />;
  return <Clock className={cls} />;
}

// §receiving-list-v2 P2 — 카드 날짜 컬럼. 시안은 "입고일"이나 projection(ModuleLandingItem)에
//   입고일 필드 부재, updatedAt(최근 갱신)만 존재 → "갱신"으로 정직 표기(오라벨 방지).
//   진짜 입고일은 module-landing-adapter 에 arrivalLabel 스레딩 필요(별건).
function formatCardDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}·${dd}`;
}

export function ReceivingDesktopList({
  items,
  onRowClick,
}: {
  items: ModuleLandingItem[];
  onRowClick: (item: ModuleLandingItem) => void;
}) {
  const [tab, setTab] = useState<TabKey>("actionable");

  const funnel = useMemo(() => buildReceivingFunnel(items), [items]);
  const tabCounts = useMemo(() => buildReceivingTabCounts(items), [items]);

  const visibleItems = useMemo(() => {
    if (tab === "all") return items;
    if (tab === "done") return items.filter((i) => i.bucketKey === "handoff");
    return items.filter((i) => i.bucketKey !== "handoff");
  }, [items, tab]);

  // §receiving-funnel-focus(호영님 2026-07-08, 입고 퍼널 현재집중 규칙.md) —
  //   "현재 집중"을 하드코딩(검수 대기 고정)하지 않고 건수>0 최소 index 단계에 배치.
  //   0건 단계엔 절대 집중 없음(흐리게). 전부 0이면 focusIdx=-1(집중 없음).
  const focusIdx = resolveReceivingFocusIndex(funnel);

  const stages = [
    { key: "waiting", label: "입고 대기", sub: "도착 예정 · 미도착", n: funnel.waiting, icon: Package, alert: false },
    { key: "review", label: "검수 대기", sub: "도착 후 검수 필요", n: funnel.review, icon: Clock, alert: false },
    { key: "blocked", label: "문서·판단", sub: "반영 차단 · 보류", n: funnel.blocked, icon: AlertTriangle, alert: true },
    { key: "posted", label: "재고 반영", sub: "반영 대기 · 완료", n: funnel.posted, icon: Check, alert: false },
  ] as const;

  const tabs: { key: TabKey; label: string; n: number }[] = [
    { key: "actionable", label: "처리 필요", n: tabCounts.actionable },
    { key: "all", label: "전체", n: tabCounts.all },
    { key: "done", label: "완료", n: tabCounts.done },
  ];

  return (
    <div className="space-y-5">
      {/* ── 파이프라인 퍼널 ─────────────────────────────── */}
      <div className="flex items-stretch gap-1 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm">
        {stages.map((s, idx) => {
          const Icon = s.icon;
          const muted = s.n === 0;
          const isFocus = idx === focusIdx; // 건수>0 최소 index 단계에만 집중
          const isAlertFocus = isFocus && s.alert; // 문서·판단에 집중 → rose 톤
          return (
            <div key={s.key} className="flex items-stretch flex-1 min-w-0">
              <div
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg flex-1 min-w-0 transition-opacity ${
                  isAlertFocus
                    ? "bg-rose-50 ring-1 ring-inset ring-rose-200"
                    : isFocus
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-200"
                      : ""
                } ${muted ? "opacity-40" : ""}`}
              >
                <span
                  className={`h-9 w-9 rounded-lg grid place-items-center flex-none ${
                    muted
                      ? "bg-slate-50 text-slate-400"
                      : isFocus && !s.alert
                        ? "bg-blue-600 text-white"
                        : s.alert
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  {isFocus && (
                    <div
                      className={`text-[10px] font-extrabold tracking-wide ${
                        isAlertFocus ? "text-rose-600" : "text-blue-600"
                      }`}
                    >
                      현재 집중
                    </div>
                  )}
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-2xl font-extrabold tabular-nums leading-none ${
                        s.alert && !muted ? "text-rose-600" : muted ? "text-slate-300" : "text-slate-900"
                      }`}
                    >
                      {s.n}
                    </span>
                    <span className="text-[13px] font-bold text-slate-700 truncate">{s.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-semibold mt-1 truncate">{s.sub}</div>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex items-center text-slate-300 flex-none">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 탭 툴바 ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-colors ${
                  on ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                <span
                  className={`font-mono text-[11px] rounded px-1.5 py-0.5 ${
                    on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 카드 리스트 ──────────────────────────────────── */}
      {visibleItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-10 text-center text-sm text-slate-500">
          이 분류에 해당하는 입고 건이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibleItems.map((item) => {
            const v = resolveReceivingRowVisual(item.bucketKey);
            return (
              <button
                key={item.entityId}
                type="button"
                onClick={() => onRowClick(item)}
                className="text-left bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <span className={`h-11 w-11 rounded-xl grid place-items-center flex-none ${TONE_STAT[v.tone]}`}>
                  <StatIcon tone={v.tone} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11.5px] font-bold text-slate-400 tracking-wide">{item.entityId}</div>
                  <h3 className="text-[15px] font-extrabold text-slate-900 truncate mt-0.5">{item.title}</h3>
                  <p className="text-[12.5px] text-slate-500 truncate mt-1">{item.summary}</p>
                </div>
                {/* §receiving-list-v2 P2 — 갱신 컬럼(시안 입고일 슬롯, updatedAt 정직 표기) */}
                <div className="hidden lg:flex flex-col items-start gap-0.5 min-w-[64px]">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">갱신</span>
                  <span className="text-[13px] font-bold text-slate-700 font-mono">{formatCardDate(item.updatedAt)}</span>
                </div>
                {item.currentOwnerName && (
                  <div className="hidden lg:flex flex-col items-start gap-0.5 min-w-[80px]">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">담당</span>
                    <span className="text-[13px] font-bold text-slate-700 font-mono truncate">{item.currentOwnerName}</span>
                  </div>
                )}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold border flex-none ${TONE_BADGE[v.tone]}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {v.badgeLabel}
                </span>
                <ChevronRight className="h-[18px] w-[18px] text-slate-300 flex-none" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
