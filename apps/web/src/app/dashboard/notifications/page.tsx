"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, FileText, Truck, Bell, CheckCircle2,
  Clock, ShieldAlert, ClipboardCheck, Flame, ArrowRight,
  Package, Filter,
} from "lucide-react";

/* ── 타입 정의 ── */

type NotificationCategory =
  | "stock_alert"
  | "quote_arrived"
  | "delivery_complete"
  | "approval_pending"
  | "expiry_warning"
  | "safety_alert"
  | "system";

type NotificationPriority = "urgent" | "normal";
type ProcessingStatus = "pending" | "completed";

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
  stock_alert:       { icon: AlertTriangle, bg: "bg-red-950/40",    text: "text-red-400",    darkBg: "",    darkText: "",    label: "재고 부족" },
  quote_arrived:     { icon: FileText,      bg: "bg-blue-950/40",   text: "text-blue-400",   darkBg: "",   darkText: "",   label: "견적 도착" },
  delivery_complete: { icon: Truck,         bg: "bg-emerald-950/40",text: "text-emerald-400",darkBg: "",darkText: "",label: "입고 완료" },
  approval_pending:  { icon: ClipboardCheck,bg: "bg-amber-950/40",  text: "text-amber-400",  darkBg: "",  darkText: "",  label: "승인 대기" },
  expiry_warning:    { icon: Clock,         bg: "bg-orange-950/40", text: "text-orange-400", darkBg: "", darkText: "", label: "유효기간 경고" },
  safety_alert:      { icon: ShieldAlert,   bg: "bg-purple-950/40", text: "text-purple-400", darkBg: "", darkText: "", label: "안전 관리" },
  system:            { icon: Bell,          bg: "bg-slate-800",  text: "text-slate-400",  darkBg: "",     darkText: "",  label: "시스템" },
};

/* ── 시간 포맷팅 ── */

function formatTime(timeString: string): string {
  const time = new Date(timeString);
  const now = new Date();
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return time.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ── 컴포넌트 ── */

function NotificationsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "pending" ? "pending" : "all";

  const [notifications, setNotifications] = useState<TaskNotification[]>([
    {
      id: "1",
      category: "stock_alert",
      priority: "urgent",
      status: "pending",
      typeLabel: "재고 부족",
      targetName: "FBS (Fetal Bovine Serum)",
      statusText: "남은 수량 1개 · 안전재고 5개",
      nextAction: "재발주 필요",
      ctaLabel: "재발주 보기",
      ctaHref: "/dashboard/inventory?filter=low",
      content: "FBS 재고가 안전 재고 이하로 떨어졌습니다. 즉시 재주문이 필요합니다.",
      time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "2",
      category: "expiry_warning",
      priority: "urgent",
      status: "pending",
      typeLabel: "유효기간 경고",
      targetName: "DMEM Medium (Lot #2024-A12)",
      statusText: "D-3일 후 만료",
      nextAction: "사용 또는 재주문",
      ctaLabel: "재고 확인",
      ctaHref: "/dashboard/inventory",
      content: "DMEM Medium의 유효기간이 3일 남았습니다. 사용 계획을 확인하거나 새 로트를 주문하세요.",
      time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "3",
      category: "approval_pending",
      priority: "urgent",
      status: "pending",
      typeLabel: "승인 대기",
      targetName: "Antibody Kit 구매 요청",
      statusText: "₩1,250,000 · 김연구원 요청",
      nextAction: "승인 필요",
      ctaLabel: "승인하기",
      ctaHref: "/dashboard/purchases",
      content: "김연구원이 Antibody Kit 구매를 요청했습니다. 금액: ₩1,250,000",
      time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "4",
      category: "quote_arrived",
      priority: "normal",
      status: "pending",
      typeLabel: "견적 도착",
      targetName: "Thermo Fisher 외 2건",
      statusText: "3개 벤더 견적 비교 가능",
      nextAction: "견적 확인 필요",
      ctaLabel: "견적 확인",
      ctaHref: "/dashboard/quotes",
      content: "Thermo Fisher, Sigma-Aldrich, Corning으로부터 견적서가 도착했습니다. 비교 분석이 가능합니다.",
      time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "5",
      category: "stock_alert",
      priority: "normal",
      status: "pending",
      typeLabel: "재고 부족",
      targetName: "에탄올 (Ethanol, 99.5%)",
      statusText: "남은 수량 3개 · 안전재고 10개",
      nextAction: "재주문 검토",
      ctaLabel: "재발주 보기",
      ctaHref: "/dashboard/inventory?filter=low",
      content: "에탄올 재고가 안전 재고 이하로 떨어졌습니다. 재주문을 검토하세요.",
      time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "6",
      category: "delivery_complete",
      priority: "normal",
      status: "pending",
      typeLabel: "입고 완료",
      targetName: "50ml Conical Tube (100개)",
      statusText: "배송 완료 · 검수 대기",
      nextAction: "재고 반영 필요",
      ctaLabel: "재고 반영",
      ctaHref: "/dashboard/inventory",
      content: "Falcon 50ml Conical Tube (100개) 배송이 완료되었습니다. 재고에 반영해주세요.",
      time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "7",
      category: "delivery_complete",
      priority: "normal",
      status: "completed",
      typeLabel: "입고 완료",
      targetName: "Pipette Tips (1000μL, 10박스)",
      statusText: "재고 반영 완료",
      nextAction: "",
      ctaLabel: "확인",
      ctaHref: "/dashboard/inventory",
      content: "Eppendorf Pipette Tips (1000μL, 10박스) 입고 및 재고 반영이 완료되었습니다.",
      time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      isArchived: false,
    },
    {
      id: "8",
      category: "safety_alert",
      priority: "normal",
      status: "completed",
      typeLabel: "안전 관리",
      targetName: "에탄올 (Ethanol, 99.5%)",
      statusText: "MSDS 등록 완료",
      nextAction: "",
      ctaLabel: "확인",
      ctaHref: "/dashboard/safety",
      content: "에탄올 MSDS 문서가 등록 완료되었습니다.",
      time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      isArchived: false,
    },
  ]);

  // 집계
  const activeNotifications = useMemo(
    () => notifications.filter((n) => !n.isArchived),
    [notifications]
  );
  const pendingNotifications = useMemo(
    () => activeNotifications.filter((n) => n.status === "pending"),
    [activeNotifications]
  );
  const completedNotifications = useMemo(
    () => activeNotifications.filter((n) => n.status === "completed"),
    [activeNotifications]
  );
  const archivedNotifications = useMemo(
    () => notifications.filter((n) => n.isArchived),
    [notifications]
  );

  const urgentPendingCount = pendingNotifications.filter((n) => n.priority === "urgent").length;

  // 모두 완료 처리
  const markAllCompleted = () => {
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
        className={`transition-all hover:shadow-none cursor-pointer ${
          isCompleted
            ? "opacity-60 bg-slate-900/50"
            : isUrgent
            ? "border-red-900/40 bg-red-950/10"
            : "hover:bg-slate-800/50"
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
                  <Badge className="h-4 px-1.5 text-[10px] font-bold bg-red-950/40 text-red-400 border-0">
                    긴급
                  </Badge>
                )}
                {isCompleted && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-emerald-950/50 text-emerald-400 border-emerald-800">
                    완료
                  </Badge>
                )}
                {!isCompleted && !isUrgent && (
                  <Badge className="h-4 px-1.5 text-[10px] bg-amber-950/30 text-amber-400 border-0">
                    미처리
                  </Badge>
                )}
              </div>

              {/* 2행: 대상 이름 */}
              <p className={`text-sm font-semibold ${
                isCompleted
                  ? "text-slate-500 line-through"
                  : "text-slate-100"
              }`}>
                {notification.targetName}
              </p>

              {/* 3행: 상세 내용 */}
              <p className="text-sm text-slate-400 mt-1">
                {notification.content}
              </p>

              {/* 4행: 상태 텍스트 + 시간 */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-400">
                  {notification.statusText}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-xs text-slate-500">
                  {formatTime(notification.time)}
                </span>
              </div>

              {/* 5행: 액션 영역 */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800">
                {!isCompleted ? (
                  <>
                    <span className="text-xs text-slate-500">
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
                            ? "border-red-800 text-red-400 bg-red-950/30 hover:bg-red-900/40"
                            : "border-slate-700 text-slate-300 hover:bg-slate-800"
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
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
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
    <div className="space-y-6 p-8 pt-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100">
            알림 센터
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            모든 알림을 확인하고 작업을 처리하세요
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={markAllCompleted}
            disabled={pendingNotifications.length === 0}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            모두 완료 처리
          </Button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={urgentPendingCount > 0 ? "border-red-900/30" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-red-950/30 p-2.5">
              <Flame className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{urgentPendingCount}</p>
              <p className="text-xs text-slate-400">긴급 처리</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-950/40 p-2.5">
              <ClipboardCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{pendingNotifications.length}</p>
              <p className="text-xs text-slate-400">미처리 작업</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-950/40 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{completedNotifications.length}</p>
              <p className="text-xs text-slate-400">완료된 작업</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 및 알림 리스트 */}
      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            전체
            {activeNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {activeNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            미처리
            {pendingNotifications.length > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs bg-amber-950/40 text-amber-400 border-0">
                {pendingNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            완료
            {completedNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs bg-emerald-950/50 text-emerald-400">
                {completedNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived">
            보관함
            {archivedNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {archivedNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 전체 탭 */}
        <TabsContent value="all" className="space-y-3">
          {activeNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-400">모든 작업이 처리되었습니다</p>
                <p className="text-xs text-slate-400 mt-1">새 알림이 발생하면 여기에 표시됩니다</p>
              </CardContent>
            </Card>
          ) : (
            activeNotifications
              .sort((a, b) => {
                if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
                if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
                return new Date(b.time).getTime() - new Date(a.time).getTime();
              })
              .map(renderNotificationItem)
          )}
        </TabsContent>

        {/* 미처리 탭 */}
        <TabsContent value="pending" className="space-y-3">
          {pendingNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-400">처리할 작업이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            pendingNotifications
              .sort((a, b) => {
                if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
                return new Date(b.time).getTime() - new Date(a.time).getTime();
              })
              .map(renderNotificationItem)
          )}
        </TabsContent>

        {/* 완료 탭 */}
        <TabsContent value="completed" className="space-y-3">
          {completedNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ClipboardCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-400">완료된 작업이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            completedNotifications.map(renderNotificationItem)
          )}
        </TabsContent>

        {/* 보관함 탭 */}
        <TabsContent value="archived" className="space-y-3">
          {archivedNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-400">보관된 알림이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            archivedNotifications.map(renderNotificationItem)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-blue-600" /></div>}>
      <NotificationsContent />
    </Suspense>
  );
}
