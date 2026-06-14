"use client";

export const dynamic = 'force-dynamic';

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileText,
  Search,
  ShieldAlert,
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
  ChevronRight,
  Lock,
  Activity,
  Zap,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

// §11.99 — audit event label helper (두 surface 일관)
import {
  AUDIT_EVENT_LABELS,
  AUDIT_TONE_CLASSES,
  AUDIT_ACTION_MAP,
  buildEventTypeOptions,
  type AuditEventTone,
} from "@/lib/audit/event-labels";

// §log-consolidation P2 — 활동 모드 표시 라벨(통합 surface 단일 소스).
import {
  ACTIVITY_TYPE_LABELS,
  ENTITY_TYPE_LABELS as ACTIVITY_ENTITY_LABELS,
  ACTIVITY_TYPE_COLORS,
  isAiActivity,
  isAlertActivity,
} from "@/lib/activity/activity-labels";

// §11.81 #audit-trail-data-fetcher-wiring
//
// §11.64 시안 흡수 후 §11.67 dead-button-removal 로 임시 제거됐던 필터 row 를
// real /api/audit-logs fetcher 와 함께 정상 wired. mock 5 행 제거 → Prisma
// AuditLog 모델 + getAuditLogs 와 직접 연결.
//
// Adapter 책임:
//   - AuditLog (Prisma) → UI AuditRow 변환
//   - eventType → 한국어 운영자 라벨 + actionTone 매핑 (5 카테고리)
//   - changes JSON → before/after string 추출
//   - userId === null → "system" auth method, else "user_token"
//   - entityType + entityId → target string
//
// LabAxis 원칙:
//   - mock 0 — canonical truth (Prisma) 만 표시
//   - dead button 0 — 모든 필터/검색 onClick wired
//   - empty/loading/error 상태 명시 (no-op 금지)

interface AuditLogResponse {
  logs: Array<{
    id: string;
    organizationId: string | null;
    userId: string | null;
    eventType: string;
    entityType: string;
    entityId: string | null;
    action: string;
    changes: any;
    metadata: any;
    ipAddress: string | null;
    userAgent: string | null;
    success: boolean;
    errorMessage: string | null;
    createdAt: string;
    user: { id: string; name: string | null; email: string } | null;
    organization: { id: string; name: string } | null;
  }>;
  total: number;
  limit: number;
  offset: number;
  demo?: boolean;
}

// §11.99 — ActionTone alias for AuditEventTone (helper 와 동일 5-tone)
type ActionTone = AuditEventTone;

interface AuditRow {
  id: string;
  time: string;
  user: string;
  email: string;
  ip: string;
  action: string;
  actionTone: ActionTone;
  target: string;
  before: string;
  after: string;
  reason: string;
  authMethod: "user_token" | "system";
  // §11.345 — 행 클릭 상세(same-canvas)용 raw 메타
  userAgent: string;
  entityType: string;
  entityId: string;
  changesRaw: string;
  metadataRaw: string;
}

const EVENT_TYPE_MAP = AUDIT_EVENT_LABELS;
const EVENT_TYPE_OPTIONS = buildEventTypeOptions();

// §11.99 — AUDIT_TONE_CLASSES helper 사용
const ACTION_TONE = AUDIT_TONE_CLASSES;

const AUTH_LABEL: Record<AuditRow["authMethod"], { label: string; cls: string }> = {
  user_token: { label: "사용자 토큰", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  system: { label: "시스템 액션", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

const PERIOD_OPTIONS: Array<{ value: string; label: string; days: number | null }> = [
  { value: "7", label: "최근 7일", days: 7 },
  { value: "30", label: "최근 30일", days: 30 },
  { value: "90", label: "최근 90일", days: 90 },
  { value: "all", label: "전체 기간", days: null },
];

function formatChange(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

// §11.337 — entityType(내부 토큰) → 사람 읽는 대상 라벨. cuid 노출 최소화.
const ENTITY_TYPE_LABELS: Record<string, string> = {
  QUOTE: "견적",
  ORDER: "발주",
  PURCHASE_REQUEST: "결재 요청",
  organization: "조직",
  User: "사용자",
  WORKSPACE: "워크스페이스",
  INVENTORY: "재고",
  AI_ACTION: "AI 작업",
  PRODUCT: "제품",
};

function adaptLog(log: AuditLogResponse["logs"][number]): AuditRow {
  const meta = EVENT_TYPE_MAP[log.eventType] ?? {
    label: log.eventType,
    tone: "register" as ActionTone,
  };
  // §11.337 — action 키 기반 표시 override (raw record 불변 — 표시 파생만).
  //   비-CRUD 출력/조회 이벤트(quote_pdf_generate 등)가 옛 레코드에서 generic
  //   eventType(SETTINGS_CHANGED)으로 저장됐어도 화면에선 "조회·출력"으로 정확 분류.
  const actionMeta = AUDIT_ACTION_MAP[log.action];

  // changes JSON 은 { before, after } 또는 { previous, new } 또는 평탄 object.
  // 일반 케이스만 best-effort decode — 미상 shape 면 빈 문자열로 graceful.
  let before = "";
  let after = "";
  if (log.changes && typeof log.changes === "object") {
    const c = log.changes as Record<string, unknown>;
    if ("before" in c) before = formatChange(c.before);
    if ("after" in c) after = formatChange(c.after);
    if (!before && "previous" in c) before = formatChange(c.previous);
    if (!after && "new" in c) after = formatChange(c.new);
  }

  // 사유: §11.337 — raw action key 노출 대신 사람 읽는 라벨 우선(action 매핑) →
  //   metadata.reason(사용자 입력)이 있으면 그게 최우선.
  let reason = actionMeta?.reason ?? log.action;
  if (log.metadata && typeof log.metadata === "object") {
    const m = log.metadata as Record<string, unknown>;
    if (typeof m.reason === "string") reason = m.reason;
    else if (typeof m.description === "string") reason = m.description;
    else if (typeof m.note === "string") reason = m.note;
  }
  if (!log.success && log.errorMessage) {
    reason = `[실패] ${log.errorMessage}`;
  }

  // 대상: §11.337 — 사람 읽는 라벨(entityType 한글) 우선, cuid 는 compact 뷰에서 제거
  //   (전체 entityId 는 행 클릭 상세 expand 에 "대상 ID"로 보존). metadata 에 견적/발주
  //   번호가 있으면 그 번호로 정확히 식별(신규 레코드). 옛 레코드는 번호 부재 → 라벨만.
  const entityLabel = ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType;
  let target = entityLabel;
  if (log.metadata && typeof log.metadata === "object") {
    const m = log.metadata as Record<string, unknown>;
    if (typeof m.quoteNumber === "string" && m.quoteNumber) target = `견적 ${m.quoteNumber}`;
    else if (typeof m.poNumber === "string" && m.poNumber) target = `발주 ${m.poNumber}`;
  }

  // §11.345 — 타임존 명시(Asia/Seoul) + "KST" 라벨. 서버/런타임 TZ 추정 제거,
  // GMP 감사 추적은 timestamp 의 타임존이 명확해야 함 (Part 11 정합).
  const time =
    new Date(log.createdAt).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Seoul",
    }) + " KST";

  return {
    id: log.id,
    time,
    user: log.user?.name ?? log.user?.email ?? "시스템",
    email: log.user?.email ?? "",
    ip: log.ipAddress ?? "",
    action: actionMeta ? actionMeta.categoryLabel : meta.label,
    actionTone: actionMeta ? actionMeta.tone : meta.tone,
    target,
    before,
    after,
    reason,
    authMethod: log.userId ? "user_token" : "system",
    userAgent: log.userAgent ?? "",
    entityType: log.entityType,
    entityId: log.entityId ?? "",
    changesRaw: log.changes ? formatChange(log.changes) : "",
    metadataRaw: log.metadata ? formatChange(log.metadata) : "",
  };
}

// §11.345 — 행 클릭 상세의 단일 필드 (label/value 쌍).
function DetailField({
  label,
  value,
  mono,
  empty,
}: {
  label: string;
  value: string;
  mono?: boolean;
  empty?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : "text-sm"} ${
          empty ? "italic text-slate-300" : "text-slate-700"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function AuditTrailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("30");

  // §11.311b — 모바일 액션 kebab + Sheet (호영님 P1 2026-05-26).
  const [isActionsSheetOpen, setIsActionsSheetOpen] = useState(false);
  // §11.311b — 모바일 검색 아이콘 → 입력 expand
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  // §11.345 — 행 클릭 시 전체 상세(전후 값·메타·IP·UA·full ID) inline expand (same-canvas)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // §log-consolidation P2 — 통합 로그 surface: 활동/감사 모드 토글.
  const [mode, setMode] = useState<"activity" | "audit">("activity");
  const [modeInitialized, setModeInitialized] = useState(false);
  // 활동 모드 필터(자기 모델 ActivityLog 읽기 — 모델 병합 없음)
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");

  const userRole = session?.user?.role as string | undefined;
  const canAccessAudit = userRole === "ADMIN" || (userRole as string)?.toLowerCase() === "manager";

  // 미인증 → 로그인. (org 멤버는 활동 모드 접근 가능 — 통합 surface)
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin?callbackUrl=/dashboard/audit");
    }
  }, [status, router]);

  // §log-consolidation P2 — 초기 모드: admin 은 감사, 그 외 org 멤버는 활동.
  useEffect(() => {
    if (status === "authenticated" && !modeInitialized) {
      setMode(canAccessAudit ? "audit" : "activity");
      setModeInitialized(true);
    }
  }, [status, canAccessAudit, modeInitialized]);

  // §log-consolidation P2 — 권한 분기(admin-gate 의미 보존):
  //   비admin 이 감사 모드에 진입하면 거부 안내 + 활동 모드로 강등.
  //   감사 데이터(AuditLog)는 admin 만 — 기존 wholesale redirect 의 대체 메커니즘.
  useEffect(() => {
    if (
      modeInitialized &&
      mode === "audit" &&
      status === "authenticated" &&
      !canAccessAudit
    ) {
      toast({
        title: "접근 권한이 없습니다",
        description: "감사 추적은 관리자만 열람할 수 있습니다.",
        variant: "destructive",
      });
      setMode("activity");
    }
  }, [mode, modeInitialized, status, canAccessAudit, toast]);

  // §11.81: real fetcher — /api/audit-logs (limit 200, eventType + startDate + search forward).
  const periodMeta = PERIOD_OPTIONS.find((p) => p.value === periodFilter);
  const startDate = useMemo(() => {
    if (!periodMeta?.days) return null;
    const d = new Date();
    d.setDate(d.getDate() - periodMeta.days);
    return d.toISOString();
  }, [periodMeta]);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", eventTypeFilter, periodFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
      if (startDate) params.set("startDate", startDate);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "감사 로그 조회 실패");
      }
      return res.json();
    },
    enabled: status === "authenticated" && canAccessAudit && mode === "audit",
  });

  const rows: AuditRow[] = useMemo(
    () => (data?.logs ?? []).map(adaptLog),
    [data]
  );

  // §log-consolidation P2 — 활동 모드 fetcher (/api/activity-logs / ActivityLog).
  //   감사와 별 모델 — 데이터 병합 없음. org 멤버 열람(admin-gate 아님).
  const activityQuery = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["activity-logs", activityTypeFilter, entityTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activityTypeFilter !== "all") params.append("activityType", activityTypeFilter);
      if (entityTypeFilter !== "all") params.append("entityType", entityTypeFilter);
      params.append("limit", "100");
      const res = await fetch(`/api/activity-logs?${params.toString()}`);
      if (!res.ok) throw new Error("활동 로그 조회 실패");
      return res.json();
    },
    enabled: status === "authenticated" && mode === "activity",
  });
  const activityLogs: any[] = activityQuery.data?.logs ?? [];
  const activityTotal: number = activityQuery.data?.total ?? 0;
  const isActivityFiltered = activityTypeFilter !== "all" || entityTypeFilter !== "all";
  const handleResetActivityFilters = () => {
    setActivityTypeFilter("all");
    setEntityTypeFilter("all");
  };

  // §log-consolidation P4 — 활동 모드 KPI(구 activity-logs 기능 동등성 회복).
  //   redirect 로 구 surface 제거 시 KPI 가 사라지면 기능 퇴행 → 통합 활동 모드로 이식.
  //   오늘(KST 자정 기준) 활동/AI 처리/경고 카운트. §11.311 컴팩트 3카드.
  const activityTodayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const activityTodayLogs = activityLogs.filter(
    (l: any) => new Date(l.createdAt) >= activityTodayStart,
  );
  const activityTodayCount = activityTodayLogs.length;
  const activityAiCount = activityTodayLogs.filter((l: any) =>
    isAiActivity(l.activityType),
  ).length;
  const activityAlertCount = activityTodayLogs.filter((l: any) =>
    isAlertActivity(l.activityType),
  ).length;

  // §11.300 — 운영 브리핑 캐시 통계 / Injection 패턴 indicator 는 audit 화면에서
  // 제거 (호영님 P1, 2026-05-24). 일반 사용자 화면에 노출되는 개발 지표.
  // ADMIN 전용 가시성은 별도 admin route 신설 시 복원 예정 (§11.300c 보류).
  // 캐시 통계 API endpoint (/api/admin/operational-brief-cache-stats) 자체는
  // 유지 — 직접 조회 또는 로그 모니터링으로 가시성 유지.

  // §log-consolidation P2 — 통합 surface: 세션/모드 확정 전 로딩.
  // (비admin 도 활동 모드로 진입 — 페이지 단위 admin-gate 제거, 감사 모드만 게이트.)
  if (status === "loading" || !modeInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">로그를 불러오는 중…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // §11.89 #audit-trail-pdf-export
  // 브라우저 native print → "PDF로 저장" — 한국어 native 지원 (jsPDF font
  // embed 회피) + 새 endpoint 0건. @media print CSS 로 필터/헤더 버튼/sidebar
  // 숨기고 table 만 인쇄. 대안 (server-side puppeteer / pdfkit) 은 별도
  // 트랙 (#audit-pdf-server-side-render) — 본 트랙은 minimal-diff.
  const handlePdfDownload = () => {
    if (rows.length === 0) {
      toast({
        title: "인쇄할 로그가 없습니다",
        description: "필터 조건을 조정한 후 다시 시도하세요.",
        variant: "destructive",
      });
      return;
    }
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // §11.109 — 정형 PDF 양식 (서명란 + 페이지 번호 + 회사 헤더 포함).
  // /api/audit-logs/pdf-view server-side rendered HTML 페이지를 새 탭으로
  // 열고 autoPrint=1 로 자동 인쇄 dialog trigger. 컴플라이언스 보존 양식.
  const handleCompliancePdf = () => {
    if (rows.length === 0) {
      toast({
        title: "인쇄할 로그가 없습니다",
        description: "필터 조건을 조정한 후 다시 시도하세요.",
        variant: "destructive",
      });
      return;
    }
    const params = new URLSearchParams();
    if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
    if (startDate) params.set("startDate", startDate);
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", "200");
    params.set("autoPrint", "1");
    window.open(`/api/audit-logs/pdf-view?${params.toString()}`, "_blank");
  };

  const handleCsvExport = () => {
    if (rows.length === 0) {
      toast({
        title: "내보낼 로그가 없습니다",
        description: "필터 조건을 조정한 후 다시 시도하세요.",
        variant: "destructive",
      });
      return;
    }
    // CSV 직접 생성 — 별도 endpoint 없이 client-side download
    const headers = [
      "ID",
      "Timestamp",
      "User",
      "Email",
      "IP",
      "Action",
      "Target",
      "Before",
      "After",
      "Reason",
      "AuthMethod",
    ];
    const lines = rows.map((r) =>
      [r.id, r.time, r.user, r.email, r.ip, r.action, r.target, r.before, r.after, r.reason, r.authMethod]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "﻿" + [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "CSV 내보내기 완료",
      description: `${rows.length}건의 감사 로그를 다운로드했습니다.`,
    });
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6 lg:p-8 pt-6 max-w-7xl mx-auto w-full print:p-0 print:max-w-none print:space-y-3">
      {/* §log-consolidation P2 — 활동/감사 모드 토글 (단일 로그 surface).
          비admin 은 감사 탭 비노출 (canAccessAudit 게이트). */}
      <div className="print:hidden">
        <div
          data-testid="log-mode-toggle"
          role="tablist"
          aria-label="로그 보기 모드"
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "activity"}
            data-testid="log-mode-activity"
            onClick={() => setMode("activity")}
            className={`h-9 px-4 rounded-md text-sm font-medium transition-colors touch-manipulation ${
              mode === "activity"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            활동 로그
          </button>
          {canAccessAudit && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "audit"}
              data-testid="log-mode-audit"
              onClick={() => setMode("audit")}
              className={`h-9 px-4 rounded-md text-sm font-medium transition-colors touch-manipulation ${
                mode === "audit"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              감사 추적
            </button>
          )}
        </div>
      </div>

      {/* §log-consolidation P2 — 활동 모드: ActivityLog(/api/activity-logs) 자기 모델 읽기. */}
      {mode === "activity" && (
        <div className="space-y-4" data-testid="log-activity-section">
          <div className="flex flex-col space-y-1.5 min-w-0">
            <h2 className="text-lg md:text-3xl font-bold tracking-tight text-slate-900 flex items-baseline gap-2 flex-wrap">
              <span>활동 로그</span>
              {activityQuery.data && (
                <span className="text-sm md:text-base text-slate-400 font-medium">
                  · {activityTotal.toLocaleString("ko-KR")}건
                </span>
              )}
            </h2>
            <p className="hidden md:block text-sm text-slate-500 break-keep">
              리스트 생성·수정·공유 등 모든 활동 내역을 확인합니다.
            </p>
          </div>

          {/* §log-consolidation P4 — 활동 KPI(§11.311 컴팩트 3카드, 구 activity-logs 동등성).
              grid-cols-3 한 줄 / p-3 / text-lg / 0건 회색·1+건 활성 / 경고 1+건 red(§11.302). */}
          <div
            data-testid="log-activity-kpi-grid"
            className="grid grid-cols-3 gap-2 md:gap-3"
          >
            <Card
              className={`transition-colors ${
                activityTodayCount > 0
                  ? "bg-white border-slate-300 shadow-sm"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity
                    className={`h-4 w-4 ${activityTodayCount > 0 ? "text-purple-600" : "text-slate-400"}`}
                  />
                  <p className="text-[10px] md:text-xs text-slate-500 break-keep">시스템 활동</p>
                </div>
                <p
                  className={`text-lg md:text-xl font-bold tabular-nums ${
                    activityTodayCount > 0 ? "text-slate-900" : "text-gray-400"
                  }`}
                >
                  {activityTodayCount.toLocaleString("ko-KR")}
                  <span className="text-xs font-semibold text-slate-400 ml-0.5">건</span>
                </p>
              </CardContent>
            </Card>
            <Card
              className={`transition-colors ${
                activityAiCount > 0
                  ? "bg-white border-slate-300 shadow-sm"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap
                    className={`h-4 w-4 ${activityAiCount > 0 ? "text-blue-600" : "text-slate-400"}`}
                  />
                  <p className="text-[10px] md:text-xs text-slate-500 break-keep">AI 처리</p>
                </div>
                <p
                  className={`text-lg md:text-xl font-bold tabular-nums ${
                    activityAiCount > 0 ? "text-slate-900" : "text-gray-400"
                  }`}
                >
                  {activityAiCount.toLocaleString("ko-KR")}
                  <span className="text-xs font-semibold text-slate-400 ml-0.5">건</span>
                </p>
              </CardContent>
            </Card>
            <Card
              className={`transition-colors ${
                activityAlertCount > 0
                  ? "bg-red-50 border-red-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle
                    className={`h-4 w-4 ${activityAlertCount > 0 ? "text-red-700" : "text-slate-400"}`}
                  />
                  <p
                    className={`text-[10px] md:text-xs break-keep ${
                      activityAlertCount > 0 ? "text-red-700" : "text-slate-500"
                    }`}
                  >
                    경고/오류
                  </p>
                </div>
                <p
                  className={`text-lg md:text-xl font-bold tabular-nums ${
                    activityAlertCount > 0 ? "text-red-700" : "text-gray-400"
                  }`}
                >
                  {activityAlertCount.toLocaleString("ko-KR")}
                  <span className="text-xs font-semibold text-slate-400 ml-0.5">건</span>
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-row gap-2 items-center">
            <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
              <SelectTrigger className="h-9 w-[120px] md:w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 활동</SelectItem>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="h-9 w-[120px] md:w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="quote">견적</SelectItem>
                <SelectItem value="product">제품</SelectItem>
                <SelectItem value="search">검색</SelectItem>
                <SelectItem value="order">발주</SelectItem>
                <SelectItem value="inventory">재고</SelectItem>
                <SelectItem value="vendor">공급사</SelectItem>
              </SelectContent>
            </Select>
            {isActivityFiltered && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetActivityFilters}
                className="h-9 gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                필터 초기화
              </Button>
            )}
          </div>

          <div className="border border-bd rounded-lg bg-white overflow-hidden shadow-sm">
            {activityQuery.isLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">활동 로그 조회 중...</p>
              </div>
            ) : activityQuery.isError ? (
              <div className="py-12 text-center">
                <Activity className="h-8 w-8 text-rose-700 mx-auto mb-2" />
                <p className="text-sm text-rose-700">활동 로그를 불러오지 못했습니다.</p>
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 mb-1">활동 내역이 없습니다.</p>
                <p className="text-[11px] text-slate-400 break-keep">
                  선택한 조건에 해당하는 활동 기록이 없습니다.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activityLogs.map((log: any) => {
                  const label = ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType;
                  const colorClass =
                    ACTIVITY_TYPE_COLORS[log.activityType] ||
                    "bg-slate-100 text-slate-700 border-slate-200";
                  const entityLabel = log.entityType
                    ? ACTIVITY_ENTITY_LABELS[log.entityType] || log.entityType
                    : "";
                  return (
                    <li
                      key={log.id}
                      className="flex items-start gap-3 p-3 md:p-4 hover:bg-slate-50/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] md:text-xs font-bold ${colorClass}`}
                          >
                            {label}
                          </Badge>
                          {entityLabel && (
                            <span className="text-[10px] text-slate-400">· {entityLabel}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          {log.user && (
                            <span className="break-keep">{log.user.name || log.user.email}</span>
                          )}
                          {log.organization && (
                            <span className="break-keep">{log.organization.name}</span>
                          )}
                          <span className="font-mono text-slate-400">
                            {new Date(log.createdAt).toLocaleString("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Seoul",
                            })}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* §log-consolidation P2 — 감사 모드: AuditLog(/api/audit-logs), admin-gate +
          GMP Part 11 + PDF/CSV export 보존. */}
      {mode === "audit" && (
        <>
      {/* §11.89 — 인쇄용 헤더 (화면에는 hidden, PDF/print 시만 표시).
          회사명 + 인쇄 시각 + 필터 컨디션 요약 — 감사 추적 출력본 보존 용도. */}
      <div className="hidden print:block border-b border-slate-300 pb-3 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-slate-900">LabAxis 감사 추적 (Audit Trail)</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {periodMeta?.label || "전체 기간"}
              {eventTypeFilter !== "all" && ` · ${EVENT_TYPE_OPTIONS.find((o) => o.value === eventTypeFilter)?.label || eventTypeFilter}`}
              {search.trim() && ` · 검색 "${search.trim()}"`}
              {data && ` · 총 ${rows.length}건`}
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            인쇄 시각: {new Date().toLocaleString("ko-KR")}
          </p>
        </div>
      </div>

      {/* §11.64: 헤더 단순화 — 자물쇠 제거, CFR 21 Part 11 톤 제거.
          §11.89: 화면 헤더는 print:hidden — 인쇄 본은 위 인쇄용 헤더 사용.
          §11.311b (호영님 P1 2026-05-26):
            - eyebrow "보안 및 컴플라이언스" 모바일 hidden md:flex (뒤로가기 충분)
            - 제목 + 건수 통합: "감사 추적 · N건"
            - description 모바일 단축 (간단한 한 줄)
            - 액션 4 button 모바일 → kebab + Sheet (4 button overflow 0). */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-2 print:hidden">
        <div className="flex flex-col space-y-1.5 min-w-0">
          {/* §11.311b — eyebrow 모바일 hidden */}
          <div className="hidden md:flex items-center gap-2 text-slate-400 mb-1">
            <span className="font-semibold tracking-tight text-xs uppercase">보안 및 컴플라이언스</span>
          </div>
          {/* §11.311b — 제목 + 건수 통합 */}
          <h2 className="text-lg md:text-3xl font-bold tracking-tight text-slate-900 flex items-baseline gap-2 flex-wrap">
            <span>감사 추적</span>
            {data && (
              <span className="text-sm md:text-base text-slate-400 font-medium">
                · {data.total.toLocaleString("ko-KR")}건
              </span>
            )}
          </h2>
          {/* §11.311b — description 데스크탑만 (모바일 first fold 절약) */}
          <p className="hidden md:block text-sm text-slate-500 break-keep">
            주요 시스템 데이터 변경 및 접근 기록 이력을 확인합니다.
          </p>
        </div>

        {/* §11.337 — export 액션 one-primary 정리(호영님 P2).
            AS-IS: 새로고침/간단인쇄/정형PDF/CSV 4 button 과밀(one-primary 위반).
            TO-BE: [새로 고침 아이콘 분리] + [내보내기 단일 primary → Sheet(인쇄/PDF/CSV)].
            데스크탑·모바일 공통(기존 md 분기 + 모바일 kebab 제거 → 단일 패턴). */}
        <div className="flex gap-2 flex-shrink-0 items-center self-start md:self-auto">
          {/* 새로 고침 — 아이콘 분리 (export 와 별개 동작) */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="새로 고침"
            data-testid="audit-refresh"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-10 w-10 touch-manipulation active:scale-95"
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          {/* 내보내기 — 단일 primary, Sheet 로 인쇄/PDF/CSV 묶음 */}
          <Button
            type="button"
            data-testid="audit-export-trigger"
            aria-label="내보내기 메뉴 열기"
            onClick={() => setIsActionsSheetOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white touch-manipulation active:scale-95"
          >
            <Download className="w-4 h-4 mr-2" />
            내보내기
            <ChevronDown className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>

      {/* §11.337 — 내보내기 Sheet (인쇄/정형 PDF/CSV 묶음). 새로 고침은 분리 아이콘. */}
      <Sheet open={isActionsSheetOpen} onOpenChange={(next) => { if (!next) setIsActionsSheetOpen(false); }}>
        <SheetContent side="bottom" className="max-h-[60vh]" data-testid="audit-actions-sheet">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">내보내기</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              data-testid="audit-actions-sheet-print"
              onClick={() => { handlePdfDownload(); setIsActionsSheetOpen(false); }}
              className="w-full h-11 justify-start"
            >
              <Download className="w-4 h-4 mr-2" />
              간단 인쇄
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="audit-actions-sheet-pdf"
              onClick={() => { handleCompliancePdf(); setIsActionsSheetOpen(false); }}
              className="w-full h-11 justify-start border-slate-700 text-slate-700"
            >
              <Download className="w-4 h-4 mr-2" />
              정형 PDF (서명·페이지 번호 포함)
            </Button>
            <Button
              type="button"
              data-testid="audit-actions-sheet-csv"
              onClick={() => { handleCsvExport(); setIsActionsSheetOpen(false); }}
              className="w-full h-11 justify-start bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              CSV 내보내기
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* §11.81 — 필터 row 복원: real fetcher 와 함께 wired (eventType + period
          + search 모두 query params 로 forward → /api/audit-logs).
          §11.67 에서 dead button 으로 잠시 제거됐던 시안 visual essence 회복. */}
      {/* §11.311b — 필터 + 검색 가로 인라인 (호영님 P1).
          AS-IS: flex-col md:flex-row (모바일 3행)
          TO-BE: flex-row 항상 (가로) + 모바일 검색 아이콘 expand (탭 시 입력 확장).
          데스크탑 (md+) 검색 input 그대로 노출 (max-w-sm). */}
      <div className="flex flex-row gap-2 items-center print:hidden">
        <div className="flex flex-1 gap-2 flex-wrap min-w-0">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 w-[120px] md:w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="h-9 w-[120px] md:w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPE_OPTIONS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* §11.311b — 데스크탑 검색 input 그대로 (md:flex), 모바일 검색 아이콘 */}
        <div className="relative hidden md:flex md:max-w-sm md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="ID, 대상, 사용자명, 이메일 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs w-full"
          />
        </div>

        {/* §11.311b — 모바일 검색 토글 button (아이콘 only) */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="audit-search-toggle"
          aria-label={isSearchExpanded ? "검색 닫기" : "검색 열기"}
          onClick={() => setIsSearchExpanded((v) => !v)}
          className="md:hidden h-9 w-9 flex-shrink-0"
        >
          {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* §11.311b — 모바일 검색 expand (필터 row 위 또는 아래) */}
      {isSearchExpanded && (
        <div className="md:hidden relative print:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="ID, 대상, 사용자명, 이메일 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="audit-search-input-mobile"
            className="pl-9 h-9 text-xs w-full"
            autoFocus
          />
        </div>
      )}

      <div className="border border-bd rounded-lg bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">감사 로그 조회 중...</p>
          </div>
        ) : isError ? (
          <div className="py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-rose-700 mx-auto mb-2" />
            <p className="text-sm text-rose-700">감사 로그를 불러오지 못했습니다.</p>
            <p className="text-xs text-slate-400 mt-1">
              새로 고침 버튼을 눌러 다시 시도하세요.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 mb-1">감사 로그가 없습니다.</p>
            <p className="text-[11px] text-slate-400 break-keep">
              선택한 기간 / 액션 조건에 해당하는 기록이 없습니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[180px] font-semibold text-xs uppercase tracking-wider text-slate-500">일시 / ID</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">작업자 / IP</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">액션 및 대상</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">변경 내역</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">사유 / 인증</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => {
                  const auth = AUTH_LABEL[log.authMethod];
                  const hasChange = log.before && log.after;
                  const onlyAfter = !log.before && log.after;
                  // §11.345 — 행 클릭 상세 토글 (same-canvas inline expand)
                  const isExpanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                    <TableRow
                      className="hover:bg-slate-50/50 cursor-pointer print:cursor-auto"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      aria-expanded={isExpanded}
                      data-testid="audit-row"
                    >
                      <TableCell>
                        <div className="flex items-start gap-1.5">
                          <ChevronRight
                            className={`h-3.5 w-3.5 mt-0.5 text-slate-400 flex-shrink-0 transition-transform print:hidden ${isExpanded ? "rotate-90" : ""}`}
                          />
                          <div className="min-w-0">
                            <div className="font-mono text-sm font-medium text-slate-900">
                              {log.time}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">
                              {log.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{log.user}</span>
                          {log.email && (
                            <span className="text-xs text-slate-400 break-all">{log.email}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          {/* §11.345 — 빈 값은 "-" 대신 "기록 없음" 으로 수집 누락 명확화 */}
                          IP: {log.ip || <span className="italic text-slate-300">기록 없음</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`mb-1 ${ACTION_TONE[log.actionTone]}`}>
                          {log.action}
                        </Badge>
                        <div className="text-sm font-medium text-slate-900 break-keep">
                          {log.target}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasChange ? (
                          <div className="flex items-center gap-2 text-sm flex-wrap">
                            <span className="text-slate-500 break-keep">{log.before}</span>
                            <span className="text-slate-400 flex-shrink-0">→</span>
                            <span className="text-slate-900 font-bold break-keep">{log.after}</span>
                          </div>
                        ) : onlyAfter ? (
                          <span className="text-sm text-slate-500 italic break-keep">{log.after}</span>
                        ) : (
                          <span className="text-slate-300 text-sm italic">기록 없음</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-600 break-keep">{log.reason}</div>
                        <Badge
                          variant="outline"
                          className={`mt-1.5 text-[10px] px-1.5 py-0 h-5 ${auth.cls}`}
                        >
                          {auth.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {/* §11.345 — 행 클릭 상세: 전후 값·메타·IP·UA·full ID (same-canvas).
                        새 페이지 0건. GMP 검토 시 단일 레코드 전체 컨텍스트 확인용. */}
                    {isExpanded && (
                      <TableRow
                        className="bg-slate-50/70 hover:bg-slate-50/70"
                        data-testid="audit-row-detail"
                      >
                        <TableCell colSpan={5} className="p-0">
                          <div className="px-4 py-4 border-l-2 border-slate-300">
                            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                              <DetailField label="레코드 ID" value={log.id} mono />
                              <DetailField label="일시 (KST)" value={log.time} mono />
                              <DetailField label="작업자" value={log.user} />
                              <DetailField label="이메일" value={log.email || "기록 없음"} mono empty={!log.email} />
                              <DetailField label="IP 주소" value={log.ip || "기록 없음"} mono empty={!log.ip} />
                              <DetailField label="User Agent" value={log.userAgent || "기록 없음"} mono empty={!log.userAgent} />
                              <DetailField label="대상 유형" value={log.entityType} mono />
                              <DetailField label="대상 ID" value={log.entityId || "기록 없음"} mono empty={!log.entityId} />
                              <DetailField label="사유" value={log.reason} />
                              <DetailField label="인증 방식" value={auth.label} />
                            </dl>
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                변경 전 → 후
                              </p>
                              {hasChange ? (
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                  <span className="text-slate-500 break-keep">{log.before}</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-slate-900 font-bold break-keep">{log.after}</span>
                                </div>
                              ) : onlyAfter ? (
                                <span className="text-sm text-slate-500 italic break-keep">{log.after}</span>
                              ) : (
                                <span className="text-sm text-slate-300 italic">기록 없음</span>
                              )}
                            </div>
                            {(log.changesRaw || log.metadataRaw) && (
                              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                                {log.changesRaw && (
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                      changes (raw)
                                    </p>
                                    <pre className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                      {log.changesRaw}
                                    </pre>
                                  </div>
                                )}
                                {log.metadataRaw && (
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                      metadata (raw)
                                    </p>
                                    <pre className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                      {log.metadataRaw}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Lock className="h-3 w-3" />
                              감사 추적 레코드는 추가 전용(append-only)으로 보존되며 수정·삭제되지 않습니다.
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

