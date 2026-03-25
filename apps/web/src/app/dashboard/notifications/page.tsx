"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Package,
  Clock,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Users,
  CreditCard,
  Settings,
  CheckCheck,
  AlertTriangle,
  Truck,
  ClipboardCheck,
  BrainCircuit,
  UserPlus,
  KeyRound,
  BarChart3,
  Mail,
  Inbox,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Suspense } from "react";

/* ── 타입 정의 ── */

type NotificationCategory = "stock_alert" | "quote_arrived" | "delivery_complete" | "approval_pending" | "expiry_warning" | "safety_alert" | "system";
type NotificationPriority = "urgent" | "normal" | "low";
type ProcessingStatus = "pending" | "in_progress" | "completed" | "archived";

type Category = "all" | "inventory" | "quote" | "org" | "safety" | "billing" | "system";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "inventory", label: "재고" },
  { value: "quote", label: "견적/구매" },
  { value: "org", label: "조직" },
  { value: "safety", label: "안전" },
  { value: "billing", label: "결제" },
  { value: "system", label: "시스템" },
];

interface TaskNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: ProcessingStatus;
  typeLabel: string;
  targetName: string;
  statusText: string;
  nextAction: string;
  ctaLabel: string;
  ctaHref: string;
  content: string;
  time: string;
  isArchived: boolean;
}

/** 카테고리별 아이콘/색상 매핑 */
const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ElementType; bg: string; text: string; darkBg: string; darkText: string; label: string }
> = {
  stock_alert:       { icon: AlertTriangle, bg: "bg-red-100",    text: "text-red-600",    darkBg: "dark:bg-red-950/40",    darkText: "dark:text-red-400",    label: "재고 부족" },
  quote_arrived:     { icon: FileText,      bg: "bg-blue-100",   text: "text-blue-600",   darkBg: "dark:bg-blue-950/40",   darkText: "dark:text-blue-400",   label: "견적 도착" },
  delivery_complete: { icon: Truck,         bg: "bg-emerald-100",text: "text-emerald-600",darkBg: "dark:bg-emerald-950/40",darkText: "dark:text-emerald-400",label: "입고 완료" },
  approval_pending:  { icon: ClipboardCheck,bg: "bg-amber-100",  text: "text-amber-600",  darkBg: "dark:bg-amber-950/40",  darkText: "dark:text-amber-400",  label: "승인 대기" },
  expiry_warning:    { icon: Clock,         bg: "bg-orange-100", text: "text-orange-600", darkBg: "dark:bg-orange-950/40", darkText: "dark:text-orange-400", label: "유효기간 경고" },
  safety_alert:      { icon: ShieldAlert,   bg: "bg-purple-100", text: "text-purple-600", darkBg: "dark:bg-purple-950/40", darkText: "dark:text-purple-400", label: "안전 관리" },
  system:            { icon: Bell,          bg: "bg-[#222226]",  text: "text-slate-400",  darkBg: "",     darkText: "",  label: "시스템" },
};

/* ── 알림 타입 ── */

interface Notification {
  id: string;
  category: Exclude<Category, "all">;
  icon: React.ElementType;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

/* ── Mock 데이터 (20건) ── */

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    category: "inventory",
    icon: AlertTriangle,
    title: "재고 부족 — FBS (Fetal Bovine Serum)",
    description: "남은 수량 1개, 안전재고 5개. 재주문 검토 필요",
    time: "10분 전",
    read: false,
  },
  {
    id: "2",
    category: "inventory",
    icon: AlertTriangle,
    title: "재고 부족 — Ethanol 99.5%",
    description: "남은 수량 3개, 안전재고 10개. 재주문 검토 필요",
    time: "25분 전",
    read: false,
  },
  {
    id: "3",
    category: "inventory",
    icon: AlertTriangle,
    title: "재고 부족 — DMEM Medium",
    description: "남은 수량 2개, 안전재고 8개. 재주문 검토 필요",
    time: "1시간 전",
    read: false,
  },
  {
    id: "4",
    category: "inventory",
    icon: Clock,
    title: "만료 임박 — DMEM Medium (Lot #2024-A12)",
    description: "D-3일 후 만료. 사용 계획 확인 필요",
    time: "30분 전",
    read: false,
  },
  {
    id: "5",
    category: "quote",
    icon: ClipboardCheck,
    title: "승인 대기 — Antibody Kit 구매 요청",
    description: "₩1,250,000 · 김연구원 요청. 구매 승인 페이지에서 확인",
    time: "1시간 전",
    read: false,
  },
  {
    id: "6",
    category: "quote",
    icon: ClipboardCheck,
    title: "승인 대기 — Cell Culture Flask 대량 주문",
    description: "₩680,000 · 박연구원 요청. 구매 승인 페이지에서 확인",
    time: "2시간 전",
    read: false,
  },
  {
    id: "7",
    category: "quote",
    icon: FileText,
    title: "공급사 견적 도착 — Thermo Fisher 외 2건",
    description: "3개 벤더 견적 비교 가능. 견적 비교 페이지에서 확인",
    time: "2시간 전",
    read: false,
  },
  {
    id: "8",
    category: "inventory",
    icon: Truck,
    title: "입고 완료 — 50ml Conical Tube (100개)",
    description: "배송 완료, 재고에 자동 반영됨",
    time: "3시간 전",
    read: true,
  },
  {
    id: "9",
    category: "safety",
    icon: ShieldCheck,
    title: "MSDS 등록 완료 — Ethanol 99.5%",
    description: "안전 관리 문서가 정상 등록되었습니다",
    time: "4시간 전",
    read: true,
  },
  {
    id: "10",
    category: "system",
    icon: Mail,
    title: "일일 요약 메일 발송 완료",
    description: "오늘의 재고·견적·안전 요약이 발송되었습니다",
    time: "5시간 전",
    read: true,
  },
  {
    id: "11",
    category: "system",
    icon: BrainCircuit,
    title: "PDF BOM 분석 실패",
    description: "OCR 인식률 낮음. 텍스트 붙여넣기로 재시도하세요",
    time: "5시간 전",
    read: false,
  },
  {
    id: "12",
    category: "org",
    icon: UserPlus,
    title: "조직 초대 수락 — 김연구원 합류",
    description: "김연구원님이 조직 초대를 수락했습니다",
    time: "6시간 전",
    read: true,
  },
  {
    id: "13",
    category: "org",
    icon: KeyRound,
    title: "Owner 권한 이전 요청",
    description: "박팀장님이 Owner 권한 이전을 요청했습니다. 확인 필요",
    time: "7시간 전",
    read: false,
  },
  {
    id: "14",
    category: "billing",
    icon: CreditCard,
    title: "구독 갱신 완료 — Business 플랜",
    description: "다음 결제일: 2026-04-18. 정상 갱신되었습니다",
    time: "1일 전",
    read: true,
  },
  {
    id: "15",
    category: "billing",
    icon: BarChart3,
    title: "예산 초과 경고 — 3월 구매 예산 90% 사용",
    description: "월 예산 대비 90% 도달. 추가 구매 시 초과 발생 가능",
    time: "1일 전",
    read: false,
  },
  {
    id: "16",
    category: "inventory",
    icon: Package,
    title: "Pipette Tips 재고 자동 보충 알림",
    description: "1000uL 팁 재고가 기준치 이하. 자동 발주 설정 확인",
    time: "1일 전",
    read: true,
  },
  {
    id: "17",
    category: "quote",
    icon: FileText,
    title: "견적서 만료 예정 — Sigma-Aldrich #Q-2841",
    description: "3일 후 만료. 갱신 또는 발주 결정 필요",
    time: "2일 전",
    read: true,
  },
  {
    id: "18",
    category: "org",
    icon: Users,
    title: "팀원 역할 변경 — 이연구원 REQUESTER → APPROVER",
    description: "관리자에 의해 역할이 변경되었습니다",
    time: "2일 전",
    read: true,
  },
  {
    id: "19",
    category: "safety",
    icon: ShieldCheck,
    title: "안전 점검 일정 알림",
    description: "3월 정기 안전 점검이 3일 후 예정되어 있습니다",
    time: "3일 전",
    read: true,
  },
  {
    id: "20",
    category: "system",
    icon: Settings,
    title: "시스템 점검 완료",
    description: "정기 시스템 점검이 완료되었습니다. 정상 운영 중",
    time: "3일 전",
    read: true,
  },
];

/* ── 컴포넌트 ── */

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filtered = useMemo(() => {
    if (activeCategory === "all") return notifications;
    return notifications.filter((n) => n.category === activeCategory);
  }, [notifications, activeCategory]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, status: "completed" as ProcessingStatus }))
    );
  };

  // 개별 완료 처리
  const markAsCompleted = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, status: "completed" as ProcessingStatus } : notif
      )
    );
  };

  // 알림 보관
  const archiveNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isArchived: true } : notif
      )
    );
  };

  // 알림 아이콘 렌더링
  const renderCategoryIcon = (category: NotificationCategory) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    return (
      <div className={`flex-shrink-0 rounded-lg ${config.bg} ${config.darkBg} p-2.5`}>
        <Icon className={`h-4 w-4 ${config.text} ${config.darkText}`} />
      </div>
    );
  };

  // 알림 아이템 렌더링
  const renderNotificationItem = (notification: TaskNotification) => {
    const isCompleted = notification.status === "completed";
    const isUrgent = notification.priority === "urgent";

    return (
      <Card
        key={notification.id}
        className={`transition-all hover:shadow-md cursor-pointer ${
          isCompleted
            ? "opacity-60 bg-[#1a1a1e]/50"
            : isUrgent
            ? "border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10"
            : "hover:bg-[#222226]/50"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {renderCategoryIcon(notification.category)}
            <div className="flex-1 min-w-0">
              {/* 1행: 유형 라벨 + 우선순위 배지 + 상태 배지 */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  CATEGORY_CONFIG[notification.category].text
                } ${CATEGORY_CONFIG[notification.category].darkText}`}>
                  {notification.typeLabel}
                </span>
                {isUrgent && !isCompleted && (
                  <Badge className="h-4 px-1.5 text-[10px] font-bold bg-red-50 text-red-600 border-0 dark:bg-red-950/40 dark:text-red-400">
                    긴급
                  </Badge>
                )}
                {isCompleted && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    완료
                  </Badge>
                )}
                {!isCompleted && !isUrgent && (
                  <Badge className="h-4 px-1.5 text-[10px] bg-amber-50 text-amber-600 border-0 dark:bg-amber-950/30 dark:text-amber-400">
                    미처리
                  </Badge>
                )}
              </div>

              {/* 2행: 대상 이름 */}
              <p className={`text-sm font-semibold ${
                isCompleted
                  ? "text-slate-400 dark:text-slate-500 line-through"
                  : "text-slate-100"
              }`}>
                {notification.targetName}
              </p>

              {/* 3행: 상세 내용 */}
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {notification.content}
              </p>

              {/* 4행: 상태 텍스트 + 시간 */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {notification.statusText}
                </span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {notification.time}
                </span>
              </div>

              {/* 5행: 액션 영역 */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-[#2a2a2e]">
                {!isCompleted ? (
                  <>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      → {notification.nextAction}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-slate-500 hover:text-slate-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsCompleted(notification.id);
                        }}
                      >
                        완료 처리
                      </Button>
                      <Button
                        size="sm"
                        variant={isUrgent ? "outline" : "outline"}
                        className={`h-7 px-3 text-xs gap-1 ${
                          isUrgent
                            ? "border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30"
                            : "border-[#333338] text-slate-300 hover:bg-[#222226]"
                        }`}
                        asChild
                      >
                        <a href={notification.ctaHref}>
                          {notification.ctaLabel}
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      처리 완료
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveNotification(notification.id);
                      }}
                    >
                      보관
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-full bg-pg p-6 md:p-8 space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100">
            알림 센터
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            모든 알림을 확인하고 작업을 처리하세요
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            모두 완료 처리
          </Button>
        </div>
      </div>

      {/* ── 알림 리스트 ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-el border border-bd border-dashed py-16 text-center">
          <p className="text-sm text-slate-400">새로운 알림이 없습니다</p>
        </div>
      ) : (
        <div className="rounded-lg bg-pn border border-bd divide-y divide-bd">
          {filtered.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => toggleRead(n.id)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-el transition-colors"
              >
                {/* unread 파란 점 */}
                <span className="mt-1.5 flex-shrink-0 w-2 h-2">
                  {!n.read && (
                    <span className="block w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </span>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${n.read ? "text-slate-400" : "text-slate-200"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {n.description}
                  </p>
                </div>

                {/* 시간 */}
                <span className="flex-shrink-0 text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                  {n.time}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2a2a2e] border-t-blue-600" /></div>}>
      <NotificationsContent />
    </Suspense>
  );
}
