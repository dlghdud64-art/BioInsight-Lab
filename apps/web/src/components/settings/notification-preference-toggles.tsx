"use client";

/**
 * §11.250-pref-ui #notification-preference-toggles — role-aware preference UI.
 *
 * 호영님 spec: §11.250-pref backend filter 위에 사용자가 직접 토글하는 UI.
 *   7 카테고리 (stock_alert / quote_arrived / approval_pending / expiry_warning /
 *   safety_alert / delivery_complete / system) 별 on/off Switch.
 *
 * canonical truth lock:
 *   - User.preferences.notificationToggles Json field reuse (10 nested key 정합).
 *   - 7 카테고리 매핑 (event-category-map.ts) 정합.
 *   - default true 보존 (preference 미설정 사용자 영향 0).
 *   - filter backend (§11.250-pref) 와 1:1 정합.
 *
 * UX:
 *   - useUserPreferences hook → updateNotificationToggles (debounce 400ms).
 *   - undefined / null → 기본값 true (toggle ON 표시).
 *   - 명시 false 만 server 도달 + dispatch filter 에서 recipient skip.
 */

import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "@/lib/preferences/user-preferences";

type CategoryKey =
  | "stock_alert"
  | "quote_arrived"
  | "approval_pending"
  | "expiry_warning"
  | "safety_alert"
  | "delivery_complete"
  | "system";

interface CategoryDescriptor {
  key: CategoryKey;
  label: string;
  description: string;
}

// §11.250-pref-ui — 7 카테고리 한국어 라벨 (event-category-map.ts 매핑 정합).
const CATEGORIES: CategoryDescriptor[] = [
  {
    key: "stock_alert",
    label: "재고 부족 알림",
    description: "안전 재고 수량 이하로 떨어진 품목 알림",
  },
  {
    key: "quote_arrived",
    label: "견적 수신 알림",
    description: "공급사 견적 회신 도착 알림",
  },
  {
    key: "approval_pending",
    label: "승인 대기 알림",
    description: "구매 요청 / 견적 / 발주 승인 대기 알림",
  },
  {
    key: "expiry_warning",
    label: "유효기간 임박 알림",
    description: "재고 유효기간 / 견적 만료 임박 알림",
  },
  {
    key: "safety_alert",
    label: "안전 알림",
    description: "MSDS 미등록 등 안전 관련 알림 (항상 권장)",
  },
  {
    key: "delivery_complete",
    label: "배송 / 입고 완료 알림",
    description: "주문 배송 완료 및 입고 처리 알림",
  },
  {
    key: "system",
    label: "시스템 알림",
    description: "예산 경고 / PDF 분석 실패 등 시스템 알림",
  },
];

export function NotificationPreferenceToggles() {
  const { preferences, updateNotificationToggles, isLoading } =
    useUserPreferences();

  // §11.250-pref-ui — preferences.notificationToggles 안 nested key 추출.
  //   undefined / null → 기본 true (filter backend 정합).
  const toggles = useMemo(() => {
    return preferences?.notificationToggles ?? {};
  }, [preferences?.notificationToggles]);

  const isChecked = (key: CategoryKey): boolean => {
    const value = toggles[key];
    // §11.250-pref default true — 명시 false 만 OFF 표시.
    return value !== false;
  };

  const handleToggle = (key: CategoryKey, next: boolean) => {
    // updateNotificationToggles 는 debounce 400ms 안 server PATCH.
    updateNotificationToggles({ [key]: next });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900">
          알림 카테고리 (서버 동기화)
        </h3>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          카테고리별 알림 수신 여부를 설정합니다. 기본값은 모두 ON 이며,
          변경 사항은 자동 저장되어 모든 기기에 즉시 반영됩니다.
          OFF 로 변경 시 해당 카테고리의 인앱 / 푸시 알림이 도착하지 않습니다.
        </p>
      </div>
      <div className="space-y-1">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-sm font-medium text-slate-800">
                {cat.label}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {cat.description}
              </p>
            </div>
            <Switch
              checked={isChecked(cat.key)}
              onCheckedChange={(next: boolean) =>
                handleToggle(cat.key, next)
              }
              disabled={isLoading}
              aria-label={`${cat.label} 알림 수신 토글`}
              className="scale-90"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
