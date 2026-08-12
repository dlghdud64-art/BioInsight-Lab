"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Store } from "lucide-react";
import { getGuestKey } from "@/lib/guest-key";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";

export default function DashboardGuestPage() {
  const [guestKey, setGuestKey] = useState<string>("");

  useEffect(() => {
    setGuestKey(getGuestKey());
  }, []);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const last30DaysStart = subDays(now, 30);

  const { data: thisMonthSummary, isLoading: loadingThisMonth } = useQuery({
    queryKey: ["purchase-summary", "thisMonth", guestKey],
    queryFn: async () => {
      const response = await fetch(
        `/api/purchases/summary?from=${thisMonthStart.toISOString()}&to=${thisMonthEnd.toISOString()}`,
        {
          headers: {
            "x-guest-key": guestKey,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
    enabled: !!guestKey,
  });

  const { data: last30DaysSummary, isLoading: loadingLast30Days } = useQuery({
    queryKey: ["purchase-summary", "last30Days", guestKey],
    queryFn: async () => {
      const response = await fetch(
        `/api/purchases/summary?from=${last30DaysStart.toISOString()}&to=${now.toISOString()}`,
        {
          headers: {
            "x-guest-key": guestKey,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch summary");
      return response.json();
    },
    enabled: !!guestKey,
  });

  const formatCurrency = (amount: number) => {
    return `₩${amount.toLocaleString()}`;
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">구매 대시보드</h1>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번달 지출</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingThisMonth ? "..." : formatCurrency(thisMonthSummary?.totalAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(thisMonthStart, "yyyy-MM")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">최근 30일 지출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingLast30Days ? "..." : formatCurrency(last30DaysSummary?.totalAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(last30DaysStart, "MM/dd")} ~ {format(now, "MM/dd")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top 벤더</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingThisMonth
                ? "..."
                : thisMonthSummary?.topVendors?.[0]?.vendorName || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {thisMonthSummary?.topVendors?.[0]
                ? formatCurrency(thisMonthSummary.topVendors[0].amount)
                : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground mt-8">
        Guest Key: {guestKey}
      </div>
    </div>
  );
}
