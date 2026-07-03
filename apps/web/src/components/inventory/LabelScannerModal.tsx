"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { csrfFetch } from "@/lib/api-client";
import { getRearCameraStream } from "@/lib/utils/get-rear-camera-stream";
// §11.326 — 라벨 용량(packSize) vs 입고 수량(받은 통 개수) 분리 매핑.
import { mapLabelToReceiving } from "@/lib/inventory/map-label-to-receiving";
// §11.371-3 — 글로벌 스캔 허브 진입 시 onDirectReceive 미주입이어도 라벨 직접등록 보장.
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { submitLabelReceive } from "@/lib/inventory/submit-label-receive";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera, ScanLine, Type, CheckCircle2, AlertTriangle,
  Loader2, ChevronRight, RotateCcw, Package, FlaskConical,
  X, Sparkles, Upload, FileText,
} from "lucide-react";
import type { LabelParseResult } from "@/lib/ocr/label-parser";
// §1-2/PLAN — 라벨 저신뢰 commit 게이트(rule 2: Lot·유효기간 신뢰도 무관 명시 확인).
import { evaluateLabelCommitGate } from "@/lib/ocr/label-commit-gate";
import { isFieldVerified } from "@/lib/ocr/merge-gs1-ocr";
// §11.319 — capture-quality 휴리스틱(흐림/조명 게이트) + OCR 신뢰도 매핑.
//   라이브 프레임 품질 평가는 웹 전용(canvas getImageData 픽셀 접근 가능).
import {
  assessFrameQuality,
  mapOcrConfidence,
  type FrameQuality,
} from "@/lib/ocr/capture-quality";
// §11.253b-1 — RelativeTimeText hydration-safe helper reuse (§11.212 lineage)
//   "X분 전" / "X시간 전" 표시 — conflict banner 시간 정보 ⑤.
import { RelativeTimeText } from "@/components/ui/relative-time-text";
// §11.253b-3 — 본인 다른 탭 detection (case 1). BroadcastChannel 으로 같은
//   origin 의 다른 탭이 동일 productId/lotNumber 작업 중인지 감지. backend 0.
import { useInventoryEditBroadcast } from "@/hooks/use-inventory-edit-broadcast";
// §11.374 — 인앱 스캔 공통 가이드 프레임(라벨/QR 통일)
import { ScanGuideFrame } from "./ScanGuideFrame";
// §scan-multi-capture-merge (호영님 2026-06-30) — 다장 캡처 fill-empty 병합(catalogNo 누적 보완).
import { mergeFormData } from "@/lib/inventory/scan-form-merge";

// §11.382 — 정지 이미지(data URI)에서 datamatrix/QR 디코드(@zxing/browser).
//   성공 → raw GS1 string(서버 parseGs1 single impl 으로 전달). 실패/없음 → null(Gemini fallback).
//   ⚠️ parseGs1 클라 복제 금지 — 여기선 raw string 만 추출.
async function decodeDatamatrixFromImage(dataUri: string): Promise<string | null> {
  try {
    const [{ BrowserMultiFormatReader }, zxing] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map();
    hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
      zxing.BarcodeFormat.DATA_MATRIX,
      zxing.BarcodeFormat.QR_CODE,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    const result = await reader.decodeFromImageUrl(dataUri);
    const t = result?.getText?.() ?? null;
    return t && t.trim() ? t.trim() : null;
  } catch {
    return null; // datamatrix 없음/디코드 실패 → 서버 Gemini fallback
  }
}

/* ── 타입 ── */
interface ScanApiResponse {
  success: boolean;
  parsed: LabelParseResult;
  matchedProduct: { id: string; name: string; brand: string | null; catalogNumber: string | null } | null;
  // §11.253b-1 — matchedInventory shape 확장: updatedAt (시간 정보 ⑤) +
  //   user.name (행위자 ③). RelativeTimeText 가 ISO string 받으므로 updatedAt
  //   string serialized (Date → JSON.stringify Date → ISO string).
  matchedInventory: {
    id: string;
    lotNumber: string | null;
    currentQuantity: number;
    unit: string | null;
    updatedAt: string;
    user: { name: string | null } | null;
  } | null;
  // §scan-secondary-match — catalogNo 미매칭 시 name+brand fuzzy 후보(승인형, 자동확정 X).
  matchType?: "fuzzy_name" | null;
  productCandidates?: { id: string; name: string; brand: string | null; catalogNumber: string | null; confidence?: number; level?: "high" | "medium" | "low"; basis?: string }[];
  // §11.290 Phase 4b — OCR pipeline metadata (provider / cache / jobId).
  // null = regex fallback path (text-only input, image 미사용).
  ocrMetadata?: {
    jobId: string | null;
    providerUsed: "GEMINI" | "CLOUD_VISION_CLAUDE" | "REGEX";
    cached: boolean;
  } | null;
  // §11.382 — source-based 마킹(P4 verified 표시). datamatrix=gs1, OCR=ocr.
  fieldSources?: { lotNo: "gs1" | "ocr" | null; expirationDate: "gs1" | "ocr" | null; catalogNo: "gs1" | "ocr" | null };
  fieldConflicts?: { lotNo: boolean; expirationDate: boolean };
  gtin?: string | null;
  suggestions: {
    isNewProduct: boolean;
    isNewLot: boolean;
    isExistingLot: boolean;
    // §scan-cat-guard — Cat.No. 미추출 시 true(신규 확정 보류 신호).
    catalogMissing?: boolean;
    action: "restock" | "new_lot" | "new_product" | "identify_required";
  };
}

/** 편집 가능한 추출 데이터 폼 */
export interface SmartReceiveFormData {
  productName: string;
  catalogNumber: string;
  lotNumber: string;
  expirationDate: string;
  // §11.326 — 라벨 규격(통 1개 함량). 입고 수량 아님.
  packSize: string;
  packUnit: string;
  // §11.326 — 입고 정보(사용자 입력). 받은 통/박스 개수.
  receivedQuantity: string;
  receivedUnit: string;
  brand: string;
  casNumber: string;
  // §scan-cat-guard — Cat.No. 없이 신규 등록 명시적 override(서버 방어 우회 승인 전달).
  allowMissingCatalog?: boolean;
}

interface LabelScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 스캔 결과를 입고 폼에 전달할 콜백 (기존 호환) */
  onScanComplete?: (result: ScanApiResponse) => void;
  /** §11.315-b — 스마트 재고 등록: 모달 내에서 직접 등록 완료 콜백 (라벨 OCR → 재고 직접 추가, PO 없음). */
  onDirectReceive?: (data: SmartReceiveFormData, scanResult: ScanApiResponse | null) => void;
}

type ScanStep = "upload" | "scanning" | "review";

/* ── 모바일 판별 ── */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(window.innerWidth < 768);
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

/* ── 신뢰도 뱃지 ── */
function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  if (level === "high") return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">높은 신뢰도</Badge>;
  if (level === "medium") return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">보통 신뢰도</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">낮은 신뢰도</Badge>;
}

/* ── §11.290 Phase 4b — OCR Provider 뱃지 ──
 *  multi-provider fallback 결과 시각화. GEMINI (Tier 1 primary) /
 *  CLOUD_VISION_CLAUDE (Tier 2 fallback) / REGEX (Tier 3 fallback).
 *  STORAGE_PROVIDER 미설정 (현재 production) 시 GEMINI 기본값.
 */
/* §scan-card-declutter (호영님 2026-06-30) — ProviderBadge(provider/fallback) removed: internal observability, not user-facing. §11.290 Phase 4b supersede. */

/* ── §11.290 Phase 4b — Cache Hit 표시 ──
 *  imageHash 기반 cache lookup 적중 시 API 호출 0. 비용 절감 + UX 개선.
 *  Phase 1 schema OcrJob.imageHash @@index + Phase 2 findCachedOcrJob 활용.
 */
/* §scan-card-declutter — CacheHitIndicator removed: internal observability. */

/* ── 스캔 애니메이션 CSS ── */
const scanAnimationStyle = `
@keyframes scanLine {
  0% { top: 0%; }
  50% { top: 85%; }
  100% { top: 0%; }
}
`;

/* ── 빈 폼 데이터 ── */
function emptyFormData(): SmartReceiveFormData {
  return { productName: "", catalogNumber: "", lotNumber: "", expirationDate: "", packSize: "", packUnit: "", receivedQuantity: "1", receivedUnit: "통", brand: "", casNumber: "" };
}

/* ══════════════════════════════════════════════════════════════ */
/* Content-only export (GlobalModal 통합용)                        */
/* ══════════════════════════════════════════════════════════════ */

/** BaseModal 내부에 렌더링되는 순수 콘텐츠. GlobalModal registry에서 사용. */
export function LabelScannerContent({
  onClose,
  onScanComplete,
  onDirectReceive,
}: {
  onClose?: () => void;
  onScanComplete?: (result: ScanApiResponse) => void;
  onDirectReceive?: (data: SmartReceiveFormData, scanResult: ScanApiResponse | null) => void;
}) {
  const queryClient = useQueryClient();
  // §11.371-3 — 글로벌 스캔 허브에서 caller 가 onDirectReceive 를 주지 않아도
  //   라벨 직접등록(공유 helper /api/inventory)이 동작하도록 기본 핸들러 주입.
  //   front-only success 금지: helper 가 200 반환(ok)일 때만 성공 토스트 + close.
  const directReceive =
    onDirectReceive ??
    (async (data: SmartReceiveFormData) => {
      const r = await submitLabelReceive(data, queryClient);
      if (r.ok) {
        toast.success(`${r.productName} ${r.receivedQuantity}${r.receivedUnit} 입고 처리되었습니다.`);
        onClose?.();
      } else {
        toast.error("입고 처리 중 오류가 발생했습니다.");
      }
    });
  return (
    <LabelScannerModal
      open={true}
      onOpenChange={(v) => { if (!v && onClose) onClose(); }}
      onScanComplete={onScanComplete}
      onDirectReceive={directReceive}
      _renderContentOnly
    />
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* 메인 컴포넌트 (기존 호환 유지)                                    */
/* ══════════════════════════════════════════════════════════════ */
export function LabelScannerModal({ open, onOpenChange, onScanComplete, onDirectReceive, _renderContentOnly }: LabelScannerModalProps & { _renderContentOnly?: boolean }) {
  const isMobile = useIsMobile();
  // §11.37x — 맥락 분기: onDirectReceive 없음 = 검색(소싱 read) 맥락, 있음 = 입고(재고 mutation) 맥락.
  //   소싱에서 라벨 스캔 시 "스마트 입고" 타이틀/CTA 가 뜨던 conflation 제거(라벨=검색 명확).
  const isSearchContext = !onDirectReceive;
  const scanTitle = isSearchContext ? "라벨 스캔 검색" : "스마트 입고";
  const [step, setStep] = useState<ScanStep>("upload");
  const [scanResult, setScanResult] = useState<ScanApiResponse | null>(null);
  // §11.382 P4 — GS1 datamatrix 필드 verified(확인필요 면제, label-commit-gate rule 3).
  //   source gs1 + 불일치 없음만. OCR(vision-guess)/conflict 는 verified 아님(터치 강제 유지).
  const lotVerified = isFieldVerified(scanResult?.fieldSources?.lotNo ?? null, scanResult?.fieldConflicts?.lotNo ?? false);
  const expiryVerified = isFieldVerified(scanResult?.fieldSources?.expirationDate ?? null, scanResult?.fieldConflicts?.expirationDate ?? false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // §scan-card-polish (호영님 2026-06-30) — 스캔 이미지 클릭 확대(zoom overlay).
  const [imageZoomed, setImageZoomed] = useState(false);
  // §pubchem-enrich (호영님 2026-06-30) — Tier 2 substance 보강(승인형). canonical(db.product) 무접촉.
  const [enrichment, setEnrichment] = useState<{ source: string; canonicalName: string; iupacName: string | null; molecularFormula: string | null; synonyms: string[] } | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  // §scan-synonym-bridge (호영님 2026-06-30) — PubChem 동의어 기반 후보(reverse-match 0일 때 fallback). canonical 무접촉.
  const [synonymCandidates, setSynonymCandidates] = useState<{ id: string; name: string; brand: string | null; catalogNumber: string | null; confidence?: number; level?: "high" | "medium" | "low"; basis?: string }[]>([]);
  // scanResult 세팅 후 CAS/제품명으로 PubChem 비동기 조회(미매칭일 때만, best-effort). 실패/무결과 → null.
  useEffect(() => {
    setEnrichment(null);
    setSynonymCandidates([]);
    const cas = scanResult?.parsed?.casNumber?.trim();
    const nm = scanResult?.parsed?.productName?.trim();
    if (!scanResult || scanResult.matchedProduct || (!cas && !nm)) return;
    let cancelled = false;
    setEnrichLoading(true);
    const qs = new URLSearchParams();
    if (cas) qs.set("cas", cas);
    if (nm) qs.set("name", nm);
    csrfFetch(`/api/catalog/enrich?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setEnrichment(d?.enrichment ?? null); setSynonymCandidates(d?.synonymCandidates ?? []); } })
      .catch(() => { if (!cancelled) { setEnrichment(null); setSynonymCandidates([]); } })
      .finally(() => { if (!cancelled) setEnrichLoading(false); });
    return () => { cancelled = true; };
  }, [scanResult]);
  const [formData, setFormData] = useState<SmartReceiveFormData>(emptyFormData());
  // §scan-cat-guard — Cat.No. 없이 신규 등록 강행 override(기본 false = 보류).
  const [ackNewWithoutCat, setAckNewWithoutCat] = useState(false);
  // §11.340 — Lot/유효기한 출처 추적. 라벨 스캔으로 채워졌고(scanFilled) 사용자가
  //   수정 안 했으면 "라벨 스캔 확인", 수정했거나 수기 입력이면 "수기 입력"(§11.335 출처 정책).
  const [lotScanFilled, setLotScanFilled] = useState(false);
  const [expiryScanFilled, setExpiryScanFilled] = useState(false);
  const [lotDirty, setLotDirty] = useState(false);
  const [expiryDirty, setExpiryDirty] = useState(false);
  // §11.378 — 제품명 사용자 수정 추적. OCR 저신뢰도 시 미보정이면 입고 완료 차단,
  //   사용자가 제품명을 직접 수정(보정)하면 차단 해제(무효 통과 = fake success 방지).
  const [productNameDirty, setProductNameDirty] = useState(false);
  // §scan-multi-capture-merge — 누적 촬영 횟수 + 다음 스캔 병합 의도(ref, closure 무영향).
  const [scanCount, setScanCount] = useState(0);
  const mergeNextRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  // §11.253 — 충돌 경고 acknowledge state. matchedInventory 존재 (case 3: 이미
  // 등록된 Lot 중복) 시 conflict banner 노출. 사용자 [그래도 진행] click → ack=true
  // → banner hide. [취소] click → onOpenChange(false) 모달 닫기. scanResult 변경
  // (재스캔) 또는 모달 close 시 자동 reset.
  const [conflictAck, setConflictAck] = useState(false);
  // §11.253b-3 — 본인 다른 탭 detection (case 1). BroadcastChannel hook.
  // scanResult 가 matchedInventory 보유 시 broadcast 발화. 다른 탭에서 같은
  // productId/lotNumber 작업 중이면 otherTabActive=true → Info banner 노출.
  const { otherTabActive, broadcast: broadcastEdit, acknowledge: acknowledgeOtherTab } =
    useInventoryEditBroadcast();
  useEffect(() => {
    if (!open) return;
    const matched = scanResult?.matchedInventory;
    const product = scanResult?.matchedProduct;
    if (!matched || !product) return;
    broadcastEdit(product.id, matched.lotNumber);
  }, [open, scanResult, broadcastEdit]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── §11.319 라이브 카메라 + capture-quality 게이트 ──
   *  A안: 카메라/파일 업로드 토글(default 카메라). 흐림/조명 휴리스틱이
   *  good=자동+수동+OCR / warn=수동+OCR(경고) / poor=차단+OCR 미호출("그래도 시도" 우회).
   *  자동 캡처 default off(수동). 파일피커/드래그드롭/텍스트 입력 경로 보존.
   */
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureRef = useRef<(force?: boolean) => void>(() => {});
  const autoCaptureRef = useRef(false);
  const qualityRef = useRef<FrameQuality | null>(null);
  const goodStreakRef = useRef(0);
  // §11.349 — 카메라 획득 직렬화. acquireGenRef=effect 세대, acquiringRef=직전
  //   획득 promise. deps 빠른 토글로 effect 가 중복 실행돼도 getRearCameraStream
  //   (getUserMedia 체인)이 동시 2회 in-flight 되지 않게 직전 획득을 await 한다.
  const acquireGenRef = useRef(0);
  const acquiringRef = useRef<Promise<void> | null>(null);
  const [uploadMode, setUploadMode] = useState<"camera" | "file">("camera");
  const [autoCapture, setAutoCapture] = useState(false);
  const [quality, setQuality] = useState<FrameQuality | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  useEffect(() => {
    autoCaptureRef.current = autoCapture;
  }, [autoCapture]);

  /* ── 리셋 ── */
  const resetState = useCallback(() => {
    setStep("upload");
    setScanResult(null);
    setScanCount(0);
    mergeNextRef.current = false;
    setError(null);
    setPreviewImage(null);
    setFormData(emptyFormData());
    setLotScanFilled(false); setExpiryScanFilled(false);
    setLotDirty(false); setExpiryDirty(false); setProductNameDirty(false);
    setIsDragOver(false);
    setManualMode(false);
    setManualText("");
    setConflictAck(false);
    setQuality(null);
    qualityRef.current = null;
    setCameraError(null);
    setUploadMode("camera");
    setAutoCapture(false);
  }, []);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  /* ── 폼 필드 변경 ── */
  const updateField = (key: keyof SmartReceiveFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // §11.340 — 사용자가 직접 수정 → 수기 출처로 전환.
    if (key === "lotNumber") setLotDirty(true);
    if (key === "expirationDate") setExpiryDirty(true);
    if (key === "productName") setProductNameDirty(true); // §11.378 — 저신뢰도 게이트 해제용
  };

  // §11.340 — 출처 배지 헬퍼. 스캔으로 채워졌고 미수정 = 검증값, 그 외 값 있으면 수기.
  const fieldSourceBadge = (
    value: string,
    scanFilled: boolean,
    dirty: boolean,
  ): { label: string; cls: string } | null => {
    if (scanFilled && !dirty) {
      return { label: "라벨 스캔 확인", cls: "bg-emerald-100 text-emerald-700" };
    }
    if (value.trim()) {
      return { label: "수기 입력", cls: "bg-slate-100 text-slate-600" };
    }
    return null;
  };

  /* ── ScanApiResponse → 편집 폼 데이터로 매핑 ── */
  const mapScanToForm = (data: ScanApiResponse): SmartReceiveFormData => ({
    productName: data.parsed.productName || data.matchedProduct?.name || "",
    catalogNumber: data.parsed.catalogNo || data.matchedProduct?.catalogNumber || "",
    lotNumber: data.parsed.lotNo || "",
    expirationDate: data.parsed.expirationDate || "",
    // §11.326 — 라벨 quantity 는 통 1개 함량(packSize). 입고 수량 아님.
    //   LabelParseResult 에 unit 필드 없음 → packUnit 은 사용자 편집(빈값 시작).
    packSize: data.parsed.quantity || "",
    packUnit: "",
    // 입고 수량(받은 통 개수)은 사용자 입력 — 라벨값 절대 사용 안 함. 기본 1.
    receivedQuantity: "1",
    receivedUnit: "통",
    brand: data.parsed.brand || data.matchedProduct?.brand || "",
    casNumber: data.parsed.casNumber || "",
  });

  /* ── base64(data URI) → scan-label API (파일/카메라 공통) ── */
  const runScan = useCallback(async (base64: string, merge = false) => {
    setPreviewImage(base64);
    setStep("scanning");
    setError(null);
    try {
      // §11.382 — datamatrix 클라 디코드 → raw GS1 을 서버로(결정적 Lot/EXP).
      const gs1Raw = await decodeDatamatrixFromImage(base64);
      const res = await csrfFetch("/api/inventory/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, ...(gs1Raw ? { gs1Raw } : {}) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "분석 실패");
      }
      const data: ScanApiResponse = await res.json();
      const incoming = mapScanToForm(data);
      // §scan-multi-capture-merge — merge 시 빈 필드만 채움(채워진/dirty 보존), 새 매칭이면 scanResult 채택.
      setScanResult((prev) => (!merge || data.matchedProduct || !prev ? data : prev));
      setFormData((prev) => (merge ? mergeFormData(prev, incoming) : incoming));
      setScanCount((c) => (merge ? c + 1 : 1));
      // §11.340 — Lot/유효기한 출처 기록(merge=OR 누적, 단일=교체).
      setLotScanFilled((prev) => (merge ? prev || Boolean(data.parsed.lotNo) : Boolean(data.parsed.lotNo)));
      setExpiryScanFilled((prev) => (merge ? prev || Boolean(data.parsed.expirationDate) : Boolean(data.parsed.expirationDate)));
      if (!merge) { setLotDirty(false); setExpiryDirty(false); }
      setStep("review");
    } catch (err) {
      console.error("[LabelScanner] Gemini parse error:", err);
      setError(err instanceof Error ? err.message : "라벨 분석 중 오류가 발생했습니다");
      setStep("upload");
    }
  }, []);

  /* ── 파일 → base64 → runScan ── */
  const processFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const m = mergeNextRef.current;
      mergeNextRef.current = false;
      await runScan(reader.result as string, m);
    };
    reader.readAsDataURL(file);
  };

  /* ── §11.319 라이브 카메라 lifecycle + 프레임 품질 분석 ── */
  useEffect(() => {
    if (!(open && step === "upload" && !manualMode && uploadMode === "camera")) {
      return;
    }
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const stopCamera = () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    };

    // good=수동+자동, warn=수동, poor=차단(force=true 우회 시에만 진행)
    const capture = (force = false) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (!force && qualityRef.current?.overall === "poor") return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      stopCamera();
      const mergeShot = mergeNextRef.current;
      mergeNextRef.current = false;
      void runScan(dataUrl, mergeShot);
    };
    captureRef.current = capture;

    const analyze = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const SW = 64;
      const SH = 64;
      let c = analysisCanvasRef.current;
      if (!c) {
        c = document.createElement("canvas");
        analysisCanvasRef.current = c;
      }
      c.width = SW;
      c.height = SH;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, SW, SH);
      const img = ctx.getImageData(0, 0, SW, SH);
      const lum = new Uint8Array(SW * SH);
      for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
        lum[p] =
          (0.299 * img.data[i] +
            0.587 * img.data[i + 1] +
            0.114 * img.data[i + 2]) |
          0;
      }
      const q = assessFrameQuality({ data: lum, width: SW, height: SH });
      qualityRef.current = q;
      setQuality(q);
      // 자동 캡처: good 이 연속 3프레임이면 트리거 (default off)
      if (autoCaptureRef.current && q.overall === "good") {
        goodStreakRef.current += 1;
        if (goodStreakRef.current >= 3) {
          goodStreakRef.current = 0;
          capture(false);
        }
      } else {
        goodStreakRef.current = 0;
      }
    };

    // §11.349 — 동시 in-flight 직렬화. 이 effect run 의 세대를 고정하고,
    //   직전 획득(prev)이 끝난 뒤에만 새 getRearCameraStream 을 발사한다.
    const myGen = ++acquireGenRef.current;
    const prev = acquiringRef.current;
    const superseded = () => cancelled || myGen !== acquireGenRef.current;

    const run = (async () => {
      // 직전 획득이 진행 중이면 settle 까지 대기 → getUserMedia 중첩 0.
      if (prev) {
        await prev.catch(() => {});
      }
      // 대기 사이 더 새로운 effect run 이 생겼으면 양보(획득 자체를 건너뜀).
      if (superseded()) return;
      try {
        // §11.355-C — 후면 카메라 4단계 fallback (exact→loose→enumerate→video).
        //   기존 environment 단일 시도는 후면 미획득/전면 강등 위험.
        stream = await getRearCameraStream();
      } catch {
        if (!superseded()) {
          setCameraError(
            "카메라를 사용할 수 없습니다. 파일 업로드로 진행하세요.",
          );
        }
        return;
      }
      // 획득 후 cancelled/superseded → 즉시 정리(이 stream 을 attach 하지 않음).
      if (superseded()) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
        return;
      }
      // §11.349 H2 — 4차 video:true 가 전면(facingMode "user") 으로 강등됐으면
      //   성공으로 위장하지 않는다. stream 정지 후 후면 미획득을 명시한다.
      const settings = stream.getVideoTracks()[0]?.getSettings();
      if (settings?.facingMode === "user") {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
        setCameraError(
          "후면 카메라를 찾지 못했습니다. 파일 업로드로 진행하세요.",
        );
        return;
      }
      setCameraError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      intervalId = setInterval(analyze, 400);
    })();
    acquiringRef.current = run;

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, step, manualMode, uploadMode, runScan]);

  /* ── 파일 선택/촬영 ── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  /* ── 드래그 & 드롭 ── */
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      await processFile(file);
    } else {
      setError("이미지 파일만 업로드할 수 있습니다.");
    }
  };

  /* ── 텍스트 수동 입력 → API ── */
  const submitManualText = async () => {
    if (!manualText.trim()) { setError("라벨 텍스트를 입력해주세요."); return; }
    setStep("scanning");
    setError(null);
    setPreviewImage(null);

    try {
      const res = await csrfFetch("/api/inventory/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: manualText.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "파싱 실패");
      }
      const data: ScanApiResponse = await res.json();
      setScanResult(data);
      setFormData(mapScanToForm(data));
      // §11.340 — 스캔 결과에 Lot/유효기한 있었는지 출처 기록(이후 수정 시 dirty 로 전환).
      setLotScanFilled(Boolean(data.parsed.lotNo));
      setExpiryScanFilled(Boolean(data.parsed.expirationDate));
      setLotDirty(false);
      setExpiryDirty(false);
      setStep("review");
    } catch (err) {
      console.error("[LabelScanner] Parse error:", err);
      setError(err instanceof Error ? err.message : "라벨 파싱 중 오류가 발생했습니다");
      setManualMode(true);
      setStep("upload");
    }
  };

  /* ── 입고 완료 (직접 처리) ── */
  const handleDirectReceive = () => {
    // §1-2/PLAN rule 2 — 직접 입고(commit) 시 Lot·유효기간 명시 확인(터치/수정) 강제.
    //   '입고 폼에 적용' 핸드오프(handleApplyToForm)는 받는 폼이 게이트 담당 → 여기 제외.
    const gate = evaluateLabelCommitGate({
      confidence: scanResult ? mapOcrConfidence(scanResult.parsed.confidence) : "high",
      present: {
        lot: formData.lotNumber.trim() !== "",
        expiry: formData.expirationDate.trim() !== "",
      },
      criticalConfirmed: { lot: lotDirty, expiry: expiryDirty },
      verified: { lot: lotVerified, expiry: expiryVerified },
      reviewed: productNameDirty,
    });
    if (
      gate.blockers.includes("lot-unconfirmed") ||
      gate.blockers.includes("expiry-unconfirmed")
    ) {
      toast.error("Lot 번호·유효기한을 확인(터치/수정)한 뒤 입고할 수 있습니다.");
      return;
    }
    // §scan-cat-guard — Cat.No.(식별키) 없이 신규 등록 확정 금지(중복·Lot추적 붕괴 방지). override 시 허용.
    if (onDirectReceive && scanResult && !scanResult.matchedProduct && formData.catalogNumber.trim() === "" && !ackNewWithoutCat) {
      toast.error("Cat.No.(식별 정보)가 없어 신규 등록을 확정할 수 없습니다 — Cat.No.를 입력하거나 기존 품목을 선택하세요.");
      return;
    }
    if (onDirectReceive) {
      // §scan-cat-guard — override(ackNewWithoutCat)를 서버 방어로 전달.
      onDirectReceive({ ...formData, allowMissingCatalog: ackNewWithoutCat }, scanResult);
    } else if (onScanComplete && scanResult) {
      onScanComplete(scanResult);
    }
    onOpenChange(false);
  };

  /* ── 기존 호환: 입고 폼에 적용 ── */
  const handleApplyToForm = () => {
    if (scanResult && onScanComplete) {
      onScanComplete(scanResult);
    }
    onOpenChange(false);
  };

  /* ═══════════════════════════════════════════════════════════ */
  /* 렌더링                                                      */
  /* ═══════════════════════════════════════════════════════════ */
  // §1-2/PLAN rule 1~3 — 직접 입고(commit) 경로 게이트. 폼 적용(handoff)은 제외.
  const commitGate = evaluateLabelCommitGate({
    confidence: scanResult ? mapOcrConfidence(scanResult.parsed.confidence) : "high",
    present: {
      lot: formData.lotNumber.trim() !== "",
      expiry: formData.expirationDate.trim() !== "",
    },
    criticalConfirmed: { lot: lotDirty, expiry: expiryDirty },
    verified: { lot: lotVerified, expiry: expiryVerified },
    reviewed: productNameDirty,
  });
  const criticalUnconfirmed =
    !!onDirectReceive &&
    (commitGate.blockers.includes("lot-unconfirmed") ||
      commitGate.blockers.includes("expiry-unconfirmed"));
  // §scan-cat-guard — 입고 맥락 + 신규(미매칭) + Cat.No. 공란 + override 미체크 → 등록 차단.
  const catIdentifyBlocked =
    !!onDirectReceive &&
    !!scanResult &&
    !scanResult.matchedProduct &&
    formData.catalogNumber.trim() === "" &&
    !ackNewWithoutCat;

  const content = (
    <div className="flex flex-col h-full">
      <style>{scanAnimationStyle}</style>

      {/* 히든 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* §11.319 캡처용 히든 canvas (라이브 프레임 → JPEG) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── 탭 인디케이터 ── */}
      <div className="flex border-b border-slate-200 px-4">
        <button
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            step === "upload" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
          }`}
          onClick={() => step !== "scanning" && setStep("upload")}
        >
          <Upload className="h-3.5 w-3.5" />
          이미지 업로드
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            step === "review" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"
          }`}
          disabled={step !== "review"}
        >
          <FileText className="h-3.5 w-3.5" />
          추출된 데이터 확인
        </button>
      </div>

      {/* ═══ Step 1: 업로드 (카메라 / 파일 업로드 토글) ═══ */}
      {step === "upload" && !manualMode && (
        <div className="flex-1 flex flex-col gap-3 p-3 min-h-0">
          {/* §11.374-vivino — 카메라 모드 시 제목/설명 숨김(헤더 chrome 축소 → video 세로 확보). */}
          {uploadMode === "file" && (
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">{scanTitle}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {isSearchContext
                  ? "라벨을 촬영하면 카탈로그에서 제품을 검색합니다."
                  : "라벨을 프레임 안에 맞춰 촬영하거나 이미지를 업로드하세요."}
              </p>
            </div>
          )}

          {/* 모드 토글 */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setUploadMode("camera")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadMode === "camera" ? "bg-white shadow-sm text-blue-600" : "text-slate-400"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              카메라
            </button>
            <button
              type="button"
              onClick={() => setUploadMode("file")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                uploadMode === "file" ? "bg-white shadow-sm text-blue-600" : "text-slate-400"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              파일 업로드
            </button>
          </div>

          {uploadMode === "camera" ? (
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              {cameraError ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
                  <p className="text-sm text-yellow-700">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => setUploadMode("file")}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    파일 업로드로 전환
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  {/* §11.374-vivino — 풀블리드 카메라: video 가 모달 가용 세로 전부 채움(flex-1).
                      헤더 chrome(제목 숨김·토글만) 축소 → video 최대화. 촬영 컨트롤은 video 위 absolute 하단 고정. */}
                  <div className="relative w-full flex-1 min-h-0 rounded-xl overflow-hidden bg-black">
                    {/* §11.373c — iOS Safari getUserMedia 검은 프리뷰 보강. playsInline·muted 만으론
                        iOS 가 첫 프레임을 안 그림 → autoPlay 속성 명시(play() 호출과 별개로 iOS 요구).
                        transform-gpu 로 GPU 합성 레이어 승격(video 합성 누락 방지). stream 획득(§11.349)과
                        직교한 "표시" 보강. */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform-gpu"
                    />
                    {/* §11.374-vivino — 정합 색변화. quality.overall(good/warn/poor·null) → status.
                        good=정합(emerald) / warn=주의(yellow) / 그 외=기본(blue). 신규 ML 0(기존 판정 재사용). */}
                    <ScanGuideFrame
                      testId="camera-guide-frame"
                      status={
                        quality?.overall === "good"
                          ? "good"
                          : quality?.overall === "warn"
                            ? "warn"
                            : "idle"
                      }
                      aligned={!!quality?.alignment?.ok}
                    />
                    {quality && (
                      <div
                        className={`absolute left-2 top-2 px-2 py-1 rounded-md text-[11px] font-medium ${
                          quality.overall === "good"
                            ? "bg-emerald-600/90 text-white"
                            : quality.overall === "warn"
                              ? "bg-yellow-500/90 text-white"
                              : "bg-red-600/90 text-white"
                        }`}
                      >
                        {/* §11.375 — "양호"는 촬영 품질(흔들림/조명)이지 라벨 인식이 아님.
                            라벨 정합/인식은 OCR(§11.378 confidence 게이트)이 판정 → 오해 제거 위해 라벨 정정. */}
                        {quality.overall === "good"
                          ? "흔들림 없음"
                          : quality.overall === "warn"
                            ? "흔들림/조명 주의"
                            : "흐림/조명 불량 — 재촬영"}
                        {quality.reasons.length > 0
                          ? ` · ${quality.reasons.join(", ")}`
                          : ""}
                      </div>
                    )}

                    {/* §11.374-vivino — 촬영 컨트롤을 video 위 absolute 하단 오버레이로 고정.
                        풀블리드 video + 컨트롤 세로 합산이 모달 높이를 넘겨 "촬영" 버튼이 스크롤 밖으로
                        밀리던 것 해소 → 카메라+촬영 한 화면, 버튼 항상 노출. */}
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
                      {/* 자동 캡처 토글 + 인라인 힌트 (default 수동) */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-white/90">
                          <input
                            type="checkbox"
                            checked={autoCapture}
                            onChange={(e) => setAutoCapture(e.target.checked)}
                          />
                          자동 캡처
                        </label>
                        <span className="text-[11px] text-white/70">
                          💡 &lsquo;흔들림 없음&rsquo;일 때 자동 촬영
                        </span>
                      </div>

                      {/* 캡처 버튼 — poor 차단 */}
                      <button
                        type="button"
                        onClick={() => captureRef.current(false)}
                        disabled={quality?.overall === "poor"}
                        className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-500/60 disabled:text-white/50"
                      >
                        <Camera className="h-4 w-4" />
                        촬영
                      </button>

                      {quality?.overall === "poor" && (
                        <button
                          type="button"
                          onClick={() => captureRef.current(true)}
                          className="self-center text-xs text-white/70 underline hover:text-white"
                        >
                          그래도 시도 (OCR 강제 실행)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="self-center flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Type className="h-3.5 w-3.5" />
                텍스트 직접 입력
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {/* 드래그 & 드롭 + 클릭 업로드 영역 (기존 경로 보존) */}
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full max-w-sm aspect-[4/3] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 group cursor-pointer ${
                  isDragOver
                    ? "border-blue-500 bg-blue-100/50 scale-[1.02]"
                    : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  isDragOver ? "bg-blue-200" : "bg-slate-100 group-hover:bg-blue-100"
                }`}>
                  <Upload className={`h-6 w-6 ${isDragOver ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">클릭하여 이미지 업로드 또는 촬영</p>
                  <p className="text-xs text-slate-400 mt-0.5">시약 병의 라벨이나 앱에서 선명하게 찍어주세요</p>
                </div>
              </button>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 w-full max-w-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={() => setManualMode(true)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Type className="h-3.5 w-3.5" />
                텍스트 직접 입력
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ 수동 텍스트 입력 모드 ═══ */}
      {step === "upload" && manualMode && (
        <div className="flex-1 flex flex-col gap-4 p-5">
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">라벨 텍스트</Label>
            <Textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={`라벨에 보이는 텍스트를 그대로 입력하세요\n\n예시:\nSIGMA-ALDRICH\nSodium Chloride\nCat. No. S9888-500G\nLot No. SLBC1234V\nExp: 2025-12`}
              className="min-h-[160px] text-sm bg-white border-slate-200 focus:border-blue-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-auto">
            <Button variant="outline" onClick={() => { setManualMode(false); setError(null); }} className="flex-1">
              뒤로
            </Button>
            <Button
              onClick={submitManualText}
              disabled={!manualText.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Sparkles className="h-4 w-4" />
              분석하기
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: AI 분석 중 (로딩) ═══ */}
      {step === "scanning" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          {previewImage ? (
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-slate-200">
              <img src={previewImage} alt="스캔 중인 라벨" className="w-full object-cover" />
              <div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_8px_2px_rgba(59,130,246,0.5)]"
                style={{ animation: "scanLine 2s ease-in-out infinite", top: "0%" }}
              />
              <div className="absolute inset-0 bg-blue-600/5" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">AI가 라벨을 분석하고 있습니다...</p>
            <p className="text-xs text-slate-500 mt-1">제품명, 카탈로그 번호, Lot, 유효기간, 수량을 추출 중</p>
          </div>
        </div>
      )}

      {/* ═══ Step 3: 검토 및 수정 (편집 가능 폼) ═══ */}
      {step === "review" && (
        <div className="flex-1 flex flex-col gap-4 p-5 overflow-y-auto">
          {/* 스캔 이미지 미니 프리뷰 + AI 상태 */}
          <div className="flex items-center gap-3">
            {previewImage && (
              <button
                type="button"
                onClick={() => setImageZoomed(true)}
                className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in hover:ring-2 hover:ring-blue-400 transition"
                aria-label="스캔 이미지 크게 보기"
                title="클릭하여 크게 보기"
              >
                <img src={previewImage} alt="스캔된 라벨" className="w-full h-full object-cover pointer-events-none" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {/* §11.290 Phase 4b — confidence badge + provider badge + cache hit
                  indicator. multi-provider fallback 결과 + cache lookup 적중 시각화. */}
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-900">AI 분석 완료</p>
                {/* §scan-card-polish — 신뢰도 배지는 low 일 때만 노출(보통/높음은 노이즈). 저신뢰는 아래 전용 배너로도 안내. */}
                {scanResult && mapOcrConfidence(scanResult.parsed.confidence) === "low" && <ConfidenceBadge level="low" />}
{/* §scan-card-declutter (호영님 2026-06-30) — provider/fallback/cache badges + retry/correct CTA removed.
                    internal observability; prod jobId null => dead button. Keep ConfidenceBadge only.
                    OCR retry/correct route(/api/ocr/*) and QuoteScannerModal unchanged (separate track). */}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                추출된 데이터를 확인하고 필요 시 수정하세요
              </p>
            </div>
          </div>

          {/* §scan-card-polish — 스캔 이미지 확대 오버레이(클릭/Esc 닫힘은 backdrop 클릭). */}
          {imageZoomed && previewImage && (
            <div
              className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-6 cursor-zoom-out"
              onClick={() => setImageZoomed(false)}
              role="dialog"
              aria-label="스캔 이미지 확대"
            >
              <img src={previewImage} alt="스캔된 라벨 확대" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-2xl object-contain" />
            </div>
          )}

          {/* DB 매칭 정보 */}
          {scanResult?.matchedProduct && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">DB 매칭: {scanResult.matchedProduct.name}</span>
              </div>
            </div>
          )}
          {/* §scan-cat-guard (호영님 2026-07-03) — Cat.No.(식별키) 미추출 시 신규 확정 보류.
              Cat 없이 등록하면 기존 품목을 신규로 오판 → 중복 등록·GMP Lot 추적 붕괴. */}
          {onDirectReceive && scanResult && !scanResult.matchedProduct && formData.catalogNumber.trim() === "" && (
            <div className="rounded-lg border border-[#f3d4bf] bg-[#fdf3ec] px-3 py-2.5 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-[#b45821] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#b45821]">식별 정보(Cat.No.) 부족 — 신규 여부를 확정할 수 없습니다</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">Cat.No.를 입력하거나 아래 유사 품목을 선택하세요. 그대로 등록하면 기존 품목이 중복 등록될 수 있습니다.</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] font-medium text-[#b45821] cursor-pointer">
                <input type="checkbox" checked={ackNewWithoutCat} onChange={(e) => setAckNewWithoutCat(e.target.checked)} className="h-3.5 w-3.5 rounded border-[#f3d4bf]" />
                식별 정보 없이 신규로 등록(중복 위험 확인함)
              </label>
            </div>
          )}
          {/* §scan-manual-path (호영님 2026-06-30) — 미매칭 = 실패 아님. 신규 품목 등록 정상 경로 calm 안내(에러톤 0). */}
          {/* §scan-secondary-match — fuzzy 후보가 있으면 "신규 품목" 단정 대신 후보 행으로 양보(런타임 숨김, 토큰 보존). */}
          {scanResult && !scanResult.matchedProduct && formData.catalogNumber.trim() !== "" && (scanResult.matchType !== "fuzzy_name" || !scanResult.productCandidates?.length) && synonymCandidates.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">DB에 없는 신규 품목입니다 — 값을 확인하고 새로 등록합니다.</span>
              </div>
            </div>
          )}
          {/* §scan-secondary-match — name+brand fuzzy 유사 품목 후보(승인형). 후보 있을 때만, 자동확정 X(canonical 무접촉). */}
          {scanResult && !scanResult.matchedProduct && scanResult.matchType === "fuzzy_name" && scanResult.productCandidates && scanResult.productCandidates.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-slate-600">
                유사 품목 후보 — 같은 품목이면 선택해 연결하세요 <span className="text-slate-400">(확인 필요)</span>
              </p>
              <div className="space-y-1.5">
                {scanResult.productCandidates.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {c.level && (
                          <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${c.level === "high" ? "bg-emerald-100 text-emerald-700" : c.level === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                            {c.level === "high" ? "높음" : c.level === "medium" ? "보통" : "낮음"}
                          </span>
                        )}
                        <p className="text-xs text-slate-700 truncate">{c.name}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {[c.brand, c.catalogNumber].filter(Boolean).join(" · ") || "추가 정보 없음"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] shrink-0 text-blue-700 border-blue-300 hover:bg-blue-100 hover:text-blue-800"
                      onClick={() => {
                        updateField("productName", c.name);
                        updateField("brand", c.brand ?? "");
                        updateField("catalogNumber", c.catalogNumber ?? "");
                      }}
                    >
                      이 품목 선택
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* §scan-synonym-bridge — reverse-match 0 + PubChem 동의어 매칭 시 "표준명 기준" 후보(승인형). 자동확정 X. */}
          {scanResult && !scanResult.matchedProduct && !(scanResult.matchType === "fuzzy_name" && scanResult.productCandidates && scanResult.productCandidates.length > 0) && synonymCandidates.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-slate-600">
                유사 품목 후보 <span className="text-slate-400">(표준명 기준 · 확인 필요)</span>
              </p>
              <div className="space-y-1.5">
                {synonymCandidates.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {c.level && (
                          <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${c.level === "high" ? "bg-emerald-100 text-emerald-700" : c.level === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-500"}`}>
                            {c.level === "high" ? "높음" : c.level === "medium" ? "보통" : "낮음"}
                          </span>
                        )}
                        <p className="text-xs text-slate-700 truncate">{c.name}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {[c.brand, c.catalogNumber].filter(Boolean).join(" · ") || "추가 정보 없음"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] shrink-0 text-blue-700 border-blue-300 hover:bg-blue-100 hover:text-blue-800"
                      onClick={() => {
                        updateField("productName", c.name);
                        updateField("brand", c.brand ?? "");
                        updateField("catalogNumber", c.catalogNumber ?? "");
                      }}
                    >
                      이 품목 선택
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* §pubchem-enrich — PubChem 표준 정보 제안(승인형 [적용]). 무결과/실패 → 미노출(calm). canonical 무접촉. */}
          {scanResult && !scanResult.matchedProduct && enrichLoading && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2 text-[11px] text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> PubChem에서 표준 정보를 찾는 중…
            </div>
          )}
          {scanResult && !scanResult.matchedProduct && enrichment && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-blue-700">PubChem 표준 정보</p>
                  <p className="text-xs text-slate-700 truncate">
                    {enrichment.canonicalName}
                    {enrichment.molecularFormula ? <span className="text-slate-400"> · {enrichment.molecularFormula}</span> : null}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] shrink-0 text-blue-700 border-blue-300 hover:bg-blue-100 hover:text-blue-800"
                  onClick={() => updateField("productName", enrichment.canonicalName)}
                >
                  제품명에 적용
                </Button>
              </div>
              {enrichment.synonyms.length > 0 && (
                <p className="text-[10px] text-slate-400 truncate">동의어: {enrichment.synonyms.slice(0, 5).join(", ")}</p>
              )}
            </div>
          )}

          {/* §11.253b-3 — case 1 Info banner (본인 다른 탭). BroadcastChannel
              으로 같은 origin 의 다른 탭이 동일 productId/lotNumber 작업 중일 때
              파란 톤 Info 노출. case 3 (red Error) 와 별개 surface — case 1 +
              case 3 동시 가능 (드물지만 사용자 명시 인지 필요). [확인] 후 hide. */}
          {otherTabActive && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-700 mb-0.5 break-keep">
                    다른 탭에서 같은 항목 작업 중입니다
                  </p>
                  <p className="text-[11px] text-blue-600/90 leading-relaxed break-keep">
                    이 탭에서 계속하시겠습니까? 동시에 진행하면 의도하지 않은 중복 입고가 발생할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={acknowledgeOtherTab}
                    className="mt-2 inline-flex items-center justify-center h-8 px-3 rounded-md border border-blue-200 bg-white text-blue-700 text-xs font-medium hover:bg-blue-50 active:scale-95 transition-all"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* §11.253 — 충돌 경고 banner 강화 (case 3 = 이미 등록된 Lot 중복).
              호영님 spec 4 요구사항 정합:
                ① 항목 특정 — matchedProduct.name + lotNumber inline 노출.
                ② 작업 유형 — "입고 처리" 명시.
                ④ 액션 — [그래도 진행] / [취소] button 2개.
              톤 — Error (red) — 이미 완료된 입고 항목 중복 시도 case 정합.
              ack 후 (conflictAck === true) banner 자동 hide → 폼 그대로 사용.
              ③ 행위자 / ⑤ 시간 정보 — backend lock infra 필요 (§11.253b 별도 cluster). */}
          {scanResult?.matchedInventory && !conflictAck && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-700 mb-1 break-keep">
                    이미 등록된 항목에 입고 처리를 시도하고 있습니다
                  </p>
                  <p className="text-[11px] text-red-600/90 leading-relaxed break-keep">
                    <span className="font-medium">{scanResult.matchedProduct?.name ?? "동일 제품"}</span>
                    {" "}— Lot {scanResult.matchedInventory.lotNumber ?? "—"}
                    {" "}(현재 {scanResult.matchedInventory.currentQuantity}{" "}
                    {scanResult.matchedInventory.unit ?? ""})
                    <br />
                    {/* §11.253b-1 — 행위자 ③ + 시간 ⑤ 정보 inline. user.name
                        없으면 "나" fallback (matchedInventory 는 userId session
                        본인 만 매칭 — 같은 사용자의 다른 입력). updatedAt 은
                        RelativeTimeText "X분 전" hydration-safe. */}
                    <span className="font-medium">
                      {scanResult.matchedInventory.user?.name ?? "나"}
                    </span>
                    님이{" "}
                    <RelativeTimeText
                      iso={scanResult.matchedInventory.updatedAt}
                      variant="minute"
                      fallback="이전에"
                    />{" "}
                    마지막으로 수정했습니다.
                    <br />
                    계속 진행 시 기존 재고에 수량이 추가됩니다.
                  </p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setConflictAck(true)}
                      className="inline-flex items-center justify-center h-9 px-3 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-500 active:scale-95 transition-all"
                    >
                      그래도 진행
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenChange(false)}
                      className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-red-200 bg-white text-red-700 text-xs font-medium hover:bg-red-50 active:scale-95 transition-all"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 편집 가능한 폼 ── */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">제품명</Label>
              <Input
                value={formData.productName}
                onChange={(e) => updateField("productName", e.target.value)}
                placeholder="예: Sodium Chloride"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">카탈로그 번호</Label>
                <Input
                  value={formData.catalogNumber}
                  onChange={(e) => updateField("catalogNumber", e.target.value)}
                  placeholder="Cat. No."
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 h-5">
                  <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">Lot 번호</Label>
                  {(() => {
                    const b = fieldSourceBadge(formData.lotNumber, lotScanFilled, lotDirty);
                    return b ? <span data-testid="lot-source-badge" className={`text-[9px] px-1.5 py-0 rounded ${b.cls}`}>{b.label}</span> : null;
                  })()}
                  {/* §11.382 P4 — datamatrix verified 녹색 배지(확인필요 면제 시각화) */}
                  {lotVerified && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5" />GS1 검증
                    </span>
                  )}
                  {onDirectReceive && commitGate.fieldMarks.lot === "needs-confirm" && (
                    /* §label-scan-qc — 녹색 "라벨 스캔 확인" + 빨강 "확인 필요" 모순 완화:
                       검토 권고는 §11.302 yellow(주의)로, red(위험) 톤 과함 해소. 게이트(터치 강제)는 유지. */
                    <span className="text-[10px] font-medium text-yellow-700">· 확인 권장</span>
                  )}
                </div>
                <Input
                  value={formData.lotNumber}
                  onChange={(e) => updateField("lotNumber", e.target.value)}
                  placeholder="Lot No."
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 h-5">
                  <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">유효기간</Label>
                  {(() => {
                    const b = fieldSourceBadge(formData.expirationDate, expiryScanFilled, expiryDirty);
                    return b ? <span data-testid="expiry-source-badge" className={`text-[9px] px-1.5 py-0 rounded ${b.cls}`}>{b.label}</span> : null;
                  })()}
                  {/* §11.382 P4 — datamatrix verified 녹색 배지(확인필요 면제 시각화) */}
                  {expiryVerified && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5" />GS1 검증
                    </span>
                  )}
                  {onDirectReceive && commitGate.fieldMarks.expiry === "needs-confirm" && (
                    /* §label-scan-qc — 모순 완화: 검토 권고 §11.302 yellow. 게이트(터치 강제)는 유지. */
                    <span className="text-[10px] font-medium text-yellow-700">· 확인 권장</span>
                  )}
                </div>
                {/* §label-scan-qc(호영님 라이브 확정) — 빈 type=date 가 모바일 브라우저에서 오늘로
                    자동 채워지며 onChange 발화 → "수기 입력" 오인 + 당일 만료 오등록 위험.
                    SmartReceiving 과 동일하게 type=text + placeholder 로 전환:
                    ① 빈값 보장(자동 today 0, QC 안전) ② "2028-06" 같은 YYYY-MM 재시험일도 수용. */}
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formData.expirationDate}
                  onChange={(e) => updateField("expirationDate", e.target.value)}
                  placeholder="예: 2026-12 또는 2026-12-31"
                  className="mt-1 h-9 text-sm"
                />
                {/* §label-scan-qc — EXP 미추출 시 QC 안전 안내(당일 만료 오등록 방지).
                    type=date 는 placeholder 미지원 → 빈값일 때 명시 hint. 값은 항상 빈값 기본(코드 |"") . */}
                {!formData.expirationDate && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    라벨의 유효기간(EXP)을 직접 입력하세요. 비워두면 미입력으로 저장됩니다(오늘 날짜 자동 아님).
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">규격 (통 1개의 함량)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    value={formData.packSize}
                    onChange={(e) => updateField("packSize", e.target.value)}
                    placeholder="예: 100"
                    className="h-9 text-sm flex-1"
                  />
                  <Input
                    value={formData.packUnit}
                    onChange={(e) => updateField("packUnit", e.target.value)}
                    placeholder="CAPSULES"
                    className="h-9 text-sm w-24"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">ⓘ 라벨에 표시된 통 1개의 용량입니다 (입고 수량 아님)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">제조사</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => updateField("brand", e.target.value)}
                  placeholder="제조사명"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600 flex h-5 items-center">CAS 번호</Label>
                <Input
                  value={formData.casNumber}
                  onChange={(e) => updateField("casNumber", e.target.value)}
                  placeholder="CAS No."
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* §11.378 — OCR 저신뢰도 + 사용자 미보정 시 입고 완료 차단(무효 통과 방지).
              제품명을 직접 수정하면 해제. 라벨 아닌 사진(키보드 등)이 재고로 들어가는 것 차단. */}
          {scanResult &&
            mapOcrConfidence(scanResult.parsed.confidence) === "low" &&
            !productNameDirty && (
              <div className="flex items-start gap-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-yellow-600" />
                <span>
                  일부 값이 흐릿하게 인식됐어요(신뢰도가 낮습니다). 라벨을 확인하고 제품명을 채운 뒤 진행하면 됩니다.
                </span>
              </div>
            )}

          {/* §1-2/PLAN rule 2 — 직접 입고 시 Lot·유효기간 미확인 차단 사유(no-op 금지). */}
          {criticalUnconfirmed && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Lot 번호·유효기한을 확인(터치/수정)해 주세요. 자동 인식값은 확인 후 입고됩니다.
              </span>
            </div>
          )}

          {/* §scan-multi-capture-merge — catalogNo 미충전 시 다른 각도 재촬영(병합) calm 유도. 채워지면 사라짐. */}
          {scanResult && !scanResult.matchedProduct && !formData.catalogNumber.trim() && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                카탈로그 번호가 안 읽혔어요 — 다른 각도로 한 번 더 촬영하면 채울 수 있어요{scanCount > 1 ? ` · ${scanCount}회 병합됨` : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] shrink-0 text-blue-700 border-blue-300 hover:bg-blue-600 hover:text-white"
                onClick={() => { mergeNextRef.current = true; setStep("upload"); }}
              >
                다른 각도 재촬영
              </Button>
            </div>
          )}
          {/* ── 액션 버튼 ── */}
          <div className="flex items-center gap-3 mt-auto pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={resetState} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              다시 스캔
            </Button>
            <Button
              onClick={onDirectReceive ? handleDirectReceive : handleApplyToForm}
              disabled={
                !formData.productName.trim() ||
                // §11.378 — 저신뢰도 + 미보정 차단. 수동 보정(productNameDirty) 시 허용.
                (!!scanResult &&
                  mapOcrConfidence(scanResult.parsed.confidence) === "low" &&
                  !productNameDirty) ||
                // §1-2/PLAN rule 2 — 직접 입고 시 Lot·유효기간 미확인 차단.
                criticalUnconfirmed ||
                // §scan-cat-guard — Cat.No. 없이 신규 등록 확정 차단(override 전).
                catIdentifyBlocked
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {onDirectReceive ? "입고 완료" : "이 라벨로 검색"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  /* ── GlobalModal 통합 모드: content만 반환 ── */
  if (_renderContentOnly) return content;

  /* ── 모바일: Sheet / 데스크탑: Dialog ── */
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 bg-white text-slate-900">
          <SheetHeader className="px-4 pt-4 pb-2">
            <SheetTitle className="text-base font-bold text-slate-900">{scanTitle}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* §scan-card-polish (호영님 2026-06-30) — lg+ 사이드바(w-64) 보정: 콘텐츠 영역 중앙 정렬(per-modal, 전역 Dialog 불변). */}
      <DialogContent className="max-w-md p-0 gap-0 bg-white text-slate-900 border-slate-200 z-[60] lg:ml-64">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-blue-600" />
            {scanTitle}
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
