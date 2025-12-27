"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VendorRequestData {
  vendorRequest: {
    id: string;
    vendorName?: string;
    message?: string;
    status: string;
    expiresAt: string;
    respondedAt?: string;
  };
  quote: {
    id: string;
    title: string;
    currency: string;
  };
  items: Array<{
    id: string;
    lineNumber?: number;
    name?: string;
    brand?: string;
    catalogNumber?: string;
    unit?: string;
    quantity: number;
    existingResponse?: {
      unitPrice?: number;
      leadTimeDays?: number;
      moq?: number;
      vendorSku?: string;
      notes?: string;
    } | null;
  }>;
}

export default function VendorResponsePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = params.token as string;

  const [data, setData] = useState<VendorRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [vendorName, setVendorName] = useState("");
  const [responses, setResponses] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/vendor-requests/${token}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to load request");
        }

        const result = await response.json();
        setData(result);
        setVendorName(result.vendorRequest.vendorName || "");

        // Initialize responses with existing data
        const initialResponses: Record<string, any> = {};
        result.items.forEach((item: any) => {
          if (item.existingResponse) {
            initialResponses[item.id] = item.existingResponse;
          }
        });
        setResponses(initialResponses);

        // Check if already responded
        if (result.vendorRequest.status === "RESPONDED") {
          setSubmitted(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load request");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  const handleSubmit = async () => {
    // Validate at least one item has a response
    const hasAnyResponse = Object.keys(responses).length > 0;
    if (!hasAnyResponse) {
      toast({
        title: "입력 필요",
        description: "최소 1개 품목에 대한 견적을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const items = Object.entries(responses)
        .filter(([_, response]) => response && (response.unitPrice || response.leadTimeDays || response.notes))
        .map(([quoteItemId, response]) => ({
          quoteItemId,
          unitPrice: response.unitPrice ? parseInt(response.unitPrice) : undefined,
          currency: data?.quote.currency || "KRW",
          leadTimeDays: response.leadTimeDays ? parseInt(response.leadTimeDays) : undefined,
          moq: response.moq ? parseInt(response.moq) : undefined,
          vendorSku: response.vendorSku || undefined,
          notes: response.notes || undefined,
        }));

      if (items.length === 0) {
        toast({
          title: "입력 필요",
          description: "최소 1개 품목에 대한 단가, 납기 또는 비고를 입력해주세요.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const response = await fetch(`/api/vendor-requests/${token}/response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
          vendorName: vendorName || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit response");
      }

      const result = await response.json();

      setSubmitted(true);
      toast({
        title: "제출 완료",
        description: result.message || "견적 회신이 성공적으로 제출되었습니다.",
      });
    } catch (err) {
      toast({
        title: "제출 실패",
        description: err instanceof Error ? err.message : "견적 회신 제출에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateResponse = (itemId: string, field: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">견적 요청서를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-12 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>
            {error || "견적 요청서를 찾을 수 없습니다. 링크가 만료되었거나 유효하지 않을 수 있습니다."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (submitted || data.vendorRequest.status === "RESPONDED") {
    return (
      <div className="container mx-auto py-12 max-w-4xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <CardTitle className="text-2xl">견적 회신 제출 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>제출 완료</AlertTitle>
              <AlertDescription>
                견적 회신이 성공적으로 제출되었습니다.
                {data.vendorRequest.respondedAt && (
                  <> 제출 시간: {new Date(data.vendorRequest.respondedAt).toLocaleString("ko-KR")}</>
                )}
                <br />
                <strong>참고:</strong> 제출 후에는 수정이 불가능합니다.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(data.vendorRequest.expiresAt);
  const isExpired = expiresAt < new Date();

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">견적 회신 제출</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">견적 제목</p>
              <p className="font-medium">{data.quote.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">회신 마감</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {expiresAt.toLocaleString("ko-KR")}
                {isExpired && <span className="text-red-600 text-sm">(만료됨)</span>}
              </p>
            </div>
          </div>

          {data.vendorRequest.message && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">요청 메시지</p>
              <div className="bg-muted p-3 rounded-md whitespace-pre-wrap">
                {data.vendorRequest.message}
              </div>
            </div>
          )}

          {isExpired && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>만료됨</AlertTitle>
              <AlertDescription>
                이 견적 요청은 만료되어 회신을 제출할 수 없습니다.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Vendor Name */}
      {!isExpired && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">벤더 정보 (선택)</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="회사명 또는 벤더명"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>
      )}

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>품목별 견적 ({data.items.length}개)</CardTitle>
          <p className="text-sm text-muted-foreground">
            단가, 납기, MOQ 등을 입력해주세요. 빈 칸은 제출 시 제외됩니다.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">No.</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead>브랜드</TableHead>
                  <TableHead>Cat No.</TableHead>
                  <TableHead className="text-right">요청 수량</TableHead>
                  <TableHead className="w-[120px]">단가 ({data.quote.currency})</TableHead>
                  <TableHead className="w-[100px]">납기(일)</TableHead>
                  <TableHead className="w-[100px]">MOQ</TableHead>
                  <TableHead className="w-[120px]">벤더 SKU</TableHead>
                  <TableHead className="w-[200px]">비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.lineNumber || "-"}</TableCell>
                    <TableCell className="font-medium">{item.name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.brand || "-"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {item.catalogNumber || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity} {item.unit || "ea"}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="단가"
                        value={responses[item.id]?.unitPrice || ""}
                        onChange={(e) => updateResponse(item.id, "unitPrice", e.target.value)}
                        disabled={isExpired}
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="납기"
                        value={responses[item.id]?.leadTimeDays || ""}
                        onChange={(e) => updateResponse(item.id, "leadTimeDays", e.target.value)}
                        disabled={isExpired}
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="MOQ"
                        value={responses[item.id]?.moq || ""}
                        onChange={(e) => updateResponse(item.id, "moq", e.target.value)}
                        disabled={isExpired}
                        min="1"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="SKU"
                        value={responses[item.id]?.vendorSku || ""}
                        onChange={(e) => updateResponse(item.id, "vendorSku", e.target.value)}
                        disabled={isExpired}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        placeholder="비고"
                        value={responses[item.id]?.notes || ""}
                        onChange={(e) => updateResponse(item.id, "notes", e.target.value)}
                        disabled={isExpired}
                        rows={1}
                        className="min-h-[38px]"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!isExpired && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="min-w-[200px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  "견적 회신 제출"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>견적 회신은 로그인 없이 진행 가능합니다.</p>
        <p className="mt-1">
          <strong>중요:</strong> 제출 후에는 수정이 불가능하니 신중히 입력해주세요.
        </p>
      </div>
    </div>
  );
}
