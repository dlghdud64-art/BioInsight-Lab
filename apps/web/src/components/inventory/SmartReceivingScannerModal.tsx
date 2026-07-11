"use client";

/**
 * §11.309d #smart-receiving-scanner-modal — 스마트 입고 카메라/갤러리 스캔 모달.
 *
 * 호영님 P0 spec (2026-05-26) — backend MVP Phase D:
 *   1. 사용자가 카메라/갤러리에서 거래명세서(명세서·PO) 이미지 선택
 *   2. POST /api/quotes/parse-image (§11.290 OCR pipeline) → ParsedQuoteDocument
 *   3. 추출 결과 form 표시 (모든 필드 사용자 수정 가능)
 *   4. [입고 등록] → POST /api/inventory/smart-receiving (§11.309c) → 신규 Product +
 *      ProductInventory + InventoryRestock create + 재고 갱신
 *   5. 성공 시 toast + close
 *
 * MVP scope:
 *   - 신규 등록 분기만 (inventoryId 안 보냄) — server side product 신규 create
 *   - 기존 매칭 분기 (catalog 검색 + fuzzy 후보 표시) 는 §11.309d-2 후속
 *   - 거래명세서 다수 품목 일괄 입고 는 §11.309e 후속
 *
 * 패턴 정합 (QuoteScannerModal §11.290 Phase 4c 복제):
 *   - Dialog + step state (upload / scanning / review / submitting / success / error)
 *   - file → base64 → /api/quotes/parse-image
 *   - ProviderBadge + ConfidenceBadge + CacheHitIndicator
 *
 * dead button 0 — 모든 CTA real handler wiring.
 * 호영님 §11.308a-v2 placeholder modal 의 실제 동작 swap 대상.
 */

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PACK_UNIT_OPTIONS, normalizePackUnit } from "@/lib/inventory/pack-unit-options";
import { toast } from "sonner";
import {
  ScanLine,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Camera,
  ArrowRight,
} from "lucide-react";
import type { QuoteParseResult, ParsedQuoteDocument } from "@/lib/ocr/gemini-quote-parser";
// §1-2/PLAN — 라벨 저신뢰 commit 게이트(rule 2: Lot·유효기간 신뢰도 무관 명시 확인).
import { evaluateLabelCommitGate } from "@/lib/ocr/label-commit-gate";

/* ── /api/quotes/parse-image response (QuoteScannerModal §11.290 패턴 정합) ── */
interface QuoteScanApiResponse extends QuoteParseResult {
  success: boolean;
  ocrMetadata?: {
    jobId: string | null;
    providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
    cached: boolean;
  } | null;
}

/* ── /api/inventory/smart-receiving response (§11.309c 정합) ── */
interface SmartReceivingApiResponse {
  inventoryId?: string;
  inventoryRestockId?: string;
  productId?: string;
  quantity?: number;
  isNew?: boolean;
  error?: string;
}

/* ── 사용자 확인 form state (Product + Restock 합쳐서 single form) ── */
interface ConfirmedFormState {
  productName: string;
  brand: string;
  catalogNumber: string;
  lotNumber: string;
  expirationDate: string;
  packSize: string;       // §11.326 통 1개 함량(규격). 입고 수량 아님.
  packUnit: string;
  receivedQuantity: number; // §11.326 받은 통/박스 개수.
  receivedUnit: string;
  storageCondition: string;
  notes: string;
}

const EMPTY_FORM: ConfirmedFormState = {
  productName: "",
  brand: "",
  catalogNumber: "",
  lotNumber: "",
  expirationDate: "",
  packSize: "",
  packUnit: "",
  receivedQuantity: 1,
  receivedUnit: "",
  storageCondition: "",
  notes: "",
};

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
        높은 신뢰도
      </Badge>
    );
  }
  if (level === "medium") {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">
        보통 신뢰도
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">
      낮은 신뢰도
    </Badge>
  );
}

function ProviderBadge({
  provider,
}: {
  provider: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
}) {
  const label =
    provider === "GEMINI"
      ? "Gemini"
      : provider === "CLOUD_VISION_CLAUDE"
        ? "Vision+Claude"
        : "정규식";
  return (
    <Badge
      className="bg-slate-100 text-slate-700 border-0 text-[10px]"
      data-testid="ocr-provider-badge"
    >
      {label}
    </Badge>
  );
}

function CacheHitIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <RotateCcw className="h-3 w-3" />
      캐시 적중
    </span>
  );
}

/** OCR 결과 ParsedQuoteDocument → form state initial 값 추출 (첫 번째 item 우선). */
function extractInitialForm(doc: ParsedQuoteDocument): ConfirmedFormState {
  const firstItem = doc.items[0];
  if (!firstItem) {
    return {
      ...EMPTY_FORM,
      brand: doc.vendor?.name ?? "",
    };
  }
  return {
    productName: firstItem.productName ?? "",
    brand: doc.vendor?.name ?? "",
    catalogNumber: firstItem.catalogNumber ?? "",
    lotNumber: "",
    expirationDate: doc.validUntil ?? "",
    packSize: "",
    packUnit: firstItem.unit ?? "",
    receivedQuantity: firstItem.quantity > 0 ? firstItem.quantity : 1,
    receivedUnit: firstItem.unit ?? "",
    storageCondition: "",
    notes: firstItem.notes ?? "",
  };
}

// §11.326 v3 — po-candidates-for-label 응답 후보(라벨↔미입고 발주 Order).
interface PoCandidate {
  orderId: string;
  orderNumber: string;
  status: string;
  expectedDelivery: string | null;
  vendorName: string | null;
  matchedItem: { name: string; catalogNumber: string | null; quantity: number };
  confidence: "catalog" | "name";
}

interface SmartReceivingScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** 입고 등록 성공 시 호출 — caller (Header / inventory) 가 React Query invalidate 등. */
  onReceivingRegistered?: (result: SmartReceivingApiResponse) => void;
  /** organizationId — 신규 ProductInventory 의 org 격리용 (caller 가 현재 org 주입). */
  organizationId?: string | null;
  /** §11.371-3 — GlobalModal/BaseModal 안에서 Dialog 래퍼 없이 콘텐츠만 렌더. */
  _renderContentOnly?: boolean;
}

type ScanStep = "upload" | "scanning" | "review" | "submitting" | "success" | "error";

export function SmartReceivingScannerModal({
  open,
  onClose,
  onReceivingRegistered,
  organizationId,
  _renderContentOnly,
}: SmartReceivingScannerModalProps) {
  const [step, setStep] = useState<ScanStep>("upload");
  const [scanResult, setScanResult] = useState<QuoteScanApiResponse | null>(null);
  const [form, setForm] = useState<ConfirmedFormState>(EMPTY_FORM);
  // §11.326 v3 — 라벨↔미입고 발주 매칭 후보 + 선택.
  const [poCandidates, setPoCandidates] = useState<PoCandidate[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // §11.375 (재설계) / §11.378 — 라이브 입고 경로 OCR 후단 게이트. 저신뢰도 OCR
  //   (키보드·잡동사니 사진 등) + 사용자 미보정이면 입고 등록 차단(재고 오염 방지).
  //   제품명 직접 수정 시 차단 해제(수동 보정 허용). LabelScannerModal §11.378 패턴 이식.
  const [productNameDirty, setProductNameDirty] = useState(false);
  // §1-2/PLAN rule 2 — Lot·유효기간 명시 확인(터치/수정) 추적. OCR 자동채움 자동수용 금지.
  //   웹 모달은 datamatrix 없음(verified false) → 사용자 확인이 유일 경로.
  const [lotConfirmed, setLotConfirmed] = useState(false);
  const [expiryConfirmed, setExpiryConfirmed] = useState(false);
  // §scan-cat-guard — Cat.No. 없이 신규 등록 override(기본 false = 보류).
  const [ackNewWithoutCat, setAckNewWithoutCat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setScanResult(null);
    setForm(EMPTY_FORM);
    setErrorMessage(null);
    setPoCandidates([]);
    setSelectedOrderId(null);
    setProductNameDirty(false);
    setLotConfirmed(false);
    setExpiryConfirmed(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // §11.326 v3 — 라벨로 식별한 품목과 매칭되는 미입고 발주(Order) 후보 조회.
  const fetchPoCandidates = async (catalogNumber: string, productName: string) => {
    if (!catalogNumber.trim() && !productName.trim()) { setPoCandidates([]); return; }
    setCandidatesLoading(true);
    try {
      const params = new URLSearchParams();
      if (catalogNumber.trim()) params.set("catalogNumber", catalogNumber.trim());
      if (productName.trim()) params.set("productName", productName.trim());
      const res = await csrfFetch(`/api/inventory/po-candidates-for-label?${params.toString()}`);
      const data = await res.json();
      setPoCandidates(res.ok && Array.isArray(data.candidates) ? data.candidates : []);
    } catch {
      setPoCandidates([]);
    } finally {
      setCandidatesLoading(false);
    }
  };

  // 발주 선택 시 받은 통 개수를 발주 수량으로 prefill (전량 입고 기준).
  const handleSelectCandidate = (c: PoCandidate) => {
    setSelectedOrderId((prev) => (prev === c.orderId ? null : c.orderId));
    setForm((f) => ({ ...f, receivedQuantity: c.matchedItem.quantity }));
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStep("scanning");
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const response = await csrfFetch("/api/quotes/parse-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const data: QuoteScanApiResponse = await response.json();
          if (!response.ok || !data.success) {
            throw new Error((data as { error?: string })?.error || "거래명세서 파싱 실패");
          }
          const _initForm = extractInitialForm(data.parsed);
          setScanResult(data);
          setForm(_initForm);
          setStep("review");
          void fetchPoCandidates(_initForm.catalogNumber, _initForm.productName);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "거래명세서 파싱 중 오류 발생";
          setErrorMessage(msg);
          setStep("error");
        }
      };
      reader.onerror = () => {
        setErrorMessage("이미지 파일을 읽을 수 없습니다.");
        setStep("error");
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "거래명세서 파싱 중 오류 발생";
      setErrorMessage(msg);
      setStep("error");
    }
  };

  const handleSubmit = async () => {
    // §11.326 v3 — 발주 매핑 경로: 선택된 미입고 발주를 DELIVERED 처리
    //   → InventoryRestock 자동 생성(orders/[id] PATCH). ocrJobId 불필요.
    if (selectedOrderId) {
      setStep("submitting");
      try {
        const response = await csrfFetch(`/api/orders/${selectedOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DELIVERED", actualDelivery: new Date().toISOString() }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error || "발주 입고 처리에 실패했습니다.");
        }
        onReceivingRegistered?.({ isNew: false });
        toast.success("발주 입고 처리 완료");
        setStep("success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "발주 입고 처리 중 오류가 발생했습니다.";
        setErrorMessage(msg);
        setStep("error");
      }
      return;
    }
    if (!scanResult?.ocrMetadata?.jobId) {
      setErrorMessage("이미지 분석 결과를 찾을 수 없습니다. 다시 스캔해 주세요.");
      setStep("error");
      return;
    }
    // §11.375 OCR 후단 게이트 — 저신뢰도(키보드·잡동사니 등 추출 실패) + 미보정 시 입고 차단.
    //   제품명 수동 수정(productNameDirty) 시 해제. 재고 오염 방지(fake success 차단).
    if (scanResult.confidence === "low" && !productNameDirty) {
      toast.error("라벨 인식 신뢰도가 낮습니다. 제품명을 확인·수정한 뒤 다시 시도해 주세요.");
      return;
    }
    // §1-2/PLAN rule 2 — Lot·유효기간은 신뢰도 무관 명시 확인(터치/수정) 후에만 commit.
    //   OCR 자동채움 자동수용 금지(재고 오염 방지). datamatrix 없는 웹은 확인이 유일 경로.
    {
      const gate = evaluateLabelCommitGate({
        confidence: scanResult.confidence,
        present: {
          lot: form.lotNumber.trim() !== "",
          expiry: form.expirationDate.trim() !== "",
        },
        criticalConfirmed: { lot: lotConfirmed, expiry: expiryConfirmed },
        verified: { lot: false, expiry: false },
        reviewed: productNameDirty,
      });
      if (
        gate.blockers.includes("lot-unconfirmed") ||
        gate.blockers.includes("expiry-unconfirmed")
      ) {
        toast.error("Lot 번호·유효기한을 확인(터치/수정)한 뒤 입고 등록할 수 있습니다.");
        return;
      }
    }
    if (!form.productName.trim()) {
      toast.error("품목명을 입력해 주세요.");
      return;
    }
    if (form.receivedQuantity <= 0) {
      toast.error("입고 수량(받은 통 개수)은 0보다 커야 합니다.");
      return;
    }
    // §scan-cat-guard — Cat.No.(식별키) 없이 신규 등록 확정 금지(중복·Lot추적 붕괴 방지). override 시 허용.
    if (!selectedOrderId && form.catalogNumber.trim() === "" && !ackNewWithoutCat) {
      toast.error("Cat.No.(식별 정보)가 없어 신규 등록을 확정할 수 없습니다 — Cat.No.를 입력하거나 확인 후 진행하세요.");
      return;
    }

    setStep("submitting");
    try {
      const response = await csrfFetch("/api/inventory/smart-receiving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocrJobId: scanResult.ocrMetadata.jobId,
          organizationId: organizationId ?? null,
          confirmedData: {
            productName: form.productName.trim(),
            brand: form.brand.trim() || null,
            catalogNumber: form.catalogNumber.trim() || null,
            lotNumber: form.lotNumber.trim() || null,
            expirationDate: form.expirationDate || null,
            quantity: form.receivedQuantity,
            unit: form.receivedUnit.trim() || null,
            packSize: form.packSize.trim() ? Number(form.packSize) : null,
            packUnit: form.packUnit.trim() || null,
            storageCondition: form.storageCondition.trim() || null,
            notes: form.notes.trim() || null,
          },
          // §scan-cat-guard — Cat.No. 없이 신규 등록 override 전달(서버 방어).
          allowMissingCatalog: ackNewWithoutCat,
        }),
      });
      const data: SmartReceivingApiResponse = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "입고 등록 실패");
      }
      onReceivingRegistered?.(data);
      toast.success(
        data.isNew ? "신규 품목 입고 등록 완료" : "기존 재고 입고 추가 완료",
      );
      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "입고 등록 중 오류 발생";
      setErrorMessage(msg);
      setStep("error");
    }
  };

  // §1-2/PLAN rule 1~3 — OCR 경로(발주매핑 제외)의 commit 게이트.
  //   웹 모달은 datamatrix 없음 → verified false. Lot·유효기간은 터치/수정(확인) 전 commit 차단.
  const commitGate = evaluateLabelCommitGate({
    confidence: scanResult?.confidence ?? "high",
    present: {
      lot: form.lotNumber.trim() !== "",
      expiry: form.expirationDate.trim() !== "",
    },
    criticalConfirmed: { lot: lotConfirmed, expiry: expiryConfirmed },
    verified: { lot: false, expiry: false },
    reviewed: productNameDirty,
  });
  // 발주매핑(selectedOrderId)은 OCR 무관 → 게이트 제외(우회 아님).
  const criticalUnconfirmed =
    !selectedOrderId &&
    (commitGate.blockers.includes("lot-unconfirmed") ||
      commitGate.blockers.includes("expiry-unconfirmed"));

  const body = (
    <>
        {/* ── Step: upload ── */}
        {step === "upload" && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              거래명세서(명세서·PO)를 촬영하거나 선택해 주세요. 다품목도 자동 인식됩니다.
            </p>
            <Button
              type="button"
              data-testid="smart-receiving-upload-cta"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-12 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <Camera className="h-4 w-4 mr-2" />
              사진 선택 / 촬영
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-[10px] text-slate-400 text-center">
              스캔 후 모든 항목을 수정할 수 있습니다.
            </p>
          </div>
        )}

        {/* ── Step: scanning ── */}
        {step === "scanning" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">AI 가 이미지를 분석 중입니다...</p>
            <p className="text-xs text-slate-500">3~5초 소요됩니다.</p>
          </div>
        )}

        {/* ── Step: review (사용자 확인 form) ── */}
        {step === "review" && scanResult && (
          <div className="space-y-4 py-2">
            {/* §11.326 v3 — 미입고 발주 매칭 후보 */}
            {(candidatesLoading || poCandidates.length > 0) && (
              <div className="space-y-2" data-testid="srm-po-candidates">
                <h4 className="text-xs font-bold text-slate-700">
                  매칭된 발주{poCandidates.length > 0 ? ` · ${poCandidates.length}건` : ""}
                </h4>
                {candidatesLoading && (
                  <p className="text-[11px] text-slate-400">발주 내역을 확인하는 중…</p>
                )}
                {!candidatesLoading && poCandidates.map((c) => {
                  const selected = selectedOrderId === c.orderId;
                  return (
                    <button
                      key={c.orderId}
                      type="button"
                      data-testid="srm-po-candidate-item"
                      onClick={() => handleSelectCandidate(c)}
                      className={`w-full text-left rounded-lg border p-2.5 transition ${selected ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900">{c.matchedItem.name}</span>
                        <span className="text-[10px] text-slate-500">{c.orderNumber}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span>발주 수량 {c.matchedItem.quantity}</span>
                        {c.vendorName && <span>· {c.vendorName}</span>}
                        {selected && <span className="text-emerald-600 font-semibold">· 선택됨</span>}
                      </div>
                    </button>
                  );
                })}
                {!candidatesLoading && poCandidates.length > 0 && (
                  <button
                    type="button"
                    data-testid="srm-po-candidate-none"
                    onClick={() => setSelectedOrderId(null)}
                    className={`w-full text-left rounded-lg border p-2 text-[11px] transition ${selectedOrderId === null ? "border-slate-400 bg-slate-50 text-slate-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    매칭되는 발주 없음 · 새 품목으로 등록
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <ConfidenceBadge level={scanResult.confidence} />
              {scanResult.ocrMetadata?.providerUsed && (
                <ProviderBadge provider={scanResult.ocrMetadata.providerUsed} />
              )}
              {scanResult.ocrMetadata?.cached && <CacheHitIndicator />}
              <span className="text-[10px] text-slate-500">
                {scanResult.itemCount} 품목 인식
              </span>
            </div>

            <div className="space-y-3 bg-slate-50/60 rounded-lg p-3 border border-slate-200">
              <div>
                <Label htmlFor="srm-productName" className="text-xs font-semibold">
                  품목명 <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="srm-productName"
                  value={form.productName}
                  onChange={(e) => {
                    setForm({ ...form, productName: e.target.value });
                    setProductNameDirty(true); // §11.375 — 수동 보정 시 저신뢰도 게이트 해제
                  }}
                  placeholder="예: Trypsin-EDTA 0.25% 100ml"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-brand" className="text-xs font-semibold">제조사</Label>
                  <Input
                    id="srm-brand"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Thermo Fisher"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="srm-catalogNumber" className="text-xs font-semibold">Cat.No</Label>
                  <Input
                    id="srm-catalogNumber"
                    value={form.catalogNumber}
                    onChange={(e) => setForm({ ...form, catalogNumber: e.target.value })}
                    placeholder="25200-056"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-lotNumber" className="text-xs font-semibold">
                    LOT 번호
                    {commitGate.fieldMarks.lot === "needs-confirm" && (
                      <span className="ml-1 text-[10px] font-medium text-red-600">· 확인 필요</span>
                    )}
                  </Label>
                  <Input
                    id="srm-lotNumber"
                    value={form.lotNumber}
                    onChange={(e) => {
                      setForm({ ...form, lotNumber: e.target.value });
                      setLotConfirmed(true); // §1-2/PLAN rule 2 — 터치/수정 = 명시 확인
                    }}
                    placeholder="2587934"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="srm-expirationDate" className="text-xs font-semibold">
                    유효기한
                    {commitGate.fieldMarks.expiry === "needs-confirm" && (
                      <span className="ml-1 text-[10px] font-medium text-red-600">· 확인 필요</span>
                    )}
                  </Label>
                  <Input
                    id="srm-expirationDate"
                    type="text"
                    value={form.expirationDate}
                    onChange={(e) => {
                      setForm({ ...form, expirationDate: e.target.value });
                      setExpiryConfirmed(true); // §1-2/PLAN rule 2 — 터치/수정 = 명시 확인
                    }}
                    placeholder="2026-12-31"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              </div>

              {/* §11.326 — 규격(통 1개 함량). 입고 수량 아님. */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-packSize" className="text-xs font-semibold">규격 (통 1개 함량)</Label>
                  <Input id="srm-packSize" type="number" min={0}
                    value={form.packSize}
                    onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                    placeholder="예: 100" className="mt-1 h-9 text-sm" />
                  <p className="text-[10px] text-slate-400 mt-0.5">라벨의 통 1개 용량 (입고 수량 아님)</p>
                </div>
                <div>
                  <Label htmlFor="srm-packUnit" className="text-xs font-semibold">함량 단위</Label>
                  <Select value={normalizePackUnit(form.packUnit)} onValueChange={(v) => setForm({ ...form, packUnit: v })}>
                    <SelectTrigger id="srm-packUnit" className="mt-1 h-9 text-sm"><SelectValue placeholder="단위 선택" /></SelectTrigger>
                    <SelectContent>
                      {PACK_UNIT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* §11.326 — 입고 정보(받은 통 개수). */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="srm-receivedQuantity" className="text-xs font-semibold">
                    입고 수량 (받은 통 개수) <span className="text-rose-600">*</span>
                  </Label>
                  <Input id="srm-receivedQuantity" type="number" min={1}
                    value={form.receivedQuantity}
                    onChange={(e) => setForm({ ...form, receivedQuantity: Number(e.target.value) || 0 })}
                    className="mt-1 h-9 text-sm" />
                  <p className="text-[10px] text-slate-400 mt-0.5">거래명세서를 확인하고 받은 통/박스 개수</p>
                </div>
                <div>
                  <Label htmlFor="srm-receivedUnit" className="text-xs font-semibold">입고 단위</Label>
                  <Input id="srm-receivedUnit"
                    value={form.receivedUnit}
                    onChange={(e) => setForm({ ...form, receivedUnit: e.target.value })}
                    placeholder="통 / 박스" className="mt-1 h-9 text-sm" />
                </div>
              </div>

              <div>
                <Label htmlFor="srm-storageCondition" className="text-xs font-semibold">보관 조건</Label>
                <Input
                  id="srm-storageCondition"
                  value={form.storageCondition}
                  onChange={(e) => setForm({ ...form, storageCondition: e.target.value })}
                  placeholder="-20°C 냉동 보관"
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="srm-notes" className="text-xs font-semibold">비고</Label>
                <Input
                  id="srm-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="추가 메모 (선택)"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            {/* §11.375 OCR 후단 게이트 — 저신뢰도 + 미보정 시 입고 차단 사유 노출(no-op 금지). */}
            {!selectedOrderId &&
              scanResult?.confidence === "low" &&
              !productNameDirty && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  라벨 인식 신뢰도가 낮습니다. 라벨이 맞는지 확인하고 제품명을 수정한 뒤
                  입고 등록할 수 있습니다. (재고 오염 방지)
                </div>
              )}
            {/* §1-2/PLAN rule 2 — Lot·유효기간 미확인 시 저장 차단 사유(no-op 금지). */}
            {criticalUnconfirmed && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                Lot 번호·유효기한을 확인(터치/수정)해 주세요. 자동 인식값은 확인 후 입고됩니다. (재고 오염 방지)
              </div>
            )}
            {/* §scan-cat-guard — Cat.No. 미추출 시 신규 확정 보류(중복 등록·GMP Lot 추적 붕괴 방지). */}
            {!selectedOrderId && form.catalogNumber.trim() === "" && (
              <div className="rounded-lg border border-[#f3d4bf] bg-[#fdf3ec] px-3 py-2.5 space-y-2">
                <p className="text-[11px] font-semibold text-[#b45821]">식별 정보(Cat.No.) 부족 — 신규 여부를 확정할 수 없습니다. Cat.No.를 입력하면 중복 등록을 막을 수 있어요.</p>
                <label className="flex items-center gap-2 text-[11px] font-medium text-[#b45821] cursor-pointer">
                  <input type="checkbox" checked={ackNewWithoutCat} onChange={(e) => setAckNewWithoutCat(e.target.checked)} className="h-3.5 w-3.5 rounded border-[#f3d4bf]" />
                  식별 정보 없이 신규로 등록(중복 위험 확인함)
                </label>
              </div>
            )}
            <div className="space-y-2 pt-1">
              <Button
                type="button"
                data-testid="smart-receiving-submit-cta"
                onClick={handleSubmit}
                disabled={
                  (!selectedOrderId &&
                    scanResult?.confidence === "low" &&
                    !productNameDirty) ||
                  criticalUnconfirmed ||
                  // §scan-cat-guard — Cat.No. 없이 신규 등록 확정 차단(override 전).
                  (!selectedOrderId && form.catalogNumber.trim() === "" && !ackNewWithoutCat)
                }
                className="w-full h-11 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedOrderId ? "발주 입고 처리" : "입고 등록"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="w-full h-9 text-xs text-slate-600 border-slate-200"
              >
                다시 스캔
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: submitting ── */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-700">입고 등록 중...</p>
          </div>
        )}

        {/* ── Step: success ── */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            <p className="text-base font-semibold text-slate-900">입고 등록 완료</p>
            <p className="text-xs text-slate-500">재고가 자동으로 갱신되었습니다.</p>
            <Button
              type="button"
              data-testid="smart-receiving-success-close"
              onClick={handleClose}
              className="mt-2 h-10 text-sm bg-slate-900 hover:bg-slate-800 text-white"
            >
              닫기
            </Button>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3 px-4">
            <AlertTriangle className="h-10 w-10 text-rose-600" />
            <p className="text-sm font-semibold text-slate-900">오류 발생</p>
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              {errorMessage ?? "알 수 없는 오류"}
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="h-9 text-xs"
              >
                다시 시도
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                className="h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white"
              >
                닫기
              </Button>
            </div>
          </div>
        )}
    </>
  );

  if (_renderContentOnly) {
    return (
      <div
        className="max-h-[80vh] overflow-y-auto"
        data-testid="smart-receiving-scanner-content"
      >
        {body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent
        className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="smart-receiving-scanner-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5 text-emerald-600" />
            스마트 입고
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            거래명세서(명세서·PO)를 촬영하면 AI 가 자동으로 품목·수량·LOT을 인식해 입고를 처리합니다.
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* Content-only export (GlobalModal 통합용, §11.371-3)             */
/* ══════════════════════════════════════════════════════════════ */

/** BaseModal 내부에 렌더링되는 순수 콘텐츠. GlobalModal registry(scan_hub→smart_receiving)에서 사용. */
export function SmartReceivingContent({
  onClose,
  organizationId,
}: {
  onClose?: () => void;
  organizationId?: string | null;
}) {
  const queryClient = useQueryClient();
  return (
    <SmartReceivingScannerModal
      open={true}
      onClose={() => onClose?.()}
      organizationId={organizationId ?? null}
      onReceivingRegistered={() => {
        queryClient.invalidateQueries({ queryKey: ["inventories"] });
        queryClient.invalidateQueries({ queryKey: ["team-inventory"] });
      }}
      _renderContentOnly
    />
  );
}
