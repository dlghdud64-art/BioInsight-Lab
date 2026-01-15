"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Truck, Bell, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Notification {
  id: string;
  type: "alert" | "quote" | "delivery" | "system";
  title: string;
  content: string;
  time: string;
  isRead: boolean;
  isArchived: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "alert",
      title: "재고 부족: 에탄올 (남은 수량 1개)",
      content: "에탄올 재고가 안전 재고 이하로 떨어졌습니다. 재주문이 필요합니다.",
      time: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10분 전
      isRead: false,
      isArchived: false,
    },
    {
      id: "2",
      type: "quote",
      title: "견적 도착: Thermo Fisher 외 2건",
      content: "Thermo Fisher, Sigma-Aldrich, Corning으로부터 견적서가 도착했습니다.",
      time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1시간 전
      isRead: false,
      isArchived: false,
    },
    {
      id: "3",
      type: "delivery",
      title: "배송 완료: 50ml Conical Tube",
      content: "Falcon 50ml Conical Tube (100개) 배송이 완료되었습니다.",
      time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 어제
      isRead: true,
      isArchived: false,
    },
    {
      id: "4",
      type: "system",
      title: "시스템 점검 안내",
      content: "2026년 1월 20일 오전 2시~4시 시스템 점검이 예정되어 있습니다.",
      time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2일 전
      isRead: true,
      isArchived: false,
    },
    {
      id: "5",
      type: "alert",
      title: "재고 부족: DMEM Medium",
      content: "DMEM Medium 재고가 3개 남았습니다. 안전 재고는 10개입니다.",
      time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3시간 전
      isRead: false,
      isArchived: false,
    },
    {
      id: "6",
      type: "delivery",
      title: "입고 완료: Pipette Tips",
      content: "Eppendorf Pipette Tips (1000μL, 10박스) 입고가 완료되었습니다.",
      time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5일 전
      isRead: true,
      isArchived: false,
    },
  ]);

  // 알림 아이콘 렌더링 함수
  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case "alert":
        return (
          <div className="flex-shrink-0 rounded-md bg-red-100 p-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
        );
      case "quote":
        return (
          <div className="flex-shrink-0 rounded-md bg-blue-100 p-2">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
        );
      case "delivery":
        return (
          <div className="flex-shrink-0 rounded-md bg-green-100 p-2">
            <Truck className="h-4 w-4 text-green-600" />
          </div>
        );
      case "system":
        return (
          <div className="flex-shrink-0 rounded-md bg-slate-100 p-2">
            <Bell className="h-4 w-4 text-slate-600" />
          </div>
        );
      default:
        return null;
    }
  };

  // 시간 포맷팅 함수
  const formatTime = (timeString: string) => {
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
    return format(time, "yyyy.MM.dd", { locale: ko });
  };

  // 모두 읽음 처리
  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, isRead: true }))
    );
  };

  // 알림 읽음 처리
  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  // 알림 보관 처리
  const archiveNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isArchived: true } : notif
      )
    );
  };

  // 필터링된 알림
  const allNotifications = notifications.filter((n) => !n.isArchived);
  const unreadNotifications = notifications.filter((n) => !n.isRead && !n.isArchived);
  const archivedNotifications = notifications.filter((n) => n.isArchived);

  // 알림 아이템 렌더링
  const renderNotificationItem = (notification: Notification) => (
    <Card
      key={notification.id}
      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
        !notification.isRead ? "bg-blue-50/50" : ""
      }`}
      onClick={() => markAsRead(notification.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {renderNotificationIcon(notification.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {notification.title}
                  </p>
                  {!notification.isRead && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                      새
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {notification.content}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-slate-500 whitespace-nowrap">
                  {formatTime(notification.time)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 mt-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    archiveNotification(notification.id);
                  }}
                >
                  보관
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-8 pt-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            알림 센터
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            모든 알림을 확인하고 관리하세요
          </p>
        </div>
        <Button
          variant="outline"
          onClick={markAllAsRead}
          disabled={unreadNotifications.length === 0}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          모두 읽음 처리
        </Button>
      </div>

      {/* 탭 및 알림 리스트 */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            전체
            {allNotifications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {allNotifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">
            안 읽음
            {unreadNotifications.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {unreadNotifications.length}
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
          {allNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-500">알림이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            allNotifications.map(renderNotificationItem)
          )}
        </TabsContent>

        {/* 안 읽음 탭 */}
        <TabsContent value="unread" className="space-y-3">
          {unreadNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-300 mx-auto mb-4" />
                <p className="text-sm text-slate-500">읽지 않은 알림이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            unreadNotifications.map(renderNotificationItem)
          )}
        </TabsContent>

        {/* 보관함 탭 */}
        <TabsContent value="archived" className="space-y-3">
          {archivedNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-500">보관된 알림이 없습니다</p>
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

