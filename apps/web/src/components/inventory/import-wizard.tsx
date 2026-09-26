"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X, Edit2, Check, XCircle } from "lucide-react";
import { csrfFetch } from "@/lib/api-client";
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

/* §import-header-mapping (2026-09-26 · 호영님 실측) — 호영님이 실제 파일(7컬럼·2행)을 넣어 두 결함을 찾았다:
 *   ① 로트·유효기한·카탈로그번호·제조사가 **말없이 버려졌다**
 *        「카탈로그번호」(붙여 씀)를 「카탈로그 번호」(띄어 씀)만 인식 · 「유효기한」 을 「유통기한」 만 인식
 *        「로트번호」·「제조사」 는 스키마에 컬럼 자체가 없었다
 *        그런데 화면은 「총 2개 중 2개를 등록할 수 있습니다」 로 경고 0이었다
 *   ② **재고 수량이 최소 주문 수량에 복사됐다**
 *        구 매칭이 부분 문자열을 허용해서 「수량」 한 컬럼이 「재고수량」·「최소주문수량」 **둘 다**에 걸렸다
 *        확정하면 틀린 재주문 기준이 DB 에 기록된다
 *   연구실 재고에서 로트·유효기한은 핵심 정보다 — 조용한 유실은 가짜 성공과 같은 등급이다(호영님).
 *
 * 처방 · 세 가지가 함께 가야 한다:
 *   (1) 매칭은 **완전 일치**만 한다(정규화 후). 부분 문자열 금지 → ② 의 뿌리를 끊는다.
 *   (2) 동의어를 사전으로 흡수한다 — 띄어쓰기·흔한 이름은 사용자 잘못이 아니다.
 *   (3) 한 컬럼이 두 필드에 걸리면 **어느 쪽에도 넣지 않고** 모호로 올린다(호영님: 「고르게 하십시오」).
 *   그리고 인식하지 못한 열은 미리보기에 **명시**한다 — 말없이 버리지 않는다. */
export const STANDARD_FIELDS = [
  { key: "productName", label: "제품명", required: true,
    synonyms: ["품목명", "시약명", "제품", "품명", "name", "productname", "item", "itemname"] },
  { key: "catalogNumber", label: "카탈로그 번호", required: false,
    synonyms: ["카탈로그번호", "카탈로그", "카달로그번호", "제품번호", "품번",
               "catno", "cat.no", "catalog", "catalogno", "catalognumber", "sku"] },
  { key: "currentQuantity", label: "재고 수량", required: true,
    synonyms: ["재고", "재고량", "현재수량", "보유수량", "qty", "quantity", "stock", "currentqty"] },
  { key: "unit", label: "단위", required: false,
    synonyms: ["규격단위", "uom", "unit"] },
  { key: "safetyStock", label: "안전 재고", required: false,
    synonyms: ["안전재고", "안전재고량", "safetystock", "minstock"] },
  { key: "minOrderQty", label: "최소 주문 수량", required: false,
    synonyms: ["최소주문수량", "최소발주수량", "moq", "minorderqty"] },
  { key: "location", label: "보관 위치", required: false,
    synonyms: ["보관위치", "위치", "보관장소", "장소", "location", "storage"] },
  { key: "expiryDate", label: "유통기한", required: false,
    synonyms: ["유효기한", "사용기한", "만료일", "유효기간", "expiry", "expirydate", "expirationdate"] },
  /* §import-header-mapping (2026-09-26 · 호영님 실측) — 호영님 지시 3: 로트 번호를 스키마에 추가한다.
   *   ProductInventory.lotNumber 가 이미 있다 — 새 컬럼을 만들지 않고 그 필드로 매핑한다. */
  { key: "lotNumber", label: "로트 번호", required: false,
    synonyms: ["로트번호", "로트", "랏번호", "배치번호", "lot", "lotno", "lotnumber", "batch", "batchno"] },
  /* 제조사도 같은 판단 — Product.manufacturer 가 이미 있다(주석에 「제조사」). */
  { key: "manufacturer", label: "제조사", required: false,
    synonyms: ["제조회사", "메이커", "브랜드", "manufacturer", "maker", "brand", "vendor"] },
  { key: "notes", label: "비고", required: false,
    synonyms: ["메모", "특이사항", "note", "notes", "remark", "remarks", "memo"] },
] as const;

/** 헤더 정규화 — 띄어쓰기·구분자·대소문자만 지운다. 글자를 빼지는 않는다. */
function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/[_\s\-.()\[\]]/g, "");
}

export interface HeaderMatchResult {
  /** field.key → 소스 컬럼 */
  mapping: Record<string, string>;
  /** 여러 필드에 걸려 **매칭하지 않은** 컬럼 → 후보 필드 라벨 */
  ambiguous: { column: string; candidates: string[] }[];
  /** 어느 필드에도 걸리지 않은 컬럼 */
  unrecognized: string[];
}

/**
 * §import-header-mapping (2026-09-26 · 호영님 실측) — 헤더 자동 매칭.
 * 🛑 **필드당 컬럼 하나, 컬럼당 필드 하나.** 부분 문자열로 맞추지 않는다.
 *    한 컬럼이 둘 이상의 필드에 걸리면 어느 쪽에도 넣지 않고 ambiguous 로 올린다 —
 *    「수량」 을 재고 수량과 최소 주문 수량에 동시에 넣던 것이 결함 ② 였다.
 */
export function matchHeaders(columns: string[]): HeaderMatchResult {
  // 컬럼 → 걸린 필드 목록
  const hits = new Map<string, string[]>();
  for (const col of columns) {
    const n = normalizeHeader(col);
    const matched = STANDARD_FIELDS.filter((f) => {
      if (n === normalizeHeader(f.key) || n === normalizeHeader(f.label)) return true;
      return f.synonyms.some((s) => n === normalizeHeader(s));
    }).map((f) => f.key as string);
    hits.set(col, matched);
  }

  const mapping: Record<string, string> = {};
  const ambiguous: { column: string; candidates: string[] }[] = [];
  const unrecognized: string[] = [];
  const labelOf = (key: string) =>
    STANDARD_FIELDS.find((f) => f.key === key)?.label ?? key;

  for (const [col, keys] of hits) {
    if (keys.length === 0) { unrecognized.push(col); continue; }
    if (keys.length > 1) {
      ambiguous.push({ column: col, candidates: keys.map(labelOf) });
      continue;
    }
    const key = keys[0];
    if (mapping[key]) {
      // 같은 필드에 두 컬럼이 걸렸다 — 뒤에 온 것은 고르게 한다(먼저 온 것을 덮지 않는다).
      ambiguous.push({ column: col, candidates: [labelOf(key)] });
      continue;
    }
    mapping[key] = col;
  }
  return { mapping, ambiguous, unrecognized };
}

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
  // §inventory-org-required (호영님 2026-09-11) — 조직 없음(422)은 토스트가 아니라 **단계 화면 안 인라인 안내**.
  //   토스트는 사라지고, 초대를 기다리는 사용자가 읽을 문장이 함께 사라진다. 마법사는 단계 화면이라 인라인이 자연스럽다.
  const [orgBlock, setOrgBlock] = useState<{
    title: string;
    detail?: string;
    hint?: string;
    action: { label: string; href: string };
  } | null>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  // Step 1: Upload
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  // §import-header-mapping (2026-09-26 · 호영님 실측) — 매칭 결과(모호·미인식)를 화면이 그려야 한다. 안 그리면 말없이 버리는 것과 같다.
  const [headerMatch, setHeaderMatch] = useState<HeaderMatchResult | null>(null);

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

      const response = await csrfFetch("/api/inventory/import/preview", {
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

      // §import-header-mapping (2026-09-26 · 호영님 실측) — 완전 일치 + 동의어 + 중복 차단. 판정은 matchHeaders 한 곳에서만 한다.
      const matched = matchHeaders(data.columns);
      const autoMapping = matched.mapping;
      setHeaderMatch(matched);
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

      const response = await csrfFetch("/api/inventory/import/commit", {
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
        // §inventory-org-required — 422 NO_ORGANIZATION 은 갈 길(action)을 함께 싣는다. 잃지 않고 넘긴다.
        throw Object.assign(new Error(error.error || "등록 실패"), { action: error.action, detail: error.detail, hint: error.hint });
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setOrgBlock(null);
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
      // §inventory-org-required — 조직이 없어 막힌 경우 막다른 길로 끝내지 않는다: 조직 화면으로 가는 버튼.
      const next = error?.action as { label: string; href: string } | undefined;
      if (next) {
        // 조직 없음 · 갈 길이 있는 거절은 화면 안에 남긴다(아래 orgBlock 렌더).
        setOrgBlock({ title: error.message, detail: error.detail, hint: error.hint, action: next });
        return;
      }
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
    setOrgBlock(null);
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
            <div className="bg-blue-50  bg-blue-950 border border-blue-200  border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900  text-blue-100 mb-1">
                    이 양식을 사용하면 가장 정확합니다
                  </h4>
                  <p className="text-sm text-blue-700  text-blue-300">
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
            {/* §inventory-org-required — 조직 없음 인라인 안내 · 버튼은 조직 만들기 하나 · 초대는 문장 */}
            {orgBlock && (
              <div role="alert" className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-yellow-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {orgBlock.title}
                </p>
                {orgBlock.detail && <p className="text-sm text-slate-700">{orgBlock.detail}</p>}
                {orgBlock.hint && <p className="text-sm text-slate-600">{orgBlock.hint}</p>}
                <Button size="sm" className="min-h-[44px]" onClick={() => router.push(orgBlock.action.href)}>
                  {orgBlock.action.label}
                </Button>
              </div>
            )}

            {/* 요약 메시지 */}
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium">
                총 <span className="font-bold">{previewData.totalRows}개</span> 중{" "}
                <span className="font-bold text-green-600">{validRows}개</span>를 등록할 수
                있습니다.
              </p>
              {Object.keys(validationErrors).length > 0 && (
                <p className="text-sm text-destructive mt-1">
                  {Object.keys(validationErrors).length}개 행에 오류가 있습니다.
                </p>
              )}
              {Object.keys(excludedRows).length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {Object.keys(excludedRows).length}개 행이 제외되었습니다.
                </p>
              )}
            </div>

            {/* §import-header-mapping (2026-09-26 · 호영님 실측) — 인식하지 못한 열·모호한 열을 **명시**한다(호영님 지시 4).
                구 화면은 「총 2개 중 2개를 등록할 수 있습니다」 만 말하고 버린 열을 알리지 않았다. */}
            {headerMatch && (headerMatch.unrecognized.length > 0 || headerMatch.ambiguous.length > 0) && (
              <div role="alert" className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-yellow-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  파일의 열 일부를 그대로 가져오지 않습니다
                </p>
                {headerMatch.ambiguous.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <p className="font-medium">어느 항목인지 고르셔야 하는 열</p>
                    <ul className="mt-0.5 list-disc pl-5">
                      {headerMatch.ambiguous.map((a) => (
                        <li key={a.column} data-testid="import-ambiguous-column">
                          {a.column} · 후보: {a.candidates.join(" / ")} · 아래에서 직접 지정하세요
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {headerMatch.unrecognized.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <p className="font-medium">인식하지 못한 열</p>
                    <ul className="mt-0.5 list-disc pl-5">
                      {headerMatch.unrecognized.map((c) => (
                        <li key={c} data-testid="import-unrecognized-column">{c} · 가져오지 않습니다</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

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
                          ${hasError && !isExcluded ? "bg-red-50  bg-red-950" : ""}
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
                      className="text-sm bg-red-50  bg-red-950 border border-red-200  border-red-800 rounded p-2"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{importResult.totalRows}</div>
                <div className="text-sm text-muted-foreground">총 행 수</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-50  bg-green-950">
                <div className="text-2xl font-bold text-green-600 text-green-400">
                  {importResult.successRows}
                </div>
                <div className="text-sm text-muted-foreground">성공</div>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-50  bg-red-950">
                <div className="text-2xl font-bold text-red-600 text-red-400">
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

