"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Package, AlertTriangle, Calendar, TrendingDown } from "lucide-react";
import Link from "next/link";

interface InventoryItem {
  id: string;
  currentQuantity: number;
  safetyStock: number | null;
  expiryDate: string | null;
  updatedAt?: string;
}

export function InventorySummaryBlock() {
  const { data: session, status } = useSession();

  const { data: inventories = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-summary"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) return [];
      const json = await res.json();
      return json.inventories ?? json ?? [];
    },
    enabled: status === "authenticated",
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  // KPI 계산 — render scope 내부
  const total = inventories.length;
  const lowStock = inventories.filter(
    (inv) => inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock
  ).length;

  const now = new Date();
  const expiringSoon = inventories.filter((inv) => {
    if (!inv.expiryDate) return false;
    const d = new Date(inv.expiryDate);
    const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 30;
  }).length;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentUpdated = inventories.filter((inv) => {
    if (!inv.updatedAt) return false;
    return new Date(inv.updatedAt) >= sevenDaysAgo;
  }).length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-el animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "전체 품목",
      value: total,
      icon: Package,
      color: "text-blue-400",
      desc: total === 0 ? "품목을 등록하세요" : `${total}개 품목 관리 중`,
      href: "/dashboard/inventory",
    },
    {
      label: "부족 위험",
      value: lowStock,
      icon: AlertTriangle,
      color: lowStock > 0 ? "text-red-400" : "text-slate-400",
      desc: lowStock === 0 ? "현재 부족 리스크 없음" : `${lowStock}건 재주문 검토 필요`,
      href: "/dashboard/inventory?filter=low",
    },
    {
      label: "만료 임박",
      value: expiringSoon,
      icon: Calendar,
      color: expiringSoon > 0 ? "text-amber-400" : "text-slate-400",
      desc: expiringSoon === 0 ? "30일 내 만료 없음" : `${expiringSoon}건 유효기간 확인`,
      href: "/dashboard/inventory?filter=expiring",
    },
    {
      label: "최근 변동",
      value: recentUpdated,
      icon: TrendingDown,
      color: "text-teal-400",
      desc: recentUpdated === 0 ? "최근 7일 변동 없음" : `${recentUpdated}건 최근 업데이트`,
      href: "/dashboard/inventory",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-bd bg-pn p-4 hover:bg-el transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs font-medium text-slate-400">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-[11px] text-slate-500 mt-1">{card.desc}</p>
          </Link>
        );
      })}
    </div>
  );
}
