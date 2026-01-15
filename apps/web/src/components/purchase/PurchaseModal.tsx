"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, FileText, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedPurchaseItem {
  purchase_date: string;
  vendor_name: string;
  category: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  currency: string;
}

interface ParseError {
  row: number;
  errors: string[];
  rawData: string;
}

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "input" | "preview" | "result";

export function PurchaseModal({ open, onOpenChange, onSuccess }: PurchaseModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("input");
  const [tsvInput, setTsvInput] = useState("");
  const [parsedData, setParsedData] = useState<ParsedPurchaseItem[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [loading, setLoading] = useState(false);

  // 날짜 형식 검증 (YYYY-MM-DD)
  const isValidDate = (dateString: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // TSV 파싱 함수
  const parseTSV = (text: string): { data: ParsedPurchaseItem[]; errors: ParseError[] } => {
    const data: ParsedPurchaseItem[] = [];
    const errors: ParseError[] = [];

    const lines = text.trim().split('\n');

    lines.forEach((line, index) => {
      const rowNumber = index + 1;
      const rawData = line;

      // 빈 줄 건너뛰기
      if (!line.trim()) return;

      const cols = line.split('\t').map(col => col.trim());
      const rowErrors: string[] = [];

      // 컬럼 개수 검증
      if (cols.length < 6) {
        rowErrors.push(`컬럼 개수 부족 (최소 6개 필요, 현재 ${cols.length}개)`);
        errors.push({ row: rowNumber, errors: rowErrors, rawData });
        return;
      }

      // 날짜 검증 (인덱스 0)
      const dateValue = cols[0];
      if (!dateValue) {
        rowErrors.push('날짜가 비어있습니다');
      } else if (!isValidDate(dateValue)) {
        rowErrors.push(`날짜 형식이 올바르지 않습니다 (YYYY-MM-DD 형식 필요): ${dateValue}`);
      }

      // 벤더명 검증 (인덱스 1)
      if (!cols[1]) {
        rowErrors.push('벤더명이 비어있습니다');
      }

      // 카테고리 (인덱스 2) - 선택적이므로 검증 안 함

      // 제품명 검증 (인덱스 3)
      if (!cols[3]) {
        rowErrors.push('제품명이 비어있습니다');
      }

      // 수량 검증 (인덱스 4)
      const quantityStr = cols[4]?.replace(/,/g, '') || '';
      const quantity = Number(quantityStr);
      if (!quantityStr) {
        rowErrors.push('수량이 비어있습니다');
      } else if (isNaN(quantity) || quantity <= 0) {
        rowErrors.push(`수량이 올바르지 않습니다: ${cols[4]}`);
      }

      // 단가 검증 (인덱스 5)
      const unitPriceStr = cols[5]?.replace(/,/g, '') || '';
      const unitPrice = Number(unitPriceStr);
      if (!unitPriceStr) {
        rowErrors.push('단가가 비어있습니다');
      } else if (isNaN(unitPrice) || unitPrice < 0) {
        rowErrors.push(`단가가 올바르지 않습니다: ${cols[5]}`);
      }

      // 통화 (인덱스 6) - 기본값 KRW
      const currency = cols[6] || 'KRW';

      // 에러가 있으면 에러 리스트에 추가
      if (rowErrors.length > 0) {
        errors.push({ row: rowNumber, errors: rowErrors, rawData });
        return;
      }

      // 성공적으로 파싱된 데이터 추가
      data.push({
        purchase_date: dateValue,
        vendor_name: cols[1],
        category: cols[2] || '',
        product_name: cols[3],
        quantity,
        unit_price: unitPrice,
        currency,
      });
    });

    return { data, errors };
  };

  // TSV 파싱 및 미리보기
  const handleParseTSV = () => {
    if (!tsvInput.trim()) {
      toast({
        title: "입력 오류",
        description: "TSV 데이터를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const { data, errors } = parseTSV(tsvInput);

    setParsedData(data);
    setParseErrors(errors);

    if (data.length === 0 && errors.length > 0) {
      toast({
        title: "파싱 실패",
        description: "유효한 데이터가 없습니다. 에러를 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    setStep("preview");

    toast({
      title: "파싱 완료",
      description: `${data.length}개의 데이터를 파싱했습니다.${errors.length > 0 ? ` (${errors.length}개 에러)` : ''}`,
    });
  };

  // 데이터 저장
  const handleSave = async () => {
    if (parsedData.length === 0) {
      toast({
        title: "저장 실패",
        description: "저장할 데이터가 없습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // TODO: API 엔드포인트로 데이터 전송
      const response = await fetch("/api/purchases/import/tsv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purchases: parsedData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "저장 실패");
      }

      const result = await response.json();

      toast({
        title: "저장 완료",
        description: `${parsedData.length}개의 구매내역을 저장했습니다.`,
      });

      setStep("result");
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 초기화
  const handleReset = () => {
    setStep("input");
    setTsvInput("");
    setParsedData([]);
    setParseErrors([]);
  };

  // 모달 닫기
  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  // 샘플 TSV 데이터
  const sampleTSV = `2025-01-15\tSigma-Aldrich\tREAGENT\tReagent A\t10\t50000\tKRW
2025-01-20\tThermo Fisher\tEQUIPMENT\tCentrifuge\t1\t2000000\tKRW
2025-01-22\tCorning\tCONSUMABLE\tPipette Tips 1000μL\t5\t30000\tKRW`;

  const loadSample = () => {
    setTsvInput(sampleTSV);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>구매내역 TSV 가져오기</DialogTitle>
          <DialogDescription>
            탭으로 구분된 텍스트(TSV)를 붙여넣어 구매내역을 일괄 등록하세요.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Input */}
        {step === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">TSV 데이터 입력</label>
                <Button variant="link" size="sm" onClick={loadSample}>
                  샘플 데이터 불러오기
                </Button>
              </div>
              <Textarea
                value={tsvInput}
                onChange={(e) => setTsvInput(e.target.value)}
                placeholder="날짜(YYYY-MM-DD)	벤더	카테고리	제품명	수량	단가	통화"
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground">
                <p className="mb-1">컬럼 순서: 날짜 / 벤더 / 카테고리 / 제품명 / 수량 / 단가 / 통화</p>
                <p>예시: 2025-01-15[TAB]Sigma-Aldrich[TAB]REAGENT[TAB]Reagent A[TAB]10[TAB]50000[TAB]KRW</p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>형식 안내</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>날짜는 YYYY-MM-DD 형식이어야 합니다</li>
                  <li>각 컬럼은 탭(Tab)으로 구분해야 합니다</li>
                  <li>수량과 단가는 숫자만 입력 가능합니다 (콤마 자동 제거)</li>
                  <li>통화는 생략 시 기본값 KRW가 적용됩니다</li>
                </ul>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                취소
              </Button>
              <Button onClick={handleParseTSV}>
                데이터 파싱 및 미리보기
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">데이터 미리보기</h3>
                <p className="text-sm text-muted-foreground">
                  성공: {parsedData.length}건 · 오류: {parseErrors.length}건
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                다시 입력
              </Button>
            </div>

            {/* 성공 데이터 테이블 */}
            {parsedData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h4 className="text-sm font-medium">정상 데이터 ({parsedData.length}건)</h4>
                </div>
                <div className="border rounded-lg overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead className="w-[100px]">날짜</TableHead>
                        <TableHead>벤더</TableHead>
                        <TableHead>카테고리</TableHead>
                        <TableHead>제품명</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="text-right">단가</TableHead>
                        <TableHead>통화</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{item.purchase_date}</TableCell>
                          <TableCell>{item.vendor_name}</TableCell>
                          <TableCell>
                            {item.category && (
                              <Badge variant="outline">{item.category}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell className="text-right">
                            {item.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unit_price.toLocaleString()}
                          </TableCell>
                          <TableCell>{item.currency}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 에러 데이터 테이블 */}
            {parseErrors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <h4 className="text-sm font-medium">오류 데이터 ({parseErrors.length}건)</h4>
                </div>
                <div className="border rounded-lg overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead className="w-[80px]">행 번호</TableHead>
                        <TableHead>원본 데이터</TableHead>
                        <TableHead>오류 내용</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseErrors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs">{error.row}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                            {error.rawData}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {error.errors.map((err, idx) => (
                                <Badge key={idx} variant="destructive" className="text-xs">
                                  {err}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleReset}>
                취소
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || parsedData.length === 0}
              >
                {loading ? "저장 중..." : `${parsedData.length}건 저장`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Result */}
        {step === "result" && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold mb-2">저장 완료</h3>
              <p className="text-muted-foreground">
                {parsedData.length}개의 구매내역이 성공적으로 저장되었습니다.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>닫기</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
