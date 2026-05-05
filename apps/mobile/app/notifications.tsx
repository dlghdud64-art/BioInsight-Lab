/**
 * §11.209d-notification-inapp-mobile-screen — in-app 알림 list screen.
 *
 * canonical truth = /api/notifications GET response. helper 4개
 * (lib/event-category-map) 로 eventType → category / text / href / time
 * 매핑 (web Header bell 과 동일 logic).
 *
 * UX:
 *   - FlatList 기반 (large list 성능)
 *   - read state 시각화 (unread = bg-blue-50/60 + 파란 점, read = bg-white)
 *   - click → mark as read + entity navigation (router.push)
 *   - pull-to-refresh 지원
 *   - 빈 상태 + 로딩 상태
 */

import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Bell, AlertTriangle, FileText, Package, ClipboardCheck, Clock, ShieldAlert, CheckCircle2 } from "lucide-react-native";
import {
  useNotifications,
  useMarkNotificationRead,
} from "../hooks/useApi";
import {
  eventTypeToCategory,
  buildNotificationText,
  buildNotificationHref,
  formatNotificationTime,
  type NotificationCategory,
} from "../lib/event-category-map";
import type { NotificationItem } from "../types";
import { iconColor, spinnerColor } from "../theme/colors";

// ── 카테고리별 아이콘 + 색상 (web Header CATEGORY_CONFIG 와 정합) ──

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: React.ComponentType<{ size?: number; color?: string }>; color: string; bgUnread: string; label: string }
> = {
  stock_alert: { icon: AlertTriangle, color: "#ef4444", bgUnread: "bg-red-50", label: "재고" },
  quote_arrived: { icon: FileText, color: "#2563eb", bgUnread: "bg-blue-50", label: "견적" },
  delivery_complete: { icon: Package, color: "#10b981", bgUnread: "bg-emerald-50", label: "입고" },
  approval_pending: { icon: ClipboardCheck, color: "#8b5cf6", bgUnread: "bg-violet-50", label: "결재" },
  expiry_warning: { icon: Clock, color: "#f59e0b", bgUnread: "bg-amber-50", label: "만료" },
  safety_alert: { icon: ShieldAlert, color: "#f97316", bgUnread: "bg-orange-50", label: "안전" },
  system: { icon: Bell, color: "#64748b", bgUnread: "bg-slate-100", label: "시스템" },
};

export default function NotificationsScreen() {
  const { data, isLoading, refetch, isFetching } = useNotifications();
  const markRead = useMarkNotificationRead();

  const items = data?.notifications ?? [];

  const handlePress = useCallback(
    (item: NotificationItem) => {
      if (item.readAt === null) {
        markRead.mutate(item.id);
      }
      const href = buildNotificationHref(item);
      router.push(href as never);
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: NotificationItem; index: number }) => {
      const category = eventTypeToCategory(item.event.eventType);
      const isRead = item.readAt !== null;
      const config = CATEGORY_CONFIG[category];
      const Icon = config.icon;
      return (
        <Pressable
          onPress={() => handlePress(item)}
          className={`flex-row items-start gap-3 px-4 py-3.5 ${
            !isRead ? "bg-blue-50/40" : "bg-white"
          } ${index > 0 ? "border-t border-slate-100" : ""}`}
        >
          {/* 카테고리 아이콘 */}
          <View
            className={`w-9 h-9 rounded-lg items-center justify-center ${
              !isRead ? config.bgUnread : "bg-slate-100"
            }`}
          >
            <Icon size={16} color={!isRead ? config.color : "#94a3b8"} />
          </View>

          {/* 텍스트 영역 */}
          <View className="flex-1 min-w-0 pt-0.5">
            <Text
              className={`text-sm leading-snug ${
                isRead ? "text-slate-500" : "text-slate-900 font-semibold"
              }`}
              numberOfLines={2}
            >
              {buildNotificationText(item)}
            </Text>
            <View className="flex-row items-center gap-2 mt-1.5">
              <Text
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                  !isRead
                    ? `${config.bgUnread}`
                    : "bg-slate-100 text-slate-400"
                }`}
                style={!isRead ? { color: config.color } : undefined}
              >
                {config.label}
              </Text>
              <Text className="text-[11px] text-slate-400">
                {formatNotificationTime(item.createdAt)}
              </Text>
            </View>
          </View>

          {/* 미독 점 */}
          {!isRead && (
            <View className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
          )}
        </Pressable>
      );
    },
    [handlePress],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={spinnerColor} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={spinnerColor}
          />
        }
        contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-3">
              <CheckCircle2 size={24} color={iconColor.muted} />
            </View>
            <Text className="text-sm font-semibold text-slate-700 mb-1">
              새 알림이 없습니다
            </Text>
            <Text className="text-xs text-slate-400 text-center leading-5">
              결재 요청·승인·반려, 재고 부족, 견적 도착 시{"\n"}
              여기에서 확인하실 수 있습니다.
            </Text>
          </View>
        }
      />
    </View>
  );
}
