"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Download,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MainHeader } from "@/app/_components/main-header";
import { DashboardSidebar } from "@/app/_components/dashboard-sidebar";

interface PreviewData {
  fileId: string;
  filename: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: any[];
  errors: Array<{ row: number; errors: string[] }>;
  columnHeaders: string[];
}

interface CommitResult {
  success: boolean;
  totalRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  errors: Array<{ row: number; reason: string }>;
  summary: {
    newProducts: number;
    newInventories: number;
    updatedInventories: number;
  };
}

export default function InventoryImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  // UI State
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Data State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [createProducts, setCreateProducts] = useState(true);

  // File Selection
  const handleFileSelect = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "xlsx, xls, csv 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  // Upload & Preview
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/inventory/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "업로드 실패");
      }

      const data: PreviewData = await response.json();
      setPreviewData(data);
      setStep("preview");

      toast({
        title: "파일 분석 완료",
        description: `총 ${data.totalRows}행 중 ${data.validRows}행 유효, ${data.invalidRows}행 에러`,
      });
    } catch (error: any) {
      toast({
        title: "업로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Commit Import
  const handleCommit = async () => {
    if (!previewData) return;

    setIsCommitting(true);

    try {
      const response = await fetch("/api/inventory/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: previewData.fileId,
          createProducts,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "임포트 실패");
      }

      const result: CommitResult = await response.json();
      setCommitResult(result);
      setStep("result");

      toast({
        title: result.success ? "임포트 완료!" : "일부 에러 발생",
        description: `${result.successRows}개 성공, ${result.errorRows}개 실패`,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "임포트 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCommitting(false);
    }
  };

  // Reset
  const handleReset = () => {
    setStep("upload");
    setSelectedFile(null);
    setPreviewData(null);
    setCommitResult(null);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <MainHeader />
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
            <div className="container mx-auto px-4 py-8">
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">로딩 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MainHeader />
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 overflow-auto min-w-0 pt-12 md:pt-0">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  인벤토리 대량 임포트
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  엑셀 파일로 재고 데이터를 일괄 등록하세요
                </p>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center justify-center gap-4">
                <StepIndicator
                  number={1}
                  label="파일 업로드"
                  active={step === "upload"}
                  completed={step === "preview" || step === "result"}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <StepIndicator
                  number={2}
                  label="데이터 확인"
                  active={step === "preview"}
                  completed={step === "result"}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <StepIndicator
                  number={3}
                  label="완료"
                  active={step === "result"}
                  completed={false}
                />
              </div>

              {/* Step 1: Upload */}
              {step === "upload" && (
                <Card>
                  <CardHeader>
                    <CardTitle>1. 엑셀 파일 업로드</CardTitle>
                    <CardDescription>
                      xlsx, xls, csv 형식의 재고 데이터를 업로드하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Drag & Drop Zone */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                        isDragging
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {selectedFile ? (
                        <div className="space-y-4">
                          <FileSpreadsheet className="h-16 w-16 mx-auto text-green-600" />
                          <div>
                            <p className="font-semibold text-lg">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(selectedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <div className="flex gap-2 justify-center">
                            <Button onClick={handleUpload} disabled={isUploading}>
                              {isUploading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  분석 중...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  분석 시작
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setSelectedFile(null)}
                              disabled={isUploading}
                            >
                              <X className="h-4 w-4 mr-2" />
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Upload className="h-16 w-16 mx-auto text-muted-foreground" />
                          <div>
                            <p className="font-semibold text-lg">
                              파일을 드래그하거나 클릭하여 선택
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              xlsx, xls, csv 파일 지원
                            </p>
                          </div>
                          <Button
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ".xlsx,.xls,.csv";
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleFileSelect(file);
                              };
                              input.click();
                            }}
                          >
                            파일 선택
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Template Download */}
                    <Alert>
                      <Download className="h-4 w-4" />
                      <AlertTitle>템플릿 다운로드</AlertTitle>
                      <AlertDescription>
                        엑셀 템플릿을 다운로드하여 양식에 맞게 데이터를 입력하세요.
                        <br />
                        <span className="text-xs text-muted-foreground">
                          필수: 제품명, 수량 | 선택: 브랜드, 카탈로그번호, 단위, 위치, 구매일, 비고
                        </span>
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Preview */}
              {step === "preview" && previewData && (
                <PreviewStep
                  data={previewData}
                  createProducts={createProducts}
                  onCreateProductsChange={setCreateProducts}
                  onCommit={handleCommit}
                  onCancel={handleReset}
                  isCommitting={isCommitting}
                />
              )}

              {/* Step 3: Result */}
              {step === "result" && commitResult && (
                <ResultStep result={commitResult} onReset={handleReset} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
          completed
            ? "bg-green-600 text-white"
            : active
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {completed ? <CheckCircle2 className="h-5 w-5" /> : number}
      </div>
      <span
        className={`text-sm font-medium ${
          active ? "text-gray-900" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// Preview Step Component
function PreviewStep({
  data,
  createProducts,
  onCreateProductsChange,
  onCommit,
  onCancel,
  isCommitting,
}: {
  data: PreviewData;
  createProducts: boolean;
  onCreateProductsChange: (value: boolean) => void;
  onCommit: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}) {
  const successRate = ((data.validRows / data.totalRows) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>2. 데이터 확인</CardTitle>
          <CardDescription>{data.filename}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold">{data.totalRows}</div>
              <div className="text-sm text-muted-foreground">총 행</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{data.validRows}</div>
              <div className="text-sm text-muted-foreground">유효</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{data.invalidRows}</div>
              <div className="text-sm text-muted-foreground">에러</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>성공률</span>
              <span className="font-semibold">{successRate}%</span>
            </div>
            <Progress value={parseFloat(successRate)} className="h-2" />
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
            <Checkbox
              id="createProducts"
              checked={createProducts}
              onCheckedChange={(checked) => onCreateProductsChange(!!checked)}
            />
            <label
              htmlFor="createProducts"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              제품이 없으면 자동 생성 (권장)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 프리뷰 (최대 10행)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.columnHeaders.slice(0, 6).map((header, idx) => (
                    <TableHead key={idx}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.preview.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell>{row.brand || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.catalogNumber || "-"}
                    </TableCell>
                    <TableCell>
                      {row.quantity} {row.unit}
                    </TableCell>
                    <TableCell>{row.location}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.purchasedAt
                        ? new Date(row.purchasedAt).toLocaleDateString("ko-KR")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {data.errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              에러 항목 ({data.errors.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.errors.slice(0, 10).map((error, idx) => (
                <div key={idx} className="text-sm p-2 bg-white rounded border border-red-200">
                  <span className="font-semibold">행 {error.row}:</span>{" "}
                  {error.errors.join(", ")}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={isCommitting}>
          취소
        </Button>
        <Button
          onClick={onCommit}
          disabled={isCommitting || data.validRows === 0}
          className="bg-green-600 hover:bg-green-700"
        >
          {isCommitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              임포트 중...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {data.validRows}개 행 임포트
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Result Step Component
function ResultStep({
  result,
  onReset,
}: {
  result: CommitResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card className={result.success ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <span className="text-green-900">임포트 완료!</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-yellow-600" />
                <span className="text-yellow-900">일부 에러 발생</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatBox label="성공" value={result.successRows} color="green" />
            <StatBox label="에러" value={result.errorRows} color="red" />
            <StatBox label="스킵" value={result.skippedRows} color="gray" />
            <StatBox label="총" value={result.totalRows} color="blue" />
          </div>

          {/* Summary */}
          <div className="bg-white p-4 rounded-lg space-y-2">
            <h4 className="font-semibold mb-2">임포트 요약</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">새 제품:</span>{" "}
                <span className="font-semibold">{result.summary.newProducts}</span>
              </div>
              <div>
                <span className="text-muted-foreground">새 인벤토리:</span>{" "}
                <span className="font-semibold">{result.summary.newInventories}</span>
              </div>
              <div>
                <span className="text-muted-foreground">업데이트:</span>{" "}
                <span className="font-semibold">{result.summary.updatedInventories}</span>
              </div>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="bg-white p-4 rounded-lg">
              <h4 className="font-semibold mb-2 text-red-900">에러 상세</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.errors.slice(0, 20).map((error, idx) => (
                  <div key={idx} className="text-sm p-2 bg-red-50 rounded border border-red-200">
                    <span className="font-semibold">행 {error.row}:</span> {error.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={onReset} className="flex-1">
              다른 파일 임포트
            </Button>
            <Button variant="outline" onClick={() => window.location.href = "/dashboard/inventory"}>
              인벤토리로 이동
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "red" | "gray" | "blue";
}) {
  const colorClasses = {
    green: "bg-green-100 text-green-900",
    red: "bg-red-100 text-red-900",
    gray: "bg-gray-100 text-gray-900",
    blue: "bg-blue-100 text-blue-900",
  };

  return (
    <div className={`text-center p-3 rounded-lg ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
