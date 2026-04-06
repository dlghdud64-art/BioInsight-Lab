"use client";

export const dynamic = "force-dynamic";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Package,
  Clock,
  FileText,
  ShieldCheck,
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
} from "lucide-react";

/* ── 카테고리 정의 ── */

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

/* ── 카테고리별 tint ── */
const CATEGORY_TINT: Record<Exclude<Category, "all">, { read: string; unread: string }> = {
  inventory: { read: "text-slate-500", unread: "text-teal-400" },
  quote:     { read: "text-slate-500", unread: "text-blue-400" },
  org:       { read: "text-slate-500", unread: "text-violet-400" },
  safety:    { read: "text-slate-500", unread: "text-amber-400" },
  billing:   { read: "text-slate-500", unread: "text-blue-400" },
  system:    { read: "text-slate-500", unread: "text-slate-600" },
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

export default function NotificationsPage() {
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
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)),
    );
  };

  return (
    <div className="min-h-full bg-pg p-6 md:p-8 space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">알림</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-slate-400 hover:text-slate-700 hover:bg-el"
          disabled={unreadCount === 0}
          onClick={markAllRead}
        >
          <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
          모두 읽음
        </Button>
      </div>

      {/* ── 필터 바 ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeCategory === cat.value
                ? "bg-blue-600 text-white"
                : "bg-el text-slate-400 hover:text-slate-700"
            }`}
          >
            {cat.label}
            {cat.value === "all" && unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] opacity-80">{unreadCount}</span>
            )}
          </button>
        ))}
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

                {/* 아이콘 — bare, 배경 타일 없음 */}
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${n.read ? CATEGORY_TINT[n.category].read : CATEGORY_TINT[n.category].unread}`} />

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${n.read ? "text-slate-400" : "text-slate-700"}`}>
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
