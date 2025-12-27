"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getGuestKey } from "@/lib/guest-key";

interface PreviewData {
  columns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  filename: string;
  fileId: string;
}

interface ImportResult {
  jobId: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errorSample: Array<{ row: number; errors: string[] }>;
}

type Step = "upload" | "mapping" | "result";

const STANDARD_FIELDS = [
  { key: "purchasedAt", label: "구매일", required: true },
  { key: "vendorName", label: "벤더", required: true },
  { key: "category", label: "카테고리", required: false },
  { key: "itemName", label: "품목명", required: true },
  { key: "catalogNumber", label: "카탈로그 번호", required: false },
  { key: "unit", label: "단위", required: false },
  { key: "qty", label: "수량", required: true },
  { key: "unitPrice", label: "단가", required: false },
  { key: "amount", label: "금액", required: false },
  { key: "currency", label: "통화", required: false },
] as const;

interface CsvUploadTabProps {
  onSuccess?: () => void;
}

export function CsvUploadTab({ onSuccess }: CsvUploadTabProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);

  // Step 1: Upload
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // Step 2: Mapping
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Step 3: Result
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/purchases/import/preview", {
        method: "POST",
        headers: {
          "x-guest-key": getGuestKey(),
        },
        body: formData,
      });

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
          return (
            normalized === fieldNormalized ||
            normalized.includes(fieldNormalized) ||
            fieldNormalized.includes(normalized)
          );
        });
        if (matchedColumn) {
          autoMapping[field.key] = matchedColumn;
        }
      }

      setColumnMapping(autoMapping);
      setStep("mapping");

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
    }
  };

  const validateMapping = (): { valid: boolean; message?: string } => {
    const requiredFields = STANDARD_FIELDS.filter((f) => f.required);

    for (const field of requiredFields) {
      if (!columnMapping[field.key]) {
        return { valid: false, message: `${field.label} 컬럼 매핑이 필요합니다` };
      }
    }

    // Check if either amount or unitPrice is mapped
    if (!columnMapping.amount && !columnMapping.unitPrice) {
      return { valid: false, message: "금액 또는 단가 중 하나는 매핑이 필요합니다" };
    }

    return { valid: true };
  };

  const handleCommit = async () => {
    const validation = validateMapping();
    if (!validation.valid) {
      toast({
        title: "매핑 확인",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/purchases/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-guest-key": getGuestKey(),
        },
        body: JSON.stringify({
          fileId: previewData?.fileId,
          columnMapping,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "가져오기 실패");
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setStep("result");

      if (result.errorRows === 0) {
        toast({
          title: "가져오기 완료",
          description: `${result.successRows}개의 구매내역을 추가했습니다.`,
        });
        onSuccess?.();
      } else if (result.successRows === 0) {
        toast({
          title: "가져오기 실패",
          description: "모든 행에서 오류가 발생했습니다.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "일부 가져오기 완료",
          description: `${result.successRows}개 성공, ${result.errorRows}개 실패`,
        });
      }
    } catch (error: any) {
      toast({
        title: "가져오기 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setPreviewData(null);
    setColumnMapping({});
    setImportResult(null);
  };

  const downloadErrorCsv = () => {
    if (!importResult || !importResult.errorSample.length) return;

    const csvContent = [
      ["행 번호", "오류"],
      ...importResult.errorSample.map((err) => [err.row, err.errors.join("; ")]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-errors.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4">
        <StepIndicator number={1} label="파일 선택" active={step === "upload"} completed={step !== "upload"} />
        <div className="h-px w-12 bg-border" />
        <StepIndicator number={2} label="컬럼 매핑" active={step === "mapping"} completed={step === "result"} />
        <div className="h-px w-12 bg-border" />
        <StepIndicator number={3} label="결과 확인" active={step === "result"} />
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
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
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">CSV 또는 Excel 파일 업로드</h3>
            <p className="text-sm text-muted-foreground mb-4">
              파일을 드래그하거나 클릭하여 선택하세요
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
              <Button asChild disabled={loading}>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  파일 선택
                </span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-4">
              지원 형식: CSV, XLSX (최대 10MB)
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === "mapping" && previewData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">컬럼 매핑</h3>
              <p className="text-sm text-muted-foreground">
                {previewData.filename} · {previewData.totalRows}행
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              다시 업로드
            </Button>
          </div>

          {/* Mapping Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">표준 필드</th>
                  <th className="text-left p-3 font-medium">CSV 컬럼</th>
                  <th className="text-left p-3 font-medium">샘플 데이터</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {STANDARD_FIELDS.map((field) => (
                  <tr key={field.key} className="hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        {field.required && (
                          <span className="text-xs text-destructive">*</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Select
                        value={columnMapping[field.key] || ""}
                        onValueChange={(value) =>
                          setColumnMapping((prev) => ({ ...prev, [field.key]: value }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="컬럼 선택..." />
                        </SelectTrigger>
                        <SelectContent>
                          {previewData.columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {columnMapping[field.key] && previewData.sampleRows[0]
                        ? String(previewData.sampleRows[0][columnMapping[field.key]] || "-")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview Table */}
          <div>
            <h4 className="text-sm font-medium mb-2">미리보기 (최대 20행)</h4>
            <div className="border rounded-lg overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {previewData.columns.map((col) => (
                      <th key={col} className="text-left p-2 font-medium whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.sampleRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      {previewData.columns.map((col) => (
                        <td key={col} className="p-2 whitespace-nowrap">
                          {String(row[col] || "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>
              취소
            </Button>
            <Button onClick={handleCommit} disabled={loading || !validateMapping().valid}>
              {loading ? "처리 중..." : "가져오기 실행"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === "result" && importResult && (
        <div className="space-y-6">
          <div className="text-center">
            {importResult.errorRows === 0 ? (
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
            ) : (
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            )}
            <h3 className="text-lg font-semibold mb-2">가져오기 완료</h3>
          </div>

          {/* Result Cards */}
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

          {/* Error Table */}
          {importResult.errorSample.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">오류 내역 (최대 10개)</h4>
                <Button variant="outline" size="sm" onClick={downloadErrorCsv}>
                  <Download className="w-4 h-4 mr-2" />
                  에러 CSV 다운로드
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium w-20">행 번호</th>
                      <th className="text-left p-2 font-medium">오류</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importResult.errorSample.map((error, idx) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="p-2">{error.row}</td>
                        <td className="p-2 text-destructive">
                          {error.errors.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <Button onClick={handleReset}>새로운 파일 업로드</Button>
          </div>
        </div>
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
