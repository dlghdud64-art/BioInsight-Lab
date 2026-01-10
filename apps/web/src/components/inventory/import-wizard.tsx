"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X, Edit2, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Confetti from "react-confetti";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

interface PreviewData {
  columns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  filename: string;
  fileId: string;
}

interface RowError {
  row: number;
  errors: string[];
}

interface ImportResult {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorSample: RowError[];
}

type Step = "upload" | "preview" | "commit";

const STANDARD_FIELDS = [
  { key: "productName", label: "제품명", required: true },
  { key: "catalogNumber", label: "카탈로그 번호", required: false },
  { key: "currentQuantity", label: "재고 수량", required: true },
  { key: "unit", label: "단위", required: false },
  { key: "safetyStock", label: "안전 재고", required: false },
  { key: "minOrderQty", label: "최소 주문 수량", required: false },
  { key: "location", label: "보관 위치", required: false },
  { key: "expiryDate", label: "유통기한", required: false },
  { key: "notes", label: "비고", required: false },
] as const;

interface ImportWizardProps {
  onSuccess?: () => void;
}

export function ImportWizard({ onSuccess }: ImportWizardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);

  // Step 1: Upload
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Step 2: Preview
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<number, RowError>>({});
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Record<number, Record<string, any>>>({});

  // Step 3: Result
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // 템플릿 다운로드
  const downloadTemplate = () => {
    const templateData = [
      {
        제품명: "예시 제품 1",
        카탈로그번호: "CAT-001",
        재고수량: "100",
        단위: "ea",
        안전재고: "20",
        최소주문수량: "10",
        보관위치: "냉장고 A-1",
        유통기한: "2025-12-31",
        비고: "참고사항",
      },
      {
        제품명: "예시 제품 2",
        카탈로그번호: "CAT-002",
        재고수량: "50",
        단위: "mL",
        안전재고: "10",
        최소주문수량: "5",
        보관위치: "실온 보관",
        유통기한: "",
        비고: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "템플릿");
    XLSX.writeFile(wb, "인벤토리_템플릿.xlsx");
  };

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

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      setLoading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const response = await fetch("/api/inventory/import/preview", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "파일 업로드 실패");
      }

      const data: PreviewData = await response.json();
      setPreviewData(data);

      // Auto-map columns based on common names
      const autoMapping: Record<string, string> = {};
      for (const field of STANDARD_FIELDS) {
        const matchedColumn = data.columns.find((col) => {
          const normalized = col.toLowerCase().replace(/[_\s-]/g, "");
          const fieldNormalized = field.key.toLowerCase();
          const labelNormalized = field.label.toLowerCase();
          return (
            normalized === fieldNormalized ||
            normalized === labelNormalized ||
            normalized.includes(fieldNormalized) ||
            fieldNormalized.includes(normalized) ||
            normalized.includes(labelNormalized) ||
            labelNormalized.includes(normalized)
          );
        });
        if (matchedColumn) {
          autoMapping[field.key] = matchedColumn;
        }
      }

      setColumnMapping(autoMapping);

      // Validate preview data
      await validatePreviewData(data, autoMapping);

      setStep("preview");

      toast({
        title: "파일 업로드 성공",
        description: `${data.totalRows}행의 데이터를 불러왔습니다.`,
      });
    } catch (error: any) {
      toast({
        title: "파일 업로드 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const validatePreviewData = async (
    data: PreviewData,
    mapping: Record<string, string>
  ) => {
    const errors: Record<number, RowError> = {};

    // Validate each row in sampleRows (for preview)
    for (let i = 0; i < data.sampleRows.length; i++) {
      const row = data.sampleRows[i];
      const rowNumber = i + 1;
      const rowErrors: string[] = [];

      // Check required fields
      const productNameCol = mapping.productName;
      const quantityCol = mapping.currentQuantity;

      if (!productNameCol) {
        rowErrors.push("제품명 컬럼이 매핑되지 않았습니다");
      } else {
        const productName = row[productNameCol];
        if (!productName || String(productName).trim() === "") {
          rowErrors.push("제품명이 필요합니다");
        }
      }

      if (!quantityCol) {
        rowErrors.push("재고 수량 컬럼이 매핑되지 않았습니다");
      } else {
        const currentQuantity = row[quantityCol];
        const qtyNum = parseFloat(String(currentQuantity || "").replace(/[,\s]/g, ""));
        if (!currentQuantity || isNaN(qtyNum) || qtyNum < 0) {
          rowErrors.push("재고 수량이 유효하지 않습니다 (0 이상의 숫자여야 합니다)");
        }
      }

      // Validate optional numeric fields
      if (mapping.safetyStock && row[mapping.safetyStock]) {
        const safetyStock = parseFloat(String(row[mapping.safetyStock] || "").replace(/[,\s]/g, ""));
        if (!isNaN(safetyStock) && safetyStock < 0) {
          rowErrors.push("안전 재고는 0 이상이어야 합니다");
        }
      }

      if (mapping.minOrderQty && row[mapping.minOrderQty]) {
        const minOrderQty = parseFloat(String(row[mapping.minOrderQty] || "").replace(/[,\s]/g, ""));
        if (!isNaN(minOrderQty) && minOrderQty < 0) {
          rowErrors.push("최소 주문 수량은 0 이상이어야 합니다");
        }
      }

      if (rowErrors.length > 0) {
        errors[rowNumber] = { row: rowNumber, errors: rowErrors };
      }
    }

    setValidationErrors(errors);
  };

  const toggleRowExclusion = (rowNumber: number) => {
    setExcludedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowNumber)) {
        newSet.delete(rowNumber);
      } else {
        newSet.add(rowNumber);
      }
      return newSet;
    });
  };

  const startEditing = (rowNumber: number, rowData: Record<string, any>) => {
    setEditingRow(rowNumber);
    setEditedData((prev) => ({
      ...prev,
      [rowNumber]: { ...rowData },
    }));
  };

  const saveEdit = (rowNumber: number) => {
    setEditingRow(null);
    // Re-validate edited row
    validatePreviewData(
      {
        ...previewData!,
        sampleRows: previewData!.sampleRows.map((row, idx) =>
          idx === rowNumber - 1 ? editedData[rowNumber] : row
        ),
      },
      columnMapping
    );
  };

  const cancelEdit = () => {
    setEditingRow(null);
  };

  const updateEditedCell = (rowNumber: number, column: string, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        [column]: value,
      },
    }));
  };

  const handleCommit = async () => {
    try {
      setLoading(true);
      setUploadProgress(0);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 5, 95));
      }, 200);

      const response = await fetch("/api/inventory/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: previewData?.fileId,
          columnMapping,
          excludedRows: Array.from(excludedRows),
          editedRows: editedData,
        }),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "등록 실패");
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setStep("commit");

      if (result.errorRows === 0) {
        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          onSuccess?.();
          router.push("/dashboard/inventory");
        }, 2000);
      }

      toast({
        title: result.errorRows === 0 ? "등록 완료" : "일부 등록 완료",
        description:
          result.errorRows === 0
            ? `${result.successRows}개의 인벤토리를 등록했습니다.`
            : `${result.successRows}개 성공, ${result.errorRows}개 실패`,
      });
    } catch (error: any) {
      toast({
        title: "등록 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setPreviewData(null);
    setColumnMapping({});
    setValidationErrors({});
    setExcludedRows(new Set());
    setEditingRow(null);
    setEditedData({});
    setImportResult(null);
    setShowConfetti(false);
  };

  const validRows = previewData
    ? previewData.totalRows - Object.keys(validationErrors).length - excludedRows.size
    : 0;

  return (
    <div className="space-y-6">
      {/* Confetti */}
      {showConfetti && (
        <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-50">
          <Confetti
            width={confettiRef.current?.clientWidth || window.innerWidth}
            height={confettiRef.current?.clientHeight || window.innerHeight}
            recycle={false}
            numberOfPieces={200}
          />
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4">
        <StepIndicator
          number={1}
          label="템플릿 & 업로드"
          active={step === "upload"}
          completed={step !== "upload"}
        />
        <div className="h-px w-12 bg-border" />
        <StepIndicator
          number={2}
          label="데이터 미리보기"
          active={step === "preview"}
          completed={step === "commit"}
        />
        <div className="h-px w-12 bg-border" />
        <StepIndicator number={3} label="등록 완료" active={step === "commit"} />
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>엑셀 파일 업로드</CardTitle>
            <CardDescription>
              인벤토리 데이터를 엑셀 파일로 일괄 등록합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 템플릿 다운로드 */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    이 양식을 사용하면 가장 정확합니다
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    샘플 양식을 다운로드하여 형식에 맞춰 작성하세요.
                  </p>
                </div>
                <Button onClick={downloadTemplate} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  샘플 양식 다운로드
                </Button>
              </div>
            </div>

            {/* Drag & Drop 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                ${loading ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">여기에 엑셀 파일을 던지세요</h3>
              <p className="text-sm text-muted-foreground mb-4">
                또는 아래 버튼을 클릭하여 파일을 선택하세요
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label htmlFor="file-upload">
                <Button asChild disabled={loading} size="lg">
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    파일 선택
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                지원 형식: CSV, XLSX (최대 10MB)
              </p>
              {loading && (
                <div className="mt-4">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-muted-foreground mt-2">
                    업로드 중... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && previewData && (
        <Card>
          <CardHeader>
            <CardTitle>데이터 미리보기</CardTitle>
            <CardDescription>
              {previewData.filename} · 총 {previewData.totalRows}행
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 요약 메시지 */}
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium">
                총 <span className="font-bold">{previewData.totalRows}개</span> 중{" "}
                <span className="font-bold text-green-600">{validRows}개</span>를 등록할 수
                있습니다.
              </p>
              {validationErrors.size > 0 && (
                <p className="text-sm text-destructive mt-1">
                  {validationErrors.size}개 행에 오류가 있습니다.
                </p>
              )}
              {excludedRows.size > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {excludedRows.size}개 행이 제외되었습니다.
                </p>
              )}
            </div>

            {/* 미리보기 테이블 */}
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox disabled />
                    </TableHead>
                    <TableHead className="w-16">행 번호</TableHead>
                    {STANDARD_FIELDS.map((field) => (
                      <TableHead key={field.key}>
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </TableHead>
                    ))}
                    <TableHead className="w-24">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.sampleRows.map((row, idx) => {
                    const rowNumber = idx + 1;
                    const hasError = validationErrors[rowNumber] !== undefined;
                    const isExcluded = excludedRows.has(rowNumber);
                    const isEditing = editingRow === rowNumber;
                    const rowData = editedData[rowNumber] || row;

                    return (
                      <TableRow
                        key={idx}
                        className={`
                          ${hasError && !isExcluded ? "bg-red-50 dark:bg-red-950" : ""}
                          ${isExcluded ? "opacity-50" : ""}
                        `}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isExcluded}
                            onCheckedChange={() => toggleRowExclusion(rowNumber)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{rowNumber}</TableCell>
                        {STANDARD_FIELDS.map((field) => {
                          const column = columnMapping[field.key];
                          const value = rowData[column] || "";

                          return (
                            <TableCell key={field.key}>
                              {isEditing ? (
                                <Input
                                  value={String(value)}
                                  onChange={(e) =>
                                    updateEditedCell(rowNumber, column, e.target.value)
                                  }
                                  className="h-8"
                                  size="sm"
                                />
                              ) : (
                                <span className={hasError ? "text-destructive" : ""}>
                                  {String(value)}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => saveEdit(rowNumber)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(rowNumber, rowData)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* 에러 상세 */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive">오류 상세</h4>
                <div className="space-y-1">
                  {Object.values(validationErrors).map((error) => (
                    <div
                      key={error.row}
                      className="text-sm bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2"
                    >
                      <span className="font-medium">행 {error.row}:</span>{" "}
                      {error.errors.join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleReset}>
                취소
              </Button>
              <Button onClick={handleCommit} disabled={loading || validRows === 0} size="lg">
                {loading ? (
                  <>
                    <span className="mr-2">처리 중...</span>
                    <Progress value={uploadProgress} className="w-24 h-2" />
                  </>
                ) : (
                  "등록 완료"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Commit Result */}
      {step === "commit" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle>등록 완료</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              {importResult.errorRows === 0 ? (
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
              ) : (
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              )}
              <h3 className="text-lg font-semibold mb-2">
                {importResult.errorRows === 0 ? "모든 데이터가 성공적으로 등록되었습니다!" : "일부 데이터가 등록되었습니다"}
              </h3>
            </div>

            {/* 결과 카드 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{importResult.totalRows}</div>
                <div className="text-sm text-muted-foreground">총 행 수</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-50 dark:bg-green-950">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {importResult.successRows}
                </div>
                <div className="text-sm text-muted-foreground">성공</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-50 dark:bg-red-950">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {importResult.errorRows}
                </div>
                <div className="text-sm text-muted-foreground">실패</div>
              </div>
            </div>

            {/* 에러 테이블 */}
            {importResult.errorSample.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">오류 내역 (최대 10개)</h4>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">행 번호</TableHead>
                        <TableHead>오류</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errorSample.map((error, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{error.row}</TableCell>
                          <TableCell className="text-destructive">
                            {error.errors.join(", ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={handleReset} size="lg">
                새로운 파일 업로드
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StepIndicatorProps {
  number: number;
  label: string;
  active?: boolean;
  completed?: boolean;
}

function StepIndicator({ number, label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center font-semibold
          ${active ? "bg-primary text-primary-foreground" : ""}
          ${completed ? "bg-green-500 text-white" : ""}
          ${!active && !completed ? "bg-muted text-muted-foreground" : ""}
        `}
      >
        {completed ? <CheckCircle2 className="w-5 h-5" /> : number}
      </div>
      <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

