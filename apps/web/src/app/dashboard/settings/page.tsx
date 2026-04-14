"use client";

export const dynamic = "force-dynamic";

import { csrfFetch } from "@/lib/api-client";
import { useState, Suspense, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

const DEMO_INVOICES = [
  { id: "inv-001", date: "2026-03-01", description: "Business 플랜 — 월간 구독", amount: 149000, status: "paid" as const },
  { id: "inv-002", date: "2026-02-01", description: "Business 플랜 — 월간 구독", amount: 149000, status: "paid" as const },
  { id: "inv-003", date: "2026-01-01", description: "Business 플랜 — 월간 구독", amount: 149000, status: "paid" as const },
];

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
  const [operatorRole, setOperatorRole] = useState("연구실 관리자 (Lab Manager)");
  const [workspaceName, setWorkspaceName] = useState("제1 바이오 R&D 센터");
  const [currencyUnit, setCurrencyUnit] = useState("KRW (₩) / Metric");

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
            <div className="flex items-center gap-2">
              {isDirty && (
                <Button variant="ghost" size="sm" onClick={handleRevert} className="text-xs text-slate-500 hover:text-slate-700 h-8">
                  <RotateCcw className="h-3 w-3 mr-1" />
                  변경사항 취소
                </Button>
              )}
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                disabled={!isDirty || profileMutation.isPending || isSavingNotifications}
                onClick={() => {
                  if (activeSection === "operator") handleProfileSubmit();
                  else if (activeSection === "notifications") handleNotificationSave();
                }}
              >
                {(profileMutation.isPending || isSavingNotifications) ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />저장 중</> :
                 saveSuccess ? <><Check className="h-3 w-3 mr-1" />저장 완료</> :
                 "설정 저장"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ═══ Left System Nav ═══ */}
          <nav className="lg:w-64 shrink-0">
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

                    {/* Fields */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FieldBlock label="운영자 성명">
                          <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-9 text-sm" />
                        </FieldBlock>
                        <FieldBlock label="직책 / 역할">
                          <Input value={operatorRole} onChange={(e) => setOperatorRole(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-9 text-sm" />
                        </FieldBlock>
                      </div>
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

                {/* Workspace Environment */}
                <SectionCard title="워크스페이스 환경" icon={Building2}>
                  <div className="space-y-4">
                    <FieldBlock label="워크스페이스 명칭">
                      <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="bg-white border-slate-200 text-slate-900 h-9 text-sm" />
                    </FieldBlock>
                    <FieldBlock label="기본 통화 및 단위">
                      <Select value={currencyUnit} onValueChange={setCurrencyUnit}>
                        <SelectTrigger className="bg-white border-slate-200 text-slate-900 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KRW (₩) / Metric">KRW (₩) / Metric</SelectItem>
                          <SelectItem value="USD ($) / Metric">USD ($) / Metric</SelectItem>
                          <SelectItem value="EUR (€) / Metric">EUR (€) / Metric</SelectItem>
                          <SelectItem value="JPY (¥) / Metric">JPY (¥) / Metric</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldBlock>
                  </div>
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
                      <DialogContent className="bg-white border-slate-200">
                        <DialogHeader>
                          <DialogTitle className="text-slate-900">비밀번호 변경</DialogTitle>
                          <DialogDescription className="text-slate-400">새 비밀번호를 입력하세요.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePasswordChange} className="space-y-4 pt-2">
                          <FieldBlock label="현재 비밀번호">
                            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900" />
                          </FieldBlock>
                          <FieldBlock label="새 비밀번호">
                            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900" />
                          </FieldBlock>
                          <FieldBlock label="새 비밀번호 확인">
                            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-white border-slate-200 text-slate-900" />
                          </FieldBlock>
                          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white" disabled={!newPassword || newPassword !== confirmPassword || !currentPassword}>
                            변경 확인
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
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

            {/* ═══ BILLING ═══ */}
            {activeSection === "billing" && (
              <div className="space-y-5 animate-in fade-in-50 duration-200">
                <SectionCard title="현재 구독" icon={CreditCard}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">Business</span>
                        <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px]">활성</Badge>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">₩149,000 / 월</p>
                      <p className="text-[10px] text-slate-500 mt-1">다음 갱신: 2026-05-01</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-slate-800 h-8 px-3 border border-slate-200">
                        플랜 변경
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:text-red-700 h-8 px-3" onClick={() => setIsCancelOpen(true)}>
                        구독 해지
                      </Button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="청구서" icon={Receipt}>
                  <div className="space-y-2">
                    {DEMO_INVOICES.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <div>
                            <p className="text-sm text-slate-800">{inv.description}</p>
                            <p className="text-[10px] text-slate-500">{inv.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-800">₩{inv.amount.toLocaleString()}</span>
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[9px]">완료</Badge>
                        </div>
                      </div>
                    ))}
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
            <DialogDescription className="text-slate-400">해지 사유를 알려주시면 서비스 개선에 반영하겠습니다.</DialogDescription>
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
