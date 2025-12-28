"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuoteRequestItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  specification?: string;
  catalogNumber?: string;
}

interface QuoteResponseItem {
  itemId: string;
  unitPrice: string;
  leadTime: string;
  inStock: boolean;
  substituteProductName?: string;
  notes?: string;
}

interface QuoteFormProps {
  requestId: string;
  items: QuoteRequestItem[];
  onSubmit?: (responses: QuoteResponseItem[]) => Promise<void>;
  readOnly?: boolean;
  existingResponses?: QuoteResponseItem[];
}

export function QuoteForm({
  requestId,
  items,
  onSubmit,
  readOnly = false,
  existingResponses = [],
}: QuoteFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responses, setResponses] = useState<Record<string, Partial<QuoteResponseItem>>>(
    existingResponses.reduce((acc, res) => ({
      ...acc,
      [res.itemId]: res,
    }), {})
  );

  const updateResponse = (itemId: string, field: keyof QuoteResponseItem, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    const responseList = items.map((item) => responses[item.id]);
    const hasEmptyPrice = responseList.some((res) => !res?.unitPrice);

    if (hasEmptyPrice) {
      toast({
        title: "필수 항목 누락",
        description: "모든 품목의 단가를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const validResponses: QuoteResponseItem[] = responseList
        .filter((res): res is QuoteResponseItem => 
          !!res && !!res.unitPrice && !!res.leadTime
        )
        .map((res) => ({
          ...res,
          inStock: res.inStock || false,
        }));

      if (onSubmit) {
        await onSubmit(validResponses);
      } else {
        // Default API call
        const response = await fetch(`/api/vendor/requests/${requestId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: validResponses }),
        });

        if (!response.ok) throw new Error("Failed to submit quote");

        toast({
          title: "견적 전송 완료",
          description: "견적이 성공적으로 전송되었습니다.",
        });
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "전송 실패",
        description: "견적 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">견적 입력</h2>
          <p className="text-sm text-slate-600 mt-1">
            각 품목의 단가와 납기를 입력해주세요
          </p>
        </div>
        {readOnly && (
          <Badge variant="outline">제출 완료</Badge>
        )}
      </div>

      {/* Warning for missing prices */}
      {!readOnly && items.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>단가(Unit Price)</strong>는 필수 입력 항목입니다.
            공급 불가능한 품목은 대체품을 제안하거나 비고란에 사유를 입력해주세요.
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-3 w-[25%]">품목 정보</TableHead>
              <TableHead className="p-3 w-[15%]">단가 (₩)</TableHead>
              <TableHead className="p-3 w-[12%]">납기</TableHead>
              <TableHead className="p-3 w-[10%]">재고</TableHead>
              <TableHead className="p-3 w-[18%]">대체품</TableHead>
              <TableHead className="p-3 w-[20%]">비고</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const response = responses[item.id] || {};
              
              return (
                <TableRow key={item.id} className="hover:bg-slate-50">
                  <TableCell className="p-3">
                    <div className="font-medium text-sm">{item.productName}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      수량: {item.quantity} {item.unit}
                    </div>
                    {item.catalogNumber && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        Cat. No: {item.catalogNumber}
                      </div>
                    )}
                    {item.specification && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        스펙: {item.specification}
                      </div>
                    )}
                  </TableCell>
                  
                  {/* Unit Price */}
                  <TableCell className="p-3">
                    <Input
                      type="number"
                      placeholder="10000"
                      value={response.unitPrice || ""}
                      onChange={(e) => updateResponse(item.id, "unitPrice", e.target.value)}
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </TableCell>

                  {/* Lead Time */}
                  <TableCell className="p-3">
                    <Input
                      placeholder="3일"
                      value={response.leadTime || ""}
                      onChange={(e) => updateResponse(item.id, "leadTime", e.target.value)}
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </TableCell>

                  {/* In Stock */}
                  <TableCell className="p-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`stock-${item.id}`}
                        checked={response.inStock || false}
                        onCheckedChange={(checked) =>
                          updateResponse(item.id, "inStock", !!checked)
                        }
                        disabled={readOnly}
                      />
                      <Label
                        htmlFor={`stock-${item.id}`}
                        className="text-xs cursor-pointer"
                      >
                        보유
                      </Label>
                    </div>
                  </TableCell>

                  {/* Substitute */}
                  <TableCell className="p-3">
                    <Input
                      placeholder="대체품명"
                      value={response.substituteProductName || ""}
                      onChange={(e) =>
                        updateResponse(item.id, "substituteProductName", e.target.value)
                      }
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </TableCell>

                  {/* Notes */}
                  <TableCell className="p-3">
                    <Input
                      placeholder="특이사항"
                      value={response.notes || ""}
                      onChange={(e) => updateResponse(item.id, "notes", e.target.value)}
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Submit Button */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" disabled={isSubmitting}>
            임시 저장
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                전송 중...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Quote
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

