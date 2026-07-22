"use client";

export const dynamic = 'force-dynamic';

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ChevronLeft,
  ChevronRight,
  Lock,
  Activity,
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
  ymd: string;
  hm: string;
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

// §audit-log-enhancement P3b — 카테고리 필터(전체/생성/수정/삭제/권한·보안/실패만).
type AuditCat = "all" | "create" | "update" | "delete" | "secu" | "fail";
function auditCategory(log: AuditRow): Exclude<AuditCat, "all"> {
  if (log.reason.startsWith("[실패]")) return "fail";
  const s = `${log.action} ${log.entityType} ${log.reason}`.toLowerCase();
  if (/login|permission|role|access|auth|권한|접근|로그인|보안|인증/.test(s)) return "secu";
  if (/삭제|제거|delete|remove|취소|cancel/.test(s)) return "delete";
  if (/생성|추가|create|insert|등록|발주/.test(s)) return "create";
  return "update";
}
const AUDIT_CAT_CHIPS: Array<{ id: AuditCat; label: string }> = [
  { id: "all", label: "전체" },
  { id: "create", label: "생성" },
  { id: "update", label: "수정" },
  { id: "delete", label: "삭제" },
  { id: "secu", label: "권한·보안" },
  { id: "fail", label: "실패만" },
];

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
  const ymd = new Date(log.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const hm = new Date(log.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

  return {
    id: log.id,
    time,
    ymd,
    hm,
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

// §audit-log-enhancement P2 — 활동 피드 헬퍼(아바타 이니셜·카테고리·톤). 색 규칙: 카테고리색=dot만, 빨강=실패행만.
function actorInitials(name?: string | null, email?: string | null): string {
  const src = (name || email || "").trim();
  if (!src) return "SY";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
const ACT_CAT_DOT: Record<string, string> = {
  create: "bg-[#0b7a4b]", update: "bg-[#2258c9]", delete: "bg-[#c8324f]",
  secu: "bg-[#6b3fc4]", system: "bg-slate-400", fail: "bg-[#c8324f]",
};
function activityCategory(t: string): "create" | "update" | "delete" | "secu" | "system" | "fail" {
  const u = (t || "").toUpperCase();
  if (u.includes("FAIL")) return "fail";
  if (u.includes("LOGIN") || u.includes("PERMISSION") || u.includes("ROLE") || u.includes("SECUR")) return "secu";
  if (u.includes("CREATE") || u.includes("GENERATED") || u.includes("REGISTERED")) return "create";
  if (u.includes("DELET") || u.includes("CANCEL") || u.includes("REVERS")) return "delete";
  if (u.includes("UPDATE") || u.includes("CHANGED") || u.includes("REVIEWED") || u.includes("STATUS")) return "update";
  return "system";
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
  const [auditCat, setAuditCat] = useState<AuditCat>("all");
  const [auditDay, setAuditDay] = useState<string>("");

  // §log-consolidation P2 — 통합 로그 surface: 활동/감사 모드 토글.
  const [mode, setMode] = useState<"activity" | "audit">("activity");
  const [modeInitialized, setModeInitialized] = useState(false);
  // 활동 모드 필터(자기 모델 ActivityLog 읽기 — 모델 병합 없음)
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  // §audit-log-enhancement P2b — 활동 피드 멤버 필터(client-side).
  const [activityMember, setActivityMember] = useState<string>("all");

  const userRole = session?.user?.role as string | undefined;
  const canAccessAudit = userRole === "ADMIN" || (userRole as string)?.toLowerCase() === "manager";

  // 미인증 → 로그인. (org 멤버는 활동 모드 접근 가능 — 통합 surface)
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin?callbackUrl=/dashboard/audit");
    }
  }, [status, router]);

  // §mobile-logs P2 — 탭 = URL `?tab=` 단일 소스(기본 탭 하드코딩 제거).
  //   `?tab=` 이 있으면 항상 그대로 반영(더보기 "활동 로그" → admin 도 활동 탭 진입 —
  //   진단 ① 라우팅 버그 해소). 단 감사 탭은 canAccessAudit 게이트(비admin 은 활동으로).
  //   `?tab=` 부재 시에만 기존 분기 유지: admin 은 감사, 그 외 org 멤버는 활동.
  //   (page 는 force-dynamic — useSearchParams CSR bailout 무관.)
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  useEffect(() => {
    if (status !== "authenticated") return;
    if (tabParam === "activity" || tabParam === "audit") {
      setMode(tabParam === "audit" && !canAccessAudit ? "activity" : tabParam);
      setModeInitialized(true);
      return;
    }
    if (!modeInitialized) {
      setMode(canAccessAudit ? "audit" : "activity");
      setModeInitialized(true);
    }
  }, [status, canAccessAudit, modeInitialized, tabParam]);

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

  // §audit-log-enhancement P3b — 하루 단위(날짜 네비) + 카테고리 파생값.
  const auditDayList = useMemo(
    () => Array.from(new Set(rows.map((r) => r.ymd))).sort((a, b) => b.localeCompare(a)),
    [rows],
  );
  const todayYmd = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
    [],
  );
  const effectiveDay =
    auditDay && auditDayList.includes(auditDay) ? auditDay : auditDayList[0] ?? "";
  const auditDayIdx = auditDayList.indexOf(effectiveDay);
  const auditDayRows = useMemo(
    () => rows.filter((r) => r.ymd === effectiveDay),
    [rows, effectiveDay],
  );
  const shownRows = useMemo(
    () =>
      auditCat === "all"
        ? auditDayRows
        : auditDayRows.filter((r) => auditCategory(r) === auditCat),
    [auditDayRows, auditCat],
  );

// §log-consolidation P4→시안정합(호영님 2026-07-04) — 활동 KPI 3카드 제거.
  //   오늘 기준 카운트가 과거 피드와 무관하게 전부 0건 회색 박스로 노출되어 제거.
  //   활동 필터는 멤버 칩(activityMember)으로 일원화(시안 정합).

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
              <div data-testid="activity-feed">
                {(() => {
                  const mm = new Map<string, { id: string; name: string; count: number }>();
                  for (const lg of activityLogs as any[]) {
                    const id = String(lg.user?.id ?? "system");
                    const name = lg.user?.name || lg.user?.email || "시스템";
                    const e = mm.get(id) ?? { id, name, count: 0 };
                    e.count += 1; mm.set(id, e);
                  }
                  const chips = [...mm.values()].sort((x, y) => y.count - x.count);
                  if (chips.length <= 1) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 border-b border-slate-100">
                      <button type="button" onClick={() => setActivityMember("all")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-[11px] font-semibold border transition-colors ${activityMember === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                        전체 <span className="tabular-nums opacity-70">{activityLogs.length}</span>
                      </button>
                      {chips.map((c) => (
                        <button key={c.id} type="button" onClick={() => setActivityMember(c.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 h-7 text-[11px] font-semibold border transition-colors ${activityMember === c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-600">{actorInitials(c.name)}</span>
                          {c.name}<span className="tabular-nums opacity-70">{c.count}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {(() => {
                  const fmtDay = (d: string) =>
                    new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" });
                  const groups: { day: string; items: any[] }[] = [];
                  for (const log of (activityLogs as any[]).filter((l: any) => activityMember === "all" || String(l.user?.id ?? "system") === activityMember)) {
                    const day = fmtDay(log.createdAt);
                    let g = groups[groups.length - 1];
                    if (!g || g.day !== day) { g = { day, items: [] }; groups.push(g); }
                    g.items.push(log);
                  }
                  return groups.map((g) => (
                    <div key={g.day}>
                      <div className="sticky top-0 z-[1] bg-slate-50/95 px-4 py-1.5 text-[11px] font-semibold text-slate-500 border-b border-slate-100 backdrop-blur">
                        {g.day}
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {g.items.map((log: any) => {
                          const cat = activityCategory(log.activityType);
                          const isFail = cat === "fail";
                          const label = ACTIVITY_TYPE_LABELS[log.activityType] || log.activityType;
                          const entityLabel = log.entityType ? (ACTIVITY_ENTITY_LABELS[log.entityType] || log.entityType) : "";
                          const actor = log.user?.name || log.user?.email || "시스템";
                          const time = new Date(log.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
                          return (
                            <li key={log.id} className={`flex items-start gap-3 px-4 py-2.5 ${isFail ? "bg-red-50" : "hover:bg-slate-50/50"}`}>
                              <span className="relative flex-none">
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                  {actorInitials(log.user?.name, log.user?.email)}
                                </span>
                                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${ACT_CAT_DOT[cat]}`} aria-hidden="true" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13px] leading-snug break-keep ${isFail ? "text-red-700" : "text-slate-700"}`}>
                                  <b className="font-semibold">{actor}</b>님이 {entityLabel && (<><b className="font-semibold">{entityLabel}</b> </>)}{label}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                                  {log.beforeStatus && log.afterStatus && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 tabular-nums">
                                      {log.beforeStatus} → {log.afterStatus}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-slate-400 tabular-nums">{time}</span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
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

      {/* §audit-log-enhancement P1 (호영님 2026-07-04) — 신뢰 배지 바(정직 문구).
          ⚠ 근거 없는 "해시 검증됨" 미주장(AuditLog 에 hash chain 필드 없음). append-only·KST·Part11 정합만 사실 주장.
          §11.64 Part11 톤 제거 반전(호영님 신 지시 재도입). 중립 톤(빨강/카테고리색 미사용). */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 print:hidden" data-testid="audit-trust-bar">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
          <Lock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          변조 방지 · 자동 기록
        </span>
        <span className="text-[11px] text-slate-500">수정·삭제 불가 (append-only)</span>
        <span className="text-[11px] text-slate-500">KST 고정 표기</span>
        <span className="text-[11px] text-slate-500">21 CFR Part 11 정합</span>
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

      {/* §audit-log-enhancement P3 — 감사 요약 스트립(4카드). accent 미사용(중립 통일). 실패만 빨강. display-only(dead button 0). */}
      {(() => {
        if (rows.length === 0) return null;
        const total = rows.length;
        const dataChange = rows.filter((r) => r.before && r.after).length;
        const access = rows.filter((r) => /login|permission|role|access|member|auth|권한|접근|로그인|열람/i.test(`${r.action} ${r.entityType} ${r.reason}`)).length;
        const fails = rows.filter((r) => r.reason.startsWith("[실패]")).length;
        const cards = [
          { label: "총 이벤트", value: total, danger: false },
          { label: "데이터 변경", value: dataChange, danger: false },
          { label: "권한·접근", value: access, danger: false },
          { label: "실패 이벤트", value: fails, danger: fails > 0 },
        ];
        return (
          <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2 print:hidden" data-testid="audit-summary">
            {cards.map((c) => (
              <div key={c.label} className={`rounded-lg border px-3.5 py-2.5 ${c.danger ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className={`text-xl font-extrabold tabular-nums leading-tight ${c.danger ? "text-red-700" : "text-slate-900"}`}>{c.value.toLocaleString("ko-KR")}</p>
              </div>
            ))}
          </div>
        );
      })()}

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

      {/* §audit-log-enhancement P3b — 날짜 네비게이터 + 카테고리 칩(하루 단위, 목업 정합) */}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex flex-col gap-2 print:hidden" data-testid="audit-day-nav">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="이전 날짜"
              onClick={() => { const n = auditDayList[auditDayIdx + 1]; if (n) setAuditDay(n); }}
              disabled={auditDayIdx >= auditDayList.length - 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 text-center px-1">
              <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">{effectiveDay || "—"}</span>
              <span className="ml-1.5 text-xs text-slate-400">· {auditDayRows.length}건</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="다음 날짜"
              onClick={() => { const p = auditDayList[auditDayIdx - 1]; if (p) setAuditDay(p); }}
              disabled={auditDayIdx <= 0}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setAuditDay(todayYmd)} disabled={effectiveDay === todayYmd}>
              오늘
            </Button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap" data-testid="audit-cat-chips">
            {AUDIT_CAT_CHIPS.map((c) => (
              <button key={c.id} type="button" onClick={() => setAuditCat(c.id)}
                className={`rounded-full px-2.5 h-7 text-[11px] font-semibold border transition-colors ${
                  auditCat === c.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : c.id === "fail"
                    ? "bg-white text-red-600 border-red-200 hover:bg-red-50"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
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
        ) : shownRows.length === 0 ? (
          <div className="py-12 text-center" data-testid="audit-day-empty">
            <FileText className="h-7 w-7 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 mb-1">이 조건에 기록이 없습니다.</p>
            <p className="text-[11px] text-slate-400 break-keep">선택한 날짜·카테고리에 해당하는 감사 기록이 없습니다.</p>
          </div>
        ) : (
          <div data-testid="audit-timeline">
            {shownRows.map((log) => {
              const auth = AUTH_LABEL[log.authMethod];
              const hasChange = log.before && log.after;
              const onlyAfter = !log.before && log.after;
              const isExpanded = expandedId === log.id;
              const isFail = log.reason.startsWith("[실패]");
              const isSystem = log.authMethod === "system";
              return (
                <div key={log.id} className={`border-b border-slate-100 last:border-0 ${isFail ? "bg-red-50" : ""}`}>
                  <div
                    className={`flex items-start gap-4 px-4 py-3 cursor-pointer print:cursor-auto ${isFail ? "" : "hover:bg-slate-50/50"}`}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    aria-expanded={isExpanded}
                    data-testid="audit-row"
                  >
                    <div className="flex-none w-12 text-right pt-0.5">
                      <div className="font-mono text-[13px] font-semibold text-slate-900 tabular-nums leading-none">{log.hm}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">KST</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={ACTION_TONE[log.actionTone]}>{log.action}</Badge>
                          <span className="text-[13px] font-semibold text-slate-900 break-keep">{log.target}</span>
                        </div>
                        <div className="flex-none flex items-center gap-1.5 text-[11px] text-slate-400 whitespace-nowrap">
                          {isSystem && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">시스템 자동</span>}
                          <span>{log.user}{log.ip ? ` · ${log.ip}` : ""}</span>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {hasChange && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] tabular-nums">
                            <span className="text-slate-500 break-keep">{log.before}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-bold text-slate-900 break-keep">{log.after}</span>
                          </span>
                        )}
                        {onlyAfter && <span className="text-[11px] text-slate-500 italic break-keep">{log.after}</span>}
                        {log.reason && <span className={`text-[12px] break-keep ${isFail ? "font-medium text-red-700" : "text-slate-500"}`}>{log.reason}</span>}
                      </div>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 mt-1 flex-none text-slate-300 transition-transform print:hidden ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-16 print:pl-4" data-testid="audit-row-detail">
                      <div className="border-l-2 border-slate-300 pl-4">
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
                        {(log.changesRaw || log.metadataRaw) && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                            {log.changesRaw && (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">changes (raw)</p>
                                <pre className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{log.changesRaw}</pre>
                              </div>
                            )}
                            {log.metadataRaw && (
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">metadata (raw)</p>
                                <pre className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{log.metadataRaw}</pre>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Lock className="h-3 w-3" />
                          감사 추적 레코드는 추가 전용(append-only)으로 보존되며 수정·삭제되지 않습니다.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

