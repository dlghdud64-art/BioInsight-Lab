"use client";

export const dynamic = 'force-dynamic';

/**
 * 예산 상세 · §budget-detail-redesign (2026-09-25)
 *
 * 정본: 예산 상세 핸드오프.md + 예산 상세 리디자인 (단독).html (호영님)
 *   1a 초기(연결 0건) · 1b 운영(연결 있음) · 같은 뼈대, 본문 카드가 상태에서 파생
 *
 * 🛑 판정값(상태·사용률·예상 소진일·규칙 pill)은 **전부 서버가 준다**(GET /api/budgets/[id] · control).
 *   이 화면은 그리기만 한다. 구 화면은 예약을 상수 0 으로 두고 사용률을 스스로 계산했다.
 *
 * 시안과 다르게 그린 자리(조항 우선 · §시안은 조항 위에 있지 않다)
 *   · 앰버 → yellow 신호등(§11.302 amber 금지)
 *   · 「확정」 단계 · 조정 이력 · 소유자 · 부서 · 편차 허용 · 승인 · 카테고리 제한 · 복제 · 보관
 *     → 생산자(DB 열·원장)가 없다. 표시하지 않는다(§연결되지 않은 소스는 0 을 보여주지 않는다).
 *       연결되지 않은 규칙은 통제 규칙 카드에 문구로 밝힌다.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import {
  ArrowLeft,
  FileSpreadsheet,
  MoreVertical,
  Trash2,
  FolderPlus,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { csrfFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { TypeToConfirmDialog } from "@/components/ui/type-to-confirm-dialog";
import { BudgetEditDialog, type BudgetEditFocus } from "@/components/budget/budget-edit-dialog";
import type { BudgetDetailControl } from "@/lib/budget/budget-detail-derive";

type ActivityStage = "reserved" | "actual";

type Activity = {
  id: string;
  stage: ActivityStage;
  domain: string;
  title: string;
  mono: boolean;
  href: string | null;
  meta: string[];
  date: string | null;
  nextTransition: string;
  amount: number;
};

type Budget = {
  id: string;
  name: string;
  amount: number;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  /**
   * §budget-period-axis — 기간의 **달력 날짜** "YYYY-MM-DD".
   * `periodEnd`(ISO)를 `new Date(...).toLocaleDateString()` 하면 하루가 밀린다 —
   * 로컬 23:59:59 로 만들어져 UTC 로 굳고 KST 에서 다음 날로 읽힌다.
   * 실측 2026-09-22: 원문 12-30 예산이 이 화면에 `2026. 12. 31.` 로 떴다.
   */
  periodEndDate?: string | null;
  periodStartDate?: string | null;
  projectName?: string | null;
  note?: string | null;
  ledger: { reserved: number; actual: number; reservedCount: number; actualCount: number };
  control: BudgetDetailControl;
  activities: Activity[];
};

const STAGE_LABEL: Record<ActivityStage, string> = { reserved: "예약", actual: "집행" };
const STAGE_PILL: Record<ActivityStage, string> = {
  reserved: "bg-blue-100 text-blue-700",
  actual: "bg-slate-900 text-white",
};

const formatAmt = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;

/** "YYYY-MM-DD" → "YYYY. M. D." (Date 왕복 0) */
function fmtYmd(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : s;
}
/** "YYYY-MM-DD" → "M. D." */
function fmtMd(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${Number(m[2])}. ${Number(m[3])}.` : s;
}

function BudgetDetailSkeleton() {
  return (
    <div className="min-h-screen bg-sh">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-3 space-y-2">
        <div className="h-7 w-64 rounded animate-pulse bg-el" />
        <div className="h-4 w-80 rounded animate-pulse bg-el" />
      </div>
      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-4">
        <div className="h-32 rounded-xl border border-bd animate-pulse bg-pn" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
          <div className="h-48 rounded-xl border border-bd animate-pulse bg-pn" />
          <div className="h-48 rounded-xl border border-bd animate-pulse bg-pn" />
        </div>
      </div>
    </div>
  );
}

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  const { toast } = useToast();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // §budget-delete-ui — 삭제 확인은 React 모달이다(window.confirm 금지).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editFocus, setEditFocus] = useState<BudgetEditFocus>(null);
  const [stageFilter, setStageFilter] = useState<"all" | ActivityStage>("all");
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const fetchBudget = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/budgets/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Failed to fetch budget");
      const json = await res.json();
      setBudget(json.budget ?? null);
      if (!json.budget) setNotFound(true);
    } catch (err) {
      console.error("[BudgetDetailPage] Error fetching budget:", err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchBudget(); }, [fetchBudget]);
  useEffect(() => { if (deleteOpen) setMenuOpen(false); }, [deleteOpen]);

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sh">
        <p className="text-sm text-slate-400">잘못된 접근입니다.</p>
      </div>
    );
  }
  if (isLoading) return <BudgetDetailSkeleton />;
  if (notFound || !budget) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sh">
        <div className="text-center space-y-4">
          <p className="text-sm text-slate-400">해당 예산 정보를 찾을 수 없습니다.</p>
          <Link href="/dashboard/budget" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            <ArrowLeft className="w-4 h-4 mr-1" />예산 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const ctrl = budget.control;
  const ledger = budget.ledger;
  const hasActivity = ledger.reservedCount + ledger.actualCount > 0;
  const startStr = budget.periodStartDate ? fmtYmd(budget.periodStartDate) : new Date(budget.periodStart).toLocaleDateString("ko-KR");
  // §budget-period-axis — 달력 날짜가 오면 **문자열 그대로** 쓴다(Date 왕복 0).
  const endStr = budget.periodEndDate
    ? (budget.periodStartDate?.slice(0, 4) === budget.periodEndDate.slice(0, 4) ? fmtMd(budget.periodEndDate) : fmtYmd(budget.periodEndDate))
    : new Date(budget.periodEnd).toLocaleDateString("ko-KR");
  const periodStr = `${startStr} ~ ${endStr}`;
  const createdStr = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" }).format(new Date(budget.createdAt));

  // 헤더 상태 pill — 서버 판정(budTone 파생)을 그대로 쓴다. 기간 밖이면 기간 상태가 먼저다.
  const statusPill =
    ctrl.phase === "ended"
      ? { label: "종료", cls: "bg-slate-100 text-slate-600 border-slate-200" }
      : ctrl.phase === "upcoming"
        ? { label: "시작 전", cls: "bg-slate-100 text-slate-600 border-slate-200" }
        : ctrl.status === "blocked"
          ? { label: "차단", cls: "bg-red-50 text-red-700 border-red-200" }
          : ctrl.status === "warning"
            ? { label: "경고", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" }
            : { label: "정상", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  const rateTone =
    ctrl.status === "blocked" ? "text-red-700" : ctrl.status === "warning" || ctrl.nearWarn ? "text-yellow-700" : "text-slate-900";

  const openEdit = (focus: BudgetEditFocus = null) => { setEditFocus(focus); setEditOpen(true); };

  // 🛑 §budget-delete-ui (2026-09-22) — 서버가 권한을 판정한다(조직 예산은 OWNER/ADMIN).
  //   화면은 버튼을 역할로 숨기지 않고 서버 거절을 그대로 보여준다.
  const handleDelete = async () => {
    setDeleting(true);
    try {
      // 🛑 §budget-delete-csrf (2026-09-24 prod 실측) — 변이 요청은 csrfFetch 로만 보낸다.
      const res = await csrfFetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "삭제하지 못했습니다");
      }
      toast({ title: "예산 삭제됨", description: `${budget?.name ?? "예산"} 을(를) 삭제했습니다.` });
      setDeleteOpen(false);
      router.push("/dashboard/budget");
      router.refresh();
    } catch (err: any) {
      // 실패를 성공처럼 보이지 않게 한다 · 모달은 열어 둔 채 사유를 띄운다.
      toast({ title: "삭제 실패", description: err.message || "알 수 없는 오류", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleExcelDownload = async () => {
    try {
      toast({ title: "엑셀 다운로드", description: "보고서를 생성하고 있습니다." });
      const res = await fetch(`/api/budget/report?budgetId=${id}`);
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error || "다운로드 실패"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `budget_report_${id}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "다운로드 완료", description: "엑셀 파일이 다운로드되었습니다." });
    } catch (err: any) {
      toast({ title: "다운로드 실패", description: err.message || "알 수 없는 오류", variant: "destructive" });
    }
  };

  // ── 게이지 폭 (집행 → 예약 순) ──
  const pct = (n: number) => (budget.amount > 0 ? Math.min((n / budget.amount) * 100, 100) : 0);
  const actualW = pct(ledger.actual);
  const reservedW = Math.min(pct(ledger.reserved), 100 - actualW);

  // ── 할 일 (초기 상태) ──
  const todos: { key: string; icon: JSX.Element; tone: "yellow" | "blue"; title: string; body: string; action: JSX.Element }[] = [];
  if (!hasActivity && !budget.projectName) {
    todos.push({
      key: "project",
      icon: <FolderPlus className="h-4 w-4" />,
      tone: "yellow",
      title: "프로젝트를 지정하세요",
      body: "지정하면 예산 목록에서 프로젝트 이름으로 찾을 수 있습니다.",
      action: (
        <Button size="sm" variant="outline" className="h-10 md:h-8 border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100" onClick={() => openEdit("projectName")}>
          지정
        </Button>
      ),
    });
  }
  if (!hasActivity) {
    todos.push({
      key: "link",
      icon: <FileText className="h-4 w-4" />,
      tone: "blue",
      title: "견적을 구매 완료하면 여기에 잡힙니다",
      body: "기간 안에 구매 완료된 견적과 발주 예약이 예약·집행 금액으로 자동 반영됩니다.",
      action: (
        <Link href="/dashboard/quotes">
          <Button size="sm" variant="outline" className="h-10 md:h-8 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
            견적 관리로
          </Button>
        </Link>
      ),
    });
  }

  // ── 연결된 활동 ──
  // 필터 알약은 두 단계에 모두 항목이 있을 때만 둔다. 한쪽뿐이면 「전체」 와 같은 집합이라 눌러도 아무 일이 없다.
  const showStageChips = ledger.reservedCount > 0 && ledger.actualCount > 0;
  const filtered = budget.activities.filter((a) => stageFilter === "all" || a.stage === stageFilter);
  const PREVIEW = 5;
  const visible = showAll ? filtered : filtered.slice(0, PREVIEW);

  // ── 통제 규칙 pill ──
  const warnPill =
    ctrl.status === "normal"
      ? ctrl.nearWarn
        ? { label: `${ctrl.warnRateLeft}% 남음`, cls: "bg-yellow-100 text-yellow-700" }
        : { label: "여유", cls: "bg-emerald-100 text-emerald-700" }
      : { label: "도달", cls: ctrl.status === "blocked" ? "bg-red-50 text-red-700" : "bg-yellow-100 text-yellow-700" };
  const blockPill = ctrl.status === "blocked" ? { label: "도달", cls: "bg-red-50 text-red-700" } : null;
  const rulesAlert = ctrl.nearWarn || ctrl.status !== "normal";

  return (
    <div className="min-h-screen bg-sh">
      {/* ═══ 헤더 ═══ */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <Link href="/dashboard/budget" aria-label="예산 목록으로" className="h-10 w-10 -ml-2 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-el hover:text-slate-900">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-[22px] font-extrabold tracking-tight text-slate-900 leading-tight truncate">{budget.name}</h2>
                <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPill.cls}`}>{statusPill.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {periodStr}
                {ctrl.phase === "active" && <> · 경과 {ctrl.elapsedDays}일 / {ctrl.totalDays}일</>}
                {budget.projectName
                  ? <> · {budget.projectName}</>
                  : <> · <span className="font-semibold text-yellow-700">프로젝트 미지정</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" className="h-10 md:h-9 border-bd bg-pn text-slate-700 hover:bg-el" onClick={handleExcelDownload}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />내보내기
            </Button>
            <Button className="h-10 md:h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold" onClick={() => openEdit(null)}>
              예산 편집
            </Button>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-label="더보기" className="h-10 w-10 md:h-9 md:w-9 p-0 border-bd bg-pn text-slate-600 hover:bg-el">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-1">
                <button
                  type="button"
                  disabled={ledger.reservedCount > 0}
                  className="w-full min-h-[44px] flex items-center gap-2 rounded-md px-3 text-left text-sm text-red-600 hover:bg-red-50 disabled:text-slate-400 disabled:hover:bg-transparent"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4 shrink-0" />예산 삭제
                </button>
                {ledger.reservedCount > 0 && (
                  <p className="px-3 pb-2 text-[11px] leading-snug text-slate-500">
                    발주 예약 {ledger.reservedCount}건이 걸려 있어 삭제할 수 없습니다.
                  </p>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-8 space-y-4">
        {/* ═══ 총액 게이지 (KPI 대체) ═══ */}
        <section className="rounded-xl border border-bd bg-pn p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <div className="text-[11px] text-slate-500">가용</div>
                <div className="text-[26px] font-extrabold leading-tight text-slate-900 tabular-nums">{formatAmt(ctrl.available)}</div>
              </div>
              <div className="pb-1 text-xs text-slate-500 tabular-nums">
                / 총액 {formatAmt(budget.amount)} · 사용 <span className={`font-bold ${rateTone}`}>{ctrl.usedRate}%</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs tabular-nums">
              {([
                { label: "예약", value: ledger.reserved, dot: "bg-blue-300" },
                { label: "집행", value: ledger.actual, dot: "bg-slate-900" },
              ] as const).map((l) => (
                <span key={l.label} className={`inline-flex items-center gap-1.5 ${l.value > 0 ? "text-slate-700" : "text-slate-400"}`}>
                  <span className={`h-2 w-2 rounded-sm ${l.value > 0 ? l.dot : "bg-slate-300"}`} />
                  {l.label} {formatAmt(l.value)}
                </span>
              ))}
            </div>
          </div>
          <div className="relative mt-3">
            <div className="h-2.5 rounded-full bg-[#eef2f7] overflow-hidden flex">
              {actualW > 0 && <div className="h-full bg-slate-900" style={{ width: `${actualW}%` }} />}
              {reservedW > 0 && <div className="h-full bg-blue-300" style={{ width: `${reservedW}%` }} />}
            </div>
            <div aria-hidden className="absolute -top-0.5 h-3.5 w-[1.5px] bg-yellow-500" style={{ left: `${ctrl.warnRate}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
            <span>
              {ctrl.phase === "ended"
                ? "기간 종료"
                : ctrl.phase === "upcoming"
                  ? "시작 전"
                  : ctrl.projectedExhaustDate
                    ? ctrl.exhaustBeforeEnd
                      ? <>진도 기준 예상 소진 <span className="font-bold text-yellow-700">{fmtMd(ctrl.projectedExhaustDate)}</span> <span className="text-yellow-700">(기간 종료 {ctrl.daysBeforeEnd}일 전)</span></>
                      : "진도 기준 기간 안 소진 없음"
                    : "0"}
            </span>
            <span className="text-yellow-700">
              경고 {ctrl.warnRate}% · {ctrl.warnAmountLeft > 0 ? `${formatAmt(ctrl.warnAmountLeft)} 남음` : "도달"}
            </span>
            <span>{ctrl.blockRate}% 차단</span>
          </div>
        </section>

        {/* ═══ 본문 2열 ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
          {/* ── 좌: 상태별 ── */}
          <div className="space-y-4 min-w-0">
            {todos.length > 0 && (
              <section className="rounded-xl border border-bd bg-pn overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-bd">
                  <h3 className="text-sm font-bold text-slate-900">예산을 쓰기 전에</h3>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">{todos.length}건</span>
                </div>
                <ul className="divide-y divide-bd">
                  {todos.map((t) => (
                    <li key={t.key} className="flex items-center gap-3 px-4 py-3">
                      <span className={`h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border ${t.tone === "yellow" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-blue-200 bg-blue-50 text-blue-600"}`}>
                        {t.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                        <p className="text-xs text-slate-500">{t.body}</p>
                      </div>
                      <div className="shrink-0">{t.action}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!hasActivity ? (
              <section className="rounded-xl border border-bd bg-pn px-4 py-3 flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-sm font-bold text-slate-900">연결된 활동</h3>
                <span className="text-xs text-slate-500">아직 없음 · 발주 예약과 구매 완료 건이 여기에 시간순으로 표시됩니다</span>
              </section>
            ) : (
              <section className="rounded-xl border border-bd bg-pn overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-bd">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-bold text-slate-900">연결된 활동</h3>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {budget.activities.length}건 · 예약 {ledger.reservedCount} · 집행 {ledger.actualCount}
                    </span>
                  </div>
                  {showStageChips && (
                    <div className="flex gap-1.5">
                      {(["all", "reserved", "actual"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setStageFilter(k); setShowAll(false); }}
                          className={`min-h-[32px] rounded-full border px-3 text-xs font-medium ${stageFilter === k ? "border-blue-200 bg-blue-50 text-blue-700" : "border-bd bg-pn text-slate-600 hover:bg-el"}`}
                        >
                          {k === "all" ? "전체" : STAGE_LABEL[k]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ul className="divide-y divide-bd">
                  {visible.map((a) => (
                    <li key={a.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] xl:grid-cols-[60px_minmax(0,1fr)_112px_auto] items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className={`justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_PILL[a.stage]}`}>{STAGE_LABEL[a.stage]}</span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 truncate">
                          <span className="font-semibold">{a.domain}</span>{" "}
                          {a.href ? (
                            <Link href={a.href} className={`text-blue-600 hover:underline ${a.mono ? "font-mono text-[13px]" : ""}`}>{a.title}</Link>
                          ) : (
                            <span className={a.mono ? "font-mono text-[13px]" : ""}>{a.title}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate tabular-nums">
                          {[...a.meta, a.date ? fmtMd(a.date) : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`hidden xl:block text-xs ${a.stage === "actual" ? "text-emerald-700" : "text-slate-500"}`}>{a.nextTransition}</span>
                      <span className="text-right text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatAmt(a.amount)}</span>
                    </li>
                  ))}
                </ul>
                {filtered.length > PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full min-h-[44px] border-t border-bd text-xs font-medium text-blue-600 hover:bg-el inline-flex items-center justify-center gap-0.5"
                  >
                    {showAll ? "접기" : <>전체 {filtered.length}건 보기<ChevronRight className="h-3.5 w-3.5" /></>}
                  </button>
                )}
              </section>
            )}
          </div>

          {/* ── 우: 규칙 · 정보 ── */}
          <div className="space-y-4">
            <section className={`rounded-xl border bg-pn ${rulesAlert ? "border-yellow-200" : "border-bd"}`}>
              <div className="px-4 pt-3 pb-2">
                <h3 className="text-sm font-bold text-slate-900">통제 규칙</h3>
              </div>
              <dl className="px-4 pb-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">경고</dt>
                  <dd className="flex items-center gap-2 font-semibold text-slate-900">
                    {ctrl.warnRate}% 도달 시
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${warnPill.cls}`}>{warnPill.label}</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">차단</dt>
                  <dd className="flex items-center gap-2 font-semibold text-slate-900">
                    {ctrl.blockRate}% 초과 발주 불가
                    {blockPill && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${blockPill.cls}`}>{blockPill.label}</span>}
                  </dd>
                </div>
              </dl>
              <p className="border-t border-bd px-4 py-2.5 text-[11px] text-slate-500">
                승인·카테고리 한도는 아직 이 예산 규칙에 연결되지 않았습니다.
              </p>
            </section>

            <section className="rounded-xl border border-bd bg-pn">
              <div className="px-4 pt-3 pb-2">
                <h3 className="text-sm font-bold text-slate-900">예산 정보</h3>
              </div>
              <dl className="px-4 pb-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">프로젝트</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {budget.projectName ?? (
                      <button type="button" className="min-h-[32px] font-semibold text-yellow-700 hover:underline" onClick={() => openEdit("projectName")}>
                        지정하기
                      </button>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">기간</dt>
                  <dd className="font-semibold text-slate-900 tabular-nums">{periodStr}</dd>
                </div>
                {hasActivity ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">일평균 소진</dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">{formatAmt(ctrl.dailyBurn)} / 일</dd>
                    </div>
                    {ctrl.phase === "active" && (
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-slate-500">남은 일평균 여유</dt>
                        <dd className={`font-semibold tabular-nums ${ctrl.exhaustBeforeEnd ? "text-yellow-700" : "text-slate-900"}`}>{formatAmt(ctrl.dailyHeadroom)} / 일</dd>
                      </div>
                    )}
                  </>
                ) : (
                  ctrl.phase !== "ended" && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">일평균 여유</dt>
                      <dd className="font-semibold text-slate-900 tabular-nums">{formatAmt(ctrl.dailyHeadroom)} / 일</dd>
                    </div>
                  )
                )}
                {budget.note && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">설명</dt>
                    <dd className="text-slate-700 text-right">{budget.note}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">생성</dt>
                  <dd className="font-semibold text-slate-900 tabular-nums">{createdStr}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>

      <BudgetEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        focus={editFocus}
        budget={{
          id: budget.id,
          name: budget.name,
          amount: budget.amount,
          periodStartDate: budget.periodStartDate ?? budget.periodStart.slice(0, 10),
          periodEndDate: budget.periodEndDate ?? budget.periodEnd.slice(0, 10),
          projectName: budget.projectName ?? null,
          note: budget.note ?? null,
        }}
        onSaved={() => {
          toast({ title: "예산을 저장했습니다." });
          fetchBudget();
        }}
      />

      {/* §budget-delete-ui — 비가역 삭제. 이름을 입력해야 확인이 켜진다(type-to-confirm). */}
      <TypeToConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="예산을 삭제할까요?"
        description={`${budget.name} · ${formatAmt(budget.amount)} · 삭제하면 되돌릴 수 없습니다. 집행 이력이 있는 예산은 삭제 대신 기간 종료를 권합니다.`}
        expected={budget.name}
        confirmText={deleting ? "삭제 중…" : "삭제"}
        pending={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
