"use client";

/**
 * §inbound-detail-mobile-redesign (호영님 2026-07-02) — 입고 상세 모바일 시트 시안(#07) 재조립.
 *
 * 문제: 라이브 입고 상세 모바일이 데스크탑용 OperationalDetailShell(dense dock)로 렌더 →
 *       user-* 키 노출·판단&조치 3중 반복·밀도 과다("이건 아니잖아", 실기기).
 * 해결: 모바일(lg 미만) 전용 시안 시트 — 헤더(PO·상태 pill) + 진행 스텝퍼 + 수령/검수 KPI +
 *       "재고 반영까지 남은 N가지" 단일 통합 blocker 카드(중복 제거) + 라인 카드 + LOT 요약 +
 *       sticky footer(부분 반영 / 재고 반영). 데스크탑 shell 무접촉.
 * 원칙: canonical 데이터(model) 바인딩, CTA 는 commandSurface 실 액션에 wiring(dead button 0,
 *       비활성은 blockedReasons 표시), 시각만 시안. §ownership-actor-id-mask 유지(user-* 미노출).
 */

import { AlertTriangle, Check, ChevronRight, Package, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  ReceivingExecutionModel,
  ReceivingExecutionPhase,
} from "@/lib/ops-console/receiving-detail-adapter";
import type { CommandSurface, OperationalCommand } from "@/lib/ops-console/action-model";

const PHASE_STEPS: { key: string; label: string; matchPhases: ReceivingExecutionPhase[] }[] = [
  { key: "arrival", label: "도착 확인", matchPhases: ["expected", "arrived"] },
  { key: "inspection", label: "검수·문서", matchPhases: ["inspection_pending", "inspection_in_progress", "docs_missing"] },
  { key: "lot_capture", label: "Lot 등록", matchPhases: [] },
  { key: "posting", label: "재고 반영", matchPhases: ["ready_to_post", "partial_posting"] },
  { key: "handoff", label: "재고 위험", matchPhases: ["posted", "closed"] },
];

const PILL_TONE: Record<string, string> = {
  danger: "bg-rose-50 text-rose-700",
  warning: "bg-[#fdf3ec] text-[#b45821]",
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-blue-50 text-blue-700",
  neutral: "bg-slate-100 text-slate-600",
};
const PILL_DOT: Record<string, string> = {
  danger: "bg-rose-500",
  warning: "bg-[#b45821]",
  success: "bg-emerald-500",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
};

interface Props {
  reference: string;
  poNumber: string;
  vendorName: string;
  arrivalLabel: string;
  currentPhase: ReceivingExecutionPhase;
  phaseLabel: string;
  phaseTone: string;
  model: ReceivingExecutionModel;
  commandSurface: CommandSurface;
}

export function MobileReceivingDetail({
  reference,
  poNumber,
  vendorName,
  arrivalLabel,
  currentPhase,
  phaseLabel,
  phaseTone,
  model,
  commandSurface,
}: Props) {
  const router = useRouter();
  const rp = model.receiptProgress;
  const ins = model.inspection;
  const lot = model.lotCapture;

  const currentIdx = PHASE_STEPS.findIndex((s) => s.matchPhases.includes(currentPhase));

  // 통합 blocker: commandSurface 의 actionable 해소 커맨드(중복 제거된 단일 목록).
  const blockerCommands: OperationalCommand[] = [
    ...commandSurface.triageCommands,
    ...commandSurface.secondaryCommands.filter(
      (c) => c.commandType === "resolve_blocker" || c.commandType === "review",
    ),
  ];
  // canonical blocker 집계(문구는 aggregatedBlockers, actionable 은 위 커맨드).
  const blockerCount = commandSurface.aggregatedBlockers.length;
  const cleared = blockerCount === 0;

  const primary = commandSurface.primaryCommand;
  const partial = commandSurface.secondaryCommands.find((c) => c.label.includes("부분"));

  const pillTone = cleared ? "success" : phaseTone;

  return (
    <div className="lg:hidden flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#eef1f5] -mx-3 sm:-mx-4 -mt-3 sm:-mt-4">
      {/* ── header ── */}
      <div className="flex-none bg-white px-[18px] pt-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-lg text-xs font-extrabold ${PILL_TONE[pillTone] ?? PILL_TONE.neutral}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${PILL_DOT[pillTone] ?? PILL_DOT.neutral}`} />
            {cleared ? "반영 준비됨" : phaseLabel}
          </span>
          <span className="text-[11px] font-bold text-slate-400 bg-[#eef1f5] rounded-md px-2 py-[3px] font-mono">
            {reference}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="닫기"
            className="h-8 w-8 rounded-[9px] grid place-items-center bg-[#eef1f5] text-slate-500 active:scale-95"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight font-mono leading-tight text-slate-900">{poNumber}</h1>
        <p className="text-[12.5px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
          <b className="font-bold text-slate-600">{vendorName}</b>
          <span className="opacity-50">·</span>
          <span>예상 도착 {arrivalLabel}</span>
        </p>
      </div>

      {/* ── scroll body ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-[18px] py-3.5 pb-5 flex flex-col gap-3">
        {/* 진행 스텝퍼 */}
        <div className="bg-white border border-slate-200 rounded-[13px] shadow-sm px-4 pt-4 pb-3">
          <div className="flex items-start">
            {PHASE_STEPS.map((s, idx) => {
              const done = idx < currentIdx;
              const now = idx === currentIdx;
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5 relative text-center">
                  {idx > 0 && (
                    <span className={`absolute top-[13px] -left-1/2 w-full h-0.5 z-0 ${done || now ? "bg-emerald-500" : "bg-slate-200"}`} />
                  )}
                  <span
                    className={`h-[26px] w-[26px] rounded-full grid place-items-center z-[1] border-2 ${
                      done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : now
                          ? "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-50"
                          : "bg-[#eef1f5] border-slate-200 text-slate-400"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3.2} /> : now ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                  </span>
                  <span className={`text-[10.5px] font-bold leading-tight ${now ? "text-blue-600 font-extrabold" : done ? "text-slate-600" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 수령/검수 KPI */}
        <div className="flex gap-2.5">
          <Kpi k="수령 수량" a={rp.totalReceived} b={rp.totalOrdered} />
          <Kpi k="라인 완료" a={rp.receivedLines} b={rp.totalLines} />
          <Kpi k="검수 합격" a={ins.passed} b={ins.totalRequired} warn={ins.totalRequired > 0 && ins.passed < ins.totalRequired} />
        </div>

        {/* 통합 blocker 카드 */}
        {!cleared && (
          <div className="bg-white border border-rose-200 rounded-[13px] shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-[15px] py-3 bg-rose-50 border-b border-rose-200">
              <span className="h-[30px] w-[30px] rounded-lg grid place-items-center bg-white border border-rose-200 text-rose-500">
                <AlertTriangle className="h-[17px] w-[17px]" />
              </span>
              <span className="flex-1 min-w-0">
                <b className="block text-sm font-black text-rose-700 tracking-tight">재고 반영까지 남은 {blockerCount}가지</b>
                <span className="text-[11.5px] text-rose-500 font-semibold">아래를 해소하면 반영됩니다</span>
              </span>
              <span className="flex-none text-xs font-black text-white bg-rose-500 rounded-lg min-w-[24px] h-6 px-[7px] grid place-items-center">{blockerCount}</span>
            </div>
            <div className="flex flex-col">
              {blockerCommands.length > 0
                ? blockerCommands.map((cmd, i) => <BlockerRow key={cmd.id} n={i + 1} cmd={cmd} />)
                : commandSurface.aggregatedBlockers.map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-[15px] py-3 border-t border-slate-100 first:border-t-0">
                      <span className="h-5 w-5 rounded-md grid place-items-center bg-rose-50 text-rose-700 text-[11px] font-black">{i + 1}</span>
                      <span className="flex-1 text-[13px] font-semibold text-slate-800">{b}</span>
                    </div>
                  ))}
            </div>
          </div>
        )}

        {/* 입고 라인 */}
        <div className="text-xs font-extrabold text-slate-500 mt-1 mx-0.5 flex items-center gap-1.5">
          입고 라인 <span className="flex-1" />
          <span className="text-[11px] font-bold text-slate-400">{model.lineExecutions.length}건 · {rp.label}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {model.lineExecutions.map((ln) => (
            <div key={ln.id} className={`bg-white border rounded-[13px] shadow-sm px-3.5 py-3 flex items-center gap-3 ${ln.conditionTone === "danger" ? "border-rose-200" : "border-slate-200"}`}>
              <span className={`h-6 w-6 rounded-md grid place-items-center text-xs font-black font-mono flex-none ${ln.conditionTone === "danger" ? "bg-rose-50 text-rose-700" : "bg-[#eef1f5] text-slate-500"}`}>{ln.lineNumber}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-slate-900 tracking-tight truncate">{ln.itemLabel}</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-semibold text-slate-600">{ln.orderedVsReceived}</span>
                  <span className="opacity-50">·</span>
                  <span className={`text-[10.5px] font-extrabold px-1.5 py-0.5 rounded ${badgeTone(ln.conditionTone)}`}>{ln.conditionLabel}</span>
                </div>
              </div>
              <span className={`flex-none text-[11.5px] font-extrabold ${ln.inspectionTone === "danger" ? "text-rose-700" : ln.inspectionTone === "success" ? "text-emerald-700" : "text-slate-500"}`}>
                {ln.inspectionLabel}
              </span>
            </div>
          ))}
        </div>

        {/* LOT 요약 */}
        {lot.totalLots > 0 && (
          <div className="bg-white border border-slate-200 rounded-[13px] shadow-sm px-[15px] py-3 flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-[9px] grid place-items-center bg-[#eef1f5] text-slate-500 flex-none">
              <Package className="h-[17px] w-[17px]" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-900 tracking-tight">LOT {lot.totalLots}건 등록됨</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">
                {lot.usableLots} 사용 가능
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── sticky footer ── */}
      <div className="flex-none border-t border-slate-200 bg-white px-[18px] pt-3 pb-[calc(env(safe-area-inset-bottom)+13px)]">
        <p className={`text-[11.5px] font-bold mb-2.5 flex items-center gap-1.5 ${cleared ? "text-emerald-700" : "text-rose-700"}`}>
          {cleared ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {cleared ? "모든 차단 해소됨 — 재고 반영 가능" : commandSurface.readinessSummary || `${blockerCount}가지 해소 후 재고 반영 가능`}
        </p>
        <div className="flex gap-2.5">
          {partial && (
            <button
              type="button"
              onClick={partial.canExecute ? partial.onExecute : undefined}
              disabled={!partial.canExecute}
              title={partial.canExecute ? undefined : partial.blockedReasons.join(", ")}
              className="flex-none px-[18px] h-[50px] rounded-[13px] text-[14.5px] font-extrabold bg-[#eef1f5] text-slate-700 border border-slate-200 disabled:opacity-50 active:scale-[0.98]"
            >
              {partial.label}
            </button>
          )}
          <button
            type="button"
            onClick={primary && primary.canExecute ? primary.onExecute : undefined}
            disabled={!primary || !primary.canExecute}
            title={primary && !primary.canExecute ? primary.blockedReasons.join(", ") : undefined}
            className={`flex-1 h-[50px] rounded-[13px] text-[14.5px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] ${
              primary && primary.canExecute
                ? "bg-blue-600 text-white shadow-[0_12px_26px_-12px_rgba(37,99,235,0.6)]"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {primary?.label ?? "재고 반영"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ k, a, b, warn }: { k: string; a: number; b: number; warn?: boolean }) {
  return (
    <div className={`flex-1 bg-white border rounded-[13px] shadow-sm px-3.5 py-3 ${warn ? "border-[#f3d4bf]" : "border-slate-200"}`}>
      <div className="text-[11px] font-semibold text-slate-400 mb-1.5">{k}</div>
      <div className={`text-[19px] font-extrabold tracking-tight leading-none tabular-nums flex items-baseline gap-0.5 ${warn ? "text-[#b45821]" : "text-slate-900"}`}>
        {a}
        <small className="text-[11px] font-bold text-slate-400">/</small>
        <span className="text-slate-400 font-bold text-[19px]">{b}</span>
      </div>
    </div>
  );
}

function BlockerRow({ n, cmd }: { n: number; cmd: OperationalCommand }) {
  const desc = cmd.blockedReasons[0] ?? cmd.postActionSummary ?? cmd.reviewReasons[0] ?? "";
  return (
    <div className="flex items-center gap-2.5 px-[15px] py-3 border-t border-slate-100 first:border-t-0">
      <span className="h-5 w-5 rounded-md grid place-items-center bg-rose-50 text-rose-700 text-[11px] font-black flex-none">{n}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 tracking-tight">{cmd.label}</div>
        {desc && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={cmd.canExecute ? cmd.onExecute : undefined}
        disabled={!cmd.canExecute}
        title={cmd.canExecute ? undefined : cmd.blockedReasons.join(", ")}
        className="flex-none inline-flex items-center gap-0.5 text-xs font-extrabold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-[7px] rounded-[9px] disabled:opacity-40 active:scale-95"
      >
        해소 <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function badgeTone(tone: string): string {
  if (tone === "danger") return "bg-rose-50 text-rose-700";
  if (tone === "warning") return "bg-[#fdf3ec] text-[#b45821]";
  if (tone === "success") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}
