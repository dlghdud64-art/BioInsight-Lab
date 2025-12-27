"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGuestKey } from "@/lib/guest-key";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PurchasesGuestPage() {
  const [guestKey, setGuestKey] = useState<string>("");
  const [jsonInput, setJsonInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setGuestKey(getGuestKey());
  }, []);

  const now = new Date();
  const fromDate = startOfMonth(now);
  const toDate = endOfMonth(now);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["purchase-summary", guestKey, fromDate, toDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/purchases/summary?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`,
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

  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ["purchases", guestKey, fromDate, toDate],
    queryFn: async () => {
      const response = await fetch(
        `/api/purchases?from=${fromDate.toISOString()}&to=${toDate.toISOString()}&limit=20`,
        {
          headers: {
            "x-guest-key": guestKey,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch purchases");
      return response.json();
    },
    enabled: !!guestKey,
  });

  const importMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const response = await fetch("/api/purchases/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-key": guestKey,
        },
        body: JSON.stringify({ rows }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `${data.successRows} rows imported. ${data.errorRows} errors.`,
      });
      setJsonInput("");
      queryClient.invalidateQueries({ queryKey: ["purchase-summary"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    try {
      const rows = JSON.parse(jsonInput);
      if (!Array.isArray(rows)) {
        throw new Error("Input must be a JSON array");
      }
      importMutation.mutate(rows);
    } catch (error: any) {
      toast({
        title: "Invalid JSON",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return `₩${amount.toLocaleString()}`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">구매 내역 관리</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryLoading ? "..." : formatCurrency(summary?.totalAmount || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 벤더</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {summaryLoading ? "..." : summary?.topVendors?.[0]?.vendorName || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.topVendors?.[0]
                ? formatCurrency(summary.topVendors[0].amount)
                : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 카테고리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {summaryLoading ? "..." : summary?.topCategories?.[0]?.category || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.topCategories?.[0]
                ? formatCurrency(summary.topCategories[0].amount)
                : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>구매 내역 추가</CardTitle>
          <CardDescription>
            JSON 배열 형식으로 구매 내역을 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>JSON 데이터</Label>
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder={`[
  {
    "purchasedAt": "2025-01-15",
    "vendorName": "Sigma-Aldrich",
    "category": "REAGENT",
    "itemName": "Reagent A",
    "qty": 10,
    "unitPrice": 50000,
    "amount": 500000,
    "currency": "KRW"
  }
]`}
            />
          </div>
          <Button
            onClick={handleImport}
            disabled={!jsonInput.trim() || importMutation.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importMutation.isPending ? "Importing..." : "Import"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>최근 구매 내역</CardTitle>
          <CardDescription>이번 달 구매 내역 (최대 20개)</CardDescription>
        </CardHeader>
        <CardContent>
          {purchasesLoading ? (
            <p>로딩 중...</p>
          ) : purchases?.items?.length === 0 ? (
            <p className="text-muted-foreground">구매 내역이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>벤더</TableHead>
                  <TableHead>품목</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases?.items?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.purchasedAt), "yyyy-MM-dd")}</TableCell>
                    <TableCell>{item.vendorName}</TableCell>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell className="text-right">
                      {item.qty} {item.unit || ""}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
