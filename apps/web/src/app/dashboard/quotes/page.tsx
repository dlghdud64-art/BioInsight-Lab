﻿﻿"use client";

export const dynamic = 'force-dynamic';

import { csrfFetch } from "@/lib/api-client";
import { MobileOperationalBriefSheet } from "@/components/operational-brief/mobile-bottom-sheet";
import { OperationalBriefFloatingEntry } from "@/components/operational-brief/floating-entry";
// §11.258-sweep-2 — 모바일 좌측 하단 ✨ 진입 (방안 1 위치 분리).
import { MobileBriefInlineButton } from "@/components/operational-brief/mobile-inline-button";
import { MetricCell } from "@/components/operational-brief/metric-cell";
import { invalidateBriefNarrative, useOperationalBriefNarrative } from "@/lib/hooks/use-operational-brief";
import { useOperationalBriefPopup } from "@/components/operational-brief/popup-context";
import { useDebounce } from "@/hooks/use-debounce";
import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserPreferences } from "@/lib/preferences/user-preferences";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Package, CheckCircle2, Clock, AlertCircle, Send, FileCheck2, ArrowRight, Plus, RefreshCw, AlertTriangle, Sparkles, X, ExternalLink, FileText as FileTextIcon, Loader2, Upload, ChevronDown, ChevronUp, ChevronsRight, ChevronsLeft, Settings2, GripVertical, MoreHorizontal } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { RelativeTimeText } from "@/components/ui/relative-time-text";
import { RelativeDeliveryText } from "@/components/quotes/relative-delivery-text";
import { NoSSR } from "@/components/ui/no-ssr";
import { VendorRequestModal } from "@/components/quotes/dispatch/vendor-dispatch-workbench";
import { resolveSuppliers, buildDraftMessage } from "@/components/quotes/dispatch/resolve-suppliers";
// #quote-rationale-inventory-context Phase 2 — 인과관계 helper + inventory match.
// #operational-brief-emoji-sweep — 새 structured helper (case + tone + icon).
import {
  buildBriefRationale,
  buildBriefRationaleSummary,
  findMostUrgentInventoryForQuote,
  type InventoryRow,
  type BriefRationaleTone,
} from "@/lib/operational-brief/build-rationale";

/**
 * #operational-brief-emoji-sweep — tone → 컬러 도트 className 매핑.
 *   호영님 redesign Phase B-1: 이모지 prefix 제거 후 메시지 옆 컬러 도트로
 *   시각 위계. tone 별 bg-{color}-500 (slate/amber/blue/emerald/red).
 */
function rationaleToneDotClass(tone: BriefRationaleTone): string {
  switch (tone) {
    case "slate": return "bg-slate-400";
    case "amber": return "bg-amber-500";
    case "blue": return "bg-blue-500";
    case "emerald": return "bg-emerald-500";
    case "red": return "bg-red-500";
  }
}
import { BatchActionBar } from "@/components/quotes/dispatch/batch-action-bar";
import { BatchDispatchSheet } from "@/components/quotes/dispatch/batch-dispatch-sheet";
// §11.228 #quote-management-v2-phase-c1 — 호영님 v2 #20 일괄 처리 강화.
import { BatchReminderSheet } from "@/components/quotes/dispatch/batch-reminder-sheet";
import { BatchStatusChangeSheet } from "@/components/quotes/dispatch/batch-status-change-sheet";
import Link from "next/link";
import { usePermission } from "@/hooks/use-permission";
import { useOntologyContextBridge } from "@/hooks/use-ontology-context-bridge";
import { PermissionGate } from "@/components/permission-gate";
import { OpsExecutionContext } from "@/components/ops/ops-execution-context";
import { CenterWorkWindow } from "@/components/work-window/center-work-window";
import { AiQuoteParseModal } from "@/components/quotes/ai-quote-parse-modal";
import { QuoteIntakeDock } from "@/components/quotes/intake/quote-intake-dock";

type QuoteStatus = "PENDING" | "SENT" | "RESPONDED" | "COMPLETED" | "CANCELLED";

interface Quote {
  id: string;
  title: string;
  status: QuoteStatus;
  createdAt: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  items: Array<{ id: string; product: { id: string; name: string }; quantity: number }>;
  responses?: Array<{ id: string; vendor: { name: string }; totalPrice?: number; createdAt: string }>;
  // §11.264j — vendorRequests (invited 공급사 리스트 + 회신 상태).
  //   API /api/quotes 가 이미 fetch 중 (route.ts:479-487) — caller type 만 확장.
  //   §11.248e mobile context sheet body 에서 공급사별 회신 현황 렌더에 사용.
  //   status: SENT (미회신) / RESPONDED (회신 완료) / EXPIRED (만료).
  vendorRequests?: Array<{
    id: string;
    status: "SENT" | "RESPONDED" | "EXPIRED";
    vendorName: string;
    vendorEmail?: string | null;
    createdAt: string;
    respondedAt?: string | null;
  }>;
  // §11.218 카드 구분자 — sub-context 표시용 (요청자 / 부서).
  user?: { id: string; name: string | null; email: string | null } | null;
  organization?: { id: string; name: string } | null;
}

// ── 운영 상태 파생 ──────────────────────────────────────────
function isDelayed(q: Quote): boolean {
  if (!q.deliveryDate) return false;
  if (q.status === "COMPLETED" || q.status === "CANCELLED") return false;
  return new Date(q.deliveryDate) < new Date();
}

// §11.242 #3 — 호영님 P0 spec: 5색 status 뱃지 + 좌측 컬러 도트.
//   회신 대기 (amber) / 요청 발송 전 (red) / 요청 발송 완 (blue) / 비교 검토 (purple) / 발주 전환 가능 (green).
//   bg-{color}-100 + text-{color}-800 + border-{color}-300 + dotColor (bg-{color}-500).
const OP_STATUS: Record<string, { label: string; bg: string; text: string; border: string; leftBorder: string; dotColor: string }> = {
  지연:           { label: "지연",            bg: "bg-red-100",    text: "text-red-800",     border: "border-red-300",     leftBorder: "border-l-red-500",     dotColor: "bg-red-500" },
  비교_검토:      { label: "비교 검토 필요",  bg: "bg-purple-100", text: "text-purple-800",  border: "border-purple-300",  leftBorder: "border-l-purple-500",  dotColor: "bg-purple-500" },
  일부_회신:      { label: "일부 회신 도착",  bg: "bg-blue-100",   text: "text-blue-800",    border: "border-blue-300",    leftBorder: "border-l-blue-500",    dotColor: "bg-blue-500" },
  회신_대기:      { label: "회신 대기 중",    bg: "bg-amber-100",  text: "text-amber-800",   border: "border-amber-300",   leftBorder: "border-l-amber-500",   dotColor: "bg-amber-500" },
  요청_접수:      { label: "요청 발송 전",    bg: "bg-red-100",    text: "text-red-800",     border: "border-red-300",     leftBorder: "border-l-red-400",     dotColor: "bg-red-500" },
  발주_완료:      { label: "발주 전환 가능",  bg: "bg-emerald-100",text: "text-emerald-800", border: "border-emerald-300", leftBorder: "border-l-emerald-500", dotColor: "bg-emerald-500" },
  취소됨:         { label: "취소됨",          bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-300",   leftBorder: "border-l-slate-300",   dotColor: "bg-slate-400" },
};

function getOpStatus(q: Quote) {
  if (isDelayed(q)) return OP_STATUS.지연;
  switch (q.status) {
    case "RESPONDED": return OP_STATUS.비교_검토;
    case "SENT":
      return (q.responses?.length ?? 0) > 0 ? OP_STATUS.일부_회신 : OP_STATUS.회신_대기;
    case "PENDING":   return OP_STATUS.요청_접수;
    case "COMPLETED": return OP_STATUS.발주_완료;
    case "CANCELLED": return OP_STATUS.취소됨;
    default:          return OP_STATUS.요청_접수;
  }
}

// ── 운영 우선순위 (triage 기준) ──
function getOpPriority(q: Quote): number {
  if (isDelayed(q)) return 0;
  // 오늘 마감
  if (q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString()) return 1;
  const map: Record<QuoteStatus, number> = {
    RESPONDED: 2, SENT: 3, PENDING: 4, COMPLETED: 6, CANCELLED: 7,
  };
  // 일부 회신 도착 = 비교 가능
  if (q.status === "SENT" && (q.responses?.length ?? 0) > 0) return 2;
  return map[q.status] ?? 9;
}

// ── Canonical State Enum ──
type RailState = "request_not_sent" | "awaiting_responses" | "response_delayed" | "compare_not_ready" | "compare_review_required" | "condition_check_required" | "external_approval_required" | "ready_for_po_conversion";

function deriveRailState(q: Quote): RailState {
  const rc = q.responses?.length ?? 0;
  if (q.status === "COMPLETED") return "ready_for_po_conversion";
  if (q.status === "RESPONDED") return rc >= 2 ? "compare_review_required" : "compare_not_ready";
  if (q.status === "SENT") {
    if (rc === 0) return isDelayed(q) ? "response_delayed" : "awaiting_responses";
    return rc >= 2 ? "compare_review_required" : "compare_not_ready";
  }
  return "request_not_sent";
}

// ── 상태별 exact 매핑 테이블 ──
type WorkWindowKey = "request_send" | "followup_send" | "compare_review" | "approval_prep" | "po_conversion" | null;

const RAIL_STATE_MAP: Record<RailState, {
  badge: string; headerSummary: string; urgency: string;
  status: string; blocker: string; nextAction: string; compareReady: string; poReady: string;
  snapshotNote: string; handoffTarget: string; handoffStatus: string;
  aiRecommendation: string;
  ctaLabel: string; railCtaLabel: string; ctaVariant: "default" | "outline"; secondaryCta: string; tertiaryCta: string;
  actionKey: WorkWindowKey;
}> = {
  request_not_sent: {
    badge: "요청 발송 전", headerSummary: "아직 공급사에 견적 요청이 발송되지 않았습니다", urgency: "첫 액션이 필요합니다",
    status: "요청 생성 완료", blocker: "공급사 미전송", nextAction: "견적 요청 발송", compareReady: "불가 · 수신 견적 없음", poReady: "불가 · 비교 전 단계",
    snapshotNote: "견적 요청이 아직 발송되지 않아 수신 견적이 없습니다",
    handoffTarget: "견적 요청 발송 흐름", handoffStatus: "아직 다음 단계 이동 전",
    aiRecommendation: "AI 추천: 현재는 비교나 검토보다 견적 요청 발송이 우선입니다",
    ctaLabel: "견적 요청 발송", railCtaLabel: "견적 요청 발송", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "request_send",
  },
  awaiting_responses: {
    badge: "회신 대기", headerSummary: "공급사 회신을 기다리는 중입니다 — 새 회신이 도착하면 비교 검토로 넘어갑니다", urgency: "새 회신 도착 여부 확인이 필요합니다",
    status: "회신 수집 중", blocker: "응답 대기 공급사 존재", nextAction: "새 회신 확인", compareReady: "불가 · 응답 대기", poReady: "불가 · 회신 수집 단계",
    snapshotNote: "현재 회신 수를 기준으로 비교 가능 여부가 달라질 수 있습니다",
    handoffTarget: "회신 수집 유지", handoffStatus: "유효 견적 확보 후 비교 검토",
    aiRecommendation: "AI 추천: 회신 수집이 끝날 때까지 비교 확정보다 응답 추적이 더 중요합니다",
    ctaLabel: "새 회신 보기", railCtaLabel: "회신 검토 시작", ctaVariant: "outline", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "compare_review",
  },
  response_delayed: {
    badge: "회신 지연", headerSummary: "기대 응답 시점을 넘긴 공급사가 있습니다", urgency: "오늘 재요청 여부 판단이 필요합니다",
    status: "회신 지연", blocker: "기대 응답 기한 경과", nextAction: "재요청 보내기", compareReady: "불안정 · 추가 회신 필요", poReady: "불가 · 응답 확보 전",
    snapshotNote: "회신 지연 공급사를 정리하지 않으면 비교 일정이 밀릴 수 있습니다",
    handoffTarget: "재요청 / 공급사 재확인", handoffStatus: "회신 확보 전 비교 보류",
    aiRecommendation: "AI 추천: 기존 거래 이력이 있다면 신규 탐색보다 재요청이 우선일 수 있습니다",
    ctaLabel: "재요청 보내기", railCtaLabel: "재요청 검토 시작", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "followup_send",
  },
  compare_not_ready: {
    badge: "비교 준비 부족", headerSummary: "비교에 필요한 유효 견적 수가 부족합니다", urgency: "추가 회신 확보가 우선입니다",
    status: "비교 준비 부족", blocker: "유효 견적 수 부족", nextAction: "추가 공급사 회신 확보", compareReady: "불가 또는 제한적", poReady: "불가 · 선택안 없음",
    snapshotNote: "유효 견적 수가 부족해 비교 후보가 아직 안정적으로 만들어지지 않았습니다",
    handoffTarget: "추가 회신 확보", handoffStatus: "비교 준비 중",
    aiRecommendation: "AI 추천: 유효 견적 수를 먼저 확보해야 비교 결과의 신뢰도가 올라갑니다",
    ctaLabel: "추가 회신 확보", railCtaLabel: "추가 확보 검토", ctaVariant: "outline", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "followup_send",
  },
  compare_review_required: {
    badge: "비교 검토 필요", headerSummary: "비교는 가능하지만 선택안 확정이 남아 있습니다", urgency: "비교 검토 후 다음 단계로 넘길 수 있습니다",
    status: "비교 검토 가능", blocker: "선택안 미확정", nextAction: "비교 결과 정리", compareReady: "가능", poReady: "조건부 · 선택안 확정 필요",
    snapshotNote: "비교는 가능하지만 선택안 확정과 예외 정리가 남아 있습니다",
    handoffTarget: "비교 검토 확정", handoffStatus: "선택안 확정 필요",
    aiRecommendation: "AI 추천: 현재는 추가 수집보다 비교 결과 정리와 선택안 확정이 우선입니다",
    ctaLabel: "비교 결과 정리", railCtaLabel: "비교 검토 시작", ctaVariant: "default", secondaryCta: "비교 열기", tertiaryCta: "닫기",
    actionKey: "compare_review",
  },
  condition_check_required: {
    badge: "조건 확인 필요", headerSummary: "문서 또는 조건 이슈가 남아 있어 확정이 불가합니다", urgency: "확인 완료 전에는 다음 단계 진행이 제한됩니다",
    status: "확정 전 조건 확인", blocker: "SDS/CoA/MOQ/납기 조건 확인 필요", nextAction: "조건 확인", compareReady: "가능", poReady: "불가 · 조건 해소 전",
    snapshotNote: "비교 결과는 있으나 문서 또는 조건 확인 전에는 확정할 수 없습니다",
    handoffTarget: "조건 확인 / 문서 정리", handoffStatus: "해소 후 발주 실행 검토 가능",
    aiRecommendation: "AI 추천: 문서나 조건 이슈를 해소하면 바로 다음 단계로 넘길 수 있습니다",
    ctaLabel: "조건 확인", railCtaLabel: "조건 검토 시작", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "compare_review",
  },
  external_approval_required: {
    badge: "외부 승인 대기", headerSummary: "외부 승인 결과 확인 후 발주 실행으로 이어집니다", urgency: "외부 승인 확인 전에는 발주 실행 불가",
    status: "외부 승인 확인 대기", blocker: "외부 승인 미확인", nextAction: "승인 증빙 연결", compareReady: "완료", poReady: "불가 · 승인 확인 필요",
    snapshotNote: "선택안은 정리되었고 외부 승인 결과만 연결되면 다음 단계로 이동할 수 있습니다",
    handoffTarget: "승인 증빙 연결", handoffStatus: "외부 승인 확인 후 발주 실행",
    aiRecommendation: "AI 추천: 외부 승인 결과를 연결하면 발주 실행으로 바로 이어질 수 있습니다",
    ctaLabel: "승인 증빙 연결", railCtaLabel: "승인 검토 시작", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "보류",
    actionKey: "approval_prep",
  },
  ready_for_po_conversion: {
    badge: "전환 가능", headerSummary: "차단 없이 발주 전환 준비가 가능한 상태입니다", urgency: "지금 전환하면 다음 처리로 바로 이어집니다",
    status: "실행 준비 완료", blocker: "차단 없음", nextAction: "발주 실행 준비", compareReady: "완료", poReady: "가능",
    snapshotNote: "현재 케이스는 비교와 확인 단계를 통과해 발주 실행 준비가 가능합니다",
    handoffTarget: "발주 실행 워크벤치", handoffStatus: "즉시 실행 가능",
    aiRecommendation: "AI 추천: 현재 케이스는 추가 검토보다 발주 실행 준비를 우선해도 됩니다",
    ctaLabel: "발주 실행 준비", railCtaLabel: "발주 실행 검토", ctaVariant: "default", secondaryCta: "전체 상세 열기", tertiaryCta: "닫기",
    actionKey: "po_conversion",
  },
};

// §11.226 #quote-management-v2-phase-a — 호영님 v2 P0 #2 spec.
//   테이블 뷰 한정 CTA 텍스트 축약 — 좁은 cell 폭에서 잘림 차단.
//   카드 뷰는 원본 ctaLabel 유지 (시각 면적 충분).
//   "12자 이내" 축약 룰 정합 (호영님 v2 spec sheet 디자인 원칙 9).
// §11.264j — 공급사별 회신 현황 (§11.248e mobile context sheet body) 에서 사용.
//   ISO date 기준 "N일 경과" 텍스트 렌더링. SSR 시 placeholder 출력 →
//   client mount 후 setText 으로 실제 일수 계산. §11.214 hydration 안전 패턴
//   (RelativeTimeText 동일 mount-after-set 전략).
function ElapsedDaysText({ iso }: { iso: string }): JSX.Element {
  const [text, setText] = useState<string>("·일 경과");
  useEffect(() => {
    const sentAt = new Date(iso).getTime();
    if (Number.isNaN(sentAt)) {
      setText("·일 경과");
      return;
    }
    const days = Math.max(0, Math.floor((Date.now() - sentAt) / 86400000));
    setText(`${days}일 경과`);
  }, [iso]);
  return <span>{text}</span>;
}

//   매핑 외 label 은 원본 그대로 통과 (graceful fallback).
function shortenActionLabel(ctaLabel: string): string {
  const TABLE_ACTION_LABEL_SHORTCUTS: Record<string, string> = {
    "견적 요청 발송": "발송",
    "새 회신 보기": "회신 확인",
    "재요청 보내기": "재요청",
    "추가 회신 확보": "추가 회신",
    "비교 결과 정리": "비교 정리",
    "조건 확인": "조건 확인",
    "승인 증빙 연결": "승인 연결",
    "발주 실행 준비": "발주 준비",
  };
  return TABLE_ACTION_LABEL_SHORTCUTS[ctaLabel] ?? ctaLabel;
}

// ── §11.230b #quote-table-column-prefs — 호영님 v2 #23 (a+b) ──
//   테이블 9 컬럼 사용자 선호 (폭 / 보임 / 순서) localStorage persist.
//   호영님 분할 결정 (2026-05-12): §11.230a (c+d, a11y+tooltip) → §11.230b (a+b 일괄).
//   canonical truth 보호: §11.226 #4 priceColumnHasData / deliveryColumnHasData 우선
//   (visibility false 라도 hasData true 시 노출). sortedQuotes / sortState / focusedRowIndex
//   변경 0 — UI preference layer 만 추가.
// §11.239 — Next.js page.tsx 는 default export 외 named export 가 OmitWithTag
//   index signature constraint 를 깬다 (PageProps never 강제). 본 module 안에서만
//   사용되는 상수/타입은 `export` 키워드 제거. grep sentinel 기반 test 는 source
//   text 매칭이므로 import path 변경 없음.
type ColumnKey =
  | "title"
  | "status"
  | "itemCount"
  | "responseCount"
  | "price"
  | "delivery"
  | "priority"
  | "createdAt"
  | "actions";

interface ColumnPrefs {
  widths: Record<ColumnKey, number>;
  visibility: Record<ColumnKey, boolean>;
  order: ColumnKey[];
}

const DEFAULT_COLUMN_PREFS: ColumnPrefs = {
  widths: {
    title: 280,
    status: 100,
    itemCount: 80,
    responseCount: 120,
    price: 140,
    delivery: 120,
    priority: 80,
    createdAt: 120,
    actions: 120,
  },
  visibility: {
    title: true,
    status: true,
    itemCount: true,
    responseCount: true,
    price: true,
    delivery: true,
    priority: true,
    createdAt: true,
    actions: true,
  },
  order: ["title", "status", "itemCount", "responseCount", "price", "delivery", "priority", "createdAt", "actions"],
};

const COLUMN_LABEL: Record<ColumnKey, string> = {
  title: "제목",
  status: "상태",
  itemCount: "품목",
  responseCount: "회신",
  price: "가격",
  delivery: "납기",
  priority: "우선순위",
  createdAt: "등록",
  actions: "액션",
};

// localStorage key
const COLUMN_PREFS_LS_KEY = "labaxis-quote-column-prefs";

// §11.248e-2 #quote-briefing-collapse-toggle — 1200px+ Briefing 패널 접힘/펼침 영구화 key.
const BRIEFING_COLLAPSED_LS_KEY = "labaxis-briefing-collapsed";

// 컬럼 폭 guard (px)
const COLUMN_MIN_WIDTH = 60;
const COLUMN_MAX_WIDTH = 500;

// ── 운영 신호 파생 (canonical state 기반) ──
function getOpSignals(q: Quote) {
  const railState = deriveRailState(q);
  const m = RAIL_STATE_MAP[railState];
  const responseCount = q.responses?.length ?? 0;

  let readinessStage = 0;
  if (q.status === "SENT") readinessStage = 1;
  if (q.status === "SENT" && responseCount > 0) readinessStage = 2;
  if (q.status === "RESPONDED") readinessStage = 3;
  if (q.status === "COMPLETED") readinessStage = 4;

  return {
    railState,
    blocker: m.blocker,
    nextAction: m.nextAction,
    summary: m.headerSummary,
    ctaLabel: m.ctaLabel,
    railCtaLabel: m.railCtaLabel,
    ctaVariant: m.ctaVariant,
    readinessStage,
    aiRecommendation: m.aiRecommendation,
    // Rail-specific fields
    badge: m.badge,
    urgency: m.urgency,
    status: m.status,
    compareReady: m.compareReady,
    poReady: m.poReady,
    snapshotNote: m.snapshotNote,
    handoffTarget: m.handoffTarget,
    handoffStatus: m.handoffStatus,
    secondaryCta: m.secondaryCta,
    tertiaryCta: m.tertiaryCta,
    actionKey: m.actionKey,
  };
}

type QuoteDispatchPreflight = {
  hardBlocked: boolean;
  summary: string;
  blockers: string[];
};

type QuoteDispatchEvidence = {
  supplierStatus: string;
  contactStatus: string;
  previewStatus: string;
  sendStatus: string;
  blockReason: string;
  canSend: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// #user-supplier-registration Phase 5 — organizationVendors optional param.
//   resolveSuppliers 의 org_book source 정합 — operator 직접 등록한 거래처
//   가 있으면 preflight 의 includedSuppliers 에 자동 포함.
// §11.225 #quote-dispatch-preflight-org-vendor-products-arg — P0 hot fix.
//   organizationVendorProducts 인자 추가. line 293 resolveSuppliers 호출이
//   3 변수를 받아야 하는데 함수 시그니처가 2 인자만이라 module-scope 함수가
//   QuotesPageContent 안 useMemo (line 843) closure 시도 → runtime
//   ReferenceError. caller 3 spot (single / bulk / BatchSheet) 도 forward.
function getQuoteDispatchPreflight(
  q: Quote | null,
  organizationVendors: Array<{
    id: string;
    vendorName: string;
    vendorEmail: string;
    vendorPhone?: string | null;
    isPrimary?: boolean;
    notes?: string | null;
  }> = [],
  organizationVendorProducts: Array<{
    vendorId: string;
    productId: string;
  }> = [],
): QuoteDispatchPreflight {
  if (!q) {
    return {
      hardBlocked: true,
      summary: "견적을 먼저 선택해야 합니다.",
      blockers: ["견적 선택 없음"],
    };
  }

  const suppliers = resolveSuppliers({ quote: q, organizationVendors, organizationVendorProducts });
  const includedSuppliers = suppliers.filter((supplier) => supplier.included);
  const invalidContacts = includedSuppliers.filter((supplier) => !EMAIL_PATTERN.test(supplier.email));
  const blockers: string[] = [];

  if (!q.id) blockers.push("견적 연결 없음");
  if (includedSuppliers.length === 0) blockers.push("연락 가능한 공급사 후보 없음");
  if (invalidContacts.length > 0) blockers.push(`연락 채널 확인 필요 ${invalidContacts.length}건`);

  return {
    hardBlocked: blockers.length > 0,
    blockers,
    summary: blockers.length > 0
      ? blockers.join(" · ")
      : `${includedSuppliers.length}개 공급사 후보 전달 가능`,
  };
}

function getQuoteDispatchEvidence(preflight: QuoteDispatchPreflight | null): QuoteDispatchEvidence {
  if (!preflight) {
    return {
      supplierStatus: "공급사 선택 필요",
      contactStatus: "연락처 필요",
      previewStatus: "미리보기 대기",
      sendStatus: "전송 차단",
      blockReason: "견적 선택 필요",
      canSend: false,
    };
  }

  const supplierMissing = preflight.blockers.some((blocker) => blocker.includes("공급사 후보 없음"));
  const contactMissing = preflight.blockers.some((blocker) => blocker.includes("연락 채널 확인 필요"));
  const quoteMissing = preflight.blockers.some((blocker) => blocker.includes("견적 선택 없음") || blocker.includes("견적 연결 없음"));
  const canSend = !preflight.hardBlocked && !supplierMissing && !contactMissing && !quoteMissing;
  const blockReason = quoteMissing
    ? "견적 선택 필요"
    : supplierMissing
      ? "공급사 선택 필요"
      : contactMissing
        ? "연락처 필요"
        : canSend
          ? "전송 가능"
          : preflight.summary;

  return {
    supplierStatus: supplierMissing || quoteMissing ? "공급사 선택 필요" : "공급사 1개 이상 선택됨",
    contactStatus: contactMissing || quoteMissing ? "연락처 필요" : "유효 연락처 확인됨",
    previewStatus: canSend ? "메시지 미리보기 준비" : "미리보기 대기",
    sendStatus: canSend ? "전송 확인 대기" : "전송 차단",
    blockReason,
    canSend,
  };
}

const READINESS_LABELS = ["요청 생성", "회신 수집", "비교 검토", "전환 준비", "완료"];

// ── 견적 카드 (운영형 density) ──
// §11.217 Phase 3 — batch dispatch selection props.
//   isSelectable: PENDING (request_not_sent) state quote 만 true.
//   isSelectedForBatch: selectedQuoteIds.has(quote.id) 결과.
//   onToggleSelect: page-level toggleQuoteSelection handler.
// §11.230c (e) #quote-card-keyboard-nav — 호영님 v2 #23 sub-spec (e) 잔여 백로그.
//   카드 뷰 unified index (urgent + inProgress + completed 합산) + Home/End 4 키.
//   §11.230c (c) 테이블 패턴 reuse — outer wrapper 에 data-card-index + tabIndex=0
//   부여 + page 안 keyboard handler. card 시그니처 변경 0 (cardIndex optional prop 추가).
function QuoteCard({
  quote,
  isSelected,
  onSelect,
  isSelectable,
  isSelectedForBatch,
  onToggleSelect,
  cardIndex,
}: {
  quote: Quote;
  isSelected?: boolean;
  /**
   * §11.264e — onSelect 시그니처에 ctaLabel 전달.
   *   parent (QuotesPageContent) 가 ctaLabel === "새 회신 보기" 일 때 vendor
   *   section 으로 auto-scroll. 다른 CTA (발송/조건/승인/...) 는 기존 동작.
   *   기존 caller (row click) 는 ctaLabel 없이 호출 (undefined) — 변경 0.
   */
  onSelect?: (ctaLabel?: string) => void;
  isSelectable?: boolean;
  isSelectedForBatch?: boolean;
  onToggleSelect?: () => void;
  /** §11.230c (e) — unified index for keyboard nav (urgent + inProgress + completed). */
  cardIndex?: number;
}) {
  const opStatus = getOpStatus(quote);
  const signals = getOpSignals(quote);
  const itemCount = quote.items.length;
  // §11.264g — 카드 2단계 접힘/펼침 (호영님 spec 견적 모바일 #2 P1).
  //   모바일 한정 default collapsed (요약 = 운영 신호 + 제목 + 본문 + CTA).
  //   확장 시 progress + readiness + 공급사 timeline 노출. 데스크탑 (md+)
  //   변경 0 — wrapper className 의 `hidden md:block` 으로 mutex.
  const [isExpanded, setIsExpanded] = useState(false);
  const responseCount = quote.responses?.length ?? 0;
  const prices = (quote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  // §11.223 #quote-card-batch3-price-delivery — 호영님 spec #4: 가격 범위 +
  //   회신 수 통합 ("₩{min} ~ ₩{max} ({n}건 수신)"). minPrice === maxPrice 시
  //   단일 값. prices.length === 0 시 "회신 N건 (가격 미기재)".
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const delayed = isDelayed(quote);
  const quoteRef = `#${quote.id.slice(0, 8).toUpperCase()}`;
  // §11.212 — daysSinceCreated 인라인 계산 제거 (SSR-CSR Date.now() drift 차단).
  // <RelativeTimeText iso={quote.createdAt} /> 가 useEffect mount 후 set.

  // §11.217 Phase 1 (Issue 1) — 카드 제목 정보 밀도 복구.
  // 기존: quote.title ("견적 요청 — N개 품목" generic) → 사용자가 카드 식별 불가.
  // 신규: 첫 품목명 + 추가 건수. snapshot path (productId null, item.name 보존)
  //       및 canonical path (item.product.name) 양쪽 fallback.
  const firstItem = quote.items[0];
  const firstItemName =
    firstItem?.product?.name ??
    (firstItem as { name?: string | null } | undefined)?.name ??
    null;
  const moreCount = Math.max(0, itemCount - 1);
  const displayTitle = firstItemName
    ? moreCount > 0
      ? `${firstItemName} 외 ${moreCount}건`
      : firstItemName
    : quote.title;

  return (
    <div
      data-testid="quote-request-card"
      data-card-index={cardIndex}
      tabIndex={0}
      className={`bg-pn rounded-xl border border-l-[3px] transition-all duration-200 p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 animate-stagger-up focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${opStatus.leftBorder} ${
        isSelectedForBatch ? "border-violet-500/60 ring-1 ring-violet-500/30 bg-violet-50/40"
        : isSelected ? "border-blue-600/40 ring-1 ring-blue-600/20 bg-blue-600/5"
        : delayed ? "border-red-600/30"
        : "border-bd/80 hover:border-bd"
      }`}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        // §11.230c (e) #quote-card-keyboard-nav — Home/End/PageUp/PageDown 4 키.
        //   §11.230c (c) 테이블 패턴 reuse. unified index (urgent + inProgress + completed).
        //   sortedQuotes.length 계산 어려우니 DOM query 으로 모든 card 수집 후 분기.
        if (typeof window === "undefined") return;
        if (e.key === "Home" || e.key === "End" || e.key === "PageUp" || e.key === "PageDown") {
          e.preventDefault();
          const allCards = document.querySelectorAll<HTMLElement>("[data-card-index]");
          if (allCards.length === 0) return;
          const lastIndex = allCards.length - 1;
          const currentIndex = cardIndex ?? 0;
          let nextIndex = currentIndex;
          if (e.key === "Home") nextIndex = 0;
          else if (e.key === "End") nextIndex = lastIndex;
          else if (e.key === "PageUp") nextIndex = Math.max(0, currentIndex - 5);
          else if (e.key === "PageDown") nextIndex = Math.min(lastIndex, currentIndex + 5);
          const target = allCards[nextIndex];
          if (target) target.focus();
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
    >
      {/* §11.217 Phase 3 — batch dispatch checkbox (PENDING quote 만 노출) */}
      {isSelectable && (
        <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!isSelectedForBatch}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer"
            aria-label={`${displayTitle} 일괄 발송 선택`}
          />
          <span className="sr-only">일괄 발송 선택</span>
          {isSelectedForBatch && (
            <span className="text-[11px] text-violet-700 font-medium">선택됨</span>
          )}
        </div>
      )}

      {/* 운영 신호 3종 — 최상단 */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border ${opStatus.bg} ${opStatus.text} ${opStatus.border}`}>
          {(quote.status === "SENT" || quote.status === "PENDING") && !delayed && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
          {opStatus.label}
        </span>
        {signals.blocker && (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-600/10 text-amber-600 border border-amber-600/20">
            <AlertTriangle className="h-2.5 w-2.5" />{signals.blocker.length > 25 ? signals.blocker.substring(0, 25) + "…" : signals.blocker}
          </span>
        )}
        {/* #quote-card-batch1-density — 호영님 spec #1: 긴급도 뱃지.
            delayed=true (회신 지연) 시 solid red 뱃지 (E2 패턴 mirror —
            bg-rose-500 + text-white). 한눈에 주의 식별. #9 정합 (이모지 →
            컬러 도트 + 텍스트). */}
        {delayed && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold">
            긴급
          </span>
        )}
        <span className="text-[11px] text-slate-500 font-mono ml-auto">{quoteRef}</span>
      </div>

      <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
        <div className="flex-1 min-w-0 w-full">
          {/* 제목 — §11.217 Phase 1 (Issue 1): 첫 품목명 (사용자 식별 가능) */}
          <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate mb-1">{displayTitle}</h3>

          {/* §11.218 카드 구분자 (sub-context disambiguation) — 같은 품목 다른 quote 식별.
              요청자 (quote.user.name) + 부서/조직 (quote.organization.name) 노출.
              둘 다 부재 시 row 0 (no-op render). */}
          {(quote.user?.name || quote.organization?.name) && (
            <p className="text-[11px] text-slate-500 mb-1 truncate">
              {quote.user?.name && (
                <span className="font-medium text-slate-600">{quote.user.name}</span>
              )}
              {quote.user?.name && quote.organization?.name && (
                <span className="mx-1 text-slate-400">·</span>
              )}
              {quote.organization?.name && (
                <span>{quote.organization.name}</span>
              )}
            </p>
          )}

          {/* Decision summary sentence */}
          <p className="text-xs text-slate-400 leading-relaxed mb-1 line-clamp-2">{signals.summary}</p>
          {/* §11.217 Phase 1 (Issue 5) — inline AI 추천 row 4번 반복 제거.
              page-top banner 1회 (별도 단계) 로 통합 예정. */}

          {/* 운영형 메타 — triage 우선 */}
          <div className="flex flex-wrap gap-x-2 sm:gap-x-3 gap-y-1">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Package className="h-3 w-3" />{itemCount}건
            </span>
            {/* §11.223 #quote-card-batch3-price-delivery — 호영님 spec #4:
                회신 + 가격 통합 (수신 상태 / 미수신 상태 명시). 기존 분리된
                회신 element + minPrice element → 1 element 로 통합. */}
            {responseCount === 0 ? (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Send className="h-3 w-3" />견적 미수신
              </span>
            ) : (
              <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1">
                <Send className="h-3 w-3 text-blue-600" />
                {prices.length === 0
                  ? `회신 ${responseCount}건 (가격 미기재)`
                  : minPrice === maxPrice
                    ? `₩${minPrice!.toLocaleString("ko-KR")} (${responseCount}건 수신)`
                    : `₩${minPrice!.toLocaleString("ko-KR")} ~ ₩${maxPrice!.toLocaleString("ko-KR")} (${responseCount}건 수신)`}
              </span>
            )}
            <RelativeTimeText iso={quote.createdAt} className="text-[11px] text-slate-500" />
            {/* §11.223 #quote-card-batch3-price-delivery — 호영님 spec #4:
                납기 절대 날짜 ("2026-05-15") → 상대 일수 ("X일 남음" / "오늘
                마감" / "Y일 지연"). RelativeDeliveryText helper (useEffect
                mount 후 set, §11.212 SSR/CSR drift 차단 패턴 mirror). */}
            {quote.deliveryDate && (
              <RelativeDeliveryText
                iso={quote.deliveryDate}
                className={`text-[11px] flex items-center gap-1 ${delayed ? "text-red-600 font-semibold" : "text-slate-500"}`}
              />
            )}
          </div>
        </div>

        {/* State-aware CTA — 모바일: 가로 전폭, sm+: 오른쪽 세로
            §11.226 #8 — 카드 CTA min-w-[140px] (sm+ 한정). 모바일은 가로 전폭으로
            min-w 의미 없음. nowrap 강제로 텍스트 잘림 차단. */}
        <div className="flex sm:flex-col gap-1.5 flex-shrink-0 w-full sm:w-auto sm:min-w-[140px]" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={signals.ctaVariant}
            className={`h-9 sm:h-7 text-xs flex-1 sm:flex-none sm:w-full sm:min-w-[140px] whitespace-nowrap ${signals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            /* §11.264e — CTA 클릭 시 ctaLabel 을 parent 에 전달 (예: "새 회신 보기").
               parent 가 vendor section auto-scroll 분기 결정. 다른 CTA 는 무시. */
            onClick={(e) => { e.stopPropagation(); onSelect?.(signals.ctaLabel); }}
          >
            {signals.ctaLabel}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
          {/* 다음 액션 힌트 — 모바일에서는 숨김 */}
          <span className="text-[9px] text-slate-500 text-center hidden sm:block">다음: {signals.nextAction}</span>
        </div>
      </div>

      {/* §11.264g — 모바일 한정 토글 버튼 (자세히 보기 / 접기).
          데스크탑 (md+) 영향 0 — 모든 row 항상 표시. */}
      <button
        type="button"
        data-testid="quote-card-expand-toggle"
        aria-expanded={isExpanded}
        onClick={(e) => { e.stopPropagation(); setIsExpanded((prev) => !prev); }}
        className="md:hidden mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-1.5 rounded transition-colors"
      >
        {isExpanded ? "접기" : "자세히 보기"}
        <span aria-hidden="true">{isExpanded ? "↑" : "↓"}</span>
      </button>

      {/* §11.217 Phase 4 — 회신 수집 progress bar.
          quote card 의 readiness strip 직전에 inline 진행률 시각화.
          PENDING hide (회신 의미 없음) — SENT/RESPONDED 만 노출.
          color: 0% slate, partial blue, 완료(N≥M) emerald.
          §11.264g — 모바일 collapsed 시 hidden (확장 시 표시), 데스크탑 always. */}
      {(quote.status === "SENT" || quote.status === "RESPONDED") && itemCount > 0 && (
        <div className={`mt-2.5 flex items-center gap-2 ${isExpanded ? "" : "hidden md:flex"}`} aria-label="회신 수집 진행률">
          <span className="text-[10px] font-medium text-slate-600 shrink-0 tabular-nums">
            회신 {responseCount}/{itemCount}
          </span>
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              role="progressbar"
              aria-valuenow={responseCount}
              aria-valuemin={0}
              aria-valuemax={itemCount}
              aria-label={`회신 ${responseCount}/${itemCount}`}
              className={`h-full rounded-full transition-all ${
                responseCount === 0
                  ? "bg-slate-200"
                  : responseCount >= itemCount
                    ? "bg-emerald-500"
                    : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min(100, (responseCount / itemCount) * 100)}%`,
              }}
            />
          </div>
          {responseCount >= itemCount && (
            <span className="text-[10px] font-medium text-emerald-700 shrink-0">완료</span>
          )}
        </div>
      )}

      {/* Readiness strip
          §11.264g — 모바일 collapsed 시 hidden, 데스크탑 always. */}
      <div className={`mt-3 pt-2.5 border-t border-bd/50 ${isExpanded ? "" : "hidden md:block"}`}>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {READINESS_LABELS.map((label, idx) => {
            const active = idx <= signals.readinessStage;
            const current = idx === signals.readinessStage;
            return (
              <div key={label} className="flex flex-col items-center gap-0.5 sm:gap-1 flex-1 min-w-0">
                <div className={`h-1.5 sm:h-2 w-full rounded-full transition-all ${
                  active
                    ? current ? "bg-blue-500 shadow-sm shadow-blue-200" : "bg-emerald-500/50"
                    : "bg-slate-100"
                }`} />
                {/* #quote-card-batch1-density — 호영님 spec #2: 활성 단계 강조.
                    기존 text-[8/9px] 단일 → current 분기 시 text-sm font-bold
                    (14px) 강조. 호영님 spec "활성 단계 라벨만 14px bold" 정합.
                    나머지 단계는 기존 작은 크기 유지 (시각 위계 보존). */}
                <span className={`leading-tight whitespace-nowrap ${
                  current ? "text-sm font-bold text-blue-700"
                  : active ? "text-[8px] sm:text-[9px] text-emerald-600/60"
                  : "text-[8px] sm:text-[9px] text-slate-300"
                }`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* §11.227 #10c — 공급사 응답 미니 타임라인 (호영님 v2 P1 Phase B).
          "발송 → 대기 → 수신" 3 stage 시각화. canonical truth = quote.status +
          responseCount (별도 vendorRequests 데이터 모델 변경 0).
          stage 분기:
            - stage1 발송: quote.status !== 'PENDING' (SENT 이상)
            - stage2 대기: quote.status === 'SENT' && responseCount === 0 (active amber)
                         responseCount > 0 (done emerald) / PENDING (waiting slate)
            - stage3 수신: responseCount > 0 (done emerald) / 미수신 (waiting slate) */}
      {/* §11.264g — 모바일 collapsed 시 hidden, 데스크탑 always. */}
      <div className={`mt-2.5 pt-2 border-t border-bd/50 ${isExpanded ? "" : "hidden md:block"}`} aria-label="공급사 응답 진행">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="font-medium uppercase tracking-wider">공급사 응답</span>
          {(() => {
            const sent = quote.status !== "PENDING";
            const waiting = quote.status === "SENT" && responseCount === 0;
            const received = responseCount > 0;
            // stage1 발송: sent → emerald / 미발송 → slate
            const stage1Color = sent ? "bg-emerald-500" : "bg-slate-300";
            // stage2 대기: received → emerald (지났음) / waiting → amber (active) / sent === false → slate
            const stage2Color = received ? "bg-emerald-500" : waiting ? "bg-amber-500" : "bg-slate-300";
            // stage3 수신: received → emerald / 미수신 → slate
            const stage3Color = received ? "bg-emerald-500" : "bg-slate-300";
            return (
              <div className="flex items-center gap-1 ml-1">
                <span className={`inline-block w-2 h-2 rounded-full ${stage1Color}`} aria-label={sent ? "발송 완료" : "발송 전"} />
                <span className="text-slate-300">·</span>
                <span className={`inline-block w-2 h-2 rounded-full ${stage2Color}`} aria-label={received ? "응답 수집 완료" : waiting ? "응답 대기 중" : "응답 대기 전"} />
                <span className="text-slate-300">·</span>
                <span className={`inline-block w-2 h-2 rounded-full ${stage3Color}`} aria-label={received ? "수신 완료" : "수신 전"} />
                <span className="ml-1.5 text-slate-500">
                  {sent ? "발송" : "미발송"} → {received ? "수신" : waiting ? "대기" : "대기 전"} → {received ? "완료" : "대기 중"}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 운영 실행 현황 */}
      <OpsExecutionContext entityType="QUOTE" entityId={quote.id} compact className="mt-2.5 pt-2.5 border-t border-bd/50" />
    </div>
  );
}

// ── Operating mode chips ──
// Mode chips — canonical state 기반 operator lens
const RESPONSE_TRACK_STATES = new Set(["request_not_sent", "awaiting_responses", "response_delayed"]);
const BLOCKED_STATES = new Set(["condition_check_required", "external_approval_required", "compare_not_ready"]);
const COMPARE_STATES = new Set(["compare_not_ready", "compare_review_required", "condition_check_required"]);

const MODE_CHIPS = [
  { key: "urgent",      label: "우선 처리",  filter: (q: Quote) => { const s = deriveRailState(q); return s === "response_delayed" || s === "condition_check_required" || s === "external_approval_required" || (q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString()); } },
  { key: "blocked",     label: "차단 있음",  filter: (q: Quote) => BLOCKED_STATES.has(deriveRailState(q)) },
  { key: "today",       label: "오늘 처리",  filter: (q: Quote) => q.deliveryDate && new Date(q.deliveryDate).toDateString() === new Date().toDateString() && q.status !== "COMPLETED" && q.status !== "CANCELLED" },
  { key: "convertible", label: "전환 가능",  filter: (q: Quote) => deriveRailState(q) === "ready_for_po_conversion" },
];

function QuotesPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const pilotProfile = searchParams.get("labaxisPilot") ?? searchParams.get("pilot");
  const isBrowserPilotQuoteDispatch = pilotProfile === "quote-dispatch";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // §11.221 — 운영 브리핑 판단 근거 collapsible (호영님 5월 8일 결론).
  // #operational-brief-3-section-compress (Phase B-2) — state 통합 + scope 확장.
  //   호영님 redesign: 7 섹션 → 3 섹션 (한 줄 요약 + 다음 액션 + 상세 아코디언).
  //   default 접힘 — visible: § 1 narrative + § 2 한 줄 + § 4 다음 조치 + bottom CTA.
  //   collapsed: § 2 4 cell + § 2 cont 회신·비교 + 최근 활동 + § 3 리스크 + AI 판단.
  //   chip click → 자동 setBriefDetailExpanded(true) + scrollIntoView (collapsed 시
  //   anchor 가 mount 되어야 scrollIntoView 작동 — expand 후 scroll).
  const [briefDetailExpanded, setBriefDetailExpanded] = useState(false);
  // backward compat alias — 기존 factsExpanded 사용처 (mobile §11.222 등) 보호.
  const factsExpanded = briefDetailExpanded;
  const setFactsExpanded = setBriefDetailExpanded;
  // §11.217 Phase 5 — chip scroll-spy active highlight.
  //   IntersectionObserver 로 detail panel scroll 시 visible section 의 chip
  //   자동 highlight. chip click 시 scrollIntoView + setActiveChipId 즉시 update.
  const [activeChipId, setActiveChipId] = useState<string | null>("summary");
  // §11.217 Phase 6 — quote list 보기 모드 (카드 ↔ 테이블 toggle).
  //   localStorage "labaxis-quote-view-mode" persist — 사용자 선호 기억.
  //   default "card" (호영님 기존 패턴 정합).
  // §11.227 #9 — 테이블을 default 뷰로 전환 (호영님 v2 Phase B spec).
  //   "실무자는 12건 이상을 한 화면에서 스캔" — 카드는 보조 뷰.
  //   localStorage 우선 (§11.217 Phase 6) 정합 — 처음 1회만 영향.
  const [viewMode, setViewMode] = useState<"card" | "table">("table");

  // §11.227 #9 — 테이블 sort state. column header 클릭 시 sortable.
  //   key = null (initial) → DB 순서 그대로. key 설정 시 sortedQuotes derive.
  const [sortState, setSortState] = useState<{
    key: "title" | "status" | "itemCount" | "responseCount" | "createdAt" | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "desc" });
  const [searchQuery, setSearchQuery] = useState("");
  // §11.246d-1 — 호영님 P0 #11 필터 디바운스 300ms.
  //   input value (searchQuery) 는 즉시 setState (UI 반응 보존) 하되, filteredQuotes
  //   재계산은 debouncedSearchQuery (300ms 후 안정 값) 기반. 연속 keystroke 시
  //   .filter() 매번 호출 부담 ↓ → 큰 quotes list 의 페이지 응답 성능 ↑.
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");
  const [modeChip, setModeChip] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(searchParams.get("selected") ?? null);
  // §11.264i — briefSheetOpen 분리 (호영님 spec P0 견적 모바일 2중 겹침 fix).
  //   기존: §11.155 MobileOperationalBriefSheet 가 selectedQuote 와 단일 truth 공유
  //         → §11.248e mobile context sheet 와 < 1200px viewport 에서 동시 렌더.
  //   신규: briefSheetOpen state 분리. §11.248e header 의 ✦ 버튼으로만 진입.
  //         closeQuoteContextRail 시 setBriefSheetOpen(false) 동기 (orphan 방지).
  const [briefSheetOpen, setBriefSheetOpen] = useState<boolean>(false);
  // §11.264e — "새 회신 보기" CTA → vendor response section auto-scroll
  //   (호영님 spec #3-3 P1). status="SENT" 회신_대기 견적에서 CTA 누르면
  //   sheet 열리고 동시에 공급사별 회신 현황 section 으로 scrollIntoView →
  //   사용자가 회신 정보 즉시 확인. mount 후 useEffect 로 ref scroll + reset.
  const [autoScrollToVendorSection, setAutoScrollToVendorSection] = useState<boolean>(false);
  const vendorResponseSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeWorkWindow, setActiveWorkWindow] = useState<WorkWindowKey>(null);
  const [aiCompareOpen, setAiCompareOpen] = useState(false);
  const [aiCompareLoading, setAiCompareLoading] = useState(false);
  const [aiCompareResult, setAiCompareResult] = useState<{ comparison: Array<{ vendor: string; price: string; leadTime: string; shippingFee: string }>; recommendation: string; negotiationGuide: string } | null>(null);
  const [aiCompareError, setAiCompareError] = useState<string | null>(null);
  const [aiParseModalOpen, setAiParseModalOpen] = useState(false);

  // ── Intake dock state (Smart Sourcing → workqueue 내부 통합) ──
  // §11.55 — manual_upload 분기 제거. backend (`create-from-intake` /
  // `attach-document`) 미구현으로 dead-end UI였음. LabAxis 견적 응답
  // 표준 워크플로우는 Path 1 (vendor token 응답 링크) + Path 2 (SendGrid
  // inbound webhook) 자동 처리이며 manual upload는 사용 시나리오 없음.
  // BOM import 분기만 유지.
  const [intakeDockOpen, setIntakeDockOpen] = useState(false);
  const [intakeDockSource, setIntakeDockSource] = useState<"bom_import" | null>(null);

  // §11.217 Phase 3 — batch dispatch selection state.
  // PENDING (request_not_sent) quote 만 selectable. checkbox click → toggle.
  // refetch / sheet close 시 clearSelection 으로 reset (canonical truth 정합).
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  // §11.228 #quote-management-v2-phase-c1 — 일괄 처리 강화 sheet state.
  // BatchReminderSheet (responseCount === 0 filter) + BatchStatusChangeSheet
  // (PATCH /api/quotes/[id]/status 일괄). BatchDispatchSheet 와 동등한 lifecycle.
  const [batchReminderOpen, setBatchReminderOpen] = useState(false);
  const [batchStatusChangeOpen, setBatchStatusChangeOpen] = useState(false);

  // §11.230a #quote-table-keyboard-tooltip — 호영님 v2 #23 (c+d) 키보드 navigation.
  //   tbody tr 의 keyboard focus index. ArrowUp/Down 으로 인접 row 이동.
  //   Enter 로 openQuoteContextRail / Escape 로 closeQuoteContextRail.
  //   default -1 (no focus) — Tab 진입 시 첫 row 부터 활성화.
  //   canonical truth 변경 0 — UI focus only (selectedQuoteId 와 별개).
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const pendingSortFocusAnchorRef = useRef(false);

  // §11.241 #6b — Shift+클릭 범위 선택용 마지막 선택 row index. -1 = 미선택.
  //   사용자가 Shift+클릭 시 lastSelectedIndex ~ 클릭 row 범위 모두 toggle.
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);

  // §11.230b #quote-table-column-prefs — 호영님 v2 #23 (a+b) 컬럼 prefs.
  //   widths / visibility / order localStorage persist.
  //   §11.226 #4 hasData 우선 — 가격/납기 컬럼은 데이터 있으면 visibility 무시.
  const [columnPrefs, setColumnPrefs] = useState<ColumnPrefs>(DEFAULT_COLUMN_PREFS);
  const [columnPrefsPopoverOpen, setColumnPrefsPopoverOpen] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<ColumnKey | null>(null);
  const [dragColumn, setDragColumn] = useState<ColumnKey | null>(null);

  // §11.230c (e) #quote-card-keyboard-nav — 호영님 v2 #23 sub-spec (e) 잔여 백로그.
  //   카드 뷰 키보드 nav (Home/End/PageUp/PageDown). focused index 는 DOM 의 document.activeElement
  //   으로 tracking — 별도 state 없이 querySelector("[data-card-index]") + element.focus()
  //   으로 충분. minimum-diff (state 폭증 회피).

  // §11.248e-2 #quote-briefing-collapse-toggle — 호영님 P0 §11.248 #5 잔여 백로그.
  //   1200px+ Briefing 패널 접힘/펼침 토글 + localStorage 영구화. <1200px 영향 0.
  //   §11.230c (a)-2 — server-persist 추가 (preferences endpoint reuse).
  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState(false);
  // §11.248e-2 — localStorage hydration (backwards compat, server fallback).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(BRIEFING_COLLAPSED_LS_KEY);
      if (raw === "true") setIsBriefingCollapsed(true);
    } catch {
      // localStorage 차단 환경 graceful fallback (default false)
    }
  }, []);
  // §11.248e-2 — localStorage write on toggle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(BRIEFING_COLLAPSED_LS_KEY, String(isBriefingCollapsed));
    } catch {
      // sandboxed iframe 등에서 localStorage 차단 시 silent skip
    }
  }, [isBriefingCollapsed]);

  // §11.230b hydrate from localStorage (mount only) — backwards compat fallback.
  //   §11.230c (a) server-first 의 fallback chain: server → localStorage → DEFAULT.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(COLUMN_PREFS_LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ColumnPrefs>;
      // graceful: missing field 는 DEFAULT 사용
      setColumnPrefs({
        widths: { ...DEFAULT_COLUMN_PREFS.widths, ...(parsed.widths ?? {}) },
        visibility: { ...DEFAULT_COLUMN_PREFS.visibility, ...(parsed.visibility ?? {}) },
        order: parsed.order && parsed.order.length === DEFAULT_COLUMN_PREFS.order.length
          ? parsed.order
          : DEFAULT_COLUMN_PREFS.order,
      });
    } catch {
      // schema drift / parse error — DEFAULT 유지
    }
  }, []);

  // §11.230c (a) #user-preferences-server-persist — server-first hydration.
  //   useUserPreferences fetch → preferences.columnPrefs.quotes 도착 시 setColumnPrefs.
  //   localStorage hydration 위에 override (server = canonical, localStorage = fallback).
  //   server fetch 실패 시 useUserPreferences hook 안 retry 1 + silent fallback.
  const userPrefs = useUserPreferences();
  useEffect(() => {
    const serverQuotes = userPrefs.preferences?.columnPrefs?.quotes;
    if (!serverQuotes) return;
    setColumnPrefs({
      widths: { ...DEFAULT_COLUMN_PREFS.widths, ...(serverQuotes.widths ?? {}) } as ColumnPrefs["widths"],
      visibility: { ...DEFAULT_COLUMN_PREFS.visibility, ...(serverQuotes.visibility ?? {}) } as ColumnPrefs["visibility"],
      order: (serverQuotes.order && serverQuotes.order.length === DEFAULT_COLUMN_PREFS.order.length
        ? (serverQuotes.order as ColumnKey[])
        : DEFAULT_COLUMN_PREFS.order),
    });
  }, [userPrefs.preferences]);

  // §11.230c (a)-2 #briefing-collapsed-server-persist — server-first hydration.
  //   preferences.briefingCollapsed override localStorage (server canonical).
  //   server null → §11.248e-2 localStorage hydration 그대로 (backwards compat).
  useEffect(() => {
    const serverCollapsed = userPrefs.preferences?.briefingCollapsed;
    if (typeof serverCollapsed !== "boolean") return;
    setIsBriefingCollapsed(serverCollapsed);
  }, [userPrefs.preferences]);

  // §11.230c (a)-2 — debounced server PATCH on isBriefingCollapsed change.
  //   §11.248e-2 localStorage write 와 양립 (3-layer: state + localStorage + server).
  //   debounce 400ms = 마지막 클릭만 server 도달 (rapid toggle 차단).
  useEffect(() => {
    userPrefs.updateBriefingCollapsed(isBriefingCollapsed);
    // userPrefs 는 외부 deps 이지만 hook signature 가 stable 보장 (useCallback X
    // 이지만 react-query setQueryData 가 referential stability 유지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBriefingCollapsed]);

  // §11.230b write on mutation — localStorage immediate.
  //   §11.230c (a) server-first: localStorage + debounced server PATCH 동시.
  //   userPrefs.updateColumnPrefs 안에 setTimeout debounce (400ms) — rapid resize 차단.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(COLUMN_PREFS_LS_KEY, JSON.stringify(columnPrefs));
    } catch {
      // quota / disabled — silent fail
    }
    // §11.230c (a) — debounced server PATCH (mount 시 server hydration 직후
    //   동일값 set 으로 인한 noise 도 debounce 가 차단 — 직전 값과 같으면
    //   서버 PATCH 가 무해, 마지막 PATCH 만 도달).
    userPrefs.updateColumnPrefs({
      widths: columnPrefs.widths,
      visibility: columnPrefs.visibility,
      order: columnPrefs.order,
    });
  }, [columnPrefs, userPrefs]);

  // §11.230b column resize — document-level mousemove/mouseup (drag 안전 종료)
  useEffect(() => {
    if (!resizingColumn) return;
    let startX = 0;
    let startWidth = columnPrefs.widths[resizingColumn] ?? 120;
    let initialized = false;
    const onMouseMove = (e: MouseEvent) => {
      if (!initialized) {
        startX = e.clientX;
        initialized = true;
        return;
      }
      const delta = e.clientX - startX;
      const next = Math.min(COLUMN_MAX_WIDTH, Math.max(COLUMN_MIN_WIDTH, startWidth + delta));
      setColumnPrefs((prev) => ({
        ...prev,
        widths: { ...prev.widths, [resizingColumn]: next },
      }));
    };
    const onMouseUp = () => setResizingColumn(null);
    // first event seeds startX
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingColumn, columnPrefs.widths]);

  const toggleQuoteSelection = useCallback((id: string) => {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedQuoteIds(new Set());
  }, []);

  // URL dock param 감지 (legacy redirect에서 유입)
  useEffect(() => {
    const dockParam = searchParams.get("dock");
    const sourceParam = searchParams.get("source");
    // §11.55 — manual_upload param은 무시 (legacy URL은 BOM 분기만 유효)
    if (dockParam === "intake" && sourceParam === "bom_import") {
      setIntakeDockSource("bom_import");
      setIntakeDockOpen(true);
    }
  }, [searchParams]);
  // ── Ontology Context Layer bridge — 현재 견적 관리 상태를 next-step resolver에 전달 ──
  useOntologyContextBridge({
    currentStage: "quote_management",
    activeWorkWindow: activeWorkWindow ?? null,
    counts: {
      pendingQuotes: 0, // quotes 로딩 전이므로 아래 useMemo로 갱신
    },
  });

  // ── AI 견적서 비교 실행 — quotes 선언 뒤로 이동 (아래 참조) ──

  // ── 견적 발송 성공 후 갱신 ──
  const handleSendSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    if (selectedQuoteId) {
      queryClient.invalidateQueries({ queryKey: ["quote", selectedQuoteId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-requests", selectedQuoteId] });
      // §11.158 cache-bust — vendor request 발송 직후 brief stale (quote_detail + purchase_conversion)
      invalidateBriefNarrative({ quoteId: selectedQuoteId, module: "quote_detail", sourceUpdatedAt: new Date() });
      invalidateBriefNarrative({ quoteId: selectedQuoteId, module: "purchase_conversion", sourceUpdatedAt: new Date() });
    }
    setActiveWorkWindow(null);
  }, [queryClient, selectedQuoteId]);

  // §11.264e — "새 회신 보기" CTA → vendor response section auto-scroll.
  //   selectedQuoteId 가 바뀐 직후 (sheet mount 완료) + autoScroll flag = true 면
  //   vendor section ref 로 scrollIntoView. reset 으로 flag 0 → 다음 CTA 까지
  //   trigger 안 함. requestAnimationFrame 으로 DOM mount 완전 보장.
  useEffect(() => {
    if (!autoScrollToVendorSection) return;
    if (!selectedQuoteId) return;
    const raf = requestAnimationFrame(() => {
      const el = vendorResponseSectionRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setAutoScrollToVendorSection(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [autoScrollToVendorSection, selectedQuoteId]);

  // §11.264e — QuoteCard onSelect handler. ctaLabel === "새 회신 보기" 면
  //   openQuoteContextRail 호출 후 autoScroll flag 설정. 다른 CTA (발송/조건/
  //   승인/...) 또는 row 클릭 (ctaLabel undefined) 은 기존 동작.
  const handleQuoteCardSelect = useCallback((quoteId: string, ctaLabel?: string) => {
    openQuoteContextRail(quoteId, "row");
    if (ctaLabel === "새 회신 보기") {
      setAutoScrollToVendorSection(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── Rail open/close — single source of truth ──
  const openQuoteContextRail = (caseId: string, source: string = "row") => {
    const next = selectedQuoteId === caseId ? null : caseId;
    if (next) {
      setSelectedQuoteId(next);
      // URL query에 selected 반영
      const url = new URL(window.location.href);
      url.searchParams.set("selected", next);
      window.history.replaceState({}, "", url.toString());
    } else {
      closeQuoteContextRail("toggle");
    }
  };

  const closeQuoteContextRail = (source: string = "x_button") => {
    setSelectedQuoteId(null);
    setActiveWorkWindow(null);
    // §11.264i — briefSheetOpen 동기 (orphan state 방지). 견적 자체 닫힐 때
    // 운영 브리핑도 함께 닫힘 — 두 sheet 가 mutually exclusive.
    setBriefSheetOpen(false);
    // URL query 정리 — path 유지, selected/task 제거
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("selected");
      url.searchParams.delete("task");
      window.history.replaceState({}, "", url.toString());
    }
  };

  // ESC로 rail 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") closeQuoteContextRail("esc"); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedQuoteId]);

  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatusFilter(s);
  }, [searchParams]);

  const entityIdParam = searchParams.get("entity_id");
  useEffect(() => {
    if (entityIdParam) {
      const el = document.getElementById("ops-execution-context");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [entityIdParam]);

  // §11.217 Phase 6 — localStorage persist (mount 시 read).
  // §11.259b — 모바일(<768px, max-width: 767px) 진입 + localStorage 미저장 시
  //   viewMode 기본 "card" 분기 (호영님 spec 견적 관리 모바일 #2).
  //   사용자가 명시적으로 table 선택했다면 saved 우선 (canonical truth 보호).
  //   server preferences 도 잡히면 그 값 우선 (line 1155+ §11.230c (a)-3).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("labaxis-quote-view-mode");
      if (saved === "card" || saved === "table") {
        setViewMode(saved);
        return;
      }
      // §11.259b — saved 없을 때만 모바일 매체쿼리 분기 적용.
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        setViewMode("card");
      }
    } catch {
      // localStorage unavailable (SSR / private mode) — fallback to "card".
    }
  }, []);

  // §11.217 Phase 6 — localStorage persist (viewMode change 시 write).
  useEffect(() => {
    try {
      window.localStorage.setItem("labaxis-quote-view-mode", viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // §11.230c (a)-3 #quotes-view-server-persist — server-first hydration.
  //   preferences.quotesView 도착 시 setViewMode + setSortState (server canonical).
  //   §11.217 localStorage hydration 위 override (server 우선).
  useEffect(() => {
    const view = userPrefs.preferences?.quotesView;
    if (!view) return;
    if (view.mode === "card" || view.mode === "table") {
      setViewMode(view.mode);
    }
    if (view.sort) {
      const validKeys = [
        "title",
        "status",
        "itemCount",
        "responseCount",
        "createdAt",
      ] as const;
      const k = view.sort.key;
      const validKey =
        k === null || (typeof k === "string" && (validKeys as readonly string[]).includes(k))
          ? (k as typeof validKeys[number] | null)
          : null;
      const validDir = view.sort.direction === "asc" || view.sort.direction === "desc"
        ? view.sort.direction
        : "desc";
      setSortState({ key: validKey, direction: validDir });
    }
  }, [userPrefs.preferences]);

  // §11.230c (a)-3 — debounced server PATCH on viewMode/sortState change.
  //   §11.217 localStorage (viewMode 만) 와 양립 — 두 layer 모두 update.
  //   sortState 는 localStorage 0 → server-only.
  useEffect(() => {
    userPrefs.updateQuotesView({
      mode: viewMode,
      sort: { key: sortState.key, direction: sortState.direction },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, sortState]);

  // §11.230c (a)-4 #quotes-filter-server-persist — server-first hydration.
  //   우선순위: URL search param > server preferences > default.
  //   URL param 이미 있으면 useState initial value 가 URL 우선 적용됨 (line 851).
  //   URL param 없을 때만 server 값 적용 — searchParams.get("status") null 체크.
  useEffect(() => {
    const filter = userPrefs.preferences?.quotesFilter;
    if (!filter) return;
    const urlStatus = searchParams.get("status");
    if (!urlStatus && typeof filter.status === "string") {
      setStatusFilter(filter.status);
    }
    if (filter.modeChip !== undefined) {
      setModeChip(filter.modeChip);
    }
  }, [userPrefs.preferences, searchParams]);

  // §11.230c (a)-4 — debounced server PATCH on statusFilter/modeChip change.
  //   localStorage 0 → server-only persistence. searchQuery 는 ad-hoc 제외.
  useEffect(() => {
    userPrefs.updateQuotesFilter({
      status: statusFilter,
      modeChip: modeChip,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, modeChip]);

  // §11.226 #3 — 테이블 뷰 진입 시 popup 자동 close.
  //   호영님 v2 spec sheet P0 #3: "테이블 뷰에서는 브리핑 패널을 기본 닫힘
  //   상태로 전환 + 행 클릭 시 브리핑이 오버레이 드로어로 열림".
  //   본 batch 는 자동 close 만 land — 행 클릭 자동 open 은 Phase B park
  //   (§11.220d popup overlay model 회귀 위험 회피).
  //   §11.142 lock 정합: popup-context spec 변경 0, close() 호출만.
  // §11.226b hot fix — viewMode 가 이미 'table' 인 fresh load (localStorage
  //   persist) 시 사용자가 popup 새로 open 해도 close() 호출 안 되던 회귀
  //   차단. briefIsOpen dep 추가로 popup open 변경 시점마다 viewMode 'table'
  //   분기 trigger. open() 호출 → render → useEffect → close() 즉시.
  const { isOpen: briefIsOpen, close: closeOperationalBrief } = useOperationalBriefPopup();
  useEffect(() => {
    if (viewMode === "table" && briefIsOpen) {
      closeOperationalBrief();
    }
  }, [viewMode, briefIsOpen, closeOperationalBrief]);

  // §11.217 Phase 5 — chip scroll-spy. detail panel 의 4 brief section
  //   (brief-summary / brief-facts / brief-facts2 / brief-next) 을 IntersectionObserver
  //   로 감시 → 가장 위에 visible 한 section 의 chip 을 active 로 highlight.
  //   selectedQuoteId 가 set 된 후 mount 됨 (panel 안 element 가 DOM 에 있어야 attach).
  useEffect(() => {
    if (!selectedQuoteId) return;
    // detail panel 이 DOM 에 mount 될 때까지 microtask defer.
    let observer: IntersectionObserver | null = null;
    const attach = () => {
      // §11.231 — type predicate fix: id type 정확히 narrow.
      const sectionIds = ["summary", "facts", "facts2", "next"] as const;
      type SectionId = typeof sectionIds[number];
      const elements = sectionIds
        .map((id) => ({ id, el: document.getElementById(`brief-${id}`) }))
        .filter((x): x is { id: SectionId; el: HTMLElement } => x.el !== null);
      if (elements.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            );
          if (visible.length > 0) {
            const targetId = visible[0].target.id.replace("brief-", "");
            setActiveChipId(targetId);
          }
        },
        { rootMargin: "-20% 0px -50% 0px", threshold: 0 },
      );
      elements.forEach(({ el }) => observer?.observe(el));
    };
    // 다음 frame 에서 attach (panel 의 brief sections 가 mount 된 후).
    const raf = requestAnimationFrame(attach);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [selectedQuoteId]);

  const { data: quotesData, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["quotes", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all" && statusFilter !== "DEADLINE_TODAY") params.append("status", statusFilter);
      const response = await fetch(`/api/quotes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 15_000, // 15초 short cache — 재방문 시 즉시 표시
    placeholderData: (prev) => prev, // 필터 변경 시 기존 데이터 유지
    refetchOnWindowFocus: true,
  });

  // #user-supplier-registration Phase 5 — 조직 거래처 (org_book source) fetch.
  //   resolveSuppliers / preflight / batch sheet 모두 정합 forward.
  //   organization 미가입 user 또는 거래처 0건 → 빈 array (graceful).
  const { data: organizationVendorsData } = useQuery({
    queryKey: ["organization-vendors"],
    queryFn: async () => {
      const response = await fetch("/api/organization-vendors", { credentials: "include" });
      if (!response.ok) return { vendors: [] };
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
  const organizationVendors: Array<{
    id: string;
    vendorName: string;
    vendorEmail: string;
    vendorPhone?: string | null;
    isPrimary?: boolean;
    notes?: string | null;
  }> = useMemo(() => organizationVendorsData?.vendors ?? [], [organizationVendorsData]);

  // #vendor-catalog-product-matching Phase 3 — vendor-product carry 매핑 fetch.
  //   resolveSuppliers 에 forward → product 매칭 시 vendor confidence boost.
  //   미등록 시 빈 array fallback (backward compat).
  const { data: organizationVendorProductsData } = useQuery({
    queryKey: ["organization-vendor-products"],
    queryFn: async () => {
      const response = await fetch("/api/organization-vendor-products", {
        credentials: "include",
      });
      if (!response.ok) return { entries: [] };
      return response.json();
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
  const organizationVendorProducts: Array<{
    vendorId: string;
    productId: string;
  }> = useMemo(
    () =>
      (organizationVendorProductsData?.entries ?? []).map(
        (e: { vendorId: string; productId: string }) => ({
          vendorId: e.vendorId,
          productId: e.productId,
        }),
      ),
    [organizationVendorProductsData],
  );

  // #quote-rationale-inventory-context Phase 2 — 재고 데이터 fetch.
  //   인과관계 한 줄에 "재고 X일 남음 / 예상 수령일 +Y일" tail append.
  //   호영님 5/8 결론의 "킬러 피처" — inventory 0건 시 graceful fallback (tail X).
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const response = await fetch("/api/inventory", { credentials: "include" });
      if (!response.ok) return { inventories: [] as InventoryRow[] };
      return response.json() as Promise<{ inventories: InventoryRow[] }>;
    },
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
  const inventories: InventoryRow[] = useMemo(
    () => inventoryData?.inventories ?? [],
    [inventoryData],
  );

  // 필터 변경 중 indicator (기존 list 유지하면서 상단에만 표시)
  const isFilterChanging = isFetching && !isLoading;

  const quotes: Quote[] = useMemo(() => {
    const baseQuotes: Quote[] = quotesData?.quotes || [];
    if (!isBrowserPilotQuoteDispatch) return baseQuotes;

    const hasPending = baseQuotes.some((quote) => quote.status === "PENDING");
    if (hasPending) return baseQuotes;

    const pilotQuote: Quote = {
      id: "pilot-quote-dispatch",
      title: "Pilot PBS Buffer 견적 요청",
      status: "PENDING",
      createdAt: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryLocation: "LabAxis Pilot Lab",
      items: [
        {
          id: "pilot-quote-item",
          product: { id: "pilot-pbs-buffer", name: "PBS Buffer 10x, 500ml" },
          quantity: 2,
        },
      ],
      responses: [],
    };

    return [pilotQuote, ...baseQuotes];
  }, [quotesData?.quotes, isBrowserPilotQuoteDispatch]);

  // ── AI 견적서 비교 실행 ──
  const runAiQuoteCompare = useCallback(async () => {
    if (!quotes || quotes.length === 0) return;
    setAiCompareLoading(true);
    setAiCompareError(null);
    setAiCompareResult(null);
    setAiCompareOpen(true);
    try {
      const quotePayload = quotes
        .filter((q: Quote) => q.status !== "CANCELLED")
        .slice(0, 5)
        .map((q: Quote) => ({
          vendor: (q.items?.[0]?.product as Record<string, unknown>)?.brand as string || q.items?.[0]?.product?.name || "미지정 공급사",
          items: q.items?.map((item) => `${item.product?.name || "품목"} x${item.quantity || 1}`).join(", ") || q.title,
          rawText: `${q.title} — ${q.items?.length || 0}건 품목`,
        }));
      const res = await csrfFetch("/api/ai/quote-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotes: quotePayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 비교 분석 실패");
      setAiCompareResult(data.data);
    } catch (err: unknown) {
      setAiCompareError(err instanceof Error ? err.message : "AI 비교 분석 중 오류 발생");
    } finally {
      setAiCompareLoading(false);
    }
  }, [quotes]);

  const today = new Date().toDateString();
  const selectedQuote = selectedQuoteId ? quotes.find(q => q.id === selectedQuoteId) : null;
  const selectedSignals = selectedQuote ? getOpSignals(selectedQuote) : null;
  const selectedDispatchPreflight = useMemo(
    () => selectedQuote && selectedSignals?.actionKey === "request_send"
      ? getQuoteDispatchPreflight(selectedQuote, organizationVendors, organizationVendorProducts)
      : null,
    [selectedQuote, selectedSignals?.actionKey, organizationVendors, organizationVendorProducts],
  );
  const selectedDispatchEvidence = useMemo(
    () => selectedSignals?.actionKey === "request_send"
      ? getQuoteDispatchEvidence(selectedDispatchPreflight)
      : null,
    [selectedDispatchPreflight, selectedSignals?.actionKey],
  );
  const selectedDispatchBlocked = selectedDispatchEvidence ? !selectedDispatchEvidence.canSend : false;

  const openQuoteDraftWorkbench = useCallback(() => {
    const targetQuote = selectedQuote
      ?? quotes.find((quote) => deriveRailState(quote) === "request_not_sent")
      ?? quotes.find((quote) => quote.status !== "COMPLETED" && quote.status !== "CANCELLED")
      ?? quotes[0];

    if (!targetQuote) {
      toast({
        title: "견적 요청 초안을 만들 수 없습니다",
        description: "먼저 비교 후보나 견적 요청 대상을 등록하세요.",
      });
      return;
    }

    setSelectedQuoteId(targetQuote.id);
    setActiveWorkWindow("request_send");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("selected", targetQuote.id);
      url.searchParams.set("task", "request_send");
      window.history.replaceState({}, "", url.toString());
    }
  }, [quotes, selectedQuote, toast]);

  // §11.181 — handleFloatingEntryClick 제거: FAB default 가 popup 호출.

  // §11.161 — 운영 브리핑 narrative hook (selectedQuote 선언 후 호출)
  const { narrative: briefNarrative, cached: briefCached } = useOperationalBriefNarrative({
    sourceTrace: {
      quoteId: selectedQuote?.id ?? "",
      module: "quote_detail",
      sourceUpdatedAt: selectedQuote?.createdAt ?? new Date(0),
    },
    facts: {
      status: selectedSignals?.status ?? null,
      blocker: selectedSignals?.blocker ?? null,
      nextAction: selectedSignals?.nextAction ?? null,
    },
    enabled: !!selectedQuote?.id,
  });
  const selectedOpStatus = selectedQuote ? getOpStatus(selectedQuote) : null;

  // 운영 요약 — canonical state 기반 집계 (row/rail과 같은 selector 사용)
  const quotesWithState = useMemo(() => quotes.map(q => ({ quote: q, state: deriveRailState(q) })), [quotes]);
  const summaryStats = useMemo(() => {
    // §11.217 Phase 2 (Issue 2) — "회신 추적 필요" 의미 분리.
    // 기존: request_not_sent + awaiting_responses + response_delayed 모두 합산 →
    //       "회신 추적 필요" label 이 "미발송" 케이스까지 포함 = 의미 mismatch.
    // 신규: dispatchPending (미발송) + responseTracking (회신 대기/지연) 으로
    //       2-bucket 분리. 각 bucket 별 filter 도 분리.
    const dispatchPending = quotesWithState.filter(({ state }) => state === "request_not_sent");
    const tracking = quotesWithState.filter(({ state }) => state === "awaiting_responses" || state === "response_delayed");
    const delayedCount = tracking.filter(({ state }) => state === "response_delayed").length;
    const review = quotesWithState.filter(({ state }) => COMPARE_STATES.has(state));
    const condCount = review.filter(({ state }) => state === "condition_check_required").length;
    const approval = quotesWithState.filter(({ state }) => state === "external_approval_required" || state === "condition_check_required");
    const convertible = quotesWithState.filter(({ state }) => state === "ready_for_po_conversion");
    return {
      dispatchPending: {
        count: dispatchPending.length,
        insight: dispatchPending.length > 0
          ? "공급사 견적 요청 발송 우선 — 첫 액션 필요"
          : "미발송 케이스 없음",
      },
      responseTracking: {
        count: tracking.length,
        insight: tracking.length > 0
          ? (delayedCount > 0 ? `${delayedCount}건 회신 지연 — 오늘 재요청 판단 필요` : "응답 수집 중 — 비교 가능 여부 대기")
          : "회신 추적 대상 없음",
      },
      compareReview: {
        count: review.length,
        insight: review.length > 0
          ? (condCount > 0 ? `${condCount}건 조건 확인 필요 — 선택안 확정 전` : "선택안 확정 또는 비교 준비 단계")
          : "검토 대상 없음",
      },
      approvalException: {
        count: approval.length,
        insight: approval.length > 0
          ? "승인 패키지 준비 또는 조건 해소 필요"
          : "승인/예외 처리 대상 없음",
      },
      readyToConvert: {
        count: convertible.length,
        insight: convertible.length > 0
          ? "차단 없이 PO 전환 준비 가능"
          : "전환 대상 없음 — 비교/조건 정리 먼저",
      },
    };
  }, [quotesWithState]);

  const primaryDispatchQuote = useMemo(
    () =>
      selectedQuote
      ?? quotesWithState.find(({ state }) => state === "request_not_sent")?.quote
      ?? quotes.find((quote) => quote.status !== "COMPLETED" && quote.status !== "CANCELLED")
      ?? quotes[0]
      ?? null,
    [selectedQuote, quotesWithState, quotes],
  );
  const primaryDispatchPreflight = useMemo(
    () => getQuoteDispatchPreflight(primaryDispatchQuote, organizationVendors, organizationVendorProducts),
    [primaryDispatchQuote, organizationVendors, organizationVendorProducts],
  );
  const primaryDispatchEvidence = useMemo(
    () => getQuoteDispatchEvidence(primaryDispatchPreflight),
    [primaryDispatchPreflight],
  );
  const primaryDispatchBadges = useMemo(
    () => [
      {
        label: "supplier",
        value: primaryDispatchEvidence.supplierStatus,
        tone: primaryDispatchEvidence.supplierStatus.includes("선택 필요") ? "red" : "green",
      },
      {
        label: "contact",
        value: primaryDispatchEvidence.contactStatus,
        tone: primaryDispatchEvidence.contactStatus.includes("필요") ? "amber" : "green",
      },
      {
        label: "preview",
        value: primaryDispatchEvidence.previewStatus,
        tone: primaryDispatchEvidence.previewStatus.includes("대기") ? "slate" : "blue",
      },
    ],
    [primaryDispatchEvidence],
  );

  // 필터링 + 운영 우선순위 정렬
  // §11.246d-1 — searchQuery → debouncedSearchQuery (300ms) 으로 filter 입력.
  //   input UI 즉시 반응 + .filter() 호출은 300ms delay 후 안정 값 기반.
  const filteredQuotes = useMemo(() => {
    let result = quotes
      .filter(quote => {
        if (!debouncedSearchQuery) return true;
        const q = debouncedSearchQuery.toLowerCase();
        return quote.title.toLowerCase().includes(q) || quote.id.toLowerCase().includes(q) || quote.items.some(item => item.product.name.toLowerCase().includes(q));
      })
      .filter(quote => {
        if (statusFilter === "all") return true;
        if (statusFilter === "DEADLINE_TODAY") return quote.deliveryDate && new Date(quote.deliveryDate).toDateString() === today && quote.status !== "COMPLETED" && quote.status !== "CANCELLED";
        return quote.status === statusFilter;
      });

    // Mode chip 필터
    if (modeChip) {
      const chip = MODE_CHIPS.find(c => c.key === modeChip);
      if (chip) result = result.filter(chip.filter);
    }

    return result.sort((a, b) => getOpPriority(a) - getOpPriority(b));
  }, [quotes, debouncedSearchQuery, statusFilter, modeChip, today]);

  // §11.227 #9 — 테이블 sortedQuotes (sortState 가 set 됐을 때 column 별 정렬).
  //   sortState.key === null 시 filteredQuotes 그대로 (default priority order).
  //   key 별 사람-친화 비교: title (한국어 localeCompare), status/createdAt/itemCount/responseCount
  //   모두 stable sort + ascending 또는 descending.
  const sortedQuotes = useMemo(() => {
    if (sortState.key === null) return filteredQuotes;
    const sorted = [...filteredQuotes].sort((a, b) => {
      let cmp = 0;
      if (sortState.key === "title") {
        cmp = (a.title || "").localeCompare(b.title || "", "ko");
      } else if (sortState.key === "status") {
        cmp = (a.status || "").localeCompare(b.status || "");
      } else if (sortState.key === "itemCount") {
        cmp = (a.items?.length ?? 0) - (b.items?.length ?? 0);
      } else if (sortState.key === "responseCount") {
        cmp = (a.responses?.length ?? 0) - (b.responses?.length ?? 0);
      } else if (sortState.key === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortState.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredQuotes, sortState]);

  const focusQuoteTableRow = useCallback((rowIndex: number) => {
    if (typeof document === "undefined" || rowIndex < 0) return;
    window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLTableRowElement>(
        `tr[data-row-index="${rowIndex}"]`,
      );
      row?.focus();
    });
  }, []);

  // §11.230c (d) #quote-table-focus-reset — sortedQuotes change 시 focus anchor.
  //   Sort/filter 이후 포커스를 비우지 않고 직전 선택 quote 또는 첫 행으로 재지정한다.
  //   Keyboard 이동/Enter 상세 확인이 다음 1회 조작으로 이어지게 하는 UI focus only 보정.
  useEffect(() => {
    if (sortedQuotes.length === 0) {
      pendingSortFocusAnchorRef.current = false;
      setFocusedRowIndex(-1);
      return;
    }

    const selectedIndex = selectedQuoteId
      ? sortedQuotes.findIndex((quote) => quote.id === selectedQuoteId)
      : -1;
    const nextFocusIndex = selectedIndex >= 0 ? selectedIndex : 0;

    if (pendingSortFocusAnchorRef.current || focusedRowIndex >= sortedQuotes.length) {
      pendingSortFocusAnchorRef.current = false;
      setFocusedRowIndex(nextFocusIndex);
      focusQuoteTableRow(nextFocusIndex);
    }
  }, [sortedQuotes, selectedQuoteId, focusedRowIndex, focusQuoteTableRow]);

  // §11.241 #6c — Ctrl/Cmd + A 전체 선택 document-level keydown listener.
  //   viewMode === "table" 일 때만 활성. input/textarea/contentEditable focus 시
  //   native a 입력 보호 (e.target tag 검사). 호영님 P1 키보드 접근성 spec 정합.
  //   필터 연동 (§11.241 #5) — sortedQuotes 가 filteredQuotes 기반이므로 자동 정합.
  useEffect(() => {
    const handleSelectAll = (e: KeyboardEvent) => {
      if (viewMode !== "table") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== "a" && e.key !== "A") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return; // native a 보호
      }
      e.preventDefault();
      const allIds = new Set(sortedQuotes.map((q) => q.id));
      setSelectedQuoteIds(allIds);
    };
    document.addEventListener("keydown", handleSelectAll);
    return () => document.removeEventListener("keydown", handleSelectAll);
  }, [viewMode, sortedQuotes]);

  // §11.227 #9 — column header 클릭 시 sort 전환. 같은 컬럼 재클릭 시 direction toggle.
  const handleSortColumn = useCallback(
    (key: "title" | "status" | "itemCount" | "responseCount" | "createdAt") => {
      pendingSortFocusAnchorRef.current = true;
      setSortState((prev) => {
        if (prev.key === key) {
          return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
        }
        return { key, direction: "asc" };
      });
    },
    [],
  );


  // 섹션 분류
  const urgentQuotes = filteredQuotes.filter(q => q.status === "RESPONDED" || (q.status === "SENT" && (q.responses?.length ?? 0) > 0) || isDelayed(q));
  const inProgressQuotes = filteredQuotes.filter(q => !urgentQuotes.includes(q) && q.status !== "COMPLETED" && q.status !== "CANCELLED");
  const completedQuotes = filteredQuotes.filter(q => q.status === "COMPLETED" || q.status === "CANCELLED");

  // §11.217 Phase 1B (Issue 5) — AI 추천 page-top banner 1회.
  // 기존: card 마다 inline AI 추천 row 반복 (4번) → 정보 노이즈.
  // 신규: page header 직후 1줄 banner — priority highest = urgentQuotes[0]
  //       → inProgressQuotes[0] fallback. 없으면 banner 0 (no-op).
  // canonical truth: getOpSignals 의 aiRecommendation 그대로 사용 (rail map
  // 의 single source).
  const priorityQuoteForBanner = urgentQuotes[0] ?? inProgressQuotes[0] ?? null;
  const priorityAiRecommendation = priorityQuoteForBanner
    ? getOpSignals(priorityQuoteForBanner).aiRecommendation
    : null;

  // §11.217 Phase 3 — batch dispatch preflight 합산.
  // selectedQuotes = selectedQuoteIds 에서 실제 quote object 복원 (filteredQuotes 안).
  // dispatchableCount = preflight 통과한 quote 수, hardBlockCount = 차단된 quote 수.
  // canonical truth = getQuoteDispatchPreflight (page-level helper) 그대로 사용.
  const selectedQuotes = useMemo(
    () => filteredQuotes.filter((q) => selectedQuoteIds.has(q.id)),
    [filteredQuotes, selectedQuoteIds],
  );
  const { dispatchableCount, hardBlockCount } = useMemo(() => {
    let dispatchable = 0;
    let hardBlock = 0;
    for (const q of selectedQuotes) {
      const preflight = getQuoteDispatchPreflight(q, organizationVendors, organizationVendorProducts);
      if (preflight.hardBlocked) hardBlock += 1;
      else dispatchable += 1;
    }
    return { dispatchableCount: dispatchable, hardBlockCount: hardBlock };
  }, [selectedQuotes, organizationVendors, organizationVendorProducts]);

  // §11.228 #quote-management-v2-phase-c1 — 리마인더 대상 수 합산.
  //   responseCount === 0 quote 만 리마인더 대상. server-side resolve 가 truth,
  //   client preview 만 client-side filter — 일괄 처리 강화 (#20) lineage.
  const reminderEligibleCount = useMemo(() => {
    let count = 0;
    for (const q of selectedQuotes) {
      if ((q.responses?.length ?? 0) === 0) count += 1;
    }
    return count;
  }, [selectedQuotes]);

  // §11.240 #quote-batch-selection-p0 — 호영님 P0: row checkbox + dropdown + guardrail.
  //   P0 4 항목: (1) row+thead checkbox 3-state / (2) batch bar dropdown + 개별 X /
  //   (3) 상태 혼재 가드레일 (응답 없는 quote 포함 시 검토 시작 disabled) / (4) invariant
  //   §11.228 BatchActionBar + selectedQuoteIds Set 위 확장.
  // 호영님 P0 상태 혼재 가드레일: 응답 없는 quote 포함 시 "검토 시작" disabled.
  //   "검토 시작" 의 (compare review) 의미 = 응답을 비교하여 발주 진입 — 응답 없는 quote
  //   포함 시 검토할 데이터 없음 → disabled. 기존 dispatchableCount === 0 disabled 와 OR
  //   처리 (BatchActionBar 내부).
  const reviewDisabled = useMemo(
    () => selectedQuotes.some((q) => (q.responses?.length ?? 0) === 0),
    [selectedQuotes],
  );

  // §11.226 #4 — 빈 컬럼 자동 hide (가격 / 납기).
  //   호영님 v2 spec sheet P0 #4: "컬럼 내 전체 행이 '—' 또는 null 이면 해당
  //   컬럼 자동 숨김. 1건이라도 데이터가 있으면 컬럼 표시." filteredQuotes 전체
  //   scan 으로 데이터 존재 여부 derive — useMemo 비용 negligible (100건 기준).
  //   §11.142 lock 정합: canonical truth (quote.responses[].totalPrice / quote.deliveryDate)
  //   변경 0. 표시만 hide.
  const priceColumnHasData = useMemo(
    () =>
      filteredQuotes.some((q) =>
        (q.responses ?? []).some(
          (r) => typeof r.totalPrice === "number" && r.totalPrice > 0,
        ),
      ),
    [filteredQuotes],
  );
  const deliveryColumnHasData = useMemo(
    () => filteredQuotes.some((q) => Boolean(q.deliveryDate)),
    [filteredQuotes],
  );

  // §11.230b — 컬럼 visibility filter (§11.226 #4 hasData 우선 — 가격/납기 컬럼은
  //   데이터 있으면 사용자 visibility false 라도 노출. canonical truth 보호).
  //   columnPrefs.order 기반 + visibility 분기. 9 컬럼 모두 노출 가능 키.
  const visibleColumns = useMemo<ColumnKey[]>(() => {
    return columnPrefs.order.filter((key) => {
      if (key === "price") return priceColumnHasData;
      if (key === "delivery") return deliveryColumnHasData;
      return columnPrefs.visibility[key];
    });
  }, [columnPrefs.order, columnPrefs.visibility, priceColumnHasData, deliveryColumnHasData]);

  return (
    <div className="p-4 md:p-8 pt-4 md:pt-6 space-y-5 max-w-7xl mx-auto w-full">

      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">견적 관리</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 hidden sm:block">처리가 필요한 견적 케이스를 우선순위 순으로 확인합니다.</p>
        </div>
        {/* §11.248b #quote-header-actions-responsive — 호영님 P0 상단 액션 버튼 반응형.
            - flex-wrap (lg:flex-nowrap): ≤1024px 2행 줄바꿈 허용 (호영님 spec).
            - 모바일 (<md) 더보기 ⋯ DropdownMenu 분리 (견적서 비교 + 초안 항목 접기).
            - 각 버튼 min-w-[80px]~min-w-[120px] 로 텍스트 잘림 방지. */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap lg:flex-nowrap">
          {/* 견적서 파싱 버튼 — 모바일 + tablet + desktop 모두 노출 (주요 액션) */}
          <button
            onClick={() => setAiParseModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors active:scale-95 shrink-0 min-w-[80px] sm:min-w-[120px]"
          >
            <Upload className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            <span className="hidden sm:inline">견적서 파싱</span><span className="sm:hidden">파싱</span>
          </button>
          {/* 견적서 비교 버튼 — md+ 노출 (모바일은 더보기 드롭다운에서) */}
          <button
            onClick={runAiQuoteCompare}
            disabled={aiCompareLoading || !quotes || quotes.length < 2}
            className="hidden md:inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0 min-w-[120px]"
          >
            {aiCompareLoading ? (
              <Loader2 className="h-3.5 sm:h-4 w-3.5 sm:w-4 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
            )}
            견적서 비교
          </button>
          {/* 견적 요청 초안 만들기 — md+ 노출 (모바일은 더보기 드롭다운에서) */}
          <Button
            type="button"
            data-testid="quote-draft-workbench-cta"
            size="sm"
            variant="outline"
            className="h-9 text-sm hidden md:flex min-w-[140px]"
            onClick={openQuoteDraftWorkbench}
            disabled={isLoading || quotes.length === 0}
          >
            <FileTextIcon className="h-4 w-4 mr-1.5" />
            견적 요청 초안 만들기
          </Button>
          {/* §11.248b — 모바일 더보기 ⋯ 드롭다운 (md 미만 한정).
              견적서 비교 + 초안 만들기 항목을 접어서 모바일 화면 vertical space 확보. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-2 md:hidden min-w-[40px]"
                aria-label="더보기 액션"
                data-testid="quote-header-more-actions-mobile"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 !bg-white">
              <DropdownMenuItem
                className="cursor-pointer gap-2 py-2.5"
                disabled={aiCompareLoading || !quotes || quotes.length < 2}
                onClick={runAiQuoteCompare}
              >
                {aiCompareLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                견적서 비교
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 py-2.5"
                disabled={isLoading || quotes.length === 0}
                onClick={openQuoteDraftWorkbench}
              >
                <FileTextIcon className="h-4 w-4" />
                견적 요청 초안 만들기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionGate permission="quotes.create">
            <div className="flex items-center gap-0 flex-shrink-0 snap-start">
              <Link href="/app/search">
                <Button size="sm" className="h-9 text-xs sm:text-sm gap-1.5 bg-blue-600 hover:bg-blue-700 rounded-r-none border-r border-blue-500/40">
                  <Plus className="h-4 w-4" /><span className="hidden sm:inline">새 견적 요청</span><span className="sm:hidden">새 요청</span>
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 px-2 bg-blue-600 hover:bg-blue-700 rounded-l-none">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 !bg-white">
                  {/* §11.55 — "외부 견적서 업로드" 메뉴 제거: backend 미구현 dead-end였음. */}
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 py-2.5"
                    onClick={() => { setIntakeDockSource("bom_import"); setIntakeDockOpen(true); }}
                  >
                    <FileTextIcon className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm">BOM 업로드</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </PermissionGate>
        </div>
      </div>

      {/* ── Page-level fatal error (primary fetch 실패 시만) ── */}
      {isError && !quotesData && (
        <div className="rounded-xl border border-red-600/20 bg-red-600/5 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
          <p className="text-sm text-slate-700 font-medium">견적 운영 워크큐를 불러오지 못했습니다</p>
          <p className="text-xs text-slate-500">기본 목록 데이터를 확인하지 못했습니다. 일시적 문제일 수 있습니다.</p>
          <div className="flex justify-center gap-2 pt-1">
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => refetch()}>다시 시도</Button>
            <Link href="/dashboard"><Button size="sm" variant="outline" className="h-8 text-xs text-slate-400 border-bd">대시보드로 돌아가기</Button></Link>
          </div>
        </div>
      )}

      {/* ── §11.217 Phase 1B — AI 추천 page-top banner (priority highest 1줄) ── */}
      {priorityAiRecommendation && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <p className="text-[12px] sm:text-xs text-violet-900 line-clamp-1">
            {priorityAiRecommendation}
          </p>
        </div>
      )}

      <section
        data-testid="quote-dispatch-fixed-flow"
        className="rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-3 sm:px-4 sm:py-3.5 space-y-3"
        aria-label="견적 발송 전 확인 4단계"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">발송 전 확인</p>
            <h2 className="text-sm font-semibold text-slate-950">공급사 선택 → 연락처 검증 → 메시지 미리보기 → 발송 확인</h2>
            <p data-testid="quote-dispatch-send-disabled-reason" className="text-[11px] text-blue-900/80">
              {primaryDispatchEvidence.canSend
                ? "공급사와 연락처가 확인되었습니다. 메시지 미리보기 후 최종 발송할 수 있습니다."
                : `전송 비활성: ${primaryDispatchEvidence.blockReason} · ${primaryDispatchPreflight.summary}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div data-testid="quote-dispatch-readiness-badges" className="flex flex-wrap items-center gap-1.5">
              {primaryDispatchBadges.map((badge) => (
                <span
                  key={badge.label}
                  data-testid={`quote-dispatch-${badge.label}-badge`}
                  className={`inline-flex min-h-[28px] items-center rounded-full border px-2.5 text-[11px] font-semibold ${
                    badge.tone === "green"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : badge.tone === "blue"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : badge.tone === "amber"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {badge.label}: {badge.value}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <Button
                type="button"
                data-testid="quote-dispatch-send-cta"
                size="sm"
                className="h-9 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-500"
                onClick={openQuoteDraftWorkbench}
                disabled={isLoading || quotes.length === 0 || !primaryDispatchEvidence.canSend}
              >
                <Send className="h-4 w-4 mr-1.5" />
                공급사에 전송
              </Button>
              <p data-testid="quote-dispatch-button-reason" className="text-[11px] text-slate-600">
                {primaryDispatchEvidence.canSend
                  ? "전송 준비됨 · 미리보기 확인 후 최종 발송"
                  : `전송 불가 · ${primaryDispatchEvidence.blockReason}`}
              </p>
            </div>
            {summaryStats.compareReview.count === 0 ? (
              <span
                data-testid="quote-compare-review-zero-disabled"
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-400"
                aria-disabled="true"
              >
                비교 검토 필요 0건 · 검토 대상 없음
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 text-xs"
                onClick={() => setStatusFilter("RESPONDED")}
              >
                비교 검토 {summaryStats.compareReview.count}건 보기
              </Button>
            )}
          </div>
        </div>
        <div
          data-testid="quote-dispatch-four-step-gate"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            ["1. supplier 선택", primaryDispatchEvidence.supplierStatus],
            ["2. contact 검증", primaryDispatchEvidence.contactStatus],
            ["3. message preview", primaryDispatchEvidence.previewStatus],
            ["4. send confirm", primaryDispatchEvidence.sendStatus],
          ].map(([label, status]) => (
            <div key={label} className="rounded-lg border border-white/80 bg-white px-3 py-2 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-1 text-xs font-medium text-slate-800">{status}</p>
            </div>
          ))}
        </div>
      </section>

      {/* §11.217 Phase 3 — Batch action bar (sticky, selectedCount > 0 시만 노출)
          §11.228 #quote-management-v2-phase-c1 — 일괄 처리 강화: 리마인더 + 상태 변경 CTA 추가 */}
      {/* §11.240 — dropdown + 가드레일 prop 확장 */}
      <BatchActionBar
        selectedCount={selectedQuoteIds.size}
        dispatchableCount={dispatchableCount}
        hardBlockCount={hardBlockCount}
        reminderEligibleCount={reminderEligibleCount}
        selectedQuotes={selectedQuotes}
        reviewDisabled={reviewDisabled}
        onRemoveOne={(id) => toggleQuoteSelection(id)}
        onReviewStart={() => setBatchSheetOpen(true)}
        onReminderStart={() => setBatchReminderOpen(true)}
        onStatusChangeStart={() => setBatchStatusChangeOpen(true)}
        onClearSelection={clearSelection}
      />

      {/* ── KPI Control Cards — 5 카드 단계적 반응형.
          §11.259a #1 — 모바일 가로 스크롤 (방안 A, snap-x mandatory) supersede §11.248c "<800px 1열".
          §11.259a #5 — 0건 카드 회색 톤다운 (isZero opacity-50 + text-slate-300/400, 기존 로직 보존).
          breakpoint: <sm flex 가로 스크롤 / sm 2열 / md 3열 / lg 5열. (§11.217 Phase 2 발송 대기 cell 보존 / §11.248c P0 라벨 wrap 보존) ── */}
      <div className="flex sm:grid overflow-x-auto sm:overflow-visible snap-x snap-mandatory sm:snap-none grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 -mx-3 sm:mx-0 px-3 sm:px-0 pb-2 sm:pb-0">
        {[
          { label: "발송 대기", ...summaryStats.dispatchPending, icon: Send, filter: "PENDING", color: "slate", iconBg: "bg-slate-50", iconText: "text-slate-600", activeBorder: "border-slate-400/50", activeRing: "ring-slate-400/20", activeBg: "bg-slate-50/50", hoverBorder: "hover:border-slate-300", hoverShadow: "hover:shadow-slate-100" },
          { label: "회신 추적", ...summaryStats.responseTracking, icon: Clock, filter: "SENT", color: "amber", iconBg: "bg-amber-50", iconText: "text-amber-600", activeBorder: "border-amber-400/50", activeRing: "ring-amber-400/20", activeBg: "bg-amber-50/50", hoverBorder: "hover:border-amber-300", hoverShadow: "hover:shadow-amber-100" },
          { label: "비교 검토 필요", ...summaryStats.compareReview, icon: RefreshCw, filter: "RESPONDED", color: "purple", iconBg: "bg-purple-50", iconText: "text-purple-600", activeBorder: "border-purple-400/50", activeRing: "ring-purple-400/20", activeBg: "bg-purple-50/50", hoverBorder: "hover:border-purple-300", hoverShadow: "hover:shadow-purple-100" },
          { label: "승인 / 예외 처리", ...summaryStats.approvalException, icon: AlertCircle, filter: "DEADLINE_TODAY", color: "red", iconBg: "bg-red-50", iconText: "text-red-500", activeBorder: "border-red-400/50", activeRing: "ring-red-400/20", activeBg: "bg-red-50/50", hoverBorder: "hover:border-red-300", hoverShadow: "hover:shadow-red-100" },
          { label: "발주 전환 가능", ...summaryStats.readyToConvert, icon: FileCheck2, filter: "COMPLETED", color: "emerald", iconBg: "bg-emerald-50", iconText: "text-emerald-600", activeBorder: "border-emerald-400/50", activeRing: "ring-emerald-400/20", activeBg: "bg-emerald-50/50", hoverBorder: "hover:border-emerald-300", hoverShadow: "hover:shadow-emerald-100" },
        ].map(({ label, count, insight, icon: Icon, filter, iconBg, iconText, activeBorder, activeRing, activeBg, hoverBorder, hoverShadow }, idx) => {
          const isActive = statusFilter === filter;
          const isZero = !isLoading && count === 0;
          const isCompareReviewZero = label === "비교 검토 필요" && isZero;
          return (
            <button
              key={label}
              onClick={() => {
                if (isCompareReviewZero) return;
                setStatusFilter(prev => prev === filter ? "all" : filter);
              }}
              disabled={isCompareReviewZero}
              aria-disabled={isCompareReviewZero}
              className={`animate-stagger-up text-left rounded-xl border bg-pn p-3 sm:p-3.5 transition-all duration-200 cursor-pointer group min-w-[140px] sm:min-w-0 shrink-0 sm:shrink snap-start
                ${hoverBorder} ${hoverShadow} hover:shadow-md hover:-translate-y-1
                ${isActive ? `${activeBorder} ${activeBg} ring-1 ${activeRing}` : "border-bd/80"}
                ${isZero && !isActive ? "opacity-50 hover:opacity-100" : ""}
                ${isCompareReviewZero ? "cursor-not-allowed hover:translate-y-0 hover:shadow-none" : ""}
              `}
              style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon className={`h-4 w-4 ${iconText}`} />
                </div>
                {/* §11.248c — label truncate 제거 (호영님 spec "라벨 우선순위 배치 — 잘리지 않도록"). break-keep 으로 어절 단위 wrap 허용. */}
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider break-keep">{label}</span>
              </div>
              <div className={`text-3xl font-extrabold tracking-tight mb-1 ${isZero ? "text-slate-300" : "text-slate-900"}`}>
                {isLoading ? <span className="inline-block w-8 h-7 bg-el/50 rounded animate-pulse" /> : count}
              </div>
              <p className={`text-[11px] leading-snug line-clamp-2 ${isZero ? "text-slate-400" : "text-slate-500"}`}>
                {isLoading ? "집계 확인 중" : insight}
              </p>
            </button>
          );
        })}
      </div>

      {/* §11.264i — KPI 5 카드 모바일 가로 스크롤 도트 인디케이터 (호영님 spec P2).
          §11.259a 가로 스크롤 (flex sm:grid + snap-x) 은 이미 적용 — 사용자가
          "더 있다" 인지하지 못한다는 호영님 보고. 5 도트 시각 hint 만 추가.
          sm:hidden — 데스크탑은 5 cell grid 로 모두 노출 → 도트 불필요. */}
      <div
        data-testid="quote-kpi-scroll-dots"
        className="flex justify-center gap-1.5 mt-1 sm:hidden"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-300"
          />
        ))}
      </div>

      {/* ── 검색 + 필터 ──
          §11.259c — 호영님 spec 견적 관리 모바일 #3 "필터 + 뷰 전환 영역 1줄 압축".
          모바일에서도 검색/상태 필터 가로 1줄 (sm:flex-row → flex-row 강제) +
          상태 Select width 모바일 압축 (w-[110px] sm:w-[160px]). mode chips 는
          가로 스크롤 (flex-nowrap + overflow-x-auto) 으로 무한 줄바꿈 차단.
          뷰 toggle 위치 이동은 별도 backlog (line 2014-2044 = 80+ line, 큰 구조 변경). */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="견적명 / 품목명 / 요청 번호 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setModeChip(null); }}>
            <SelectTrigger className="w-[110px] sm:w-[160px] h-9 text-sm shrink-0">
              <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" /><SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="DEADLINE_TODAY">오늘 마감</SelectItem>
              <SelectItem value="PENDING">요청 접수</SelectItem>
              <SelectItem value="SENT">회신 대기 중</SelectItem>
              <SelectItem value="RESPONDED">비교 검토 필요</SelectItem>
              <SelectItem value="COMPLETED">발주 완료</SelectItem>
              <SelectItem value="CANCELLED">취소됨</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* §11.259c-2 — mode chips + 뷰 toggle 데스크탑 1줄 통합 sub-wrapper.
            모바일: 2 sub-row (chips 위, 뷰 toggle 아래). 데스크탑 sm+: 같은 줄.
            mode chips flex-1 min-w-0 (좌측 차지) + 뷰 toggle shrink-0 (우측). */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* §11.262a — mode chips 가로 스크롤 fade hint (§11.248d 패턴 reuse).
            outer wrapper relative + flex-1 min-w-0 (sm+ 좌측 차지). inner mode
            chips row 의 좌/우 끝에 fade gradient overlay (모바일 only sm:hidden) →
            우측에 더 많은 chip 이 있음을 시각 단서로 표시. pointer-events-none
            으로 chip 상호작용 방해 0. aria-hidden 으로 SR 무시. */}
        <div className="relative flex-1 min-w-0">
        {/* Operating mode chips — §11.259c 가로 스크롤 (1줄 강제) + §11.259c-2 sm+ 좌측 flex-1. */}
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-1 sm:pb-0">
          {MODE_CHIPS.map(chip => {
            const isActive = modeChip === chip.key;
            const chipCount = quotes.filter(chip.filter).length;
            return (
              <button key={chip.key} onClick={() => setModeChip(isActive ? null : chip.key)}
                /* §11.264h — chip 내부 텍스트 줄바꿈 차단 (호영님 spec 견적 모바일 #4).
                   flex-nowrap 은 chip 끼리 줄바꿈 차단, whitespace-nowrap 은
                   chip 내부 텍스트 wrap 차단 ("우선\n처리" 같은 깨짐 방지).
                   §11.264h-4 — mode chips 44x44 touch target (호영님 모바일 spec
                   a11y 일관성, §11.264h-3 cross-cutting concern follow-up).
                   min-h-[44px] 추가 → Apple HIG / Material / WCAG 2.1 SC 2.5.5
                   Target Size 정합. text-[11px] 시각 사이즈 보존 (44px height
                   안에 items-center 로 가운데 정렬). */
                className={`inline-flex items-center gap-1 text-[11px] min-h-[44px] px-2.5 py-1 rounded-full border font-medium transition-all whitespace-nowrap ${
                  isActive ? "bg-blue-600/10 text-blue-600 border-blue-600/30" : "text-slate-500 border-bd/50 hover:border-bd hover:text-slate-900"
                }`}>
                {chip.label}
                {chipCount > 0 && <span className={`text-[9px] ${isActive ? "text-blue-300" : "text-slate-600"}`}>{chipCount}</span>}
              </button>
            );
          })}
          {modeChip && (
            /* §11.264h-5 — 초기화 button 44x44 touch target (호영님 모바일 spec
               a11y 일관성, §11.264h family final close). inline-flex items-center
               + min-h-[44px] + px-2 추가 → mode chip (§11.264h-4 44px) + 전체
               선택 텍스트 링크 (§11.264h-3 44px) 와 same-row sibling 일관성 확보.
               text-[11px] + text-slate-500 + ml-1 보존. */
            <button onClick={() => setModeChip(null)} className="inline-flex items-center text-[11px] min-h-[44px] px-2 text-slate-500 hover:text-slate-900 ml-1">초기화</button>
          )}

          {/* §11.220 — 전체 선택 CTA (PENDING quote 일괄 선택). 호영님 피드백
              "체크박스 박스 외에 일괄 선택 가능하게도". PENDING 0건이면 noop. */}
          {(() => {
            const selectablePending = filteredQuotes.filter(q => deriveRailState(q) === "request_not_sent");
            if (selectablePending.length === 0) return null;
            const allSelected = selectablePending.every(q => selectedQuoteIds.has(q.id));
            return (
              <button
                type="button"
                onClick={() => {
                  if (allSelected) {
                    clearSelection();
                  } else {
                    setSelectedQuoteIds(new Set(selectablePending.map(q => q.id)));
                  }
                }}
                /* §11.264h — 전체 선택 CTA 줄바꿈 차단 ("전체 선택\n(8건)" 깨짐 방지).
                   §11.264h-2 — 호영님 spec 견적 #4-2: "칩이 아닌 우측 끝 텍스트 링크".
                   기존 chip 톤 (rounded-full + border + bg-violet-50/50) 제거 →
                   underline-offset + hover:underline 으로 텍스트 링크 톤 전환.
                   ml-auto (우측 정렬), text-violet-700 (시각 연속성), whitespace-nowrap
                   (§11.264h), onClick / aria-label 보존.
                   §11.264h-3 — touch target 44x44 (Apple HIG / Material). text-[11px]
                   유지하되 min-h-[44px] + items-center 으로 line-height 가운데 정렬.
                   px-1 → px-2 으로 가로 영역 확보. 시각 변화 미미, tap 영역 확보. */
                className="ml-auto inline-flex items-center gap-1 text-[11px] min-h-[44px] px-2 py-1 font-medium underline-offset-2 hover:underline transition-colors whitespace-nowrap text-violet-700 hover:text-violet-900"
                aria-label={allSelected ? "전체 선택 해제" : "발송 대기 견적 전체 선택"}
              >
                {allSelected ? "전체 해제" : `전체 선택 (${selectablePending.length}건)`}
              </button>
            );
          })()}
        </div>
        {/* §11.262a — 모바일 fade gradient overlay (가로 스크롤 시각 단서).
            좌측: from-white → transparent. 우측: from-white ← transparent.
            pointer-events-none + aria-hidden 으로 상호작용/SR 영향 0.
            sm:hidden 으로 데스크탑 hide (chips 모두 한 줄에 표시되므로 fade 불필요). */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent pointer-events-none sm:hidden" aria-hidden="true" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent pointer-events-none sm:hidden" aria-hidden="true" />
        </div>
        {/* §11.259c-2 — 뷰 toggle (카드 ↔ 테이블 + §11.230b column prefs) 통합.
            §11.217 Phase 6 보기 모드 + §11.230b 컬럼 설정 popover trigger.
            기존 main column 위치 (data-testid="quote-work-queue" 직후) 에서
            검색/필터 wrapper 안 sub-wrapper 안으로 이동. 호영님 §11.259 spec
            "필터 + 뷰 전환 영역 1줄 압축" 완전 정합. */}
        {!isLoading && filteredQuotes.length > 0 && (
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            <span className="text-[11px] text-slate-500 mr-1">보기</span>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              aria-pressed={viewMode === "card"}
              aria-label="카드 보기"
              className={
                viewMode === "card"
                  ? "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-700"
                  : "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
              }
            >
              <Package className="h-3 w-3" />
              카드
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              aria-label="테이블 보기"
              className={
                viewMode === "table"
                  ? "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-blue-100 text-blue-700"
                  : "h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
              }
            >
              <FileTextIcon className="h-3 w-3" />
              테이블
            </button>
            {/* §11.230b #quote-table-column-prefs — 컬럼 설정 popover trigger.
                테이블 뷰 한정 노출 + popover 안 9 컬럼 visibility checkbox +
                HTML5 drag-and-drop reorder (호영님 v2 #23 b1+b2). */}
            {viewMode === "table" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColumnPrefsPopoverOpen((prev) => !prev)}
                  aria-label="컬럼 설정"
                  aria-expanded={columnPrefsPopoverOpen}
                  className="h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                >
                  <Settings2 className="h-3 w-3" />
                  컬럼 설정
                </button>
                {columnPrefsPopoverOpen && (
                  <>
                    {/* backdrop click → close */}
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setColumnPrefsPopoverOpen(false)}
                    />
                    <div
                      className="absolute right-0 top-9 z-40 w-72 rounded-lg border border-bd bg-pn shadow-lg p-3 space-y-1"
                      role="dialog"
                      aria-label="컬럼 설정 패널"
                    >
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-bd/60">
                        <span className="text-xs font-semibold text-slate-900">컬럼 설정</span>
                        <button
                          type="button"
                          onClick={() => setColumnPrefs(DEFAULT_COLUMN_PREFS)}
                          className="text-[11px] text-blue-600 hover:text-blue-700"
                        >
                          기본값 복원
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-1.5">
                        체크박스로 보임/숨김 · 손잡이를 끌어 순서 변경
                      </p>
                      {columnPrefs.order.map((key) => {
                        const isProtected = (key === "price" && priceColumnHasData) || (key === "delivery" && deliveryColumnHasData);
                        return (
                          <div
                            key={key}
                            draggable
                            onDragStart={() => setDragColumn(key)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (!dragColumn || dragColumn === key) {
                                setDragColumn(null);
                                return;
                              }
                              // §11.230b (b2) — 순서 재정렬: dragColumn → key 위치 swap.
                              const nextOrder = columnPrefs.order.slice();
                              const fromIdx = nextOrder.indexOf(dragColumn);
                              const toIdx = nextOrder.indexOf(key);
                              if (fromIdx === -1 || toIdx === -1) {
                                setDragColumn(null);
                                return;
                              }
                              nextOrder.splice(fromIdx, 1);
                              nextOrder.splice(toIdx, 0, dragColumn);
                              setColumnPrefs((prev) => ({ ...prev, order: nextOrder }));
                              setDragColumn(null);
                            }}
                            onDragEnd={() => setDragColumn(null)}
                            className={`flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 cursor-move ${dragColumn === key ? "opacity-50" : ""}`}
                          >
                            <GripVertical className="h-3 w-3 text-slate-400 shrink-0" />
                            <input
                              type="checkbox"
                              id={`col-vis-${key}`}
                              checked={columnPrefs.visibility[key]}
                              onChange={(e) =>
                                setColumnPrefs((prev) => ({
                                  ...prev,
                                  visibility: { ...prev.visibility, [key]: e.target.checked },
                                }))
                              }
                              disabled={isProtected && !columnPrefs.visibility[key]}
                              className="h-3 w-3 accent-blue-600 shrink-0"
                            />
                            <label
                              htmlFor={`col-vis-${key}`}
                              className="text-[11px] text-slate-700 cursor-pointer flex-1"
                            >
                              {COLUMN_LABEL[key]}
                            </label>
                            {isProtected && (
                              <span className="text-[10px] text-amber-600">데이터 있음</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ═══ Main: List + Quote Context Rail ═══ */}
      <div className="flex gap-0">
      <div data-testid="quote-work-queue" className="flex-1 min-w-0 space-y-4">

      {/* §11.259c-2 — 뷰 toggle (보기 모드 + column prefs) 영역 검색/필터
          wrapper 안 sub-wrapper 로 이동. 기존 main column 위치는 비움.
          §11.217 Phase 6 + §11.230b 정합 보존. */}

      {/* §11.217 Phase 6 — 테이블 보기 (단일 통합 테이블, 3 section 구분 row).
          card 와 같은 데이터 (filteredQuotes) 다른 layout. 클릭 → 같은 detail panel.
          §11.224 #quote-table-price-delivery-parity — 카드 뷰 §11.223 spec parity
          위해 가격/납기 2 컬럼 추가 (회신 옆 가격, 등록 옆 납기). 테이블 뷰 가격/납기 parity.
          §11.226 #quote-management-v2-phase-a — 호영님 v2 P0 CRITICAL spec:
            #1 상태 뱃지 nowrap + min-width 72px / 컬럼 100px
            #2 액션 버튼 nowrap + min-width 80px + shortenActionLabel 축약
            #4 빈 컬럼 (가격/납기) 자동 hide — priceColumnHasData/deliveryColumnHasData
            #5 제목 열 = firstItemName + 외 N건 (§11.217 helper inline reuse)
            #8 카드 CTA min-w-[140px] / 테이블 CTA min-w-[80px] 강제 */}
      {!isLoading && viewMode === "table" && sortedQuotes.length > 0 && (
        /* §11.248d #quote-table-fade-hint — 호영님 P0 견적 관리 #4 (scope 축소).
           가로 스크롤 존재 시 좌우 fade gradient overlay 으로 스크롤 가능 표시.
           CSS-only 패턴 (JS scroll position 감지 별도 §11.248d-2 백로그).
           title 컬럼 min-width 240px 보장 (DEFAULT_COLUMN_PREFS.widths.title = 280, 호영님 spec 정합).
           pointer-events-none 으로 테이블 상호작용 방해 0. */
        <div className="relative">
          <div className="overflow-x-auto bg-pn rounded-xl border border-bd/80">
            <table className="w-full text-xs">
            {/* §11.230b #quote-table-column-prefs — 호영님 v2 #23 (a+b).
                visibleColumns.map() 으로 dynamic generate. canonical truth:
                - sortState (§11.227) sortable 5 컬럼 유지
                - priceColumnHasData / deliveryColumnHasData (§11.226 #4) 우선
                - tbody td 순서 일치 — 같은 visibleColumns.map() */}
            {/* §11.242 #6 — 헤더 sticky + 배경 강화 (bg-gray-100 + uppercase + tracking-wide + border-b-2). */}
            <thead className="bg-gray-100 border-b-2 border-gray-200 sticky top-0 z-10">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                {/* §11.240 + §11.242 #10 — 첫 column = batch selection checkbox + sticky left-0. */}
                <th
                  data-batch-select-header
                  style={{ width: 40, minWidth: 40 }}
                  className="px-2 py-2 text-center sticky left-0 bg-gray-100 z-20"
                  aria-label="전체 견적 선택/해제"
                >
                  <input
                    type="checkbox"
                    aria-label="전체 견적 선택/해제"
                    className="accent-violet-600 cursor-pointer h-4 w-4"
                    checked={sortedQuotes.length > 0 && sortedQuotes.every((q) => selectedQuoteIds.has(q.id))}
                    ref={(el) => {
                      if (el) {
                        const selectedCount = sortedQuotes.filter((q) => selectedQuoteIds.has(q.id)).length;
                        el.indeterminate = selectedCount > 0 && selectedCount < sortedQuotes.length;
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        sortedQuotes.forEach((q) => {
                          if (!selectedQuoteIds.has(q.id)) toggleQuoteSelection(q.id);
                        });
                      } else {
                        sortedQuotes.forEach((q) => {
                          if (selectedQuoteIds.has(q.id)) toggleQuoteSelection(q.id);
                        });
                      }
                    }}
                  />
                </th>
                {visibleColumns.map((key) => {
                  const width = columnPrefs.widths[key];
                  const isSortable = key === "title" || key === "status" || key === "itemCount" || key === "responseCount" || key === "createdAt";
                  const isCenter = key === "itemCount" || key === "responseCount" || key === "priority";
                  const isRight = key === "price" || key === "actions";
                  const label = COLUMN_LABEL[key];
                  // §11.226 #1/#2 invariant — column-specific min-width 보존
                  // title 200px / status 100px / actions 120px (§11.226 spec).
                  // 그 외 fallback COLUMN_MIN_WIDTH (60px).
                  const colMinWidth =
                    key === "title" ? 200
                    : key === "status" ? 100
                    : key === "actions" ? 120
                    : COLUMN_MIN_WIDTH;
                  // §11.226 #4 — Tailwind sentinel class 보존 (drift test 호환).
                  const minWClass =
                    key === "title" ? "min-w-[200px]"
                    : key === "status" ? "min-w-[100px]"
                    : key === "actions" ? "min-w-[120px]"
                    : "";
                  // §11.242c #1 — 액션 column sticky right-0 (가로 스크롤 시 항상 보임).
                  //   첫 column sticky left-0 (§11.242 #10 a) 와 대칭 lock.
                  //   thead 배경 bg-gray-100 매칭 + z-20 (다른 sticky 보다 우선).
                  const isStickyAction = key === "actions";
                  const stickyClass = isStickyAction ? "sticky right-0 bg-gray-100 z-20" : "";
                  return (
                    <th
                      key={key}
                      style={{ width, minWidth: colMinWidth, position: isStickyAction ? "sticky" : "relative" }}
                      className={`px-3 py-2 ${minWClass} ${stickyClass} ${isCenter ? "text-center" : isRight ? "text-right" : ""} ${isSortable ? "cursor-pointer select-none hover:bg-slate-100" : ""}`}
                      onClick={isSortable ? () => handleSortColumn(key as Parameters<typeof handleSortColumn>[0]) : undefined}
                    >
                      <span className={`inline-flex items-center gap-1 ${isCenter ? "justify-center" : ""}`}>
                        {label}
                        {isSortable && sortState.key === key && (
                          sortState.direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        )}
                      </span>
                      {/* §11.230b (a) — drag handle (resize). 우측 끝 4px width zone. */}
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`${label} 컬럼 폭 조정`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setResizingColumn(key);
                        }}
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 select-none"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-bd/40">
              {/* §11.230a #quote-table-keyboard-tooltip — 호영님 v2 #23 (c+d).
                  키보드 navigation: ArrowUp/Down row 이동 + Enter row 진입 +
                  Escape rail close. focusedRowIndex (UI focus only) + DOM
                  focus() 로 native focus ring 시각화. canonical mutation
                  (openQuoteContextRail / closeQuoteContextRail) 재사용. */}
              {/*
                §11.242 #quote-table-readability — 호영님 P0 가독성 10항목.
                  zebra (rowIndex % 2) + hover (bg-gray-100 transition) + 5색 뱃지 (OP_STATUS swap) +
                  우선순위 left border (priorityLevel hoist) + 중복 품목 (isDuplicateOfPrev) +
                  헤더 sticky top-0 + 첫 td sticky left-0 + 빈 데이터 text-gray-300 +
                  selected row bg-blue-50 + border-l-blue-500 (§11.240 bg-indigo-50 swap).

                §11.242c #quote-table-sticky-action-h12 — 호영님 P0 가독성 백로그 close.
                  #9 tr h-12 통일 (px-3/4 + py-2/3 혼재 → 일관 행 간격).
                  #10 마지막 액션 column sticky right-0 (첫 column sticky left-0 대칭 lock).
                  가로 스크롤 시 행 선택 (좌측 checkbox) + 즉시 액션 (우측 CTA) 항상 보임.
              */}
              {sortedQuotes.map((quote, rowIndex) => {
                const signals = getOpSignals(quote);
                const itemCount = quote.items?.length ?? 0;
                const responseCount = quote.responses?.length ?? 0;
                const railState = deriveRailState(quote);
                const isSelected = selectedQuoteId === quote.id;
                // §11.242 #4 — 우선순위 left border tr scope derive (canonical RailState 기반).
                //   critical: response_delayed / external_approval_required (호영님 "긴급").
                //   high: compare_review_required (호영님 "높음").
                //   normal: 그 외 (보더 없음).
                const priorityLevel: "critical" | "high" | "normal" =
                  railState === "response_delayed" || railState === "external_approval_required"
                    ? "critical"
                    : railState === "compare_review_required"
                      ? "high"
                      : "normal";
                // §11.242 #5 — 중복 품목 그룹핑 derive (인접 prev row 의 firstItemName 비교).
                //   같은 firstItemName 이 연속될 때 isDuplicateOfPrev=true → 텍스트 회색.
                const prevQuote = rowIndex > 0 ? sortedQuotes[rowIndex - 1] : null;
                const prevFirstItem = prevQuote?.items?.[0]?.product?.name?.trim() ?? null;
                const currentFirstItem = quote.items?.[0]?.product?.name?.trim() ?? null;
                const isDuplicateOfPrev = Boolean(
                  prevFirstItem && currentFirstItem && prevFirstItem === currentFirstItem,
                );
                // §11.224 — 가격 range (테이블 row scope). 카드 분기 변수와 동일 의미.
                const prices = (quote.responses ?? [])
                  .map((r) => r.totalPrice)
                  .filter((v): v is number => typeof v === "number" && v > 0);
                const minPrice = prices.length ? Math.min(...prices) : null;
                const maxPrice = prices.length ? Math.max(...prices) : null;
                // §11.226 #5 — 테이블 제목 열 = firstItemName + 외 N건 (§11.217 helper inline reuse).
                //   카드 분기 (QuoteCard line 362~370) 와 동일 derive. firstItemName 없으면
                //   quote.title fallback (graceful) — 데이터 모델 안정성 보장.
                // §11.231 — item.name optional fallback (type drift fix, items[0] 가 cart-origin 시
                //   product 부재 + name 직접 carry 케이스 보존).
                const firstItem = quote.items?.[0] as { product?: { name?: string }; name?: string } | undefined;
                const firstItemName =
                  firstItem?.product?.name ?? firstItem?.name ?? null;
                const moreCount = Math.max(0, itemCount - 1);
                const tableDisplayTitle = firstItemName
                  ? moreCount > 0
                    ? `${firstItemName} 외 ${moreCount}건`
                    : firstItemName
                  : quote.title;
                return (
                  <tr
                    key={quote.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`견적 ${tableDisplayTitle} · 상태 ${signals.badge}`}
                    onClick={(e) => {
                      // §11.241 #6b — Shift+클릭 = lastSelectedIndex ~ rowIndex 범위 선택.
                      if (e.shiftKey && lastSelectedIndex >= 0) {
                        e.preventDefault();
                        const start = Math.min(lastSelectedIndex, rowIndex);
                        const end = Math.max(lastSelectedIndex, rowIndex);
                        const next = new Set(selectedQuoteIds);
                        for (let i = start; i <= end; i += 1) {
                          const q = sortedQuotes[i];
                          if (q) next.add(q.id);
                        }
                        setSelectedQuoteIds(next);
                        setLastSelectedIndex(rowIndex);
                        return;
                      }
                      setLastSelectedIndex(rowIndex);
                      openQuoteContextRail(quote.id, "row");
                    }}
                    onFocus={() => setFocusedRowIndex(rowIndex)}
                    onKeyDown={(e) => {
                      // §11.230a #quote-table-keyboard-tooltip — 4 key 분기
                      // §11.230c (c) — Home / End / PageUp / PageDown 4 key 확장.
                      //   Out of scope (b) park 항목 land. 큰 테이블 운영 흐름 강화.
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const nextIndex = Math.min(rowIndex + 1, sortedQuotes.length - 1);
                        setFocusedRowIndex(nextIndex);
                        // DOM focus — querySelector tbody tr[data-row-index]
                        const next = document.querySelector<HTMLTableRowElement>(
                          `tr[data-row-index="${nextIndex}"]`,
                        );
                        next?.focus();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const prevIndex = Math.max(rowIndex - 1, 0);
                        setFocusedRowIndex(prevIndex);
                        const prev = document.querySelector<HTMLTableRowElement>(
                          `tr[data-row-index="${prevIndex}"]`,
                        );
                        prev?.focus();
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        setFocusedRowIndex(0);
                        const first = document.querySelector<HTMLTableRowElement>(
                          `tr[data-row-index="0"]`,
                        );
                        first?.focus();
                      } else if (e.key === "End") {
                        e.preventDefault();
                        const lastIndex = sortedQuotes.length - 1;
                        setFocusedRowIndex(sortedQuotes.length - 1);
                        const last = document.querySelector<HTMLTableRowElement>(
                          `tr[data-row-index="${lastIndex}"]`,
                        );
                        last?.focus();
                      } else if (e.key === "PageDown") {
                        e.preventDefault();
                        const jumpIndex = Math.min(rowIndex + 10, sortedQuotes.length - 1);
                        setFocusedRowIndex(jumpIndex);
                        const jump = document.querySelector<HTMLTableRowElement>(
                          `tr[data-row-index="${jumpIndex}"]`,
                        );
                        jump?.focus();
                      } else if (e.key === "PageUp") {
                        e.preventDefault();
                        const jumpIndex = Math.max(rowIndex - 10, 0);
                        setFocusedRowIndex(jumpIndex);
                        const jump = document.querySelector<HTMLTableRowElement>(
                          `tr[data-row-index="${jumpIndex}"]`,
                        );
                        jump?.focus();
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        openQuoteContextRail(quote.id, "row");
                      } else if (e.key === " ") {
                        // §11.241 #6a — Space = 선택/해제 (페이지 scroll 차단)
                        e.preventDefault();
                        toggleQuoteSelection(quote.id);
                        setLastSelectedIndex(rowIndex);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        // §11.241 #6d — selectedQuoteIds.size > 0 시 clearSelection 우선,
                        //   else 기존 §11.230a rail close.
                        if (selectedQuoteIds.size > 0) {
                          clearSelection();
                        } else {
                          closeQuoteContextRail("esc_key");
                        }
                      }
                    }}
                    data-row-index={rowIndex}
                    className={(() => {
                      // §11.242 #1+#2+#4 — zebra + hover + 우선순위 left border + selected.
                      //   호영님 spec 우선: selected = bg-blue-50 + border-l-blue-500 (§11.240 bg-indigo-50 swap).
                      //   우선순위 left border: critical → red, high → amber, normal → transparent.
                      //   zebra: 짝수 bg-white / 홀수 bg-gray-50. 호버: hover:bg-gray-100.
                      // §11.242c #2 — tr 행 높이 h-12 통일 (호영님 P0 가독성 백로그 close).
                      //   px-3 py-2 ~ px-4 py-3 혼재 → h-12 강제로 일관 행 간격 확보.
                      const focusRing = "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-inset";
                      const priorityBorder =
                        priorityLevel === "critical" ? "border-l-4 border-red-500"
                        : priorityLevel === "high" ? "border-l-4 border-amber-400"
                        : "border-l-4 border-transparent";
                      const isBatchSelected = selectedQuoteIds.has(quote.id);
                      const bgClass = isBatchSelected
                        ? "bg-blue-50 border-l-blue-500 hover:bg-blue-100"
                        : isSelected
                          ? "bg-blue-50/60 hover:bg-blue-100/60"
                          : `${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`;
                      return `h-12 ${bgClass} ${priorityBorder} cursor-pointer transition-colors duration-150 ${focusRing}`;
                    })()}
                  >
                    {/* §11.240 + §11.242 #10 — 첫 td = row checkbox + sticky left-0. */}
                    <td
                      data-batch-select-row
                      style={{ width: 40, minWidth: 40 }}
                      className={`px-2 py-3 text-center sticky left-0 z-10 ${
                        selectedQuoteIds.has(quote.id) ? "bg-blue-50" : rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`견적 ${tableDisplayTitle} 선택/해제`}
                        className="accent-violet-600 cursor-pointer h-4 w-4"
                        checked={selectedQuoteIds.has(quote.id)}
                        onChange={() => toggleQuoteSelection(quote.id)}
                      />
                    </td>
                    {/* §11.230b — visibleColumns.map() dynamic td. column key 별 render
                        분기. §11.224 가격/납기 분기 + §11.226 #4 hasData 우선 +
                        §11.226 #5 tableDisplayTitle + §11.230a title attr 보존. */}
                    {visibleColumns.map((key) => {
                      const width = columnPrefs.widths[key];
                      if (key === "title") {
                        // §11.242 #5 — 중복 품목: prev row 와 같은 firstItemName 이면 text-gray-400 + "〃"
                        //   첫 표시 row 만 강조, 연속 row 는 시각 noise ↓.
                        return (
                          <td
                            key={key}
                            style={{ width, maxWidth: width }}
                            className={`px-4 py-3 truncate ${
                              isDuplicateOfPrev
                                ? "font-normal text-gray-400 pl-6"
                                : "font-medium text-gray-900"
                            }`}
                            title={tableDisplayTitle}
                          >
                            {isDuplicateOfPrev ? `〃 ${tableDisplayTitle}` : tableDisplayTitle}
                          </td>
                        );
                      }
                      if (key === "status") {
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2">
                            {/* §11.231 — railState enum drift fix: compare_review → compare_review_required,
                                approval_prep → external_approval_required (canonical RailState enum 정합). */}
                            <span className={`inline-flex justify-center whitespace-nowrap min-w-[72px] px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              railState === "response_delayed" ? "bg-slate-100 text-slate-700"
                              : railState === "compare_not_ready" ? "bg-blue-100 text-blue-700"
                              : railState === "compare_review_required" ? "bg-purple-100 text-purple-700"
                              : railState === "external_approval_required" ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {signals.badge}
                            </span>
                          </td>
                        );
                      }
                      if (key === "itemCount") {
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2 text-center text-slate-600 tabular-nums">{itemCount}</td>
                        );
                      }
                      if (key === "responseCount") {
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2 text-center">
                            {(quote.status === "SENT" || quote.status === "RESPONDED") && itemCount > 0 ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-[10px] tabular-nums text-slate-600">
                                  {responseCount}/{itemCount}
                                </span>
                                <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    role="progressbar"
                                    aria-valuenow={responseCount}
                                    aria-valuemin={0}
                                    aria-valuemax={itemCount}
                                    className={`h-full rounded-full ${
                                      responseCount === 0 ? "bg-slate-200"
                                      : responseCount >= itemCount ? "bg-emerald-500"
                                      : "bg-blue-500"
                                    }`}
                                    style={{ width: `${Math.min(100, (responseCount / itemCount) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                        );
                      }
                      if (key === "price") {
                        // §11.226 #4 — priceColumnHasData 우선 (visibleColumns 가 이미 hasData 분기).
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2 text-right text-[11px] tabular-nums">
                            {/* §11.242 #8 — 빈 데이터 색상 약화 (호영님 spec: text-gray-300). */}
                            {responseCount === 0 ? (
                              <span className="text-gray-300">미수신</span>
                            ) : prices.length === 0 ? (
                              <span className="text-gray-300">가격 미기재</span>
                            ) : minPrice === maxPrice ? (
                              <span className="text-slate-700">₩{minPrice!.toLocaleString("ko-KR")}</span>
                            ) : (
                              <span className="text-slate-700">₩{minPrice!.toLocaleString("ko-KR")} ~ ₩{maxPrice!.toLocaleString("ko-KR")}</span>
                            )}
                          </td>
                        );
                      }
                      if (key === "delivery") {
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2 text-[11px]">
                            {quote.deliveryDate ? (
                              <RelativeDeliveryText iso={quote.deliveryDate} className="text-slate-600" />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        );
                      }
                      if (key === "priority") {
                        // §11.231 — priority derive (railState 기반, signals 의 priority 부재 fix).
                        //   §11.242 — outer tr scope priorityLevel reuse (shadow drop).
                        //   delayed/external_approval_required = critical, compare_review_required = high,
                        //   그 외 = normal. canonical RailState 정합 + 시각화 분기 보존.
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2 text-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              priorityLevel === "critical" ? "bg-red-500"
                              : priorityLevel === "high" ? "bg-amber-500"
                              : "bg-slate-300"
                            }`} aria-label={`우선순위 ${priorityLevel}`} />
                          </td>
                        );
                      }
                      if (key === "createdAt") {
                        return (
                          <td key={key} style={{ width }} className="px-3 py-2 text-slate-500">
                            <RelativeTimeText iso={quote.createdAt} />
                          </td>
                        );
                      }
                      if (key === "actions") {
                        // §11.242c #1 — tbody 액션 td sticky right-0. zebra bg + selected blue-50
                        //   분기로 가로 스크롤 시 행 배경 매칭 보존 (§11.242 first td sticky 대칭).
                        const actionBg = selectedQuoteIds.has(quote.id)
                          ? "bg-blue-50"
                          : rowIndex % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50";
                        return (
                          <td
                            key={key}
                            style={{ width }}
                            className={`px-3 py-2 text-right sticky right-0 z-10 ${actionBg}`}
                          >
                            <Button
                              size="sm"
                              variant={signals.ctaVariant}
                              onClick={(e) => {
                                e.stopPropagation();
                                openQuoteContextRail(quote.id, "row");
                              }}
                              className={`h-7 text-[11px] whitespace-nowrap min-w-[80px] ${signals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                            >
                              {shortenActionLabel(signals.ctaLabel)}
                            </Button>
                          </td>
                        );
                      }
                      return null;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {/* §11.248d — 가로 스크롤 좌우 fade gradient overlay (테이블 자체는 inner div).
              from-white → transparent 으로 자연스러운 페이드. rounded-l-xl / rounded-r-xl 으로 모서리 정합. */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none rounded-l-xl" aria-hidden="true" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none rounded-r-xl" aria-hidden="true" />
        </div>
      )}

      {/* ── 로딩: progressive skeleton (list만, header/search는 이미 보임) ── */}
      {isLoading && (
        <div className="space-y-2">
          {[0,1,2,3,4].map((i) => (
            <div key={i} className="bg-pn rounded-xl border border-bd/80 p-4 space-y-2" style={{ opacity: 1 - i * 0.15 }}>
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-el rounded animate-pulse" />
                <div className="h-4 w-32 bg-el/50 rounded animate-pulse" />
              </div>
              <div className="h-4 w-3/4 bg-el rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-el/30 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* 필터 변경 / background revalidation indicator (기존 list 유지) */}
      {isFilterChanging && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-3 w-3 animate-spin rounded-full border border-blue-600 border-t-transparent" />
          {statusFilter !== "all" || modeChip ? "필터 적용 중..." : "최신 상태를 확인 중"}
        </div>
      )}

      {/* ── 섹션: 즉시 처리 필요 ── */}
      {!isLoading && viewMode === "card" && urgentQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-slate-700">즉시 처리 필요</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600/15 text-red-600 text-[11px] font-bold">{urgentQuotes.length}</span>
          </div>
          {urgentQuotes.map((quote, i) => <QuoteCard key={quote.id} quote={quote} cardIndex={i} isSelected={selectedQuoteId === quote.id} onSelect={(ctaLabel) => handleQuoteCardSelect(quote.id, ctaLabel)} isSelectable={deriveRailState(quote) === "request_not_sent"} isSelectedForBatch={selectedQuoteIds.has(quote.id)} onToggleSelect={() => toggleQuoteSelection(quote.id)} />)}
        </div>
      )}

      {/* ── 섹션: 진행 중 ── */}
      {!isLoading && viewMode === "card" && inProgressQuotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-700">진행 중</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/15 text-amber-600 text-[11px] font-bold">{inProgressQuotes.length}</span>
          </div>
          {inProgressQuotes.map((quote, i) => <QuoteCard key={quote.id} quote={quote} cardIndex={urgentQuotes.length + i} isSelected={selectedQuoteId === quote.id} onSelect={(ctaLabel) => handleQuoteCardSelect(quote.id, ctaLabel)} isSelectable={deriveRailState(quote) === "request_not_sent"} isSelectedForBatch={selectedQuoteIds.has(quote.id)} onToggleSelect={() => toggleQuoteSelection(quote.id)} />)}
        </div>
      )}

      {/* ── 섹션: 완료 ── */}
      {!isLoading && viewMode === "card" && completedQuotes.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-700">완료 / 취소</span>
            <span className="text-xs text-slate-500">({completedQuotes.length}건)</span>
            <span className="ml-1 text-xs text-slate-500 group-open:hidden">▶</span>
            <span className="ml-1 text-xs text-slate-500 hidden group-open:inline">▼</span>
          </summary>
          <div className="mt-2 space-y-2">
            {completedQuotes.map((quote, i) => <QuoteCard key={quote.id} quote={quote} cardIndex={urgentQuotes.length + inProgressQuotes.length + i} isSelected={selectedQuoteId === quote.id} onSelect={(ctaLabel) => handleQuoteCardSelect(quote.id, ctaLabel)} isSelectable={deriveRailState(quote) === "request_not_sent"} isSelectedForBatch={selectedQuoteIds.has(quote.id)} onToggleSelect={() => toggleQuoteSelection(quote.id)} />)}
          </div>
        </details>
      )}

      {/* ── 빈 상태: filter empty vs queue empty 분리 ── */}
      {!isLoading && filteredQuotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          {(searchQuery || statusFilter !== "all" || modeChip) ? (
            <>
              <Filter className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-700">현재 조건에 맞는 견적 케이스가 없습니다</p>
              <p className="text-xs text-slate-500">필터를 완화하거나 다른 상태군을 선택해 보세요</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setModeChip(null); }} className="text-xs text-blue-600 hover:underline">필터 초기화</button>
                <button onClick={() => setStatusFilter("all")} className="text-xs text-slate-400 hover:underline">전체 보기</button>
              </div>
            </>
          ) : (
            <>
              <Package className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-700">현재 처리 중인 견적 케이스가 없습니다</p>
              <p className="text-xs text-slate-500">새 견적 요청을 만들거나, BOM/외부 견적서를 업로드할 수 있습니다</p>
              <div className="flex gap-2 mt-2">
                <Link href="/app/search"><Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700">새 요청 만들기</Button></Link>
                <Link href="/dashboard/inventory"><Button size="sm" variant="outline" className="h-8 text-xs text-slate-400 border-bd">재고 확인</Button></Link>
              </div>
            </>
          )}
        </div>
      )}

      </div>{/* end list column */}

      {/* ═══ Mobile Quote Context Sheet — §11.248e #quote-briefing-panel-responsive.
            호영님 P0 견적 관리 #5: breakpoint 1024px → 1200px 상향 (1024-1199px 구간
            bottom-sheet 적용, 테이블 가용 너비 회복). word-break 어절 단위 wrap +
            "전체 상세 열기" / "닫기" Button 44px 터치 영역 확보. ═══ */}
      {selectedQuote && selectedSignals && selectedOpStatus && (
        <div className="min-[1200px]:hidden fixed inset-0 z-40" onClick={() => closeQuoteContextRail("overlay_click")}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-pn rounded-t-2xl border-t border-bd max-h-[75vh] flex flex-col animate-slide-up safe-area-pb"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center py-2"><div className="w-10 h-1 rounded-full bg-slate-300" /></div>
            {/* Header */}
            <div className="px-4 pb-2 border-b border-bd/50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus.bg} ${selectedOpStatus.text} ${selectedOpStatus.border}`}>
                    {selectedSignals.badge}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
                </div>
                {/* §11.264i — "✦ 운영 브리핑" 진입 버튼 (호영님 spec P0 견적 모바일 2중 겹침 fix).
                    기존: selectedQuote set 시 §11.248e + §11.155 둘 다 자동 렌더 → 겹침.
                    신규: §11.155 는 briefSheetOpen=true 일 때만. ✦ 클릭 = 명시적 진입. */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-violet-700 hover:bg-violet-50"
                    aria-label="운영 브리핑 열기"
                    onClick={() => setBriefSheetOpen(true)}
                  >
                    <span className="mr-0.5">✦</span>
                    <span className="hidden sm:inline">운영 브리핑</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" onClick={() => closeQuoteContextRail("x_button")}><X className="h-4 w-4" /></Button>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 truncate">{selectedQuote.title}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{selectedSignals.summary}</p>
            </div>
            {/* Scrollable body — 운영 요약 compact */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {selectedDispatchEvidence && (
                <div
                  data-testid="quote-dispatch-priority-gate"
                  className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-blue-900">현재 단계</span>
                    <span className="text-[11px] font-medium text-blue-700">
                      {selectedDispatchEvidence.canSend ? "발송 확인" : selectedDispatchEvidence.blockReason}
                    </span>
                  </div>
                  <div
                    data-testid="quote-dispatch-priority-order"
                    className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-700"
                  >
                    <span>1. 공급사: {selectedDispatchEvidence.supplierStatus}</span>
                    <span>2. 연락처: {selectedDispatchEvidence.contactStatus}</span>
                    <span>3. 메시지 미리보기: {selectedDispatchEvidence.previewStatus}</span>
                    <span>4. 발송 확인: {selectedDispatchEvidence.sendStatus}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400 block text-[10px]">상태</span><span className="text-slate-700 font-medium">{selectedSignals.status}</span></div>
                <div><span className="text-slate-400 block text-[10px]">차단</span><span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-400" : "text-amber-600"}>{selectedSignals.blocker}</span></div>
                <div><span className="text-slate-400 block text-[10px]">비교</span><span className="text-slate-700">{selectedSignals.compareReady}</span></div>
                <div><span className="text-slate-400 block text-[10px]">전환</span><span className={selectedSignals.poReady === "가능" ? "text-emerald-400" : "text-slate-500"}>{selectedSignals.poReady}</span></div>
              </div>
              {selectedSignals.aiRecommendation && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-violet-50 border border-violet-100">
                  <Sparkles className="h-3 w-3 text-violet-500 shrink-0" />
                  <span className="text-[11px] text-violet-700 line-clamp-2">{selectedSignals.aiRecommendation}</span>
                </div>
              )}
              {/* §11.264j — 공급사별 회신 현황 (호영님 spec #2 P1).
                  기존: 카드 표면 정보 (badge/title/summary) 만 반복 = dead content.
                  신규: vendorRequests.map 으로 ● 회신 완료 / ○ 미회신 + 가격/경과일 표시.
                  데이터 source: API /api/quotes 의 vendorRequests (이미 fetch 중,
                  composer/schema 변경 0). 가격은 responses[].vendor.name 매칭.
                  경과일: <RelativeTimeText iso={createdAt} /> (§11.214 hydration 안전).
                  per-vendor 납기 ("5영업일") 는 §11.264j-2 별도 cluster
                  (QuoteResponse.deliveryDays 컬럼 신규 필요). */}
              {selectedQuote.vendorRequests && selectedQuote.vendorRequests.length > 0 && (
                <div
                  data-testid="quote-vendor-response-status"
                  ref={vendorResponseSectionRef}
                  className="rounded-lg border border-bd/60 bg-slate-50/60 px-3 py-2.5 space-y-1.5"
                >
                  <div className="text-[11px] font-semibold text-slate-700">공급사별 회신 현황</div>
                  <ul className="space-y-1">
                    {selectedQuote.vendorRequests.map((req) => {
                      const isResponded = req.status === "RESPONDED";
                      const matchedResponse = isResponded
                        ? (selectedQuote.responses ?? []).find(
                            (r) => r.vendor.name === req.vendorName,
                          )
                        : undefined;
                      return (
                        <li key={req.id} className="flex items-center gap-2 text-[11px]">
                          <span
                            className={isResponded ? "text-emerald-500" : "text-slate-400"}
                            aria-hidden="true"
                          >
                            {isResponded ? "●" : "○"}
                          </span>
                          <span className="font-medium text-slate-700 truncate">{req.vendorName}</span>
                          <span className="text-slate-300">—</span>
                          {isResponded ? (
                            <span className="text-slate-600">
                              회신 완료
                              {typeof matchedResponse?.totalPrice === "number" && matchedResponse.totalPrice > 0 && (
                                <span className="ml-1 font-medium text-slate-900">
                                  (₩{matchedResponse.totalPrice.toLocaleString("ko-KR")})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              {/* §11.264j — "N일 경과" 표시. ElapsedDaysText 가 mount 후 day diff
                                  계산 → "11일 경과" 같은 호영님 spec verbatim 출력. §11.214
                                  hydration 안전 (useState + useEffect mount-after-set). */}
                              미회신 (<ElapsedDaysText iso={req.createdAt} />)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
            {/* Bottom actions */}
            <div className="px-4 py-3 border-t border-bd/50 space-y-2">
              {selectedDispatchEvidence && (
                <div
                  data-testid="quote-dispatch-readiness-strip"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1.5"
                >
                  <div
                    data-testid="quote-dispatch-readiness-row"
                    className="grid grid-cols-2 gap-1 text-[10px] text-slate-600"
                  >
                    <span>공급사: {selectedDispatchEvidence.supplierStatus}</span>
                    <span>연락처: {selectedDispatchEvidence.contactStatus}</span>
                    <span>미리보기: {selectedDispatchEvidence.previewStatus}</span>
                    <span>전송 확인: {selectedDispatchEvidence.sendStatus}</span>
                  </div>
                  <p data-testid="quote-dispatch-block-reason" className="text-[11px] font-medium text-amber-700">
                    차단 사유: {selectedDispatchEvidence.blockReason}
                  </p>
                </div>
              )}
              {selectedDispatchBlocked && selectedDispatchPreflight && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-amber-900">전달 전 보강 필요</p>
                    <p className="text-[11px] text-amber-700 leading-snug">{selectedDispatchPreflight.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px] border-amber-300 text-amber-800"
                      onClick={() => setActiveWorkWindow("request_send")}
                    >
                      공급사 후보 보강
                    </Button>
                    <Link href="/app/search">
                      <Button size="sm" variant="outline" className="w-full h-8 text-[11px] border-amber-300 text-amber-800">
                        요청 보완
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              <Button size="sm" className="w-full h-10 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]"
                onClick={() => {
                  if (selectedDispatchBlocked) return;
                  if (selectedSignals.actionKey) setActiveWorkWindow(selectedSignals.actionKey);
                }}
                disabled={!selectedSignals.actionKey || selectedDispatchBlocked}>
                {selectedSignals.actionKey === "request_send"
                  ? selectedDispatchBlocked ? "공급사에 전송 잠김" : "공급사에 전송"
                  : selectedSignals.railCtaLabel}<ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <div className="flex gap-2">
                <Link href={`/quotes/${selectedQuote.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full h-9 text-xs text-slate-400 border-bd">전체 상세</Button>
                </Link>
                <Button size="sm" variant="ghost" className="flex-1 h-9 text-xs text-slate-500" onClick={() => closeQuoteContextRail("close_btn")}>닫기</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Quote Context Rail (lg+) ═══ */}
      {/* §11.248e-2 — 1200px+ Briefing 패널 접힘 시 floating expand button.
          collapsed && selectedQuote 일 때만 노출. min-[1200px]:flex 으로 1200px+ 한정,
          <1200px 는 bottom-sheet 분기 유지. sticky top-20 right-0 으로 화면 우측 가장자리 고정. */}
      {selectedQuote && selectedSignals && selectedOpStatus && isBriefingCollapsed && (
        <button
          type="button"
          onClick={() => setIsBriefingCollapsed(false)}
          aria-label="Briefing 패널 펼치기"
          data-testid="briefing-floating-expand"
          className="hidden min-[1200px]:flex fixed top-20 right-0 z-30 items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold px-2 py-3 rounded-l-md shadow-md transition-colors writing-mode-vertical"
          style={{ writingMode: "vertical-rl" }}
        >
          <ChevronsLeft className="h-4 w-4" />
          BRIEFING
        </button>
      )}
      {selectedQuote && selectedSignals && selectedOpStatus && (() => {
        const sqResponseCount = selectedQuote.responses?.length ?? 0;
        // §11.212 — sqDaysSince 인라인 계산 제거 (SSR-CSR Date.now() drift 차단).
        // <RelativeTimeText iso={selectedQuote.createdAt} /> 가 useEffect mount 후 set.
        const sqDelayed = isDelayed(selectedQuote);
        const sqDeadline = selectedQuote.deliveryDate ? new Date(selectedQuote.deliveryDate) : null;
        const sqDaysToDeadline = sqDeadline ? Math.ceil((sqDeadline.getTime() - Date.now()) / 86400000) : null;

        // §11.248e-2 — isBriefingCollapsed=true 시 패널 자체 mount 0 (full hide).
        //   floating expand button (위쪽 분기) 으로만 펼치기.
        if (isBriefingCollapsed) return null;
        return (
        /* §11.248e #quote-briefing-panel-responsive — 호영님 P0 견적 관리 #5.
            breakpoint lg (1024px) → min-[1200px] 상향. 1024-1199px 구간 = bottom-sheet 자동 적용
            (테이블 가용 너비 회복). 1200px+ 에서만 우측 480px 패널.
            §11.248e-2 — isBriefingCollapsed 분기 + 헤더 우측 접기 button 추가. */
        <div className="hidden min-[1200px]:flex w-[480px] shrink-0 border-l border-bd flex-col bg-pn ml-5 rounded-xl overflow-hidden self-start sticky top-20" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {/* §11.144 Brief header — 운영 브리핑 + 선택한 견적 (lock §11.142, §11.179 eyebrow 통일).
              §11.248e-2 — 우측에 접기 button (ChevronsRight) 추가. 클릭 시 패널 hide + floating expand button 노출. */}
          <div className="px-4 py-2 border-b border-bd bg-el/30 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold tracking-[0.12em] text-blue-700 uppercase">OPERATIONAL BRIEFING</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">선택한 견적</span>
              <button
                type="button"
                onClick={() => setIsBriefingCollapsed(true)}
                aria-label="Briefing 패널 접기"
                data-testid="briefing-collapse-button"
                className="inline-flex items-center justify-center h-6 w-6 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* §11.144 4 preset chips — anchor jump to brief sections.
              §11.217 Phase 5 — scroll-spy active highlight (activeChipId 매칭 시 blue tone). */}
          <div className="px-4 py-2 border-b border-bd/50 flex flex-wrap gap-1.5">
            {[
              { id: "summary", label: "상태 요약" },
              { id: "facts",   label: "회신 현황" },
              { id: "facts2",  label: "비교 진행" },
              { id: "next",    label: "발주 전환" },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // #operational-brief-3-section-compress — collapsed 시 anchor 가
                  //   mount 되어야 scrollIntoView 작동 → 자동 expand 후 next tick 에 scroll.
                  if (c.id !== "summary" && c.id !== "next") {
                    setBriefDetailExpanded(true);
                  }
                  setActiveChipId(c.id);
                  requestAnimationFrame(() => {
                    const el = document.getElementById(`brief-${c.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                aria-pressed={activeChipId === c.id}
                className={
                  activeChipId === c.id
                    ? "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 transition-colors"
                    : "px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                }
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* A. Rail header */}
          <div className="px-4 py-3 border-b border-bd bg-el/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus.bg} ${selectedOpStatus.text} ${selectedOpStatus.border}`}>
                  {selectedSignals.badge}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={`/quotes/${selectedQuote.id}`}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-900" title="전체 상세 열기"><ExternalLink className="h-3 w-3" /></Button>
                </Link>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-slate-900" onClick={(e) => { e.stopPropagation(); closeQuoteContextRail("x_button"); }}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 truncate mb-1">{selectedQuote.title}</h3>
            <p className="text-[11px] text-slate-500">{selectedQuote.items.length}건 · 회신 {sqResponseCount}/{selectedQuote.items.length} · <RelativeTimeText iso={selectedQuote.createdAt} /></p>
            <p className="text-[11px] text-slate-400 mt-0.5">{selectedSignals.urgency}</p>
          </div>

          {/* Rail scrollable body */}
          <div className="flex-1 overflow-y-auto">

          {/* § 1. 상황 요약 — resolver-derived 1-line + §11.161 LLM narrative hook.
              §11.248e — selectedQuote.title / summary 영역 break-keep (어절 단위 wrap)
              으로 좁은 너비에서도 어색한 줄바꿈 방지 (호영님 spec). */}
          <section id="brief-summary" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">상황 요약</div>
            <p className="text-xs text-slate-700 leading-relaxed break-keep">
              {briefNarrative ?? selectedSignals.summary}
              {briefCached && <span className="ml-1 text-[10px] text-slate-400">· 캐시</span>}
            </p>
          </section>

          {/* §11.221 § 2. 판단 근거 — 인과관계 한 줄 요약 + collapsible 4 cell.
              호영님 5월 8일 결론: "상태 반복" → "인과관계 + 실행 이유". 1차 노출은
              한 줄 ("→" + emoji + 굵게), 4 cell grid 는 "상세 보기" 클릭 시 펼침.
              §11.188 의 4 cell grid (현재 상태 / 회신 / 비교 가능 / 발주 전환) 는
              collapsed 안에 보존 — canonical truth 영향 0. */}
          <div id="brief-facts" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">판단 근거</div>
              <button
                type="button"
                onClick={() => setFactsExpanded(prev => !prev)}
                className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-0.5 transition-colors"
                aria-label={factsExpanded ? "판단 근거 상세 접기" : "판단 근거 상세 보기"}
              >
                {factsExpanded ? "접기" : "상세 보기"}
                {factsExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* 1차 노출 — 한 줄 인과관계 요약 (always visible).
                #quote-rationale-inventory-context Phase 2 — helper call.
                #operational-brief-emoji-sweep — 이모지 제거 후 컬러 도트
                + Clock icon (inventory tail) 시각 위계. B2B 톤 정합. */}
            {(() => {
              const totalItems = selectedQuote.items.length;
              const mostUrgent = findMostUrgentInventoryForQuote(
                selectedQuote.items as never,
                inventories,
              );
              const result = buildBriefRationale({
                status: selectedSignals.status,
                blocker: selectedSignals.blocker,
                nextAction: selectedSignals.nextAction,
                compareReady: selectedSignals.compareReady,
                poReady: selectedSignals.poReady,
                replyCount: sqResponseCount,
                totalItems,
                isSent: selectedQuote.status === "SENT",
                inventoryContext: { mostUrgent },
              });
              return (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${rationaleToneDotClass(result.tone)}`}
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-slate-800 font-medium">
                      {result.message}
                    </p>
                  </div>
                  {result.inventoryTail && (
                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        {result.inventoryTail.message}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2차 — collapsible: 4 cell grid + 보조 (차단/위험 + 다음 액션). */}
            {factsExpanded && (
              <>
                {(() => {
                  const totalItems = selectedQuote.items.length;
                  const replyTone: "ok" | "warn" | "danger" =
                    sqResponseCount === 0
                      ? "danger"
                      : sqResponseCount >= totalItems
                        ? "ok"
                        : "warn";
                  const compareTone: "ok" | "neutral" =
                    selectedSignals.compareReady === "가능" || selectedSignals.compareReady === "완료"
                      ? "ok"
                      : "neutral";
                  const poTone: "ok" | "neutral" =
                    selectedSignals.poReady === "가능" ? "ok" : "neutral";
                  const replyValue = totalItems === 0 ? "—" : `${sqResponseCount}/${totalItems}`;
                  return (
                    <div className="grid grid-cols-2 gap-2.5 mt-3">
                      <MetricCell label="현재 상태" value={selectedSignals.status} tone="neutral" />
                      <MetricCell label="회신" value={replyValue} tone={replyTone} />
                      <MetricCell label="비교 가능" value={selectedSignals.compareReady} tone={compareTone} />
                      <MetricCell label="발주 전환" value={selectedSignals.poReady} tone={poTone} />
                    </div>
                  );
                })()}
                {/* 보조 — 차단/위험 + 다음 액션 (정보 보존) */}
                <div className="mt-3 pt-3 border-t border-bd/30 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">차단/위험</span>
                    <span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-600" : "text-amber-600"}>
                      {selectedSignals.blocker}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">다음 액션</span>
                    <span className="text-slate-700">{selectedSignals.nextAction}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* #operational-brief-3-section-compress Phase B-2 — 5 섹션 collapse.
              호영님 redesign: 7 섹션 → 3 섹션 (한 줄 요약 + 다음 액션 + 상세).
              brief-facts2 / 최근 활동 / brief-risks / AI 판단 4 영역 모두
              briefDetailExpanded conditional 안 wrap. visible 보존: brief-summary
              (§ 1) + brief-facts (§ 2 한 줄) + brief-next (§ 4) + bottom CTA. */}
          {briefDetailExpanded && (<>

          {/* § 2 cont. 핵심 근거 (회신/비교) — response delta */}
          <div id="brief-facts2" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">회신 · 비교 현황</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">수신 견적</span>
                <span className={`font-medium ${sqResponseCount > 0 ? "text-blue-600" : "text-slate-700"}`}>{sqResponseCount}건{sqResponseCount > 0 && selectedQuote.status === "SENT" ? " (새 회신)" : ""}</span>
              </div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">회신 대기</span><span className={selectedQuote.status === "SENT" && sqResponseCount === 0 ? "text-amber-600" : "text-slate-500"}>{selectedQuote.status === "SENT" ? `${selectedQuote.items.length - sqResponseCount}건` : "—"}</span></div>
              {/* 가격 범위 — 회신이 있을 때만 */}
              {(() => {
                const prices = (selectedQuote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
                if (prices.length === 0) return null;
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                const spread = prices.length >= 2 ? Math.round(((max - min) / min) * 100) : 0;
                return (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">가격 범위</span>
                      <span className="text-slate-700 font-medium">₩{min.toLocaleString("ko-KR")}{prices.length >= 2 ? ` ~ ₩${max.toLocaleString("ko-KR")}` : ""}</span>
                    </div>
                    {prices.length >= 2 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">가격 차이</span>
                        <span className={`font-medium ${spread > 20 ? "text-amber-600" : "text-slate-700"}`}>{spread}%</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {/* 최저가 공급사 */}
              {(() => {
                const validResponses = (selectedQuote.responses ?? []).filter(r => typeof r.totalPrice === "number" && r.totalPrice > 0);
                if (validResponses.length === 0) return null;
                const best = validResponses.reduce((a, b) => (a.totalPrice! < b.totalPrice! ? a : b));
                return (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">최저가 공급사</span>
                    <span className="text-emerald-400 font-medium">{best.vendor.name}</span>
                  </div>
                );
              })()}
              <div className="flex justify-between text-xs"><span className="text-slate-400">선택안</span><span className="text-slate-500">{selectedQuote.status === "COMPLETED" ? "확정됨" : "미확정"}</span></div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-snug">{selectedSignals.snapshotNote}</p>
            {/* 요청 품목 요약 */}
            <div className="mt-2 space-y-1">
              {selectedQuote.items.slice(0, 3).map(item => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <span className="text-slate-700 truncate max-w-[200px]">{item.product.name}</span>
                  <span className="text-slate-500 shrink-0">×{item.quantity}</span>
                </div>
              ))}
              {selectedQuote.items.length > 3 && <p className="text-[11px] text-slate-500">+{selectedQuote.items.length - 3}건 더</p>}
            </div>
            {/* 회신이 있을 때: 공급사별 회신 요약 */}
            {sqResponseCount > 0 && (
              <div className="mt-2.5 pt-2 border-t border-bd/30 space-y-1">
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">공급사별 회신</div>
                {(selectedQuote.responses ?? []).slice(0, 4).map(resp => (
                  <div key={resp.id} className="flex justify-between text-[11px]">
                    <span className="text-slate-700 truncate max-w-[140px]">{resp.vendor.name}</span>
                    <span className="text-slate-400">{typeof resp.totalPrice === "number" && resp.totalPrice > 0 ? `₩${resp.totalPrice.toLocaleString("ko-KR")}` : "가격 미제출"}</span>
                  </div>
                ))}
                {(selectedQuote.responses ?? []).length > 4 && <p className="text-[10px] text-slate-500">+{(selectedQuote.responses ?? []).length - 4}건 더</p>}
              </div>
            )}
          </div>

          {/* D. Activity snapshot */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">최근 활동</div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div><span className="text-slate-700">요청 생성</span><RelativeTimeText iso={selectedQuote.createdAt} className="text-slate-500 ml-1.5" /></div>
              </div>
              {selectedQuote.status !== "PENDING" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div><span className="text-slate-700">견적 요청 발송</span></div>
                </div>
              )}
              {sqResponseCount > 0 && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div><span className="text-slate-700">회신 {sqResponseCount}건 도착</span></div>
                </div>
              )}
              {selectedQuote.status === "RESPONDED" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <div><span className="text-slate-700">비교 검토 필요</span></div>
                </div>
              )}
              {selectedQuote.status === "PENDING" && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                  <div><span className="text-slate-500">첫 액션: 견적 요청 발송</span></div>
                </div>
              )}
            </div>
          </div>

          {/* § 3. 리스크 — 차단/위험 + 만료 임박 */}
          <section id="brief-risks" className="px-4 py-3 border-b border-bd/50 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">리스크</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">차단/위험</span>
                <span className={selectedSignals.blocker === "차단 없음" ? "text-emerald-600" : "text-amber-600 font-medium"}>{selectedSignals.blocker}</span>
              </div>
              {sqDaysToDeadline !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">납기 잔여</span>
                  <span className={sqDaysToDeadline < 0 ? "text-rose-600 font-medium" : sqDaysToDeadline <= 3 ? "text-amber-600" : "text-slate-700"}>
                    {sqDaysToDeadline < 0 ? `${Math.abs(sqDaysToDeadline)}일 초과` : `${sqDaysToDeadline}일`}
                  </span>
                </div>
              )}
              {sqDelayed && (
                <p className="text-[11px] text-amber-600 mt-1 inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                  회신 지연 — 재요청 권장
                </p>
              )}
            </div>
          </section>

          {/* (was E. Decision summary + AI) — § 1 상황 요약 의 AI 판단 보조 */}
          <div className="px-4 py-3 border-b border-bd/50">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">AI 판단</div>
            <p className="text-xs text-slate-700 leading-relaxed">{selectedSignals.summary}</p>
            {selectedSignals.aiRecommendation && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1.5">
                <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />{selectedSignals.aiRecommendation}
              </p>
            )}
          </div>

          </>)}{/* end #operational-brief-3-section-compress collapse */}

          {/* § 4. 다음 조치 — 연결 작업 + 발주 전환 정보.
              §11.222 #quote-brief-next-prune — 호영님 spec #5: 값이 "없음"/
              "불필요"/"해당없음" 인 hardcoded row 는 hide (해당없는 정보가
              "할 게 있다" 정보만큼 면적 점유). 실제 액션 항목 (handoffTarget +
              handoffStatus) 만 노출. */}
          <section id="brief-next" className="px-4 py-3 scroll-mt-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">다음 조치</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-slate-400">다음 연결</span><span className="text-slate-700">{selectedSignals.handoffTarget}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">전환 상태</span><span className={selectedSignals.poReady === "가능" ? "text-emerald-400" : "text-amber-600"}>{selectedSignals.handoffStatus}</span></div>
            </div>
          </section>

          {/* §11.55 — G-pre "공급사 회신 견적서 등록" 블록 제거.
              backend (`/api/quotes/[id]/attach-document`) 미구현으로
              dead-end UI였음. LabAxis 견적 응답 표준 워크플로우는
              자동 처리(Path 1: vendor token 응답 링크 + Path 2: SendGrid
              inbound webhook)이며 운영자가 PDF를 직접 등록하는
              시나리오는 LabAxis 운영 ontology에 없음. 미래 demand
              발생 시 backend + UI 함께 재구현. */}

          </div>{/* end scrollable body */}

          {/* G. Bottom sticky action — 3 canonical CTA (rail-first, no default page nav) */}
          <div className="px-4 py-3 border-t border-bd bg-el/30 space-y-1.5">
            {selectedDispatchEvidence && (
              <div
                data-testid="quote-dispatch-readiness-strip"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1.5"
              >
                <div
                  data-testid="quote-dispatch-readiness-row"
                  className="grid grid-cols-4 gap-2 text-[10px] text-slate-600"
                >
                  <span>공급사: {selectedDispatchEvidence.supplierStatus}</span>
                  <span>연락처: {selectedDispatchEvidence.contactStatus}</span>
                  <span>미리보기: {selectedDispatchEvidence.previewStatus}</span>
                  <span>전송 확인: {selectedDispatchEvidence.sendStatus}</span>
                </div>
                <p data-testid="quote-dispatch-block-reason" className="text-[11px] font-medium text-amber-700">
                  차단 사유: {selectedDispatchEvidence.blockReason}
                </p>
              </div>
            )}
            {selectedDispatchBlocked && selectedDispatchPreflight && (
              <div
                data-testid="quote-dispatch-blocker-summary"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2"
              >
                <div>
                  <p className="text-[11px] font-semibold text-amber-900">전달 전 보강 필요</p>
                  <p className="text-[11px] text-amber-700 leading-snug">{selectedDispatchPreflight.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    data-testid="quote-dispatch-supplier-remediation-cta"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-amber-300 text-amber-800"
                    onClick={() => setActiveWorkWindow("request_send")}
                  >
                    공급사 후보 보강
                  </Button>
                  <Link href="/app/search">
                    <Button
                      data-testid="quote-dispatch-request-remediation-cta"
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-[11px] border-amber-300 text-amber-800"
                    >
                      요청 보완
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            {/* #quotes-rail-cta-outline-contrast — 호영님 spec: outline variant
                ("회신 검토 시작" 등) 가 Button default 의 bg-primary (blue) 위에
                text-slate-700 만 override 되어 contrast 부족 (파란 배경 + 어두운
                텍스트). bg-white + text-slate-900 + border 명시로 outline 본 의도
                (흰 배경 + 어두운 글자 + 테두리) 정합. */}
            <Button
              data-testid={selectedSignals.actionKey === "request_send" ? "quote-dispatch-review-cta" : undefined}
              size="sm"
              variant={selectedSignals.ctaVariant === "outline" ? "outline" : "default"}
              className={`w-full h-8 text-xs font-medium ${selectedDispatchBlocked ? "bg-slate-200 text-slate-500 cursor-not-allowed" : selectedSignals.ctaVariant === "default" ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50"}`}
              onClick={() => {
                if (selectedDispatchBlocked) return;
                if (selectedSignals.actionKey) {
                  setActiveWorkWindow(selectedSignals.actionKey);
                }
              }}
              disabled={!selectedSignals.actionKey || selectedDispatchBlocked}
              title={selectedDispatchBlocked ? selectedDispatchPreflight?.summary : undefined}>
              {selectedSignals.actionKey === "request_send"
                ? selectedDispatchBlocked ? "공급사에 전송 잠김" : "공급사에 전송"
                : selectedSignals.railCtaLabel}<ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
            {/* §11.248e — '전체 상세 열기' / '닫기' Button 44px 터치 영역 확보 (호영님 spec).
                h-7 (28px) → min-h-[44px] + h-11 (Tailwind 44px) 적용. */}
            <div className="flex gap-1.5">
              <Link href={`/quotes/${selectedQuote.id}`} className="flex-1">
                <Button size="sm" variant="outline" className="w-full min-h-[44px] h-11 text-[11px] text-slate-400 border-bd">전체 상세 열기</Button>
              </Link>
              <Button size="sm" variant="ghost" className="flex-1 min-h-[44px] h-11 text-[11px] text-slate-500" onClick={(e) => { e.stopPropagation(); closeQuoteContextRail("x_button"); }}>{selectedSignals.tertiaryCta}</Button>
            </div>
          </div>
        </div>
        );
      })()}

      </div>{/* end flex container */}

      {/* §11.155 모바일 변종 — desktop rail (hidden lg:flex) 와 mutually exclusive.
          §11.264i — briefSheetOpen 분리 (호영님 spec P0 견적 모바일 2중 겹침 fix).
          기존: selectedQuote set 시 자동 렌더 → §11.248e mobile context sheet 와
          < 1200px viewport 에서 동시 렌더 (2층 겹침). 신규: ✦ 운영 브리핑 버튼으로
          명시적 진입 시에만 활성. closeQuoteContextRail 시 setBriefSheetOpen(false)
          동기 → 견적 닫힐 때 운영 브리핑도 자동 닫힘 (orphan 방지). */}
      {briefSheetOpen && selectedQuote && selectedSignals && (
        <MobileOperationalBriefSheet
          open={briefSheetOpen}
          onClose={() => setBriefSheetOpen(false)}
          /* §11.264d — 견적명 동적 결합 (호영님 spec #3-2 P1).
             기존 정적 "선택한 견적" → "선택한 견적 · {견적명}" 으로 변경.
             root cause: caller 정적 string. 컴포넌트 변경 0 (5 surface 영향 0).
             selectedQuote.title 은 이미 page 다른 위치 (line 2775, 2985, 3482,
             3529) 에서 사용 중. canonical truth lock: chips override
             (§11.264a 정합) / props 시그니처 보존. */
          objectLabel={`선택한 견적 · ${selectedQuote.title}`}
          chips={[
            { id: "summary", label: "상태 요약" },
            { id: "facts",   label: "회신 현황" },
            { id: "risks",   label: "리스크" },
            { id: "next",    label: "발주 전환" },
          ]}
          summary={<p className="text-xs text-slate-700 leading-relaxed">{selectedSignals.summary}</p>}
          facts={
            // §11.222 + #quote-rationale-inventory-context Phase 2 — helper call.
            //   1차 노출 한 줄 (desktop §11.221 동일 메시지 + inventory tail).
            //   같은 factsExpanded state 공유 (desktop + mobile 동일 toggle).
            <div className="space-y-2 text-xs">
              {/* #operational-brief-emoji-sweep — mobile mirror desktop §11.221.
                  컬러 도트 + Clock icon (B2B 톤). */}
              {(() => {
                const totalItems = selectedQuote.items.length;
                const mostUrgent = findMostUrgentInventoryForQuote(
                  selectedQuote.items as never,
                  inventories,
                );
                const result = buildBriefRationale({
                  status: selectedSignals.status,
                  blocker: selectedSignals.blocker,
                  nextAction: selectedSignals.nextAction,
                  compareReady: selectedSignals.compareReady,
                  poReady: selectedSignals.poReady,
                  replyCount: selectedQuote.responses?.length ?? 0,
                  totalItems,
                  isSent: selectedQuote.status === "SENT",
                  inventoryContext: { mostUrgent },
                });
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${rationaleToneDotClass(result.tone)}`}
                        aria-hidden="true"
                      />
                      <p className="text-xs leading-relaxed text-slate-800 font-medium">
                        {result.message}
                      </p>
                    </div>
                    {result.inventoryTail && (
                      <div className="flex items-start gap-2">
                        <Clock className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                        <p className="text-[11px] leading-relaxed text-slate-600">
                          {result.inventoryTail.message}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => setFactsExpanded(prev => !prev)}
                className="text-[10px] text-slate-500 hover:text-slate-700 inline-flex items-center gap-0.5 transition-colors"
                aria-label={factsExpanded ? "판단 근거 상세 접기" : "판단 근거 상세 보기"}
              >
                {factsExpanded ? "접기" : "상세 보기"}
                {factsExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {factsExpanded && (
                <div className="space-y-1 pt-2 border-t border-slate-200">
                  <div className="flex justify-between"><span className="text-slate-400">현재 상태</span><span className="font-medium">{selectedSignals.status}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">다음 액션</span><span>{selectedSignals.nextAction}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">수신 견적</span><span>{(selectedQuote.responses?.length ?? 0)}건</span></div>
                </div>
              )}
            </div>
          }
          risks={
            <p className={`text-xs ${selectedSignals.blocker === "차단 없음" ? "text-emerald-700" : "text-amber-700"}`}>
              {selectedSignals.blocker}
            </p>
          }
          next={<p className="text-xs text-slate-700">{selectedSignals.handoffTarget}</p>}
          primaryCta={selectedDispatchBlocked ? {
            label: "공급사 후보 보강",
            onClick: () => { setActiveWorkWindow("request_send"); },
          } : selectedSignals.actionKey ? {
            label: selectedSignals.railCtaLabel,
            onClick: () => { setActiveWorkWindow(selectedSignals.actionKey); },
          } : undefined}
        />
      )}

      {/* ═══ 견적 발송 워크벤치 (request_send) ═══ */}
      {activeWorkWindow === "request_send" && selectedQuote && (
        <VendorRequestModal
          open={true}
          onOpenChange={(open) => { if (!open) setActiveWorkWindow(null); }}
          quoteId={selectedQuote.id}
          quoteSummary={selectedQuote.title}
          // #user-supplier-registration Phase 5 — org_book source forward.
          resolvedSuppliers={resolveSuppliers({ quote: selectedQuote, organizationVendors, organizationVendorProducts })}
          draftMessage={buildDraftMessage(selectedQuote)}
          onSuccess={handleSendSuccess}
        />
      )}

      {/* ═══ §11.217 Phase 3 — 일괄 발송 검토 sheet ═══ */}
      {/* #user-supplier-registration Phase 5 — getPreflight 가 organizationVendors
          를 closure 로 capture. BatchDispatchSheet 가 props 로도 받음. */}
      <BatchDispatchSheet
        open={batchSheetOpen}
        onOpenChange={setBatchSheetOpen}
        selectedQuotes={selectedQuotes as never}
        getPreflight={((q: Quote) => getQuoteDispatchPreflight(q, organizationVendors, organizationVendorProducts)) as never}
        organizationVendors={organizationVendors}
        onSuccess={() => { refetch(); clearSelection(); }}
      />

      {/* ═══ §11.228 #quote-management-v2-phase-c1 — 일괄 리마인더 sheet ═══ */}
      {/* responseCount === 0 quote 만 filter → vendor-requests POST 재호출.
          §11.225 organizationVendorProducts 정합으로 organizationVendors forward. */}
      <BatchReminderSheet
        open={batchReminderOpen}
        onOpenChange={setBatchReminderOpen}
        selectedQuotes={selectedQuotes as never}
        organizationVendors={organizationVendors}
        onSuccess={() => { refetch(); clearSelection(); }}
      />

      {/* ═══ §11.228 #quote-management-v2-phase-c1 — 일괄 상태 변경 sheet ═══ */}
      {/* PATCH /api/quotes/[id]/status N회 Promise.allSettled.
          ALLOWED_STATUS_TRANSITIONS server-side validate — UI 는 partial failure 통계. */}
      <BatchStatusChangeSheet
        open={batchStatusChangeOpen}
        onOpenChange={setBatchStatusChangeOpen}
        selectedQuotes={selectedQuotes as never}
        onSuccess={() => { refetch(); clearSelection(); }}
      />

      {/* ═══ Center Work Window — rail CTA에서 열리는 task surface ═══ */}
      {activeWorkWindow && activeWorkWindow !== "request_send" && selectedQuote && selectedSignals && (
        <CenterWorkWindow
          open={true}
          onClose={() => setActiveWorkWindow(null)}
          title={selectedSignals.railCtaLabel}
          subtitle={`${selectedQuote.title} · ${selectedSignals.badge}`}
          phase="ready"
          primaryAction={{
            label: activeWorkWindow === "compare_review"
              ? ((selectedQuote.responses?.length ?? 0) >= 2 ? "선택안 확정" : "추가 회신 확보")
              : activeWorkWindow === "approval_prep"
              ? "승인 패키지 준비 완료"
              : selectedSignals.ctaLabel,
            onClick: () => {
              setActiveWorkWindow(null);
            },
          }}
          secondaryAction={{ label: "닫기", onClick: () => setActiveWorkWindow(null) }}
        >
          <div className="space-y-4">
            {/* Work window header context */}
            <div className="rounded-lg border border-bd bg-pn p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border font-medium ${selectedOpStatus?.bg} ${selectedOpStatus?.text} ${selectedOpStatus?.border}`}>
                  {selectedSignals.badge}
                </span>
                <span className="text-xs text-slate-400">#{selectedQuote.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{selectedQuote.title}</h3>
              <p className="text-xs text-slate-400">{selectedSignals.summary}</p>
            </div>

            {/* Action-specific content */}
            {activeWorkWindow === "followup_send" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-700">재요청 / 추가 회신 확보</p>
                <p className="text-xs text-slate-400">미응답 공급사에 재요청하거나 추가 공급사를 탐색합니다.</p>
                <div className="text-xs text-slate-500">현재 회신: {selectedQuote.responses?.length ?? 0}건</div>
              </div>
            )}
            {activeWorkWindow === "compare_review" && (() => {
              const sqrc = selectedQuote.responses?.length ?? 0;
              const validQuotes = sqrc;
              const hasSelection = selectedQuote.status === "COMPLETED";
              const blockers: { label: string; reason: string; action: string }[] = [];
              if (validQuotes < 2) blockers.push({ label: "유효 견적 부족", reason: "비교에 필요한 견적 수가 부족합니다", action: "추가 회신 확보" });
              if (!hasSelection && validQuotes >= 2) blockers.push({ label: "선택안 미확정", reason: "비교는 가능하지만 선택안이 아직 확정되지 않았습니다", action: "선택안 확정" });
              const canConfirm = validQuotes >= 2 && blockers.length === 0;
              const responses = selectedQuote.responses ?? [];
              const prices = responses.map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);

              return (
                <div className="space-y-4">
                  {/* A. Compare Snapshot Block */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">비교 현황</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div><p className="text-lg font-bold tabular-nums text-slate-900">{sqrc}</p><p className="text-[11px] text-slate-500">수신 견적</p></div>
                      <div><p className="text-lg font-bold tabular-nums text-slate-900">{validQuotes}</p><p className="text-[11px] text-slate-500">유효 견적</p></div>
                      <div><p className="text-lg font-bold tabular-nums text-slate-900">{selectedQuote.items.length}</p><p className="text-[11px] text-slate-500">품목</p></div>
                      <div><p className={`text-lg font-bold ${hasSelection ? "text-emerald-400" : "text-amber-600"}`}>{hasSelection ? "확정" : "미확정"}</p><p className="text-[11px] text-slate-500">선택안</p></div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      {validQuotes >= 2 ? "비교 자체는 가능하지만 선택안 확정이 남아 있습니다" : "유효 견적이 부족해 비교 후보가 안정적으로 만들어지지 않았습니다"}
                    </p>
                  </div>

                  {/* B. Candidate Decision Block */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">비교 후보</p>
                    {responses.length > 0 ? (
                      <div className="space-y-2">
                        {responses.slice(0, 2).map((r, idx) => {
                          const isRecommended = idx === 0 && prices.length > 0;
                          return (
                            <div key={r.id} className={`rounded border p-3 ${isRecommended ? "border-blue-600/30 bg-blue-600/5" : "border-bd"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-slate-700">{r.vendor.name || "공급사"}</span>
                                  {isRecommended && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-600 border border-blue-600/20">추천</span>}
                                </div>
                                {r.totalPrice && <span className="text-xs font-semibold tabular-nums text-slate-900">₩{r.totalPrice.toLocaleString("ko-KR")}</span>}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {isRecommended ? "가격 우위 · 기존 거래처" : "대안 후보"}
                              </p>
                            </div>
                          );
                        })}
                        {responses.length > 2 && <p className="text-[11px] text-slate-500">+{responses.length - 2}건 더</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-3">수신 견적이 없어 비교 후보를 구성할 수 없습니다. 추가 회신 확보가 필요합니다.</p>
                    )}
                  </div>

                  {/* C. Blocker & Handoff Block */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">차단 / 다음 단계</p>
                    {blockers.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {blockers.map((b, idx) => (
                          <div key={idx} className="rounded border border-amber-600/20 bg-amber-600/5 px-3 py-2">
                            <div className="flex items-center gap-2 text-xs mb-0.5">
                              <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                              <span className="text-amber-300 font-medium">{b.label}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 pl-5">{b.reason}</p>
                            <p className="text-[11px] text-blue-600 pl-5 mt-0.5">해소 액션: {b.action}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3">
                        <CheckCircle2 className="h-3.5 w-3.5" />차단 없음 — 선택안 확정 가능
                      </div>
                    )}
                    <div className="flex justify-between text-xs pt-2 border-t border-bd/50">
                      <span className="text-slate-400">다음 목적지</span>
                      <span className="text-slate-700">{canConfirm ? "승인 패키지 준비 또는 발주 전환" : "조건 해소 후 확정"}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {activeWorkWindow === "approval_prep" && (() => {
              const sqrc = selectedQuote.responses?.length ?? 0;
              const prices = (selectedQuote.responses ?? []).map(r => r.totalPrice).filter((p): p is number => typeof p === "number" && p > 0);
              const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
              const bestVendor = selectedQuote.responses?.find(r => r.totalPrice === bestPrice);

              return (
                <div className="space-y-4">
                  {/* A. Approval Package Summary */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">승인 패키지 요약</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[11px] text-slate-500">선택안</p>
                        <p className="text-xs text-slate-700 font-medium">{bestVendor?.vendor.name ?? "미확정"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">예상 금액</p>
                        <p className="text-xs text-slate-700 font-medium tabular-nums">{bestPrice ? `₩${bestPrice.toLocaleString("ko-KR")}` : "미정"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">품목</p>
                        <p className="text-xs text-slate-700">{selectedQuote.items.length}건</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">공급사</p>
                        <p className="text-xs text-slate-700">{sqrc}곳 회신</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">현재 선택안은 확정되었고 외부 승인 패키지 전달 준비 단계입니다</p>
                  </div>

                  {/* B. Approval Readiness & Exception */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">승인 준비 상태</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">선택안 확정</span>
                        <span className={bestPrice ? "text-emerald-400" : "text-amber-600"}>{bestPrice ? "준비 완료" : "확인 필요"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">문서 상태</span>
                        <span className="text-emerald-400">준비 완료</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">예산 차단</span>
                        <span className="text-emerald-400">차단 없음</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">승인 정책</span>
                        <span className="text-slate-700">외부 승인 필요</span>
                      </div>
                    </div>
                  </div>

                  {/* C. Handoff Recording */}
                  <div className="rounded-lg border border-bd bg-pn p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">승인 전달 기록</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">전달 채널</span>
                        <span className="text-slate-700">외부 전자결재</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">현재 상태</span>
                        <span className="text-amber-600">승인 준비 중</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">승인 완료 후</span>
                        <span className="text-slate-700">발주 전환 준비</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            {activeWorkWindow === "po_conversion" && (
              <div className="rounded-lg border border-bd bg-pn p-4 space-y-3">
                <p className="text-xs font-medium text-slate-700">발주 전환 준비</p>
                <p className="text-xs text-slate-400">line item을 확정하고 발주 조건을 검토한 뒤 PO를 생성합니다.</p>
                <div className="text-xs text-slate-500">품목: {selectedQuote.items.length}건</div>
              </div>
            )}

            {/* AI recommendation */}
            {selectedSignals.aiRecommendation && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-slate-600 shrink-0" />{selectedSignals.aiRecommendation}
              </p>
            )}
          </div>
        </CenterWorkWindow>
      )}

      {/* ═══ AI 견적서 파싱 모달 ═══ */}
      <AiQuoteParseModal
        open={aiParseModalOpen}
        onClose={() => setAiParseModalOpen(false)}
        quoteId={selectedQuoteId}
        onRegistered={() => {
          refetch();
          toast({ title: "AI 견적서 파싱 완료", description: "벤더 응답이 등록되었습니다." });
        }}
      />

      {/* ═══ AI 견적서 비교 모달 ═══ */}
      <Dialog open={aiCompareOpen} onOpenChange={setAiCompareOpen}>
        <DialogContent className="max-w-2xl bg-white border-slate-200 p-0 gap-0">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-slate-900">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                AI 견적서 비교 분석
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                등록된 견적의 공급사별 조건을 비교하고 협상 포인트를 제안합니다
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
            {aiCompareLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-slate-500">견적 데이터를 분석하고 있습니다...</p>
              </div>
            )}

            {aiCompareError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{aiCompareError}</p>
                <button onClick={runAiQuoteCompare} className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium underline">재시도</button>
              </div>
            )}

            {aiCompareResult && (
              <>
                {/* 공급사별 비교 테이블 */}
                {aiCompareResult.comparison.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">공급사 비교</h4>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="text-left px-3 py-2 font-medium">공급사</th>
                            <th className="text-left px-3 py-2 font-medium">가격</th>
                            <th className="text-left px-3 py-2 font-medium">납기</th>
                            <th className="text-left px-3 py-2 font-medium">배송비</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aiCompareResult.comparison.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium text-slate-900">{row.vendor}</td>
                              <td className="px-3 py-2 text-slate-700">{row.price}</td>
                              <td className="px-3 py-2 text-slate-700">{row.leadTime}</td>
                              <td className="px-3 py-2 text-slate-700">{row.shippingFee}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 추천 */}
                {aiCompareResult.recommendation && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">추천</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{aiCompareResult.recommendation}</p>
                  </div>
                )}

                {/* 협상 가이드 */}
                {aiCompareResult.negotiationGuide && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-900">협상 포인트</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{aiCompareResult.negotiationGuide}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setAiCompareOpen(false)}>닫기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Intake Dock (외부 견적서 업로드 / BOM 업로드) ── */}
      <QuoteIntakeDock
        open={intakeDockOpen}
        onOpenChange={setIntakeDockOpen}
        source={intakeDockSource}
        onCommitSuccess={() => {
          setIntakeDockOpen(false);
          setIntakeDockSource(null);
          refetch();
        }}
      />

      {/* §11.181 — 운영 브리핑 floating entry (default = popup open).
          §11.258-sweep — §11.257 후속: 모바일 (<lg) BarcodeScanFab 겹침 해소,
          데스크탑 한정 노출. 모바일 inline 진입은 §11.258-sweep-2 백로그. */}
      <div className="hidden lg:block">
        <OperationalBriefFloatingEntry controls="operational-brief-popup" />
      </div>
      {/* §11.258-sweep-2 — 모바일 좌측 하단 ✨ 운영 브리핑 진입 (방안 1). */}
      <MobileBriefInlineButton />
    </div>
  );
}

function QuotesPageInner() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    }>
      <QuotesPageContent />
    </Suspense>
  );
}

// §11.214b Path Z — NoSSR wrapper.
export default function QuotesPage() {
  return (
    <NoSSR>
      <QuotesPageInner />
    </NoSSR>
  );
}
