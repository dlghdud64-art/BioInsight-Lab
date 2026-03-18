"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, Plus, Search } from "lucide-react";
import Link from "next/link";
// bisect step 2: radix heavy imports
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function InventoryContent() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: inventories, isLoading } = useQuery({
    queryKey: ["inventory-list"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) return [];
      const data = await res.json();
      return data.inventories ?? data ?? [];
    },
    enabled: !!session,
  });

  const items = Array.isArray(inventories) ? inventories : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">재고 관리</h1>
          <p className="text-sm text-slate-400">
            {items.length > 0 ? `${items.length}개 품목 등록됨` : "품목을 등록하면 재고 현황이 표시됩니다."}
          </p>
        </div>
        <Link href="/dashboard/inventory">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            재고 등록
          </Button>
        </Link>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-pn border-bd">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] text-slate-400 uppercase">전체 품목</span>
            </div>
            <p className="text-xl font-bold text-slate-200">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-pn border-bd">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="text-[10px] text-slate-400 uppercase">부족 알림</span>
            </div>
            <p className="text-xl font-bold text-slate-200">
              {items.filter((i: any) => i.safetyStock && i.currentQuantity < i.safetyStock).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-pn border-bd">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Search className="h-3 w-3 text-teal-400" />
              <span className="text-[10px] text-slate-400 uppercase">검색</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="품목 검색..."
              className="w-full bg-el border border-bd rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500"
            />
          </CardContent>
        </Card>
        <Card className="bg-pn border-bd">
          <CardContent className="p-3 flex items-center justify-center">
            <Link href="/dashboard/inventory/scan">
              <Button variant="outline" size="sm" className="text-xs border-bd">
                QR 스캔
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Item List (simple) */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-el rounded-lg animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-pn border-bd border-dashed">
          <CardContent className="p-8 text-center">
            <Package className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-200">등록된 품목이 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">품목을 등록하면 재고 현황, 부족 알림이 활성화됩니다</p>
            <Link href="/dashboard/inventory">
              <Button size="sm" className="mt-3 gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                첫 품목 등록
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-pn border-bd overflow-hidden">
          <div className="divide-y divide-bd">
            {items
              .filter((item: any) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  item.product?.name?.toLowerCase().includes(q) ||
                  item.product?.brand?.toLowerCase().includes(q) ||
                  item.product?.catalogNumber?.toLowerCase().includes(q)
                );
              })
              .slice(0, 20)
              .map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-el transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {item.product?.name || "품목명 없음"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.product?.brand || ""} {item.product?.catalogNumber ? `· ${item.product.catalogNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-200">
                      {item.currentQuantity} {item.unit}
                    </p>
                    {item.safetyStock && item.currentQuantity < item.safetyStock && (
                      <Badge variant="destructive" className="text-[10px]">부족</Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Bisect marker */}
      <p className="text-[10px] text-slate-600 text-center">bisect step 2: + Tabs/Table/Dialog/Select/DropdownMenu/Sheet (radix imports only, not rendered)</p>
    </div>
  );
}
