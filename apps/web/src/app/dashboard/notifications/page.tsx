"use client";

export const dynamic = "force-dynamic";

/**
 * 알림 센터 — §notifications-single-source (2026-09-22 · 호영님 P0)
 *
 * 🛑 이 화면은 코드에 박힌 **가짜 알림 20건**을 띄우고 있었다(INITIAL_NOTIFICATIONS · 「Mock 데이터 (20건)」).
 *    재고 부족·만료 임박·승인 대기 같은 **행동 지시형** 알림에 수치를 대고 재주문·승인을 하라고 했고,
 *    실존하지 않는 사람의 권한 승격, 있지도 않은 구독 결제 완료까지 띄웠다. 상대 시각이라 새로고침할 때마다
 *    방금 온 것처럼 보였다. 헤더 종은 그동안 0 이었다 — 같은 개념의 출처가 둘이었다.
 *    「모두 읽음」·항목 클릭도 로컬 상태만 바꿨다(저장 0 · placeholder success).
 *
 * 지금: 헤더 종과 **같은 함수**(`useInAppNotifications`)로 읽는다. 알림이 없으면 「새 알림 없음」 한 줄.
 *   알림은 없는 게 정상이라 「왜 · 어디서」 설명을 붙이지 않는다(호영님).
 * ⚠️ `/api/notifications` 는 2026-09-22 현재 라우트가 없다(404) — 헤더 종과 같은 이유로 0건이다.
 *    404 처리는 별건이다(이 변경과 분리 · 호영님 지시).
 * 계약: __tests__/regression/notifications-single-source.test.ts
 */
import Link from "next/link";
import { useInAppNotifications } from "@/lib/notifications/use-in-app-notifications";
import {
  buildNotificationText,
  buildNotificationHref,
  formatNotificationTime,
} from "@/lib/notifications/event-category-map";

export default function NotificationsPage() {
  const { data } = useInAppNotifications();
  const notifications = data?.notifications ?? [];

  return (
    <div className="min-h-full bg-el p-6 md:p-8 space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">알림</h1>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">새 알림 없음</p>
        </div>
      ) : (
        <div className="rounded-lg bg-pn border border-bd divide-y divide-bd">
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={buildNotificationHref(n)}
              className="w-full flex items-start gap-3 px-4 py-3 min-h-[44px] text-left hover:bg-el transition-colors"
            >
              <span className="mt-1.5 flex-shrink-0 w-2 h-2">
                {!n.readAt && <span className="block w-2 h-2 rounded-full bg-blue-500" />}
              </span>
              <p className={`flex-1 min-w-0 text-sm leading-snug ${n.readAt ? "text-slate-400" : "text-slate-700"}`}>
                {buildNotificationText(n)}
              </p>
              <span className="flex-shrink-0 text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                {formatNotificationTime(n.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
