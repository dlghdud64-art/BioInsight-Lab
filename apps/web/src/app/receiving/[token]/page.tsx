"use client";

// §11.348-A-2 — 공급사 입고 회신 폼. 발주(PO) snapshot 기준으로 품목별
// LOT·실수량·유효기간 입력 → 제출 시 "검증 대기 입고안"(PENDING_REVIEW).
// 입고 확정/재고 반영은 연구소 사람 승인(A-4) 후에만. 이 폼은 재고 미변경.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReceivingItem {
  orderItemId: string;
  productId: string | null;
  name: string;
  expectedQuantity: number;
  existingResponse?: {
    receivedQuantity?: number | null;
    lotNumber?: string | null;
    expiryDate?: string | null;
    vendorNote?: string | null;
  } | null;
}
interface ReceivingData {
  draft: { id: string; status: string; expiresAt: string; submittedAt?: string | null; vendorNote?: string | null };
  order: { orderNumber: string | null };
  items: ReceivingItem[];
}

export default function ReceivingReplyPage() {
  const params = useParams();
  const { toast } = useToast();
  const token = params.token as string;

  const [data, setData] = useState<ReceivingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [vendorNote, setVendorNote] = useState("");
  const [responses, setResponses] = useState<Record<string, { receivedQuantity?: string; lotNumber?: string; expiryDate?: string; vendorNote?: string }>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/receiving/${token}`);
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error || "Failed to load request");
        }
        const result: ReceivingData = await res.json();
        setData(result);
        setVendorNote(result.draft.vendorNote || "");
        const init: Record<string, any> = {};
        for (const it of result.items) {
          init[it.orderItemId] = {
            receivedQuantity: it.existingResponse?.receivedQuantity != null ? String(it.existingResponse.receivedQuantity) : String(it.expectedQuantity ?? ""),
            lotNumber: it.existingResponse?.lotNumber || "",
            expiryDate: it.existingResponse?.expiryDate ? String(it.existingResponse.expiryDate).split("T")[0] : "",
            vendorNote: it.existingResponse?.vendorNote || "",
          };
        }
        setResponses(init);
      } catch (e: any) {
        setError(e.message || "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchData();
  }, [token]);

  const setField = (id: string, field: string, value: string) =>
    setResponses((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const handleSubmit = async () => {
    if (!data) return;
    setSubmitting(true);
    try {
      const items = data.items.map((it) => {
        const r = responses[it.orderItemId] || {};
        return {
          orderItemId: it.orderItemId,
          receivedQuantity: r.receivedQuantity ? Number(r.receivedQuantity) : undefined,
          lotNumber: r.lotNumber || undefined,
          expiryDate: r.expiryDate || undefined,
          vendorNote: r.vendorNote || undefined,
        };
      });
      const res = await fetch(`/api/receiving/${token}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, vendorNote: vendorNote || undefined }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "제출에 실패했습니다.");
      }
      setSubmitted(true);
      toast({ title: "접수 완료", description: "입고 정보가 접수되었습니다. 연구소 검토 후 확정됩니다." });
    } catch (e: any) {
      toast({ title: "제출 실패", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>요청을 열 수 없습니다</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">입고 정보 접수 완료</h2>
            <p className="text-sm text-slate-500">연구소 검토 후 입고가 확정됩니다. 감사합니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <PackageCheck className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">입고 정보 회신</h1>
            <p className="text-sm text-slate-500">발주번호: {data?.order.orderNumber ?? "-"}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">품목별 입고 정보</CardTitle>
            <p className="text-xs text-slate-500">납품하신 품목의 실수량·LOT 번호·유효기간을 입력해 주세요.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>품목</TableHead>
                  <TableHead className="text-right">발주수량</TableHead>
                  <TableHead>실수량</TableHead>
                  <TableHead>LOT 번호</TableHead>
                  <TableHead>유효기간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((it) => {
                  const r = responses[it.orderItemId] || {};
                  return (
                    <TableRow key={it.orderItemId}>
                      <TableCell className="font-medium">{it.name}</TableCell>
                      <TableCell className="text-right text-slate-500">{it.expectedQuantity}</TableCell>
                      <TableCell>
                        <Input type="number" min="0" className="h-9 w-24" value={r.receivedQuantity ?? ""}
                          onChange={(e) => setField(it.orderItemId, "receivedQuantity", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 w-32" placeholder="LOT" value={r.lotNumber ?? ""}
                          onChange={(e) => setField(it.orderItemId, "lotNumber", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="date" className="h-9 w-40" value={r.expiryDate ?? ""}
                          onChange={(e) => setField(it.orderItemId, "expiryDate", e.target.value)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <label className="text-sm font-medium text-slate-700">회신 메모 (선택)</label>
            <Textarea rows={3} placeholder="납기 지연, 분할 납품 등 특이사항" value={vendorNote}
              onChange={(e) => setVendorNote(e.target.value)} />
            <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "입고 정보 제출"}
            </Button>
            <p className="text-xs text-slate-400 text-center">제출 후에도 연구소 검토 전까지 수정할 수 있습니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
