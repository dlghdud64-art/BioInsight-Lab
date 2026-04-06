"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Package, Search, AlertTriangle, Calendar, MapPin, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface InventoryItem {
  id: string;
  productId: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  location: string | null;
  expiryDate: string | null;
  lotNumber?: string | null;
  product: {
    id: string;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
  };
}

function getStatus(inv: InventoryItem): { label: string; cls: string } {
  if (inv.currentQuantity === 0) return { label: "품절", cls: "bg-red-500/10 text-red-400 border-red-500/20" };
  if (inv.safetyStock != null && inv.currentQuantity <= inv.safetyStock)
    return { label: "부족", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  if (inv.expiryDate) {
    const days = Math.ceil((new Date(inv.expiryDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return { label: "만료", cls: "bg-red-500/10 text-red-400 border-red-500/20" };
    if (days <= 30) return { label: "임박", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  }
  return { label: "정상", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
}

export function InventoryTableBlock() {
  const { status: authStatus } = useSession();
  const [search, setSearch] = useState("");

  const { data: inventories = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-table"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) return [];
      const json = await res.json();
      return json.inventories ?? json ?? [];
    },
    enabled: authStatus === "authenticated",
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  const filtered = inventories.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.product.name.toLowerCase().includes(q) ||
      (inv.product.brand?.toLowerCase().includes(q)) ||
      (inv.product.catalogNumber?.toLowerCase().includes(q)) ||
      (inv.lotNumber?.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return <div className="h-64 rounded-xl bg-el animate-pulse" />;
  }

  return (
    <div className="rounded-xl border border-bd bg-pn overflow-hidden">
      {/* Search */}
      <div className="p-3 border-b border-bd">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="품목명, 제조사, CAS No. 또는 카탈로그 번호"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-el border-bd text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          <Package className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">
            {search ? "검색 결과가 없습니다" : "등록된 품목이 없습니다"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {search ? "다른 키워드로 검색해보세요" : "재고 등록을 시작하세요"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bd bg-el/50">
                <th className="text-left py-2.5 px-3 font-medium text-slate-400 text-xs">품목명</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-400 text-xs">수량</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-400 text-xs hidden md:table-cell">위치</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-400 text-xs hidden md:table-cell">Lot</th>
                <th className="text-left py-2.5 px-3 font-medium text-slate-400 text-xs hidden lg:table-cell">유효기간</th>
                <th className="text-center py-2.5 px-3 font-medium text-slate-400 text-xs">상태</th>
                <th className="text-right py-2.5 px-3 font-medium text-slate-400 text-xs"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bd">
              {filtered.map((inv) => {
                const st = getStatus(inv);
                return (
                  <tr key={inv.id} className="hover:bg-el/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-700 text-sm truncate max-w-[200px]">{inv.product.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {inv.product.brand}{inv.product.catalogNumber ? ` · ${inv.product.catalogNumber}` : ""}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm font-medium text-slate-700">
                      {inv.currentQuantity} <span className="text-slate-500 text-xs">{inv.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      {inv.location ? (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{inv.location}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">미지정</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell">
                      <span className="text-xs text-slate-400">{inv.lotNumber || "—"}</span>
                    </td>
                    <td className="py-2.5 px-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-400">
                        {inv.expiryDate ? new Date(inv.expiryDate).toLocaleDateString("ko-KR") : "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${st.cls}`}>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <ChevronRight className="h-4 w-4 text-slate-600 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
