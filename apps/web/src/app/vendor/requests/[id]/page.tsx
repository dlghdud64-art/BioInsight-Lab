"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Upload, Loader2, FileText, X } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface RequestItem {
  id: string;
  productName: string;
  catalogNumber?: string;
  quantity: number;
  unitPrice?: number;
  leadTime?: string;
  moq?: number;
  notes?: string;
}

interface VendorRequestDetail {
  id: string;
  quoteTitle: string;
  status: string;
  expiresAt: Date;
  items: RequestItem[];
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
  }>;
  canEdit: boolean;
}

export default function VendorRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const requestId = params.id as string;

  const [itemResponses, setItemResponses] = useState<Record<string, Partial<RequestItem>>>({});
  const [uploading, setUploading] = useState(false);

  // Fetch request detail
  const { data: requestData, isLoading } = useQuery({
    queryKey: ["vendor-request", requestId],
    queryFn: async () => {
      const response = await fetch(`/api/vendor/requests/${requestId}`);
      if (!response.ok) throw new Error("Failed to fetch request");
      return response.json();
    },
  });

  const request: VendorRequestDetail | undefined = requestData?.request;

  // Submit response
  const submitMutation = useMutation({
    mutationFn: async (data: { items: Record<string, Partial<RequestItem>> }) => {
      const response = await fetch(`/api/vendor/requests/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to submit response");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "회신 완료",
        description: "견적 회신이 제출되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["vendor-request", requestId] });
    },
    onError: () => {
      toast({
        title: "오류",
        description: "회신 제출에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Upload attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/vendor/requests/${requestId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      toast({
        title: "업로드 완료",
        description: "파일이 업로드되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["vendor-request", requestId] });
    } catch (error) {
      toast({
        title: "오류",
        description: "파일 업로드에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate({ items: itemResponses });
  };

  const updateItemResponse = (itemId: string, field: keyof RequestItem, value: any) => {
    setItemResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">요청을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const isReadOnly = !request.canEdit;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/vendor">
                <ChevronLeft className="h-4 w-4 mr-1" />
                목록으로
              </Link>
            </Button>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{request.quoteTitle}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary">{request.status}</Badge>
                <span className="text-sm text-slate-600">
                  만료일: {format(new Date(request.expiresAt), "PPP", { locale: ko })}
                </span>
              </div>
            </div>
            {!isReadOnly && (
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending || Object.keys(itemResponses).length === 0}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    제출 중...
                  </>
                ) : (
                  "견적 회신 제출"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Items Table */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">품목 목록</h2>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-medium">제품명</TableHead>
                      <TableHead className="font-medium">Cat No.</TableHead>
                      <TableHead className="font-medium text-right">수량</TableHead>
                      <TableHead className="font-medium">단가</TableHead>
                      <TableHead className="font-medium">납기</TableHead>
                      <TableHead className="font-medium">MOQ</TableHead>
                      <TableHead className="font-medium">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {request.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="p-3 font-medium">
                          {item.productName}
                        </TableCell>
                        <TableCell className="p-3 text-sm">
                          {item.catalogNumber || "-"}
                        </TableCell>
                        <TableCell className="p-3 text-right text-sm">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="p-3">
                          {isReadOnly ? (
                            <span className="text-sm">{item.unitPrice || "-"}</span>
                          ) : (
                            <Input
                              type="number"
                              placeholder="단가"
                              value={itemResponses[item.id]?.unitPrice || ""}
                              onChange={(e) =>
                                updateItemResponse(item.id, "unitPrice", parseFloat(e.target.value))
                              }
                              className="w-24 h-8 text-sm"
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-3">
                          {isReadOnly ? (
                            <span className="text-sm">{item.leadTime || "-"}</span>
                          ) : (
                            <Input
                              type="text"
                              placeholder="예: 3일"
                              value={itemResponses[item.id]?.leadTime || ""}
                              onChange={(e) =>
                                updateItemResponse(item.id, "leadTime", e.target.value)
                              }
                              className="w-24 h-8 text-sm"
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-3">
                          {isReadOnly ? (
                            <span className="text-sm">{item.moq || "-"}</span>
                          ) : (
                            <Input
                              type="number"
                              placeholder="MOQ"
                              value={itemResponses[item.id]?.moq || ""}
                              onChange={(e) =>
                                updateItemResponse(item.id, "moq", parseInt(e.target.value))
                              }
                              className="w-20 h-8 text-sm"
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-3">
                          {isReadOnly ? (
                            <span className="text-sm">{item.notes || "-"}</span>
                          ) : (
                            <Input
                              type="text"
                              placeholder="비고"
                              value={itemResponses[item.id]?.notes || ""}
                              onChange={(e) =>
                                updateItemResponse(item.id, "notes", e.target.value)
                              }
                              className="w-32 h-8 text-sm"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-slate-200 shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">첨부 파일</h2>
              </div>
              <div className="p-4 space-y-4">
                {!isReadOnly && (
                  <div>
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <label htmlFor="file-upload">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={uploading}
                        asChild
                      >
                        <span>
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              업로드 중...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              파일 업로드
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}

                {request.attachments.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    첨부 파일이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {request.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 p-2 border border-slate-200 hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline truncate flex-1"
                        >
                          {attachment.filename}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isReadOnly && (
              <div className="mt-4 bg-white border border-slate-200 shadow-sm p-4">
                <p className="text-sm text-slate-600 mb-3">
                  이미 회신을 제출하셨습니다.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  회신 수정 (1회 가능)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

