"use client";

export const dynamic = "force-dynamic";

import { csrfFetch } from "@/lib/api-client";
// §11.99 — audit event label helper (settings recent activity 와 audit page 일관)
import {
  AUDIT_EVENT_LABELS,
  AUDIT_TONE_DOT_CLASSES,
} from "@/lib/audit/event-labels";
import { useState, Suspense, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
// §11.193a hot fix — billing section 의 LabAxis Enterprise dark card +
// CurrentPlan badge 가 Card / CardContent 사용. import 누락 시 prod runtime
// `ReferenceError: Card is not defined` → settings 진입 자체 실패.
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Upload,
  Lock,
  Bell,
  Mail,
  Shield,
  Loader2,
  ChevronRight,
  Package,
  Phone,
  CreditCard,
  Receipt,
  Check,
  RotateCcw,
  AlertCircle,
  Clock,
  FileText,
  AlertTriangle,
  XCircle,
  Zap,
  ClipboardCheck,
  Server,
  Trash2,
  UserPlus,
  KeyRound,
  Crown,
  Settings,
  Brain,
  Link2,
  Building2,
  Globe,
  Fingerprint,
  Activity,
  Gauge,
  Database,
  Webhook,
  ShieldCheck,
  Users,
  Eye,
  Sliders,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════
// Types & Constants
// ══════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자 (Admin)",
  USER: "운영자 (Operator)",
  RESEARCHER: "연구실 관리자 (Lab Manager)",
  BUYER: "구매 담당자 (Procurement)",
  SUPPLIER: "공급사 (Supplier)",
};

type SettingsSection =
  | "operator"
  | "ontology"
  | "security"
  | "integrations"
  | "notifications"
  | "billing";

type DeliveryMode = "immediate" | "daily";

interface NotificationItem {
  id: string;
  category: string;
  label: string;
  description: string;
  icon: React.ElementType;
  inApp: boolean;
  email: boolean;
  deliveryOverride: DeliveryMode | null;
}

type CancelReason = "price" | "features" | "frequency" | "team" | "alternative" | "performance" | "other";

const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: "price", label: "가격 부담" },
  { value: "features", label: "기능 부족" },
  { value: "frequency", label: "사용 빈도 낮음" },
  { value: "team", label: "팀 도입 어려움" },
  { value: "alternative", label: "다른 도구 사용" },
  { value: "performance", label: "성능/안정성 문제" },
  { value: "other", label: "기타" },
];

const SAFETY_CRITICAL_IDS = new Set(["stock_low", "stock_expiry", "safety_compliance", "system_security"]);

function getSaveOffer(reason: CancelReason | null): { title: string; description: string; cta: string } {
  switch (reason) {
    case "price":
      return { title: "다운그레이드 옵션이 있습니다", description: "현재 플랜 대신 더 저렴한 플랜으로 변경할 수 있습니다.", cta: "플랜 비교하기" };
    case "features":
      return { title: "로드맵을 확인해 보세요", description: "요청하신 기능이 개발 로드맵에 포함되어 있을 수 있습니다.", cta: "로드맵 확인" };
    case "team":
      return { title: "온보딩 지원을 요청하세요", description: "팀 도입에 어려움이 있으시다면, 전담 온보딩 지원을 무료로 제공해 드립니다.", cta: "온보딩 지원 요청" };
    default:
      return { title: "지원팀에 문의해 주세요", description: "해결할 수 있는 방법이 있을 수 있습니다.", cta: "지원팀 문의" };
  }
}

// §11.88 #settings-billing-real-fetcher — DEMO_INVOICES 제거.
// 청구 내역은 /api/billing/invoices alive endpoint 가 real Subscription invoices
// 또는 mock-backed fallback (운영 데이터 0건 시) 반환. Stripe wiring 은 별도 트랙.

// ══════════════════════════════════════════════
// Nav Configuration — OS-style system menu
// ══════════════════════════════════════════════

const NAV_GROUPS: { group: string; items: { id: SettingsSection; label: string; sublabel: string; icon: React.ElementType }[] }[] = [
  {
    group: "메뉴",
    items: [
      { id: "operator", label: "운영자 및 워크스페이스", sublabel: "식별 정보 및 운영 정보", icon: Fingerprint },
      { id: "ontology", label: "온톨로지 엔진 (AI)", sublabel: "추론 및 자동화 규칙", icon: Brain },
      { id: "security", label: "보안 및 접근 제어", sublabel: "역할 권한 및 승인 라우팅", icon: ShieldCheck },
      { id: "integrations", label: "시스템 연동", sublabel: "외부 시스템 및 공급사 연결", icon: Webhook },
    ],
  },
  {
    group: "시스템",
    items: [
      { id: "notifications", label: "알림 관리", sublabel: "알림 채널 및 빈도", icon: Bell },
      { id: "billing", label: "청구 및 구독", sublabel: "플랜, 결제, 청구서", icon: CreditCard },
    ],
  },
];

// ══════════════════════════════════════════════
// Fallback
// ══════════════════════════════════════════════

function SettingsPageFallback() {
  return (
    <div className="flex-1 p-8 bg-sh">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-el rounded w-1/4 mb-4" />
          <div className="h-4 bg-el rounded w-1/2 mb-8" />
          <div className="flex gap-6">
            <div className="w-56 h-64 bg-el rounded" />
            <div className="flex-1 space-y-4">
              <div className="h-32 bg-el rounded" />
              <div className="h-32 bg-el rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Main Content
// ══════════════════════════════════════════════

function SettingsPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [activeSection, setActiveSection] = useState<SettingsSection>("operator");

  // ── Profile state ──
  const [profileName, setProfileName] = useState(session?.user?.name || "");
  const [profileBio, setProfileBio] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [countryCode, setCountryCode] = useState("+82");
  const [profilePhone, setProfilePhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  // §11.157 — operatorRole free-text useState 제거 (Identity Governance).
  //   canonical role display 는 line ~488 `roleLabel` + line ~645 Badge 가 담당.
  //   §11.74 SectionCard "운영 역할 및 업무 범위" (line ~660) 는 read-only 정합 유지.
  // §11.159 — workspaceName / currencyUnit hardcoded mock 제거.
  //   workspace 는 /api/workspaces canonical fetch (아래 useQuery), currency 는
  //   Workspace 모델에 필드 부재이므로 "KRW (시스템 기본값)" 명시 fallback.

  // ── Ontology engine state ──
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [anomalyDetectionSensitivity, setAnomalyDetectionSensitivity] = useState(70);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(true);
  const [autoApprovalLimit, setAutoApprovalLimit] = useState("1000000");
  const [priceAlertThreshold, setPriceAlertThreshold] = useState(15);

  // ── Security / RBAC state ──
  const [approvalTier1, setApprovalTier1] = useState("1000000");
  const [approvalTier2, setApprovalTier2] = useState("5000000");
  const [approvalTier3, setApprovalTier3] = useState("10000000");

  // ── Notification state ──
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: "stock_low", category: "재고", label: "재고 부족", description: "안전 재고 수량 이하로 떨어진 품목 알림", icon: Package, inApp: true, email: true, deliveryOverride: "immediate" },
    { id: "stock_expiry", category: "재고", label: "만료 임박", description: "유효기간 7일 이내 품목 자동 알림", icon: AlertTriangle, inApp: true, email: true, deliveryOverride: "immediate" },
    { id: "stock_disposal", category: "재고", label: "폐기 검토", description: "만료·손상 품목의 폐기 절차 검토 요청", icon: Trash2, inApp: true, email: false, deliveryOverride: null },
    { id: "quote_new", category: "견적/구매", label: "견적 도착", description: "요청한 견적에 대한 공급사 응답 도착", icon: FileText, inApp: true, email: true, deliveryOverride: null },
    { id: "quote_approval", category: "견적/구매", label: "승인 필요", description: "구매 요청 또는 견적 승인 대기 알림", icon: ClipboardCheck, inApp: true, email: true, deliveryOverride: null },
    { id: "quote_delay", category: "견적/구매", label: "공급사 응답 지연", description: "견적 요청 후 48시간 이상 미응답", icon: Clock, inApp: true, email: false, deliveryOverride: null },
    { id: "org_invite", category: "조직/권한", label: "초대", description: "조직 또는 워크스페이스 초대 수신", icon: UserPlus, inApp: true, email: true, deliveryOverride: null },
    { id: "org_role_change", category: "조직/권한", label: "권한 변경", description: "내 역할 또는 팀원 권한 변경 알림", icon: KeyRound, inApp: true, email: false, deliveryOverride: null },
    { id: "org_owner_transfer", category: "조직/권한", label: "Owner 이전", description: "조직 소유권 이전 요청 또는 완료", icon: Crown, inApp: true, email: true, deliveryOverride: null },
    { id: "safety_compliance", category: "안전", label: "규정 위반", description: "보관 조건, 라벨링 등 규정 위반 경고", icon: AlertCircle, inApp: true, email: true, deliveryOverride: "immediate" },
    { id: "safety_msds", category: "안전", label: "MSDS 미등록", description: "안전보건자료 미등록 또는 누락 품목 알림", icon: Shield, inApp: true, email: true, deliveryOverride: null },
    { id: "billing_failed", category: "결제/구독", label: "결제 실패", description: "카드 만료 또는 결제 수단 오류", icon: XCircle, inApp: true, email: true, deliveryOverride: null },
    { id: "billing_plan_change", category: "결제/구독", label: "구독 상태 변경", description: "플랜 업그레이드·다운그레이드·갱신 알림", icon: CreditCard, inApp: true, email: true, deliveryOverride: null },
    { id: "billing_cancel", category: "결제/구독", label: "해지", description: "구독 해지 예정 또는 해지 완료 안내", icon: RotateCcw, inApp: true, email: true, deliveryOverride: null },
    { id: "system_pdf_fail", category: "시스템", label: "PDF 분석 실패", description: "업로드한 PDF의 자동 분석 실패 알림", icon: FileText, inApp: true, email: false, deliveryOverride: null },
    { id: "system_security", category: "시스템", label: "보안 알림", description: "비정상 로그인 시도 및 권한 변경", icon: Lock, inApp: true, email: true, deliveryOverride: "immediate" },
    { id: "system_daily_digest", category: "시스템", label: "일일 요약 메일", description: "하루 동안의 주요 활동을 정리한 요약 메일", icon: Mail, inApp: false, email: true, deliveryOverride: null },
  ]);
  const [notificationFrequency, setNotificationFrequency] = useState<DeliveryMode>("immediate");

  // ── Cancel flow state ──
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelReason, setCancelReason] = useState<CancelReason | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState("");

  // ── Save state ──
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [initialNotifications, setInitialNotifications] = useState(() =>
    JSON.stringify(notifications.map((n) => ({ id: n.id, inApp: n.inApp, email: n.email, deliveryOverride: n.deliveryOverride })))
  );
  const [initialFrequency, setInitialFrequency] = useState<DeliveryMode>("immediate");

  // ── Queries ──
  const { data: userData } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile");
      if (!response.ok) throw new Error("Failed to fetch user profile");
      return response.json();
    },
    enabled: !!session,
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "billing") setActiveSection("billing");
    if (tab === "notifications") setActiveSection("notifications");
  }, [searchParams]);

  useEffect(() => {
    if (userData?.phone && typeof userData.phone === "string") {
      const match = userData.phone.match(/^(\+\d+)\s*(.*)$/);
      if (match) { setCountryCode(match[1]); setProfilePhone(match[2].trim()); }
      else setProfilePhone(userData.phone);
    }
  }, [userData?.phone]);

  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const response = await csrfFetch("/api/billing");
      if (!response.ok) throw new Error("Failed to fetch billing");
      return response.json();
    },
    enabled: activeSection === "billing",
  });

  // §11.88 #settings-billing-real-fetcher
  // DEMO_INVOICES 로컬 const → /api/billing/invoices alive endpoint.
  // endpoint 자체는 real Subscription invoices 또는 mock fallback 반환.
  // shape: { invoices: [{id, number, description, amountDue, amountPaid,
  //   currency, periodStart, periodEnd, status, invoicePdfUrl}], total }
  const { data: invoicesData } = useQuery<{
    invoices: Array<{
      id: string;
      number?: string;
      description?: string;
      amountDue?: number;
      amountPaid?: number;
      currency?: string;
      periodStart?: string;
      periodEnd?: string;
      status?: string;
      invoicePdfUrl?: string | null;
    }>;
    total: number;
  }>({
    queryKey: ["billing-invoices"],
    queryFn: async () => {
      const response = await fetch("/api/billing/invoices");
      if (!response.ok) return { invoices: [], total: 0 };
      return response.json();
    },
    enabled: activeSection === "billing",
    staleTime: 5 * 60_000,
  });

  // §11.87 #user-permission-summary-fetcher
  // mock badges (Lab Manager/Requester/Approver) + 한도 ₩1,000,000 / 월간 ₩50,000,000
  // / Cost Center / 입고 위치 → real /api/organizations + /api/user-budgets 기반 derive.
  // 일부 필드 (단일 건 승인 한도 / Cost Center / 기본 입고 위치) 는 schema 미존재
  // → "운영 정책 미설정" 솔직한 empty state. schema 필드 추가는 별도 트랙
  // (#user-approval-policy-schema-add deferred).
  const { data: orgsData } = useQuery<{
    organizations: Array<{ id: string; name: string; role: string }>;
  }>({
    queryKey: ["settings-organizations"],
    queryFn: async () => {
      const response = await fetch("/api/organizations");
      if (!response.ok) return { organizations: [] };
      return response.json();
    },
    enabled: !!session && activeSection === "operator",
    staleTime: 5 * 60_000,
  });

  // §11.159 — canonical Workspace fetch (기존 /api/workspaces 재사용)
  const { data: workspacesData } = useQuery<{
    workspaces: Array<{ id: string; name: string; slug: string; plan?: string }>;
  }>({
    queryKey: ["settings-workspaces"],
    queryFn: async () => {
      const response = await fetch("/api/workspaces");
      if (!response.ok) return { workspaces: [] };
      return response.json();
    },
    enabled: !!session && activeSection === "operator",
    staleTime: 5 * 60_000,
  });

  const { data: userBudgetsData } = useQuery<{
    budgets: Array<{ id: string; totalAmount: number; remainingAmount: number; isActive?: boolean }>;
  }>({
    queryKey: ["settings-user-budgets"],
    queryFn: async () => {
      const response = await fetch("/api/user-budgets");
      if (!response.ok) return { budgets: [] };
      return response.json();
    },
    enabled: !!session && activeSection === "operator",
    staleTime: 5 * 60_000,
  });

  // §11.86 #settings-recent-activity-fetcher
  // mock 4-row → real /api/audit-logs?userId={current}&limit=5 wiring.
  // session.user.id 기반 본인 변경 이력만 표시 (operator surface 정합).
  // operator section 활성화될 때만 fetch — 다른 section 진입 시 비호출.
  const { data: recentActivityData } = useQuery<{
    logs: Array<{
      id: string;
      eventType: string;
      action: string;
      entityType: string;
      createdAt: string;
      success: boolean;
    }>;
  }>({
    queryKey: ["settings-recent-activity", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return { logs: [] };
      const params = new URLSearchParams();
      params.set("userId", session.user.id);
      params.set("limit", "5");
      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) return { logs: [] };
      return response.json();
    },
    enabled: !!session?.user?.id && activeSection === "operator",
    staleTime: 60_000,
  });

  // ── Profile mutation ──
  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; phone?: string; password?: string; currentPassword?: string }) => {
      const response = await csrfFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "변경사항 저장 완료", description: "설정이 성공적으로 반영되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setSaveSuccess(true); setSaveError(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: (error: Error) => {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    },
  });

  const savedPhone = userData?.phone;
  const fullPhone = profilePhone.trim() ? `${countryCode} ${profilePhone.trim()}` : "";

  const handleProfileSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const updates: Record<string, string> = {};
    if (profileName !== session?.user?.name) updates.name = profileName;
    if (profileEmail !== session?.user?.email) updates.email = profileEmail;
    if (fullPhone !== (savedPhone || "")) updates.phone = fullPhone;
    if (Object.keys(updates).length > 0) profileMutation.mutate(updates);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword === confirmPassword && currentPassword) {
      profileMutation.mutate({ password: newPassword, currentPassword });
      setIsPasswordDialogOpen(false);
    }
  };

  // ── Dirty ──
  const isProfileDirty = useMemo(() => {
    return profileName !== (session?.user?.name || "") || fullPhone !== (savedPhone || "") || profileBio !== "" || profileUrl !== "";
  }, [profileName, session?.user?.name, fullPhone, savedPhone, profileBio, profileUrl]);

  const isNotificationsDirty = useMemo(() => {
    const currentSnap = JSON.stringify(notifications.map((n) => ({ id: n.id, inApp: n.inApp, email: n.email, deliveryOverride: n.deliveryOverride })));
    return currentSnap !== initialNotifications || notificationFrequency !== initialFrequency;
  }, [notifications, initialNotifications, notificationFrequency, initialFrequency]);

  const isDirty = activeSection === "operator" ? isProfileDirty : activeSection === "notifications" ? isNotificationsDirty : false;

  const handleRevert = useCallback(() => {
    if (activeSection === "operator") {
      setProfileName(session?.user?.name || ""); setProfileBio(""); setProfileUrl("");
      if (userData?.phone && typeof userData.phone === "string") {
        const match = userData.phone.match(/^(\+\d+)\s*(.*)$/);
        if (match) { setCountryCode(match[1]); setProfilePhone(match[2].trim()); }
        else setProfilePhone(userData.phone);
      } else setProfilePhone("");
    } else {
      const parsed = JSON.parse(initialNotifications) as { id: string; inApp: boolean; email: boolean; deliveryOverride: DeliveryMode | null }[];
      setNotifications((prev) => prev.map((n) => { const saved = parsed.find((s) => s.id === n.id); return saved ? { ...n, inApp: saved.inApp, email: saved.email, deliveryOverride: saved.deliveryOverride } : n; }));
      setNotificationFrequency(initialFrequency);
    }
    setSaveSuccess(false); setSaveError(false);
  }, [activeSection, session?.user?.name, userData?.phone, initialNotifications, initialFrequency]);

  const handleNotificationSave = async () => {
    setIsSavingNotifications(true); setSaveSuccess(false); setSaveError(false);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      toast({ title: "설정 저장 완료", description: "알림 설정이 반영되었습니다." });
      setInitialNotifications(JSON.stringify(notifications.map((n) => ({ id: n.id, inApp: n.inApp, email: n.email, deliveryOverride: n.deliveryOverride }))));
      setInitialFrequency(notificationFrequency);
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000);
    } catch { setSaveError(true); setTimeout(() => setSaveError(false), 3000); }
    finally { setIsSavingNotifications(false); }
  };

  const getInitials = () => {
    if (session?.user?.name) return session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    return session?.user?.email?.[0].toUpperCase() || "U";
  };

  const userRole = (session?.user?.role as string) || "USER";
  const roleLabel = ROLE_LABELS[userRole] || "운영자 (Operator)";

  const toggleNotification = (id: string, field: "inApp" | "email") => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, [field]: !n[field] } : n)));
  };

  const notificationsByCategory = useMemo(() => {
    const grouped: { category: string; items: NotificationItem[] }[] = [];
    const seen = new Set<string>();
    for (const n of notifications) {
      if (!seen.has(n.category)) { seen.add(n.category); grouped.push({ category: n.category, items: notifications.filter((x) => x.category === n.category) }); }
    }
    return grouped;
  }, [notifications]);

  const resetCancelFlow = () => { setIsCancelOpen(false); setCancelStep(1); setCancelReason(null); setCancelFeedback(""); };

  // ══════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ═══ Page Header ═══ */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">
            <Settings className="h-3 w-3" />
            시스템 설정
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">시스템 및 워크스페이스 설정</h1>
              <p className="text-sm text-slate-500 mt-0.5">운영자 권한, 온톨로지 엔진 및 외부 시스템 연동을 구성합니다.</p>
            </div>
            {/* §11.76: Save section section-aware conditional render — operator/
                notifications 외 section (ontology/security/integrations/billing)
                에서는 button 자체 hidden (dead button 회귀 차단). 시안 검정 primary
                button 모양 (bg-slate-900 + rounded-lg + shadow-sm) 적용. */}
            {(activeSection === "operator" || activeSection === "notifications") ? (
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevert}
                    className="text-xs text-slate-500 hover:text-slate-700 h-9 px-3 rounded-lg"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    변경사항 취소
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-9 px-5 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition-all"
                  disabled={!isDirty || profileMutation.isPending || isSavingNotifications}
                  onClick={() => {
                    if (activeSection === "operator") handleProfileSubmit();
                    else if (activeSection === "notifications") handleNotificationSave();
                  }}
                >
                  {(profileMutation.isPending || isSavingNotifications) ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />저장 중</>
                  ) : saveSuccess ? (
                    <><Check className="h-3.5 w-3.5 mr-1.5" />저장 완료</>
                  ) : (
                    <>설정 저장</>
                  )}
                </Button>
              </div>
            ) : (
              // 운영자/notifications 외 section 은 read-only 또는 별도 mutation —
              // header 의 통합 "설정 저장" button 의미 없음.
              <div className="text-[11px] text-slate-400 break-keep">
                이 영역의 변경은 자체 컨트롤로 즉시 반영됩니다.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ═══ Left System Nav ═══ */}
          {/* §11.100 — 인쇄 시 settings 좌측 nav hide (활성 section 만 인쇄). */}
          <nav className="lg:w-64 shrink-0 print:hidden">
            {NAV_GROUPS.map((group) => (
              <div key={group.group} className="mb-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">{group.group}</div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                          isActive
                            ? "bg-blue-50 border border-blue-200 text-slate-900"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium leading-tight">{item.label}</div>
                          <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.sublabel}</div>
                        </div>
                        {isActive && <ChevronRight className="h-3 w-3 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* ═══ Right Content ═══ */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ═══ OPERATOR & WORKSPACE ═══ */}
            {activeSection === "operator" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* 운영자 식별 정보 */}
                <SectionCard title="운영자 식별 정보" icon={Fingerprint}>
                  <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-20 w-20 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-2xl font-bold text-blue-600">
                        {getInitials()}
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] text-slate-400 hover:text-slate-800 h-7 px-2">
                        <Upload className="h-3 w-3 mr-1" />
                        식별자 이미지 변경
                      </Button>
                      <span className="text-[9px] text-slate-500">JPG, PNG 지원. 최대 2MB.</span>
                    </div>

                    {/* Fields — §11.157 individual profile only.
                        직책/역할 free-text Input 제거 (Identity Governance):
                        canonical role 은 아래 Badge ({roleLabel}) 와 §11.74
                        "운영 역할 및 업무 범위" SectionCard 에서 read-only 로
                        표시. 사용자는 자유 입력 불가. */}
                    <div className="space-y-4">
                      <FieldBlock label="운영자 성명">
                        <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-9 text-sm" />
                      </FieldBlock>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FieldBlock label="연락처">
                          <Input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="010-0000-0000" className="bg-white border-slate-200 text-slate-900 h-9 text-sm" />
                        </FieldBlock>
                        <FieldBlock label="이메일 (통합 인증)">
                          <Input value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-9 text-sm" />
                        </FieldBlock>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] font-medium">{roleLabel}</Badge>
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] font-medium">접근 등급 3</Badge>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                {/* §11.74 — 운영 역할 및 업무 범위 (read-only — ASSIGNED BY ADMIN)
                    Identity Governance: 운영자 self-service 가 아닌 시스템 권한
                    관리 정책에 따라 결정되는 값. 사용자는 read-only 로 확인만,
                    변경은 "권한 검토 요청" CTA → /dashboard/organizations 로
                    redirect (또는 toast notify).
                    실제 데이터 fetcher 연결은 #user-permission-summary-fetcher
                    별도 트랙. 본 commit 은 시안 visual essence + read-only
                    layout 정형화. */}
                <SectionCard title="운영 역할 및 업무 범위" icon={Shield} description="시스템 권한(RBAC)과 승인 워크플로우에 영향을 줍니다. 직접 변경할 수 없습니다.">
                  <div className="space-y-5">
                    {/* §11.87 활성 운영 역할 — real session.user.role + organizations[].role
                        매핑. system ADMIN 은 별도 badge, 각 조직 멤버십은 한국어 라벨
                        매핑 (ADMIN/OWNER/MEMBER/VIEWER). */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">활성 운영 역할</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const sysRole = session?.user?.role as string | undefined;
                          const orgs = orgsData?.organizations ?? [];
                          // §11.193d Phase 1 — OrganizationRole enum 5종 모두
                          // 매핑 (이전 4종, REQUESTER/APPROVER 누락). 호영님
                          // prototype 시안 정합:
                          //   ADMIN     → "Lab Manager" (운영 책임자, purple)
                          //   OWNER     → "Owner" (조직 최고 책임자, rose)
                          //   APPROVER  → "Approver" (승인 권한, emerald)
                          //   REQUESTER → "Requester" (요청 권한, blue)
                          //   MEMBER    → "Member" (일반 멤버, slate-strong)
                          //   VIEWER    → "Viewer" (조회만, slate-mute)
                          // schema 변경 0 — 기존 OrganizationRole enum 직접 매핑.
                          // multi-capability (1인 동시 보유) 는 §11.193d Phase 2
                          // 별도 batch (Membership.workflowCapabilities schema 추가).
                          const orgRoleLabel: Record<string, { label: string; cls: string }> = {
                            ADMIN: { label: "Lab Manager", cls: "bg-purple-50 text-purple-700 border-purple-200" },
                            OWNER: { label: "Owner", cls: "bg-rose-50 text-rose-700 border-rose-200" },
                            APPROVER: { label: "Approver", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                            REQUESTER: { label: "Requester", cls: "bg-blue-50 text-blue-700 border-blue-200" },
                            MEMBER: { label: "Member", cls: "bg-slate-100 text-slate-700 border-slate-300" },
                            VIEWER: { label: "Viewer", cls: "bg-slate-50 text-slate-600 border-slate-200" },
                          };
                          const badges: React.ReactNode[] = [];
                          if (sysRole === "ADMIN") {
                            badges.push(
                              <Badge key="sys-admin" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">
                                System Admin
                              </Badge>
                            );
                          }
                          orgs.forEach((org) => {
                            const meta = orgRoleLabel[org.role] ?? { label: org.role, cls: "bg-slate-50 text-slate-600 border-slate-200" };
                            badges.push(
                              <Badge key={org.id} className={`${meta.cls} text-xs font-medium`}>
                                {org.name} · {meta.label}
                              </Badge>
                            );
                          });
                          if (badges.length === 0) {
                            return (
                              <p className="text-xs text-slate-400 break-keep">
                                할당된 운영 역할이 없습니다. 조직 관리자에게 문의하세요.
                              </p>
                            );
                          }
                          return badges;
                        })()}
                      </div>
                    </div>
                    <div className="h-px bg-slate-200" />
                    {/* §11.87 승인 권한 — 단일 건 승인 한도 schema 부재 (미설정 표시);
                        월간 구매 예산은 UserBudget 첫 active 항목 활용. */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">승인 권한 (LIMITS)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                          <p className="text-[11px] text-slate-500 mb-0.5">단일 건 승인 한도</p>
                          {/* §11.97 — User.approvalLimit (BigInt → string serialized) real value */}
                          {userData?.approvalLimit ? (
                            <p className="text-sm font-bold text-slate-900 tabular-nums">
                              ₩{Number(userData.approvalLimit).toLocaleString("ko-KR")}
                            </p>
                          ) : (
                            <p className="text-sm font-bold text-slate-400 tabular-nums">운영 정책 미설정</p>
                          )}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                          <p className="text-[11px] text-slate-500 mb-0.5">월간 구매 예산</p>
                          {(() => {
                            const budgets = userBudgetsData?.budgets ?? [];
                            // isActive 필드가 source 별로 일관 안 함 — 첫 항목 (가장 최신 createdAt)
                            // 을 활성으로 가정. UserBudget 은 isActive 명시, Budget 변환분은 항상 표시.
                            const active = budgets.find((b) => b.isActive !== false) ?? budgets[0];
                            if (!active) {
                              return <p className="text-sm font-bold text-slate-400 tabular-nums">예산 미설정</p>;
                            }
                            return (
                              <div>
                                <p className="text-sm font-bold text-slate-900 tabular-nums">
                                  ₩{active.totalAmount.toLocaleString("ko-KR")}
                                </p>
                                <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                                  잔여 ₩{active.remainingAmount.toLocaleString("ko-KR")}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-slate-200" />
                    {/* §11.87 + §11.97 — 기본 업무 환경.
                        User.costCenter / defaultLocation schema 추가 후 (§11.97)
                        real data 표시. null 시 honest empty state 유지. */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">기본 업무 환경</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <span className="text-xs text-slate-500">기본 Cost Center</span>
                          {userData?.costCenter ? (
                            <span className="text-sm font-mono text-slate-900">{userData.costCenter}</span>
                          ) : (
                            <span className="text-sm font-mono text-slate-400">운영 정책 미설정</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <span className="text-xs text-slate-500">기본 입고 위치</span>
                          {userData?.defaultLocation ? (
                            <span className="text-sm text-slate-900 break-keep">{userData.defaultLocation}</span>
                          ) : (
                            <span className="text-sm text-slate-400 break-keep">운영 정책 미설정</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* §11.67 lesson: 권한 검토 요청 wired (dead button 회피) —
                        조직 관리 페이지로 redirect, 거기서 권한 변경 절차. */}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto gap-2 text-xs"
                        onClick={() => router.push("/dashboard/organizations")}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        권한 검토 요청
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </SectionCard>

                {/* §11.74 — 현재 워크스페이스 정보 (read-only — WORKSPACE CANONICAL IDENTITY)
                    §11.193b — eyebrow "WORKSPACE CANONICAL IDENTITY" 추가하여
                    prototype 시안 톤 정합 (조직 식별 정보의 canonical 강조).
                    워크스페이스 기본값은 조직 administrator 권한으로만 변경. */}
                <SectionCard title="현재 워크스페이스 정보" icon={Building2} description="워크스페이스 기본값은 조직 관리자만 변경할 수 있습니다.">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-blue-700 mb-3">
                    Workspace Canonical Identity
                  </p>
                  {(() => {
                    // §11.159 — canonical Workspace fetch (mock 제거)
                    // §11.164 — explicit pickActiveWorkspace priority logic
                    //   Priority:
                    //     1. (future) session.user.lastWorkspaceId — schema 추가 필요 (deferred 트랙
                    //        `#user-last-workspace-id-schema`). 현재 User 모델에 필드 부재.
                    //     2. WorkspaceMember.updatedAt desc 첫 번째 (last active implicit) —
                    //        `getUserWorkspaces` (lib/auth/scope.ts:208) 가 이미 desc 정렬.
                    //     3. fallback null → "데이터 미동기화" indicator (§11.159).
                    //   `Workspace.lastWorkspaceId` (schema:933) 는 design ambiguity —
                    //   workspace 모델 안 user-scoped 필드는 multi-user 부합 0. 사용 X.
                    const activeWorkspace = pickActiveWorkspace(workspacesData?.workspaces);
                    const wsList = workspacesData?.workspaces ?? [];
                    const activeWs = activeWorkspace;
                    const wsName = activeWs?.name ?? "데이터 미동기화";
                    const wsSlug = activeWs?.slug ?? "—";
                    const wsPlan = activeWs?.plan ? activeWs.plan : "—";
                    // §11.193b — sub-label 영문 convention 정합 (시안 매핑):
                    //   "Plan: …"        → "ENTERPRISE EDITION" (또는 plan 별)
                    //   "URL Identifier" → "AUTO-GENERATED ID"
                    //   "시스템 기본값"  → "FINANCIAL BASE"
                    // workspace canonical identity 명시. plan 값 영문 normalize:
                    const planSubLabel = (() => {
                      if (!activeWs) return "WORKSPACE NOT FOUND";
                      const p = (wsPlan || "").toUpperCase();
                      if (p === "ENTERPRISE") return "ENTERPRISE EDITION";
                      if (p === "PRO" || p === "PROFESSIONAL") return "PROFESSIONAL EDITION";
                      if (p === "FREE" || p === "STARTER") return "FREE EDITION";
                      // plan 값 fallback — uppercase + " EDITION" suffix 유지하여
                      // canonical identity 톤 일관 (시안 정합).
                      return p ? `${p} EDITION` : "EDITION 미지정";
                    })();
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">워크스페이스 명칭</p>
                          <p className="text-sm font-bold text-slate-900 break-keep mb-1">{wsName}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{planSubLabel}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">워크스페이스 코드</p>
                          <p className="text-sm font-bold font-mono text-slate-900 mb-1">{wsSlug}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">AUTO-GENERATED ID</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">기본 통화</p>
                          <p className="text-sm font-bold text-slate-900 mb-1">KRW (₩)</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">FINANCIAL BASE</p>
                        </div>
                      </div>
                    );
                  })()}
                </SectionCard>

                {/* Password */}
                <SectionCard title="보안 자격 증명" icon={Lock}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-700">비밀번호</p>
                      <p className="text-xs text-slate-500">마지막 변경: 알 수 없음</p>
                    </div>
                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                      <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 h-8 px-3 border border-blue-200" onClick={() => setIsPasswordDialogOpen(true)}>
                        <Lock className="h-3 w-3 mr-1" />
                        비밀번호 변경
                      </Button>
                      <DialogContent className="bg-white border-slate-200 rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-slate-900">비밀번호 변경</DialogTitle>
                          <DialogDescription className="text-slate-500">새 비밀번호를 입력하세요.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePasswordChange} className="space-y-5 pt-2">
                          <FieldBlock label="현재 비밀번호">
                            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-11 rounded-xl" />
                          </FieldBlock>
                          <FieldBlock label="새 비밀번호">
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-11 rounded-xl" />
                          </FieldBlock>
                          <FieldBlock label="새 비밀번호 확인">
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`bg-white text-slate-900 h-11 rounded-xl ${confirmPassword && newPassword !== confirmPassword ? "border-red-400 ring-1 ring-red-200" : "border-slate-200"}`} />
                            {confirmPassword && newPassword !== confirmPassword && (
                              <p className="text-[12px] font-medium text-red-500 mt-1.5">비밀번호가 일치하지 않습니다.</p>
                            )}
                          </FieldBlock>
                          <Button type="submit" className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold" disabled={!newPassword || newPassword !== confirmPassword || !currentPassword}>
                            변경 확인
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </SectionCard>

                {/* §11.86 #settings-recent-activity-fetcher
                    mock 4-row → real /api/audit-logs?userId={current}&limit=5.
                    EVENT_TYPE → 한국어 라벨 + tone 5분류 매핑. 빈 결과 시
                    명시적 empty state (no fake fallback). 시간 표기는
                    상대 (방금/N분 전/N시간 전/어제/N일 전) format. */}
                <SectionCard
                  title="최근 보안 및 활동 로그"
                  icon={Activity}
                  description="식별 정보·워크스페이스 설정·접근 권한 변경 이력. 전체 감사 증적은 별도 페이지에서 확인."
                >
                  <div className="space-y-2">
                    {(() => {
                      const logs = recentActivityData?.logs ?? [];
                      if (logs.length === 0) {
                        return (
                          <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-6 text-center">
                            <p className="text-xs text-slate-500 break-keep">
                              아직 운영 활동 이력이 없습니다.
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 break-keep">
                              프로필·권한·워크스페이스 변경 이력이 여기에 표시됩니다.
                            </p>
                          </div>
                        );
                      }

                      // §11.99 — AUDIT_EVENT_LABELS helper 사용 (audit page 와
                      // 일관 — 향후 enum 추가 시 본 helper 만 update).

                      // 상대 시간 derive
                      const formatRelative = (iso: string) => {
                        const diff = Date.now() - new Date(iso).getTime();
                        const min = Math.floor(diff / 60000);
                        if (min < 1) return "방금";
                        if (min < 60) return `${min}분 전`;
                        const hr = Math.floor(min / 60);
                        if (hr < 24) return `${hr}시간 전`;
                        const day = Math.floor(hr / 24);
                        if (day === 1) return "어제";
                        if (day < 7) return `${day}일 전`;
                        const week = Math.floor(day / 7);
                        if (week < 5) return `${week}주 전`;
                        return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
                      };

                      return logs.map((log) => {
                        const meta = AUDIT_EVENT_LABELS[log.eventType];
                        const label = meta?.label ?? log.action ?? log.eventType;
                        const dotCls = meta
                          ? AUDIT_TONE_DOT_CLASSES[meta.tone]
                          : "bg-slate-400";
                        return (
                          <div
                            key={log.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
                              <span className="text-sm text-slate-700 break-keep">
                                {label}
                                {!log.success && <span className="text-rose-500 ml-1">(실패)</span>}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono flex-shrink-0 ml-3">
                              {formatRelative(log.createdAt)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                    <div className="pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
                        onClick={() => router.push("/dashboard/audit")}
                      >
                        전체 감사 증적 보기
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ ONTOLOGY ENGINE (AI) ═══ */}
            {activeSection === "ontology" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <SectionCard title="AI 추론 매개변수" icon={Brain} description="온톨로지 엔진의 자동 판단 기준을 조정합니다. 값을 변경하면 실시간으로 추론 결과에 반영됩니다.">
                  <div className="space-y-6">
                    <SliderField
                      label="자동 승인 신뢰도 임계값 (Confidence Threshold)"
                      description="AI가 발주를 자동 승인하는 최소 신뢰도. 이 값 이하의 판단은 수동 검토로 라우팅됩니다."
                      value={confidenceThreshold}
                      onChange={setConfidenceThreshold}
                      min={50} max={100} unit="%"
                    />
                    <div className="h-px bg-slate-200" />
                    <SliderField
                      label="이상 탐지 민감도 (Anomaly Detection Sensitivity)"
                      description="단가 급등, 비정상 발주량 등을 탐지하는 민감도. 높을수록 경고가 많아집니다."
                      value={anomalyDetectionSensitivity}
                      onChange={setAnomalyDetectionSensitivity}
                      min={0} max={100} unit="%"
                    />
                    <div className="h-px bg-slate-200" />
                    <SliderField
                      label="가격 변동 알림 임계값"
                      description="공급사 단가가 이 비율 이상 변동하면 알림을 발생시킵니다."
                      value={priceAlertThreshold}
                      onChange={setPriceAlertThreshold}
                      min={5} max={50} unit="%"
                    />
                  </div>
                </SectionCard>

                <SectionCard title="자동화 규칙" icon={Zap}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">AI 기반 자동 승인</p>
                        <p className="text-xs text-slate-500 mt-0.5">신뢰도 임계값을 충족하고 금액 한도 내인 발주를 자동 승인합니다.</p>
                      </div>
                      <Switch checked={autoApprovalEnabled} onCheckedChange={setAutoApprovalEnabled} />
                    </div>
                    {autoApprovalEnabled && (
                      <FieldBlock label="자동 승인 금액 한도">
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={Number(autoApprovalLimit).toLocaleString("ko-KR")}
                            onChange={(e) => setAutoApprovalLimit(e.target.value.replace(/[^0-9]/g, ""))}
                            className="bg-white border-slate-200 text-slate-900 h-9 text-sm w-48"
                          />
                          <span className="text-xs text-slate-500">원 이하</span>
                        </div>
                      </FieldBlock>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ SECURITY & RBAC ═══ */}
            {activeSection === "security" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <SectionCard title="결재선 라우팅 규칙" icon={ShieldCheck} description="금액별 전결 규정을 설정합니다. 각 단계의 금액 기준을 초과하면 상위 승인자에게 자동 라우팅됩니다.">
                  <div className="space-y-4">
                    <ApprovalTierRow tier={1} label="자동 승인" description="이 금액 이하는 AI 자동 승인" value={approvalTier1} onChange={setApprovalTier1} color="emerald" />
                    <div className="h-px bg-slate-200" />
                    <ApprovalTierRow tier={2} label="팀장 승인" description="이 금액 이하는 팀장 승인" value={approvalTier2} onChange={setApprovalTier2} color="blue" />
                    <div className="h-px bg-slate-200" />
                    <ApprovalTierRow tier={3} label="CFO 승인" description="이 금액 초과 시 CFO 승인 필요" value={approvalTier3} onChange={setApprovalTier3} color="amber" />
                  </div>
                </SectionCard>

                <SectionCard title="역할 기반 접근 제어" icon={Users}>
                  <div className="space-y-3">
                    {[
                      { role: "관리자", permissions: "전체 설정 / 사용자 관리 / 결재선 변경", count: 1, color: "text-red-600" },
                      { role: "연구실 관리자", permissions: "발주 / 재고 / 예산 관리", count: 3, color: "text-blue-600" },
                      { role: "구매 담당", permissions: "견적 / PO / 공급사 관리", count: 2, color: "text-emerald-600" },
                      { role: "열람자", permissions: "읽기 전용 / 리포트 열람", count: 5, color: "text-slate-400" },
                    ].map((r) => (
                      <div key={r.role} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                          <Shield className={cn("h-4 w-4", r.color)} />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{r.role}</p>
                            <p className="text-[10px] text-slate-500">{r.permissions}</p>
                          </div>
                        </div>
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{r.count}명</Badge>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ INTEGRATIONS ═══ */}
            {activeSection === "integrations" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <SectionCard title="ERP 및 외부 시스템 연동" icon={Server} description="SAP, Oracle 등 기간계 시스템과의 동기화 상태를 관리합니다.">
                  <div className="space-y-3">
                    {[
                      { name: "SAP S/4HANA", type: "ERP 동기화", status: "connected", lastSync: "2분 전", icon: Database },
                      { name: "Thermo Fisher B2B API", type: "공급사 카탈로그", status: "connected", lastSync: "15분 전", icon: Globe },
                      { name: "Sigma-Aldrich Webhook", type: "공급사 주문 확인", status: "pending", lastSync: "설정 대기", icon: Webhook },
                      { name: "Oracle NetSuite", type: "회계 연동", status: "disconnected", lastSync: "미연결", icon: Link2 },
                    ].map((sys) => (
                      <div key={sys.name} className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center",
                            sys.status === "connected" ? "bg-emerald-50" : sys.status === "pending" ? "bg-amber-50" : "bg-slate-100"
                          )}>
                            <sys.icon className={cn("h-4 w-4",
                              sys.status === "connected" ? "text-emerald-600" : sys.status === "pending" ? "text-amber-600" : "text-slate-500"
                            )} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{sys.name}</p>
                            <p className="text-[10px] text-slate-500">{sys.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-1.5">
                              <div className={cn("h-1.5 w-1.5 rounded-full",
                                sys.status === "connected" ? "bg-emerald-500" : sys.status === "pending" ? "bg-amber-500 animate-pulse" : "bg-slate-400"
                              )} />
                              <span className={cn("text-[10px] font-medium",
                                sys.status === "connected" ? "text-emerald-600" : sys.status === "pending" ? "text-amber-600" : "text-slate-500"
                              )}>
                                {sys.status === "connected" ? "연결됨" : sys.status === "pending" ? "대기 중" : "미연결"}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-500">{sys.lastSync}</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-slate-400 hover:text-slate-800 border border-slate-200">
                            {sys.status === "disconnected" ? "연결" : "설정"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ═══ NOTIFICATIONS ═══ */}
            {activeSection === "notifications" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <SectionCard title="전역 알림 빈도" icon={Bell}>
                  <div className="flex items-center gap-4">
                    <Select value={notificationFrequency} onValueChange={(v: string) => setNotificationFrequency(v as DeliveryMode)}>
                      <SelectTrigger className="w-48 bg-white border-slate-200 text-slate-900 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">즉시 전송</SelectItem>
                        <SelectItem value="daily">일일 요약</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-slate-500">안전 중요 알림은 항상 즉시 전송됩니다.</span>
                  </div>
                </SectionCard>

                {notificationsByCategory.map((group) => (
                  <SectionCard key={group.category} title={group.category} icon={group.items[0].icon}>
                    <div className="space-y-1">
                      {group.items.map((n) => {
                        const isSafety = SAFETY_CRITICAL_IDS.has(n.id);
                        return (
                          <div key={n.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-800">{n.label}</p>
                                {isSafety && <Badge className="bg-red-50 text-red-600 border-red-200 text-[9px] py-0">즉시</Badge>}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">{n.description}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-500">앱</span>
                                <Switch checked={n.inApp} onCheckedChange={() => toggleNotification(n.id, "inApp")} className="scale-75" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-500">메일</span>
                                <Switch checked={n.email} onCheckedChange={() => toggleNotification(n.id, "email")} className="scale-75" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}

            {/* ═══ BILLING ═══ §11.77 시안 정합 — LabAxis Enterprise CURRENT PLAN
                + 최근 청구 내역 + 플랜 업그레이드 / 결제 수단 변경 / 구독 해지 */}
            {activeSection === "billing" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                {/* CURRENT PLAN — 큰 dark accent 카드 (시안 image 3) */}
                <Card className="border-0 bg-slate-900 text-white overflow-hidden relative">
                  <CardContent className="p-6 md:p-7 relative">
                    <div className="absolute top-4 right-4 opacity-20">
                      <Zap className="h-32 w-32 -rotate-12" strokeWidth={1.5} />
                    </div>
                    <Badge className="bg-blue-600/90 text-white border-0 text-[10px] uppercase tracking-wider font-bold mb-3">
                      Current Plan
                    </Badge>
                    <h3 className="text-2xl md:text-3xl font-extrabold mb-2 break-keep">LabAxis Enterprise</h3>
                    <p className="text-xs md:text-sm text-slate-300 mb-6 break-keep">
                      대규모 연구소 및 R&D 센터를 위한 무제한 엔터프라이즈 플랜
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Next Billing Date</p>
                        <p className="text-lg md:text-xl font-bold font-mono text-white">2026.05.15</p>
                      </div>
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Monthly Cost</p>
                        <p className="text-lg md:text-xl font-bold text-white tabular-nums">
                          ₩1,200,000
                          <span className="text-xs text-slate-400 font-normal ml-1.5">/ mo</span>
                        </p>
                      </div>
                    </div>
                    {/* §11.100 — 인쇄 시 action button row hide (인쇄 본은 청구
                        내역 보존 용도, 액션 의미 없음). */}
                    <div className="flex flex-wrap items-center gap-2 mt-5 print:hidden">
                      <Button
                        size="sm"
                        className="h-9 px-4 text-xs bg-white text-slate-900 hover:bg-slate-100 font-semibold rounded-lg shadow-sm"
                        onClick={() => toast({ title: "플랜 업그레이드", description: "엔터프라이즈 플랜은 영업팀과 직접 조율됩니다. 운영 지원 센터로 문의해 주세요." })}
                      >
                        플랜 업그레이드
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-4 text-xs bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white font-medium rounded-lg"
                        onClick={() => toast({ title: "결제 수단 변경", description: "엔터프라이즈 결제는 청구서 발행 방식입니다. 운영 지원 센터로 문의해 주세요." })}
                      >
                        결제 수단 변경
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-9 px-3 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-50 rounded-lg"
                        onClick={() => setIsCancelOpen(true)}
                      >
                        구독 해지
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* §11.88 — 최근 청구 내역 real fetcher.
                    /api/billing/invoices alive endpoint 가 Subscription invoices
                    (real) 또는 mock fallback 반환. PDF 다운로드 버튼은
                    invoicePdfUrl 이 있으면 새 탭으로 open, 없으면 솔직한 안내. */}
                <SectionCard title="최근 청구 내역" icon={Receipt}>
                  <div className="space-y-2">
                    {(() => {
                      const invoices = invoicesData?.invoices ?? [];
                      if (invoices.length === 0) {
                        return (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                            <p className="text-sm text-slate-500 break-keep">
                              아직 청구 내역이 없습니다.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 break-keep">
                              결제가 처리되면 청구서가 여기에 표시됩니다.
                            </p>
                          </div>
                        );
                      }
                      return invoices.map((inv) => {
                        const amount = inv.amountPaid ?? inv.amountDue ?? 0;
                        const description = inv.description || "구독 청구";
                        const invoiceLabel = inv.number || inv.id;
                        const hasPdf = !!inv.invoicePdfUrl;
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between py-3 px-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <FileText className="h-4 w-4 text-slate-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 break-keep">{description}</p>
                                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  Invoice #{invoiceLabel}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-900 tabular-nums">
                                  ₩{amount.toLocaleString("ko-KR")}
                                </p>
                                {hasPdf ? (
                                  <a
                                    href={inv.invoicePdfUrl!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium mt-0.5 inline-flex items-center gap-0.5"
                                  >
                                    PDF 다운로드
                                    <ArrowRight className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toast({
                                        title: "PDF 미발급",
                                        description: "이 청구서는 아직 PDF 가 발급되지 않았습니다. 운영 지원 센터로 문의해 주세요.",
                                      })
                                    }
                                    className="text-[11px] text-slate-400 hover:text-slate-600 font-medium mt-0.5 inline-flex items-center gap-0.5"
                                  >
                                    PDF 미발급
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </SectionCard>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Cancel dialog */}
      <Dialog open={isCancelOpen} onOpenChange={(o) => { if (!o) resetCancelFlow(); else setIsCancelOpen(true); }}>
        <DialogContent className="bg-white border-slate-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">구독 해지</DialogTitle>
            <DialogDescription className="text-slate-500">해지 사유를 알려주시면 서비스 개선에 반영하겠습니다.</DialogDescription>
          </DialogHeader>
          {cancelStep === 1 && (
            <div className="space-y-2 pt-2">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setCancelReason(r.value); setCancelStep(2); }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm",
                    cancelReason === r.value
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-100"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {cancelStep === 2 && cancelReason && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-700">{getSaveOffer(cancelReason).title}</p>
                <p className="text-xs text-amber-600 mt-1">{getSaveOffer(cancelReason).description}</p>
                <Button size="sm" className="mt-3 h-8 bg-amber-600 hover:bg-amber-500 text-white text-xs" onClick={resetCancelFlow}>
                  {getSaveOffer(cancelReason).cta}
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full text-xs text-red-600 hover:text-red-700" onClick={() => {
                toast({ title: "구독 해지 요청이 접수되었습니다", description: "현재 결제 기간이 끝나면 해지됩니다." });
                resetCancelFlow();
              }}>
                그래도 해지하기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════
// Shared Components
// ══════════════════════════════════════════════

function SectionCard({ title, icon: Icon, description, children }: {
  title: string;
  icon: React.ElementType;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {description && <p className="text-xs text-slate-500 mt-1 ml-6">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function SliderField({ label, description, value, onChange, min, max, unit }: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          <span className="text-lg font-bold text-blue-600 tabular-nums">{value}</span>
          <span className="text-xs text-slate-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
        style={{ accentColor: "#2563eb" }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-slate-500">{min}{unit}</span>
        <span className="text-[9px] text-slate-500">{max}{unit}</span>
      </div>
    </div>
  );
}

function ApprovalTierRow({ tier, label, description, value, onChange, color }: {
  tier: number;
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  color: "emerald" | "blue" | "amber";
}) {
  const colorMap = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  };
  const c = colorMap[color];

  return (
    <div className="flex items-center gap-4">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold", c.bg, c.text)}>
        T{tier}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-500">₩</span>
        <Input
          type="text"
          value={Number(value).toLocaleString("ko-KR")}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          className="bg-white border-slate-200 text-slate-800 h-8 text-sm w-36 text-right"
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Export
// ══════════════════════════════════════════════

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}

/**
 * §11.164 #workspace-last-active-tracking — explicit active workspace picker.
 *
 * Priority logic:
 *   1. (future) session.user.lastWorkspaceId — User 모델 schema 추가 필요
 *      (별도 트랙 `#user-last-workspace-id-schema`).
 *   2. WorkspaceMember.updatedAt desc 첫 번째 (implicit last active) —
 *      `getUserWorkspaces` 가 이미 desc 정렬.
 *   3. null fallback (workspaces 미동기화 또는 멤버십 0).
 *
 * Identity Governance: workspace 선택 결정은 캐논. operator 자유 선택 X.
 */
function pickActiveWorkspace<T extends { id: string; name: string }>(
  workspaces: T[] | undefined,
): T | null {
  if (!workspaces || workspaces.length === 0) return null;
  // 현재는 endpoint 정렬 (WorkspaceMember.updatedAt desc) 신뢰
  return workspaces[0];
}
