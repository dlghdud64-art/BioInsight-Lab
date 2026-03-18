"use client";

export const dynamic = "force-dynamic";

import { useState, Suspense, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Wallet,
  BarChart3,
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
  Users,
  ArrowRight,
  ExternalLink,
  Zap,
  CalendarClock,
  ShoppingCart,
  ClipboardCheck,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Role labels ──
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  USER: "사용자",
  RESEARCHER: "연구실 관리자",
  BUYER: "구매 담당자",
  SUPPLIER: "공급사",
};

type SettingsSection = "profile" | "notifications" | "billing";

// ── Notification config type ──
type DeliveryMode = "immediate" | "daily";

interface NotificationItem {
  id: string;
  category: string;
  label: string;
  description: string;
  icon: React.ElementType;
  inApp: boolean;
  email: boolean;
  deliveryOverride: DeliveryMode | null; // null = follow global default
}

// ── Cancel reason type ──
type CancelReason =
  | "price"
  | "features"
  | "frequency"
  | "team"
  | "alternative"
  | "performance"
  | "other";

const CANCEL_REASONS: { value: CancelReason; label: string }[] = [
  { value: "price", label: "가격 부담" },
  { value: "features", label: "기능 부족" },
  { value: "frequency", label: "사용 빈도 낮음" },
  { value: "team", label: "팀 도입 어려움" },
  { value: "alternative", label: "다른 도구 사용" },
  { value: "performance", label: "성능/안정성 문제" },
  { value: "other", label: "기타" },
];

function getSaveOffer(reason: CancelReason | null): { title: string; description: string; cta: string } {
  switch (reason) {
    case "price":
      return {
        title: "다운그레이드 옵션이 있습니다",
        description: "현재 플랜 대신 더 저렴한 플랜으로 변경할 수 있습니다. 핵심 기능은 유지됩니다.",
        cta: "플랜 비교하기",
      };
    case "features":
      return {
        title: "로드맵을 확인해 보세요",
        description: "요청하신 기능이 개발 로드맵에 포함되어 있을 수 있습니다. 최신 업데이트를 확인해 보세요.",
        cta: "로드맵 확인",
      };
    case "team":
      return {
        title: "온보딩 지원을 요청하세요",
        description: "팀 도입에 어려움이 있으시다면, 전담 온보딩 지원을 무료로 제공해 드립니다.",
        cta: "온보딩 지원 요청",
      };
    default:
      return {
        title: "지원팀에 문의해 주세요",
        description: "해결할 수 있는 방법이 있을 수 있습니다. 지원팀이 도와드리겠습니다.",
        cta: "지원팀 문의",
      };
  }
}

// ── Demo invoices ──
const DEMO_INVOICES = [
  { id: "inv-001", date: "2026-03-01", description: "Business 플랜 — 월간 구독", amount: 149000, status: "paid" as const },
  { id: "inv-002", date: "2026-02-01", description: "Business 플랜 — 월간 구독", amount: 149000, status: "paid" as const },
  { id: "inv-003", date: "2026-01-01", description: "Business 플랜 — 월간 구독", amount: 149000, status: "paid" as const },
];

// ── Fallback ──
function SettingsPageFallback() {
  return (
    <div className="flex-1 p-8 bg-[#09090b]">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-[#222226] rounded w-1/4 mb-4" />
          <div className="h-4 bg-[#222226] rounded w-1/2 mb-8" />
          <div className="flex gap-6">
            <div className="w-56 h-64 bg-[#222226] rounded" />
            <div className="flex-1 space-y-4">
              <div className="h-32 bg-[#222226] rounded" />
              <div className="h-32 bg-[#222226] rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main content
// ═══════════════════════════════════════════════════════════════
function SettingsPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

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

  // ── Notification state ──
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    // 견적/구매 관련
    { id: "quote_new", category: "견적/구매", label: "신규 견적 도착", description: "요청한 견적에 대한 공급사 응답 도착", icon: FileText, inApp: true, email: true, deliveryOverride: null },
    { id: "quote_delay", category: "견적/구매", label: "공급사 응답 지연", description: "견적 요청 후 48시간 이상 미응답", icon: Clock, inApp: true, email: false, deliveryOverride: null },
    { id: "purchase_status", category: "견적/구매", label: "구매 진행 상태", description: "발주, 배송, 입고 등 구매 진행 알림", icon: ShoppingCart, inApp: true, email: true, deliveryOverride: null },
    // 재고 관련
    { id: "stock_low", category: "재고", label: "재고 부족", description: "안전 재고 수량 이하로 떨어진 품목 알림", icon: Package, inApp: true, email: true, deliveryOverride: "immediate" },
    { id: "stock_expiry", category: "재고", label: "만료 임박", description: "유효기간 7일 이내 품목 자동 알림", icon: AlertTriangle, inApp: true, email: true, deliveryOverride: "immediate" },
    // 승인/결재 관련
    { id: "approval_request", category: "승인/결재", label: "승인 요청", description: "구매 요청 또는 견적 승인 대기 알림", icon: ClipboardCheck, inApp: true, email: true, deliveryOverride: null },
    { id: "approval_result", category: "승인/결재", label: "승인 결과", description: "내가 요청한 건의 승인/반려 결과", icon: Check, inApp: true, email: false, deliveryOverride: null },
    // 조직/팀 관련
    { id: "team_member", category: "조직/팀", label: "팀원 변동", description: "멤버 초대, 탈퇴, 역할 변경 알림", icon: Users, inApp: true, email: false, deliveryOverride: null },
    { id: "team_mention", category: "조직/팀", label: "멘션/댓글", description: "나를 멘션하거나 댓글이 달린 경우", icon: Mail, inApp: true, email: false, deliveryOverride: null },
    // 안전/규정 관련
    { id: "safety_msds", category: "안전/규정", label: "MSDS 업데이트", description: "안전보건자료 갱신 또는 누락 알림", icon: Shield, inApp: true, email: true, deliveryOverride: null },
    { id: "safety_compliance", category: "안전/규정", label: "규정 위반 경고", description: "보관 조건, 라벨링 등 규정 이슈", icon: AlertCircle, inApp: true, email: true, deliveryOverride: "immediate" },
    // 시스템 관련
    { id: "system_login", category: "시스템", label: "보안 알림", description: "비정상 로그인 시도 및 권한 변경", icon: Lock, inApp: true, email: true, deliveryOverride: "immediate" },
    { id: "system_maintenance", category: "시스템", label: "시스템 점검", description: "서비스 점검 및 업데이트 공지", icon: Server, inApp: true, email: false, deliveryOverride: null },
    { id: "system_report", category: "시스템", label: "리포트 발행", description: "주간/월간 요약 리포트 이메일 수신", icon: BarChart3, inApp: false, email: true, deliveryOverride: null },
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

  // ── Initial notification snapshot ──
  const [initialNotifications, setInitialNotifications] = useState(() =>
    JSON.stringify(
      notifications.map((n) => ({ id: n.id, inApp: n.inApp, email: n.email, deliveryOverride: n.deliveryOverride }))
    )
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
  }, [searchParams]);

  useEffect(() => {
    if (userData?.phone && typeof userData.phone === "string") {
      const match = userData.phone.match(/^(\+\d+)\s*(.*)$/);
      if (match) {
        setCountryCode(match[1]);
        setProfilePhone(match[2].trim());
      } else {
        setProfilePhone(userData.phone);
      }
    }
  }, [userData?.phone]);

  const { data: billingData, isLoading: billingLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const response = await fetch("/api/billing");
      if (!response.ok) throw new Error("Failed to fetch billing");
      return response.json();
    },
    enabled: activeSection === "billing",
  });

  // ── Profile mutation ──
  const profileMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; phone?: string; password?: string; currentPassword?: string }) => {
      const response = await fetch("/api/user/profile", {
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaveSuccess(true);
      setSaveError(false);
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
    if (Object.keys(updates).length > 0) {
      profileMutation.mutate(updates);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword === confirmPassword && currentPassword) {
      profileMutation.mutate({ password: newPassword, currentPassword });
      setIsPasswordDialogOpen(false);
    }
  };

  // ── Dirty state ──
  const isProfileDirty = useMemo(() => {
    const nameChanged = profileName !== (session?.user?.name || "");
    const phoneChanged = fullPhone !== (savedPhone || "");
    const bioChanged = profileBio !== "";
    const urlChanged = profileUrl !== "";
    return nameChanged || phoneChanged || bioChanged || urlChanged;
  }, [profileName, session?.user?.name, fullPhone, savedPhone, profileBio, profileUrl]);

  const isNotificationsDirty = useMemo(() => {
    const currentSnap = JSON.stringify(notifications.map((n) => ({ id: n.id, inApp: n.inApp, email: n.email, deliveryOverride: n.deliveryOverride })));
    return currentSnap !== initialNotifications || notificationFrequency !== initialFrequency;
  }, [notifications, initialNotifications, notificationFrequency, initialFrequency]);

  const isDirty = activeSection === "profile" ? isProfileDirty : isNotificationsDirty;

  // ── Revert ──
  const handleRevert = useCallback(() => {
    if (activeSection === "profile") {
      setProfileName(session?.user?.name || "");
      setProfileBio("");
      setProfileUrl("");
      if (userData?.phone && typeof userData.phone === "string") {
        const match = userData.phone.match(/^(\+\d+)\s*(.*)$/);
        if (match) {
          setCountryCode(match[1]);
          setProfilePhone(match[2].trim());
        } else {
          setProfilePhone(userData.phone);
        }
      } else {
        setProfilePhone("");
      }
    } else {
      const parsed = JSON.parse(initialNotifications) as { id: string; inApp: boolean; email: boolean; deliveryOverride: DeliveryMode | null }[];
      setNotifications((prev) =>
        prev.map((n) => {
          const saved = parsed.find((s) => s.id === n.id);
          return saved ? { ...n, inApp: saved.inApp, email: saved.email, deliveryOverride: saved.deliveryOverride } : n;
        })
      );
      setNotificationFrequency(initialFrequency);
    }
    setSaveSuccess(false);
    setSaveError(false);
  }, [activeSection, session?.user?.name, userData?.phone, initialNotifications, initialFrequency]);

  const handleNotificationSave = async () => {
    setIsSavingNotifications(true);
    setSaveSuccess(false);
    setSaveError(false);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      toast({ title: "설정 저장 완료", description: "알림 설정이 반영되었습니다." });
      setInitialNotifications(
        JSON.stringify(notifications.map((n) => ({ id: n.id, inApp: n.inApp, email: n.email, deliveryOverride: n.deliveryOverride })))
      );
      setInitialFrequency(notificationFrequency);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const getInitials = () => {
    if (session?.user?.name) {
      return session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return session?.user?.email?.[0].toUpperCase() || "U";
  };

  const userRole = (session?.user?.role as string) || "USER";
  const roleLabel = ROLE_LABELS[userRole] || "사용자";

  const toggleNotification = (id: string, field: "inApp" | "email") => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: !n[field] } : n))
    );
  };

  const setDeliveryOverride = (id: string, mode: DeliveryMode | null) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, deliveryOverride: mode } : n))
    );
  };

  // Group notifications by category for rendering
  const notificationsByCategory = useMemo(() => {
    const grouped: { category: string; items: NotificationItem[] }[] = [];
    const seen = new Set<string>();
    for (const n of notifications) {
      if (!seen.has(n.category)) {
        seen.add(n.category);
        grouped.push({ category: n.category, items: notifications.filter((x) => x.category === n.category) });
      }
    }
    return grouped;
  }, [notifications]);

  // ── Nav items ──
  const navItems: { id: SettingsSection; label: string; sublabel: string; icon: React.ElementType }[] = [
    { id: "profile", label: "계정", sublabel: "프로필 및 보안", icon: User },
    { id: "notifications", label: "알림", sublabel: "알림 채널 및 빈도", icon: Bell },
    { id: "billing", label: "청구 및 구독", sublabel: "플랜, 결제, 청구서", icon: CreditCard },
  ];

  // ── Cancel dialog helpers ──
  const resetCancelFlow = () => {
    setIsCancelOpen(false);
    setCancelStep(1);
    setCancelReason(null);
    setCancelFeedback("");
  };

  return (
    <div className="w-full min-h-screen bg-[#09090b] py-4 md:py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="space-y-1 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">설정</h2>
          <p className="text-sm text-slate-400 hidden sm:block">
            계정 정보와 연구실 워크스페이스 환경을 관리합니다.
          </p>
        </div>

        <div className="h-px bg-[#222226] mb-6" />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left nav panel ── */}
          <nav className="lg:w-60 shrink-0">
            <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-2 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-md text-left transition-colors",
                      isActive
                        ? "bg-[#222226] text-slate-100"
                        : "text-slate-400 hover:bg-[#222226]/50 hover:text-slate-200"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-slate-100" : "text-slate-500")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight">{item.label}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{item.sublabel}</div>
                    </div>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ── Right content ── */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* ═══ PROFILE ═══ */}
            {activeSection === "profile" && (
              <div className="animate-in fade-in-50 duration-300 space-y-6">
                {/* Profile info */}
                <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg">
                  <div className="px-6 py-5 border-b border-[#2a2a2e]">
                    <div className="flex items-center gap-2 text-slate-100 font-semibold">
                      <User className="h-4 w-4" />
                      프로필 정보
                    </div>
                    <p className="text-sm text-slate-400 mt-1">공개적으로 표시되는 프로필 정보입니다.</p>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                        <AvatarFallback className="bg-[#222226] text-slate-300 text-lg font-semibold">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <Badge variant="secondary" className="w-fit border-[#333338] bg-[#222226] text-slate-300">
                          {roleLabel}
                        </Badge>
                        <Button type="button" variant="outline" size="sm" className="border-[#333338] text-slate-300 hover:bg-[#222226]">
                          <Upload className="h-4 w-4 mr-2" />
                          사진 변경
                        </Button>
                      </div>
                    </div>

                    <div className="h-px bg-[#222226]" />

                    <div className="space-y-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">기본 정보</h4>
                      <div className="grid gap-5 max-w-md">
                        <div className="grid gap-1.5">
                          <Label htmlFor="name" className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            이름
                          </Label>
                          <Input
                            id="name"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="이름을 입력하세요"
                            className="bg-[#09090b] border-[#333338] text-slate-100 placeholder:text-slate-600 focus:ring-slate-600"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="phone" className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            휴대폰 번호
                          </Label>
                          <div className="flex gap-2">
                            <Select value={countryCode} onValueChange={setCountryCode}>
                              <SelectTrigger className="w-[100px] bg-[#09090b] border-[#333338] text-slate-300">
                                <SelectValue placeholder="국가" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="+82">KR (+82)</SelectItem>
                                <SelectItem value="+1">US (+1)</SelectItem>
                                <SelectItem value="+81">JP (+81)</SelectItem>
                                <SelectItem value="+86">CN (+86)</SelectItem>
                                <SelectItem value="+44">UK (+44)</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              id="phone"
                              value={profilePhone}
                              onChange={(e) => setProfilePhone(e.target.value)}
                              placeholder="010-0000-0000"
                              className="flex-1 bg-[#09090b] border-[#333338] text-slate-100 placeholder:text-slate-600 focus:ring-slate-600"
                            />
                          </div>
                          <p className="text-[11px] text-slate-500">긴급 알림 및 본인 확인용으로 사용됩니다.</p>
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="bio" className="text-sm font-medium text-slate-300">소개</Label>
                          <Textarea
                            id="bio"
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            placeholder="자기소개를 입력하세요"
                            rows={3}
                            className="bg-[#09090b] border-[#333338] text-slate-100 placeholder:text-slate-600"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[#222226]" />

                    <div className="space-y-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">연락처</h4>
                      <div className="grid gap-5 max-w-md">
                        <div className="grid gap-1.5">
                          <Label htmlFor="url" className="text-sm font-medium text-slate-300">URL</Label>
                          <Input
                            id="url"
                            value={profileUrl}
                            onChange={(e) => setProfileUrl(e.target.value)}
                            placeholder="https://example.com"
                            type="url"
                            className="bg-[#09090b] border-[#333338] text-slate-100 placeholder:text-slate-600"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="email" className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-500" />
                            이메일
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={profileEmail}
                            disabled
                            className="bg-[#09090b]/50 border-[#333338] text-slate-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg">
                  <div className="px-6 py-5 border-b border-[#2a2a2e]">
                    <div className="flex items-center gap-2 text-slate-100 font-semibold">
                      <Lock className="h-4 w-4" />
                      비밀번호
                    </div>
                    <p className="text-sm text-slate-400 mt-1">계정 보안을 위해 주기적으로 비밀번호를 변경하세요.</p>
                  </div>
                  <div className="p-6">
                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="border-[#333338] text-slate-300 hover:bg-[#222226]">
                          <Lock className="h-4 w-4 mr-2" />
                          비밀번호 변경
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#1a1a1e] border-[#2a2a2e]">
                        <DialogHeader>
                          <DialogTitle className="text-slate-100">비밀번호 변경</DialogTitle>
                          <DialogDescription className="text-slate-400">
                            보안을 위해 주기적으로 비밀번호를 변경해주세요.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="dialogCurrentPassword" className="text-slate-300">현재 비밀번호</Label>
                            <Input
                              id="dialogCurrentPassword"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="현재 비밀번호를 입력하세요"
                              required
                              className="bg-[#09090b] border-[#333338] text-slate-100"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="dialogNewPassword" className="text-slate-300">새 비밀번호</Label>
                            <Input
                              id="dialogNewPassword"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="새 비밀번호를 입력하세요"
                              required
                              className="bg-[#09090b] border-[#333338] text-slate-100"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="dialogConfirmPassword" className="text-slate-300">비밀번호 확인</Label>
                            <Input
                              id="dialogConfirmPassword"
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="새 비밀번호를 다시 입력하세요"
                              required
                              className="bg-[#09090b] border-[#333338] text-slate-100"
                            />
                          </div>
                          {newPassword && newPassword !== confirmPassword && (
                            <p className="text-sm text-red-400">비밀번호가 일치하지 않습니다.</p>
                          )}
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-[#333338] text-slate-300"
                              onClick={() => {
                                setIsPasswordDialogOpen(false);
                                setCurrentPassword("");
                                setNewPassword("");
                                setConfirmPassword("");
                              }}
                            >
                              취소
                            </Button>
                            <Button
                              type="submit"
                              className="bg-[#222226] text-slate-100 hover:bg-slate-200"
                              disabled={profileMutation.isPending || !newPassword || newPassword !== confirmPassword || !currentPassword}
                            >
                              {profileMutation.isPending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />변경 중...</>
                              ) : (
                                "변경하기"
                              )}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ NOTIFICATIONS ═══ */}
            {activeSection === "notifications" && (
              <div className="animate-in fade-in-50 duration-300 space-y-5">

                {/* ── 1. 전달 방식 (Delivery Method) ── */}
                <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-[#2a2a2e]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10">
                        <Bell className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-100">전달 방식</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          이벤트 알림을 즉시 받거나 하루 단위 요약으로 받을 수 있습니다
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 즉시 알림 */}
                      <button
                        type="button"
                        onClick={() => setNotificationFrequency("immediate")}
                        className={cn(
                          "relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all",
                          notificationFrequency === "immediate"
                            ? "border-blue-500 bg-blue-500/[0.06]"
                            : "border-[#2a2a2e] bg-[#222226] hover:border-[#353a45]"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center h-10 w-10 rounded-lg shrink-0 transition-colors",
                          notificationFrequency === "immediate"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-[#2a2a2e] text-slate-500"
                        )}>
                          <Zap className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-semibold",
                              notificationFrequency === "immediate" ? "text-slate-100" : "text-slate-300"
                            )}>
                              즉시 알림
                            </span>
                            {notificationFrequency === "immediate" && (
                              <span className="flex h-5 items-center rounded-full bg-blue-500/15 px-2 text-[10px] font-bold text-blue-400">
                                활성
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            이벤트가 발생하면 바로 전달됩니다
                          </p>
                        </div>
                        {/* Radio indicator */}
                        <div className={cn(
                          "absolute top-4 right-4 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-colors",
                          notificationFrequency === "immediate"
                            ? "border-blue-500 bg-blue-500"
                            : "border-[#3a3f4a]"
                        )}>
                          {notificationFrequency === "immediate" && (
                            <div className="h-1.5 w-1.5 rounded-full bg-[#1a1a1e]" />
                          )}
                        </div>
                      </button>

                      {/* 하루 한 번 요약 */}
                      <button
                        type="button"
                        onClick={() => setNotificationFrequency("daily")}
                        className={cn(
                          "relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left transition-all",
                          notificationFrequency === "daily"
                            ? "border-blue-500 bg-blue-500/[0.06]"
                            : "border-[#2a2a2e] bg-[#222226] hover:border-[#353a45]"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center h-10 w-10 rounded-lg shrink-0 transition-colors",
                          notificationFrequency === "daily"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-[#2a2a2e] text-slate-500"
                        )}>
                          <CalendarClock className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-sm font-semibold",
                              notificationFrequency === "daily" ? "text-slate-100" : "text-slate-300"
                            )}>
                              하루 한 번 요약
                            </span>
                            {notificationFrequency === "daily" && (
                              <span className="flex h-5 items-center rounded-full bg-blue-500/15 px-2 text-[10px] font-bold text-blue-400">
                                활성
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            하루 동안 발생한 항목을 정리해 한 번에 전달합니다
                          </p>
                        </div>
                        {/* Radio indicator */}
                        <div className={cn(
                          "absolute top-4 right-4 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-colors",
                          notificationFrequency === "daily"
                            ? "border-blue-500 bg-blue-500"
                            : "border-[#3a3f4a]"
                        )}>
                          {notificationFrequency === "daily" && (
                            <div className="h-1.5 w-1.5 rounded-full bg-[#1a1a1e]" />
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── 2. 채널별 알림 토글 테이블 ── */}
                <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-[#2a2a2e]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#111114]0/10">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-100">알림 항목별 채널 설정</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          각 알림의 수신 채널과 전달 방식을 개별적으로 설정할 수 있습니다
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pt-4 pb-2">
                    {/* Column headers */}
                    <div className="flex items-center mb-1">
                      <div className="flex-1" />
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="w-[52px] text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">앱 내</span>
                        <span className="w-[52px] text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">이메일</span>
                        <span className="w-[72px] text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">전달</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 pb-4">
                    {notificationsByCategory.map((group, gi) => (
                      <div key={group.category}>
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-3 pt-4 pb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400/80">
                            {group.category}
                          </span>
                          <div className="flex-1 h-px bg-[#2a2a2e]" />
                        </div>

                        {/* Items */}
                        <div className="space-y-0.5">
                          {group.items.map((n) => {
                            const Icon = n.icon;
                            const isOverridden = n.deliveryOverride !== null;
                            const effectiveMode = n.deliveryOverride ?? notificationFrequency;

                            return (
                              <div
                                key={n.id}
                                className={cn(
                                  "flex items-center justify-between py-3 px-3 rounded-lg transition-colors group",
                                  isOverridden
                                    ? "bg-blue-500/[0.04] hover:bg-blue-500/[0.07]"
                                    : "hover:bg-[#222226]"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <Icon className={cn(
                                    "h-4 w-4 shrink-0",
                                    isOverridden ? "text-blue-400/70" : "text-slate-500"
                                  )} />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-slate-200">{n.label}</span>
                                      {isOverridden && (
                                        <span className="flex h-4 items-center rounded bg-blue-500/10 px-1.5 text-[9px] font-bold text-blue-400 uppercase tracking-wider">
                                          개별
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate mt-0.5">{n.description}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                  {/* In-app toggle */}
                                  <div className="w-[52px] flex justify-center">
                                    <Switch
                                      checked={n.inApp}
                                      onCheckedChange={() => toggleNotification(n.id, "inApp")}
                                      className="data-[state=checked]:bg-blue-500"
                                    />
                                  </div>
                                  {/* Email toggle */}
                                  <div className="w-[52px] flex justify-center">
                                    <Switch
                                      checked={n.email}
                                      onCheckedChange={() => toggleNotification(n.id, "email")}
                                      className="data-[state=checked]:bg-blue-500"
                                    />
                                  </div>
                                  {/* Delivery override dropdown */}
                                  <div className="w-[72px] flex justify-center">
                                    <Select
                                      value={n.deliveryOverride ?? "default"}
                                      onValueChange={(val: string) =>
                                        setDeliveryOverride(n.id, val === "default" ? null : val as DeliveryMode)
                                      }
                                    >
                                      <SelectTrigger
                                        className={cn(
                                          "h-7 w-[68px] text-[10px] font-medium border px-2 rounded-md",
                                          isOverridden
                                            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                            : "border-[#2a2a2e] bg-[#222226] text-slate-500"
                                        )}
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-[#222226] border-[#2a2a2e]">
                                        <SelectItem value="default" className="text-xs text-slate-400">
                                          기본값
                                        </SelectItem>
                                        <SelectItem value="immediate" className="text-xs text-slate-300">
                                          즉시
                                        </SelectItem>
                                        <SelectItem value="daily" className="text-xs text-slate-300">
                                          요약
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Separator between groups (not after last) */}
                        {gi < notificationsByCategory.length - 1 && (
                          <div className="mx-3 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="px-6 py-3.5 border-t border-[#2a2a2e] bg-[#111114]/50">
                    <div className="flex items-center gap-4 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-[#2a2a2e]" />
                        <span>기본값 = 상단 전달 방식 따름</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-blue-500/40" />
                        <span className="text-blue-400/70">개별 = 항목별 전달 방식 지정됨</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ═══ BILLING ═══ */}
            {activeSection === "billing" && (
              <div className="animate-in fade-in-50 duration-300 space-y-6">
                {billingLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-6">
                        <Skeleton className="h-5 w-32 bg-[#222226] mb-3" />
                        <Skeleton className="h-8 w-48 bg-[#222226]" />
                      </div>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const subscription = billingData?.subscription || {
                      plan: "FREE",
                      status: "active",
                      currentPeriodEnd: null as string | null,
                    };
                    const planInfo = (billingData?.planInfo as Record<string, { nameKo: string; priceDisplay?: string }>) || {};
                    const planKey = (subscription?.plan && ["FREE", "TEAM", "ORGANIZATION"].includes(subscription.plan) ? subscription.plan : "FREE") as string;
                    const displayName = planInfo[planKey]?.nameKo ?? "무료";
                    const priceDisplay = planInfo[planKey]?.priceDisplay ?? "";
                    const invoices = billingData?.invoices ?? [];
                    const hasInvoices = invoices.length > 0 || DEMO_INVOICES.length > 0;
                    const allInvoices = invoices.length > 0 ? invoices : DEMO_INVOICES;
                    const isFree = planKey === "FREE";

                    return (
                      <>
                        {/* Plan overview grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {/* Current plan */}
                          <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-5">
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">현재 플랜</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-slate-100">{displayName}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-medium",
                                  subscription.status === "active"
                                    ? "border-emerald-800 bg-emerald-950/40 text-emerald-400"
                                    : "border-amber-800 bg-amber-950/40 text-amber-400"
                                )}
                              >
                                {subscription.status === "active" ? "활성" : "비활성"}
                              </Badge>
                            </div>
                          </div>

                          {/* Next billing date */}
                          <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-5">
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">다음 결제일</div>
                            <div className="text-xl font-bold text-slate-100">
                              {subscription?.currentPeriodEnd
                                ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
                                : isFree ? "-" : "-"}
                            </div>
                          </div>

                          {/* Billing amount */}
                          <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-5">
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">월 결제 금액</div>
                            <div className="text-xl font-bold text-slate-100">
                              {priceDisplay || "무료"}
                            </div>
                          </div>

                          {/* Seats */}
                          <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-5">
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">좌석 수</div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-500" />
                              <span className="text-lg font-bold text-slate-100">
                                {billingData?.seats?.used ?? 1} / {billingData?.seats?.total ?? (isFree ? 1 : "무제한")}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">사용 중 / 전체</p>
                          </div>

                          {/* Billing contact */}
                          <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-5">
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">결제 담당자</div>
                            <div className="text-sm font-medium text-slate-200">
                              {billingData?.billingContact?.name ?? session?.user?.name ?? "-"}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {billingData?.billingContact?.email ?? session?.user?.email ?? "-"}
                            </p>
                          </div>

                          {/* Payment method */}
                          <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg p-5">
                            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">결제 수단</div>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-slate-500" />
                              <span className="text-sm font-medium text-slate-200">
                                {billingData?.paymentMethod?.display ?? (isFree ? "등록된 수단 없음" : "Visa ****1234")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Invoices */}
                        <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg">
                          <div className="px-6 py-4 border-b border-[#2a2a2e] flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                              <Receipt className="h-4 w-4" />
                              최근 청구서
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            {!hasInvoices || isFree ? (
                              <div className="px-6 py-12 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#222226] mb-3">
                                  <Receipt className="h-5 w-5 text-slate-500" />
                                </div>
                                <p className="text-sm text-slate-400">첫 결제 이전입니다</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  유료 플랜으로 전환하면 청구서가 여기에 표시됩니다.
                                </p>
                              </div>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-[#2a2a2e] hover:bg-transparent">
                                    <TableHead className="text-slate-400 text-xs font-medium">날짜</TableHead>
                                    <TableHead className="text-slate-400 text-xs font-medium">항목</TableHead>
                                    <TableHead className="text-slate-400 text-xs font-medium">금액</TableHead>
                                    <TableHead className="text-slate-400 text-xs font-medium">상태</TableHead>
                                    <TableHead className="text-right text-slate-400 text-xs font-medium">영수증</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(invoices.length > 0 ? invoices : allInvoices).map((invoice: { id: string; date?: string; paidAt?: string; periodStart?: string; description?: string; amount?: number; amountDue?: number; amountPaid?: number; status?: string; invoicePdfUrl?: string }) => (
                                    <TableRow key={invoice.id} className="border-[#2a2a2e]/50 hover:bg-[#222226]/30">
                                      <TableCell className="text-slate-300 text-sm">
                                        {invoice.date
                                          ? new Date(invoice.date).toLocaleDateString("ko-KR")
                                          : invoice.paidAt
                                            ? new Date(invoice.paidAt).toLocaleDateString("ko-KR")
                                            : "-"}
                                      </TableCell>
                                      <TableCell className="text-slate-300 text-sm">{invoice.description || "구독 결제"}</TableCell>
                                      <TableCell className="text-slate-300 text-sm">
                                        {(invoice.amount ?? invoice.amountPaid ?? invoice.amountDue ?? 0).toLocaleString("ko-KR")}원
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline" className="text-[10px] border-emerald-800 bg-emerald-950/30 text-emerald-400">
                                          {invoice.status === "paid" ? "결제 완료" : "대기"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-slate-400 hover:text-slate-200 h-7 px-2"
                                          onClick={() => {
                                            if (invoice.invoicePdfUrl) {
                                              window.open(invoice.invoicePdfUrl, "_blank");
                                            } else {
                                              toast({ title: "영수증", description: "PDF 영수증은 결제 시스템 연동 후 이용 가능합니다." });
                                            }
                                          }}
                                        >
                                          <Receipt className="h-3.5 w-3.5 mr-1" />
                                          다운로드
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </div>

                        {/* Action row */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            className="bg-[#222226] text-slate-100 hover:bg-slate-200 font-medium"
                            onClick={() => router.push("/dashboard/settings/plans")}
                          >
                            플랜 변경
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                          {!isFree && (
                            <Button
                              variant="ghost"
                              className="text-slate-400 hover:text-red-400 hover:bg-red-950/20"
                              onClick={() => setIsCancelOpen(true)}
                            >
                              구독 해지
                            </Button>
                          )}
                        </div>
                      </>
                    );
                  })()
                )}

                {/* ── Cancel subscription dialog ── */}
                <Dialog open={isCancelOpen} onOpenChange={(open) => { if (!open) resetCancelFlow(); }}>
                  <DialogContent className="bg-[#1a1a1e] border-[#2a2a2e] max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-slate-100">
                        {cancelStep === 1 && "구독 해지"}
                        {cancelStep === 2 && "의견을 남겨주세요"}
                        {cancelStep === 3 && "잠깐, 이런 방법은 어떨까요?"}
                        {cancelStep === 4 && "구독 해지 확인"}
                      </DialogTitle>
                      <DialogDescription className="text-slate-400">
                        {cancelStep === 1 && "해지 이유를 선택해 주세요. 서비스 개선에 도움이 됩니다."}
                        {cancelStep === 2 && "추가로 알려주실 내용이 있다면 작성해 주세요."}
                        {cancelStep === 3 && "해지 전에 확인해 보세요."}
                        {cancelStep === 4 && "아래 내용을 확인 후 해지를 진행합니다."}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="mt-4">
                      {/* Step 1: Reason selection */}
                      {cancelStep === 1 && (
                        <div className="space-y-2">
                          {CANCEL_REASONS.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => setCancelReason(r.value)}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-md border text-left text-sm transition-colors",
                                cancelReason === r.value
                                  ? "border-slate-600 bg-[#222226] text-slate-100"
                                  : "border-[#2a2a2e] text-slate-400 hover:border-[#333338] hover:text-slate-300"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                                cancelReason === r.value ? "border-slate-400" : "border-slate-600"
                              )}>
                                {cancelReason === r.value && (
                                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                                )}
                              </div>
                              {r.label}
                            </button>
                          ))}
                          <div className="flex justify-end gap-2 pt-4">
                            <Button variant="ghost" className="text-slate-400" onClick={resetCancelFlow}>취소</Button>
                            <Button
                              className="bg-[#222226] text-slate-100 hover:bg-slate-200"
                              disabled={!cancelReason}
                              onClick={() => setCancelStep(2)}
                            >
                              다음
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Free text */}
                      {cancelStep === 2 && (
                        <div className="space-y-4">
                          <Textarea
                            value={cancelFeedback}
                            onChange={(e) => setCancelFeedback(e.target.value)}
                            placeholder="어떤 점이 아쉬우셨나요? 자유롭게 작성해 주세요. (선택사항)"
                            rows={4}
                            className="bg-[#09090b] border-[#333338] text-slate-100 placeholder:text-slate-600"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" className="text-slate-400" onClick={() => setCancelStep(1)}>이전</Button>
                            <Button
                              className="bg-[#222226] text-slate-100 hover:bg-slate-200"
                              onClick={() => setCancelStep(3)}
                            >
                              다음
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Save offer */}
                      {cancelStep === 3 && (
                        <div className="space-y-4">
                          {(() => {
                            const offer = getSaveOffer(cancelReason);
                            return (
                              <div className="bg-[#222226]/60 border border-[#333338] rounded-lg p-5 space-y-3">
                                <h4 className="text-sm font-semibold text-slate-200">{offer.title}</h4>
                                <p className="text-sm text-slate-400">{offer.description}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                  onClick={() => {
                                    resetCancelFlow();
                                    if (cancelReason === "price") {
                                      router.push("/dashboard/settings/plans");
                                    }
                                  }}
                                >
                                  {offer.cta}
                                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                                </Button>
                              </div>
                            );
                          })()}
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" className="text-slate-400" onClick={() => setCancelStep(2)}>이전</Button>
                            <Button
                              variant="ghost"
                              className="text-slate-400 hover:text-red-400"
                              onClick={() => setCancelStep(4)}
                            >
                              그래도 해지할게요
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Final confirmation */}
                      {cancelStep === 4 && (
                        <div className="space-y-4">
                          <div className="bg-red-950/20 border border-red-900/40 rounded-lg p-4 space-y-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                              <div className="text-sm text-slate-300 space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">해지일</span>
                                  <span className="text-slate-200">현재 결제 주기 종료 시</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">사용 가능 기간</span>
                                  <span className="text-slate-200">결제 주기 종료까지 모든 기능 이용 가능</span>
                                </div>
                                <div className="h-px bg-red-900/30" />
                                <div className="flex justify-between">
                                  <span className="text-slate-400">데이터</span>
                                  <span className="text-slate-200">읽기 전용 보관 (30일)</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">팀원 권한</span>
                                  <span className="text-slate-200">해지 후 접근 불가</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">재구독</span>
                                  <span className="text-slate-200">언제든 가능</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              className="border-[#333338] text-slate-300"
                              onClick={resetCancelFlow}
                            >
                              취소
                            </Button>
                            <Button
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => {
                                toast({
                                  title: "해지 예약 완료",
                                  description: "현재 결제 주기가 종료되면 구독이 해지됩니다.",
                                });
                                resetCancelFlow();
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              해지 확인
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* ── Bottom action bar (profile & notifications) ── */}
            {activeSection !== "billing" && isDirty && (
              <div className="bg-[#1a1a1e] border border-[#2a2a2e] rounded-lg overflow-hidden">
                <div className="px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    변경된 {activeSection === "profile" ? "프로필 정보" : "알림 설정"}를 저장할 수 있습니다.
                  </p>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-400 gap-1.5"
                      onClick={handleRevert}
                      disabled={profileMutation.isPending || isSavingNotifications}
                    >
                      <RotateCcw className="h-3 w-3" />
                      되돌리기
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={cn(
                        "text-xs font-semibold gap-1.5 min-w-[120px] transition-colors",
                        saveSuccess
                          ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                          : saveError
                            ? "bg-red-700 hover:bg-red-800 text-white"
                            : "bg-[#222226] hover:bg-slate-200 text-slate-100"
                      )}
                      onClick={() => {
                        setSaveSuccess(false);
                        setSaveError(false);
                        if (activeSection === "profile") {
                          handleProfileSubmit();
                        } else {
                          handleNotificationSave();
                        }
                      }}
                      disabled={profileMutation.isPending || isSavingNotifications}
                    >
                      {(profileMutation.isPending || isSavingNotifications) ? (
                        <><Loader2 className="h-3 w-3 animate-spin" />저장 중...</>
                      ) : saveSuccess ? (
                        <><Check className="h-3 w-3" />저장 완료</>
                      ) : saveError ? (
                        <><AlertCircle className="h-3 w-3" />저장 실패 — 다시 시도</>
                      ) : (
                        "변경사항 저장"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
