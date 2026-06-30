import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
// §11.380 Phase 2 — expo-camera → VisionCamera v4 이전. lucide Camera(아이콘)과
//   이름 충돌 회피 위해 컴포넌트는 VisionCamera 로 alias.
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
  useFrameProcessor,
  runAtTargetFps,
} from "react-native-vision-camera";
import { useTextRecognition } from "react-native-vision-camera-text-recognition";
import { Worklets } from "react-native-worklets-core";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
// §11.380 Phase 3 — 라벨 검출 lock 상태머신(순수). 라이브 신호 전용(진위=§11.378).
import {
  stepLock,
  initialLockRuntime,
  type LockState,
} from "../lib/scan/label-lock";
import {
  X,
  Flashlight,
  FlashlightOff,
  Settings,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Printer,
  MapPin,
  Package,
  AlertCircle,
  Keyboard,
  Camera,
  ScanLine,
  RotateCcw,
  CheckCircle2,
  FlaskConical,
} from "lucide-react-native";
import { lookupInventory, scanLabel, type LabelScanResponse } from "../hooks/useApi";
import { mapOcrConfidence } from "../lib/ocr/capture-quality";
// §scan-mobile-align-merge B — 다장 캡처 fill-empty 병합(순수). canonical 무접촉(draft 병합).
import { mergeLabelForm, type LabelForm } from "../lib/inventory/merge-label-form";
// §gs1-datamatrix — 시약 라벨 2D datamatrix(GS1) 결정적 디코드. OCR보다 Lot/유효기간 신뢰 ↑.
import { parseGs1 } from "../lib/scan/gs1-parser";
// §1-2/PLAN — 라벨 저신뢰 commit 게이트(rule 2 Lot·EXP 명시확인, rule 3 datamatrix verified 우회).
import { evaluateLabelCommitGate } from "../lib/scan/label-commit-gate";
import { resolveSourcingSearchQuery } from "../lib/scan/sourcing-search-resolve";
import { logEvent } from "../lib/analytics";

// §11.319 — 바코드(기존) + 라벨 OCR(신규) 두 모드. label-capture = 촬영/분석 중,
//   label-review = 추출 결과 편집. 기존 barcode 상태머신 보존.
type ScanState =
  | "scanning"
  | "looking"
  | "matched"
  | "unmatched"
  | "manual"
  | "error"
  | "label-capture"
  | "label-review";

type ScanMode = "barcode" | "label";

interface MatchResult {
  inventoryId: string;
  scannedData: string;
}

// §11.319 — 라벨 OCR 추출 결과 편집 폼. §scan-mobile-align-merge: LabelForm 타입은
//   ../lib/inventory/merge-label-form 에서 import(병합 util 과 단일 출처 → drift 방지).

function emptyLabelForm(): LabelForm {
  return {
    productName: "",
    catalogNumber: "",
    lotNumber: "",
    expirationDate: "",
    packSize: "",
    packUnit: "",
    receivedQuantity: "1",
    receivedUnit: "통",
    brand: "",
    casNumber: "",
  };
}

function mapLabelToForm(r: LabelScanResponse): LabelForm {
  return {
    productName: r.parsed.productName || r.matchedProduct?.name || "",
    catalogNumber: r.parsed.catalogNo || r.matchedProduct?.catalogNumber || "",
    lotNumber: r.parsed.lotNo || "",
    expirationDate: r.parsed.expirationDate || "",
    // §11.326 — 라벨 quantity 는 통 1개 함량(packSize). 입고 수량 아님(기본 1).
    packSize: r.parsed.quantity || "",
    packUnit: "",
    receivedQuantity: "1",
    receivedUnit: r.matchedInventory?.unit || "통",
    brand: r.parsed.brand || r.matchedProduct?.brand || "",
    casNumber: r.parsed.casNumber || "",
  };
}

export default function ScanScreen() {
  // §11.380 Phase 2 — VisionCamera 권한/디바이스/포커스 lifecycle.
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const isFocused = useIsFocused();
  // §11.379 — ScanHubSheet intent 수신. 입고(라벨)/사용(QR 차감) 진입 의도.
  //   receive_label → 라벨 OCR 모드, use_qr → 바코드/QR 모드(matched 시 차감 우선).
  //   intent 없는 직진입은 기존 기본값(barcode) 유지(하위호환).
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const [state, setState] = useState<ScanState>("scanning");
  const [scanMode, setScanMode] = useState<ScanMode>(
    // §11.37x(c) — sourcing_label(소싱 라벨→검색, read-only)도 label 모드 재사용.
    intent === "receive_label" || intent === "sourcing_label" ? "label" : "barcode"
  );
  const [torch, setTorch] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [unmatchedData, setUnmatchedData] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // §11.319 — 라벨 OCR 상태
  const cameraRef = useRef<VisionCamera>(null);
  // §11.380 Phase 2 — 바코드 연속 프레임 중복 호출 잠금(matched 전이 burst 차단). resetToScan 해제.
  const scanLockRef = useRef(false);
  // §11.380 Phase 3 — 라벨 라이브 검출 lock(가이드색·햅틱·촬영강조 신호 전용). 진위 아님(§11.378).
  const [lockState, setLockState] = useState<LockState>("idle");
  const lockRuntimeRef = useRef(initialLockRuntime());
  const [labelResult, setLabelResult] = useState<LabelScanResponse | null>(null);
  const [labelForm, setLabelForm] = useState<LabelForm>(emptyLabelForm());
  // §scan-mobile-multi-merge — 누적 병합 시 직전 draft 동기 참조(stale closure 회피).
  const labelFormRef = useRef<LabelForm>(labelForm);
  useEffect(() => {
    labelFormRef.current = labelForm;
  }, [labelForm]);
  // §scan-mobile-multi-merge — "다른 각도 재촬영(누적)" 모드. true 면 다음 촬영이 fill-empty 병합.
  const [accumulate, setAccumulate] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  // §11.340 — Lot/유효기한 출처 추적(라벨 스캔 확인 vs 수기 입력, §11.335 정책).
  const [lotScanFilled, setLotScanFilled] = useState(false);
  const [expiryScanFilled, setExpiryScanFilled] = useState(false);
  const [lotDirty, setLotDirty] = useState(false);
  const [expiryDirty, setExpiryDirty] = useState(false);
  // §1-2/PLAN rule 3 — datamatrix(GS1) 결정적 디코드 = verified. OCR-fill·수기와 구분.
  const [lotVerified, setLotVerified] = useState(false);
  const [expiryVerified, setExpiryVerified] = useState(false);
  // §11.378 — 제품명 사용자 수정 추적. OCR 저신뢰도 + 미보정이면 입고 차단,
  //   제품명을 직접 수정(보정)하면 차단 해제(무효 사진 재고 오염 방지, web 동치).
  const [productNameDirty, setProductNameDirty] = useState(false);
  // §gs1-datamatrix — GS1 datamatrix 캡처 시 GTIN(표시용, 제품매칭 아님). null = OCR/일반 경로.
  const [gs1Gtin, setGs1Gtin] = useState<string | null>(null);

  const resetToScan = useCallback(() => {
    setState("scanning");
    setMatchResult(null);
    setUnmatchedData("");
    setErrorMessage("");
    setLabelResult(null);
    setLabelForm(emptyLabelForm());
    setLotScanFilled(false); setExpiryScanFilled(false);
    setGs1Gtin(null);
    setLotDirty(false); setExpiryDirty(false);
    setLotVerified(false); setExpiryVerified(false);
    setProductNameDirty(false);
    setAccumulate(false);
    setCapturedUri(null);
    scanLockRef.current = false;
    lockRuntimeRef.current = initialLockRuntime();
    setLockState("idle");
  }, []);

  const performLookup = useCallback(
    async (data: string, source: "scan" | "manual") => {
      setState("looking");

      if (source === "scan") {
        logEvent("qr_scan_started", { data });
      }

      try {
        const inventoryId = await lookupInventory({
          catalogNumber: data,
          productName: data,
        });

        if (inventoryId) {
          logEvent("qr_scan_success", { data, inventoryId, source });
          setMatchResult({ inventoryId, scannedData: data });
          setState("matched");
        } else {
          logEvent("qr_scan_unmatched", { data, source });
          setUnmatchedData(data);
          setState("unmatched");
        }
      } catch (err) {
        logEvent("qr_scan_failed", { data, error: String(err), source });
        setErrorMessage(
          "네트워크 오류로 조회에 실패했습니다.\n인터넷 연결을 확인 후 다시 시도해주세요."
        );
        setState("error");
      }
    },
    []
  );

  // §11.380 Phase 2 — VisionCamera CodeScanner(기존 9종 동일 매핑, 하이픈 표기).
  //   연속 프레임 burst 는 scanLockRef 로 1회 차단(matched 전이 후 isActive=false 로 정지).
  const codeScanner = useCodeScanner({
    codeTypes: [
      "qr",
      "ean-13",
      "ean-8",
      "code-128",
      "code-39",
      "code-93",
      "upc-a",
      "upc-e",
      "data-matrix",
    ],
    onCodeScanned: (codes) => {
      if (scanMode !== "barcode") return;
      if (scanLockRef.current) return;
      const value = codes[0]?.value;
      if (!value) return;
      scanLockRef.current = true;
      // §gs1-datamatrix — GS1 2D datamatrix(시약 라벨, Lot/유효기간 보유)면 재고등록
      //   검토로 분기 + Lot/유효기간 자동채움(결정적, OCR보다 신뢰 ↑). use_qr(차감) 의도는
      //   기존 조회 유지. GTIN 은 표시용(제품매칭 아님 — 카탈로그 GTIN 필드 부재).
      const gs1 = parseGs1(value);
      if (intent !== "use_qr" && gs1.isGs1 && (gs1.lotNo || gs1.expirationDate)) {
        setLabelForm((f) => ({
          ...f,
          lotNumber: gs1.lotNo ?? f.lotNumber,
          expirationDate: gs1.expirationDate ?? f.expirationDate,
        }));
        setLotScanFilled(Boolean(gs1.lotNo));
        setExpiryScanFilled(Boolean(gs1.expirationDate));
        // §1-2/PLAN rule 3 — datamatrix Lot/EXP = verified(결정적) → commit 게이트 우회.
        setLotVerified(Boolean(gs1.lotNo));
        setExpiryVerified(Boolean(gs1.expirationDate));
        setGs1Gtin(gs1.gtin);
        logEvent("gs1_datamatrix_capture", {
          gtin: gs1.gtin,
          hasLot: Boolean(gs1.lotNo),
          hasExpiry: Boolean(gs1.expirationDate),
        });
        setState("label-review");
        return;
      }
      performLookup(value, "scan");
    },
  });

  // §11.380 Phase 3 — 라벨 모드 라이브 텍스트 검출(ML Kit) → lock 상태머신.
  //   ⚠️ §11.375 경계: locked = "텍스트 감지됨, 촬영 권장" 신호일 뿐 진위 판정 아님.
  //   진위는 OCR 후단(§11.378). idle 여도 수동 촬영 가능(막다른 길 금지).
  const { scanText } = useTextRecognition({ language: "latin" });

  // worklet → JS: 프레임 신호(텍스트 길이/블록 수)로 상태머신 1스텝. 전이 시 햅틱 1회.
  const applyFrameSignal = useCallback(
    (textLength: number, blockCount: number) => {
      const { next, haptic } = stepLock(lockRuntimeRef.current, {
        textLength,
        blockCount,
      });
      lockRuntimeRef.current = next;
      setLockState((prev) => (prev === next.state ? prev : next.state));
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    },
    [],
  );
  const onFrameSignal = useMemo(
    () => Worklets.createRunOnJS(applyFrameSignal),
    [applyFrameSignal],
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      // OCR 은 무거움 → 5fps 로 throttle(파이프라인 부하 방지).
      runAtTargetFps(5, () => {
        "worklet";
        const data = scanText(frame);
        onFrameSignal(data.resultText.length, data.blocks.length);
      });
    },
    [scanText, onFrameSignal],
  );

  // §11.380 Phase 3 — 바코드 모드 전환 시 lock 초기화(라벨 신호 잔존 방지).
  useEffect(() => {
    if (scanMode !== "label") {
      lockRuntimeRef.current = initialLockRuntime();
      setLockState("idle");
    }
  }, [scanMode]);

  const handleManualSearch = useCallback(() => {
    const query = manualInput.trim();
    if (!query) return;
    performLookup(query, "manual");
  }, [manualInput, performLookup]);

  // §11.319 — 라벨 촬영 → OCR 분석
  // §scan-mobile-multi-merge — merge=true("다른 각도 재촬영"): 직전 draft 의 빈 필드만 새 스캔으로
  //   채우고 채워진/수기 값은 보존(곡면 병 catalogNo 누적 보완). merge=false(기본)=단일 촬영=교체(회귀 0).
  //   canonical 무접촉(draft 병합).
  const handleCaptureLabel = useCallback(async (merge = false) => {
    if (state === "label-capture") return;
    setState("label-capture");
    logEvent("label_scan_started", {});
    try {
      // §11.380 Phase 2 — VisionCamera takePhoto 는 file path 반환. base64 는
      //   expo-file-system 으로 읽어 기존 scanLabel(dataUri) 계약 유지(OCR 경로 무변경).
      const photo = await cameraRef.current?.takePhoto({
        enableShutterSound: false,
        flash: torch ? "on" : "off",
      });
      if (!photo?.path) {
        throw new Error("촬영 이미지를 가져오지 못했습니다.");
      }
      const fileUri = photo.path.startsWith("file://")
        ? photo.path
        : `file://${photo.path}`;
      setCapturedUri(fileUri);
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const dataUri = `data:image/jpeg;base64,${base64}`;
      const result = await scanLabel(dataUri);
      setLabelResult(result);
      // §scan-mobile-multi-merge — 누적이면 직전 draft(ref) 기준 fill-empty, 아니면 교체.
      const prev = labelFormRef.current;
      const incoming = mapLabelToForm(result);
      setLabelForm(merge ? mergeLabelForm(prev, incoming) : incoming);
      // §11.340 — 스캔 결과 Lot/유효기한 출처 기록.
      //   병합: 직전이 비어있던 필드만 이번 스캔이 채웠으므로 그 필드 한정 출처 갱신.
      //   직전에 이미 채워진(보존된) 필드의 출처/dirty/verified 는 그대로 둔다.
      const lotWasEmpty = !String(prev.lotNumber ?? "").trim();
      const expWasEmpty = !String(prev.expirationDate ?? "").trim();
      if (!merge || lotWasEmpty) {
        setLotScanFilled(Boolean(result.parsed.lotNo));
        setLotDirty(false);
        // §1-2/PLAN rule 3 — OCR-fill 은 verified 아님(결정적 아님). datamatrix 경로만 verified.
        setLotVerified(false);
      }
      if (!merge || expWasEmpty) {
        setExpiryScanFilled(Boolean(result.parsed.expirationDate));
        setExpiryDirty(false);
        setExpiryVerified(false);
      }
      logEvent("label_scan_success", {
        confidence: result.parsed.confidence,
        matched: result.matchedProduct ? 1 : 0,
        provider: result.ocrMetadata?.providerUsed ?? "REGEX",
      });
      setAccumulate(false);
      setState("label-review");
    } catch (err) {
      logEvent("label_scan_failed", { error: String(err) });
      setErrorMessage(
        "라벨 분석에 실패했습니다.\n조명을 확보하고 라벨을 프레임 안에 맞춰 다시 촬영해주세요."
      );
      setState("error");
    }
  }, [state, torch]);

  const updateLabelField = useCallback((key: keyof LabelForm, value: string) => {
    setLabelForm((f) => ({ ...f, [key]: value }));
    // §11.340 — 직접 수정 → 수기 출처로 전환.
    //   §1-2/PLAN rule 3 — 수기 수정 시 verified 해제(결정적 디코드값 아님). dirty=확인으로 commit 허용.
    if (key === "lotNumber") { setLotDirty(true); setLotVerified(false); }
    if (key === "expirationDate") { setExpiryDirty(true); setExpiryVerified(false); }
    if (key === "productName") setProductNameDirty(true); // §11.378 — 저신뢰도 게이트 해제
  }, []);

  // §11.340 — 출처 배지(스캔 확인 vs 수기). 스캔으로 채워졌고 미수정 = 검증값.
  const fieldSource = (value: string, scanFilled: boolean, dirty: boolean) => {
    if (scanFilled && !dirty) return { label: "라벨 스캔 확인", cls: "bg-emerald-100 text-emerald-700" };
    if (value.trim()) return { label: "수기 입력", cls: "bg-slate-100 text-slate-500" };
    return null;
  };

  // §11.319 — 입고 prefill: 매칭 재고 있으면 입고(lot-receive), 없으면 신규 등록(register)
  const confirmLabelReceive = useCallback(() => {
    // §11.37x(c) — 소싱 검색 맥락(read-only): 입고 게이트·mutation 전부 우회하고
    //   검색 복귀만 수행. 자동차감·입고 라우팅 0 (canonical 보호).
    if (intent === "sourcing_label") {
      const q = resolveSourcingSearchQuery({
        catalogNumber: labelForm.catalogNumber,
        productName: labelForm.productName,
      });
      if (!q) {
        setErrorMessage("검색할 제품명 또는 카탈로그 번호가 없습니다.");
        return;
      }
      logEvent("sourcing_label_search", { hasCatalog: Boolean(labelForm.catalogNumber.trim()) });
      router.replace({ pathname: "/(tabs)/search", params: { q } });
      return;
    }
    if (!labelForm.productName.trim()) {
      setErrorMessage("제품명을 입력해주세요.");
      return;
    }
    // §11.378 — OCR 저신뢰도 + 미보정 차단(무효 사진 재고 오염 방지). 제품명 수정 시 해제.
    //   버튼 disabled 와 동일 게이트(우회 0). web LabelScannerModal 동치.
    const lowConf = labelResult
      ? mapOcrConfidence(labelResult.parsed.confidence) === "low"
      : false;
    if (lowConf && !productNameDirty) return;
    // §1-2/PLAN rule 2~3 — Lot·유효기간 명시 확인(터치/수정) 또는 datamatrix verified 후에만 commit.
    const gate = evaluateLabelCommitGate({
      confidence: labelResult ? mapOcrConfidence(labelResult.parsed.confidence) : "high",
      present: {
        lot: labelForm.lotNumber.trim() !== "",
        expiry: labelForm.expirationDate.trim() !== "",
      },
      criticalConfirmed: { lot: lotDirty, expiry: expiryDirty },
      verified: { lot: lotVerified, expiry: expiryVerified },
      reviewed: productNameDirty,
    });
    if (
      gate.blockers.includes("lot-unconfirmed") ||
      gate.blockers.includes("expiry-unconfirmed")
    ) {
      setErrorMessage("Lot 번호·유효기한을 확인(터치/수정)한 뒤 진행해주세요.");
      return;
    }
    const matchedInventoryId = labelResult?.matchedInventory?.id;
    if (matchedInventoryId) {
      router.replace({
        pathname: "/inventory/lot-receive",
        params: {
          id: matchedInventoryId,
          lotNumber: labelForm.lotNumber,
          // §11.326 — 입고 수량 = 받은 통 개수(라벨값 아님).
          prefillQty: labelForm.receivedQuantity,
        },
      });
    } else {
      router.replace({
        pathname: "/purchases/register",
        params: {
          prefill: "1",
          productName: labelForm.productName,
          catalogNumber: labelForm.catalogNumber,
          unit: labelForm.receivedUnit,
          quantity: labelForm.receivedQuantity,
          category: "시약",
        },
      });
    }
  }, [intent, labelResult, labelForm, productNameDirty, lotDirty, expiryDirty, lotVerified, expiryVerified]);

  const handleAction = useCallback(
    (action: string) => {
      if (!matchResult) return;
      const { inventoryId } = matchResult;
      logEvent("qr_action_selected", { action, inventoryId });

      switch (action) {
        case "detail":
          router.replace(`/inventory/${inventoryId}`);
          break;
        case "receive":
          router.replace({
            pathname: "/inventory/lot-receive",
            params: { id: inventoryId },
          });
          break;
        case "dispatch":
          router.replace({
            pathname: "/inventory/lot-dispatch",
            params: { id: inventoryId },
          });
          break;
        case "label":
          router.replace({
            pathname: "/inventory/lot-label",
            params: { id: inventoryId },
          });
          break;
        case "location":
          router.replace({
            pathname: "/inventory/lot-location",
            params: { id: inventoryId },
          });
          break;
      }
    },
    [matchResult]
  );

  // ─── 권한 거부 (Fallback UI 포함) ───
  //   §11.380 Phase 2 — VisionCamera useCameraPermission 은 로딩 null/canAskAgain 미제공.
  //   요청 버튼(requestPermission) + 설정 이동(영구 거부 대비) 동시 노출.
  if (!hasPermission) {
    return (
      <View className="flex-1 bg-white px-6 items-center justify-center">
        <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4">
          <Settings size={28} color="#64748b" />
        </View>
        <Text className="text-lg font-bold text-slate-900 mb-2">
          카메라 권한 필요
        </Text>
        <Text className="text-sm text-slate-500 text-center mb-6 leading-5">
          QR/바코드 스캔 및 라벨 촬영을 위해 카메라 접근 권한이 필요합니다.{"\n"}
          권한을 허용하지 않으면 수동 검색을 이용할 수 있습니다.
        </Text>

        <Pressable
          className="bg-blue-600 rounded-xl px-8 py-3.5 mb-3 w-full items-center"
          onPress={async () => {
            const granted = await requestPermission();
            // 영구 거부 시 requestPermission 즉시 false → 설정 안내(아래 버튼)로 유도.
            if (!granted) Linking.openSettings();
          }}
        >
          <Text className="text-sm font-semibold text-white">
            카메라 권한 허용
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center justify-center gap-2 bg-slate-700 rounded-xl px-8 py-3.5 mb-3 w-full"
          onPress={() => Linking.openSettings()}
        >
          <Settings size={16} color="white" />
          <Text className="text-sm font-semibold text-white">
            설정에서 권한 허용
          </Text>
        </Pressable>

        <Pressable
          className="flex-row items-center justify-center gap-2 border border-slate-200 rounded-xl px-8 py-3.5 mb-3 w-full"
          onPress={() => setState("manual")}
        >
          <Keyboard size={16} color="#475569" />
          <Text className="text-sm font-semibold text-slate-700">
            수동 검색
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-slate-400 mt-2">뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

  // ─── §11.319 라벨 OCR 검토/편집 ───
  if (state === "label-review") {
    // §gs1-datamatrix — GS1 datamatrix 경로(OCR 아님). datamatrix=결정적 인코딩이라
    //   OCR 저신뢰 게이트 미적용. 단 제품명(GTIN≠이름)은 여전히 필수.
    const isGs1Capture = !!gs1Gtin && !labelResult;
    const level = labelResult
      ? mapOcrConfidence(labelResult.parsed.confidence)
      : "low";
    const lowConf = !isGs1Capture && level === "low";
    // §1-2/PLAN rule 2~3 — Lot·유효기간 commit 게이트. datamatrix(verified) 우회.
    const commitGate = evaluateLabelCommitGate({
      confidence: isGs1Capture ? "high" : level,
      present: {
        lot: labelForm.lotNumber.trim() !== "",
        expiry: labelForm.expirationDate.trim() !== "",
      },
      criticalConfirmed: { lot: lotDirty, expiry: expiryDirty },
      verified: { lot: lotVerified, expiry: expiryVerified },
      reviewed: productNameDirty,
    });
    const criticalUnconfirmed =
      commitGate.blockers.includes("lot-unconfirmed") ||
      commitGate.blockers.includes("expiry-unconfirmed");
    // §11.378 — 입고/등록 이동 차단 게이트: 제품명 빈값 OR (저신뢰 + 미보정).
    //   제품명 수정 시(productNameDirty) 저신뢰 차단 해제. GS1 경로는 lowConf=false.
    //   §1-2/PLAN — Lot·유효기간 미확인(criticalUnconfirmed) 추가.
    const receiveBlocked =
      !labelForm.productName.trim() ||
      (lowConf && !productNameDirty) ||
      criticalUnconfirmed;
    // §11.37x(c) — 소싱 검색 맥락: 입고 게이트 무관(read-only). 검색어
    //   (제품명 또는 카탈로그 번호) 없을 때만 차단 — confirmLabelReceive 분기와 동일 게이트.
    const isSourcingContext = intent === "sourcing_label";
    const commitBlocked = isSourcingContext
      ? !labelForm.productName.trim() && !labelForm.catalogNumber.trim()
      : receiveBlocked;
    const confTone =
      level === "high"
        ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "높은 신뢰도" }
        : level === "medium"
          ? { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", label: "보통 신뢰도" }
          : { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "낮은 신뢰도" };

    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 상태 헤더 */}
          <View className="flex-row items-center gap-3 mb-4">
            {capturedUri ? (
              <Image
                source={{ uri: capturedUri }}
                className="w-14 h-14 rounded-lg border border-slate-200"
              />
            ) : (
              <View className="w-14 h-14 rounded-lg bg-blue-50 items-center justify-center">
                <FlaskConical size={22} color="#2563eb" />
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <CheckCircle2 size={16} color="#059669" />
                <Text className="text-sm font-bold text-slate-900">
                  {isGs1Capture ? "datamatrix 스캔 완료" : "AI 분석 완료"}
                </Text>
                {isGs1Capture ? (
                  <View className="px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200">
                    <Text className="text-[11px] font-medium text-emerald-700">
                      Lot·유효기간 확정
                    </Text>
                  </View>
                ) : (
                  <View className={`px-2 py-0.5 rounded-full border ${confTone.bg} ${confTone.border}`}>
                    <Text className={`text-[11px] font-medium ${confTone.text}`}>
                      신뢰도: {confTone.label}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-xs text-slate-400 mt-0.5">
                {isGs1Capture
                  ? "Lot·유효기간은 datamatrix에서 확정. 제품명을 입력하세요"
                  : "추출 데이터를 확인하고 필요 시 수정하세요"}
              </Text>
            </View>
          </View>

          {/* §gs1-datamatrix — GTIN 표시(제품 매칭 아님 — 카탈로그 GTIN 필드 부재). */}
          {isGs1Capture && gs1Gtin && (
            <View className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-4">
              <Text className="text-[11px] text-slate-500">
                GTIN <Text className="font-mono text-slate-700">{gs1Gtin}</Text> · datamatrix
              </Text>
            </View>
          )}

          {/* §11.378 — OCR 저신뢰도 + 미보정 시 입고 차단(무효 사진 재고 오염 방지).
              제품명을 직접 수정하면 해제. 라벨 아닌 사진(키보드 등)이 재고로 들어가는 것 차단. */}
          {lowConf && !productNameDirty && (
            <View className="flex-row items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle size={16} color="#ef4444" />
              <Text className="flex-1 text-xs text-red-600 leading-5">
                라벨 인식 신뢰도가 낮습니다. 라벨이 맞는지 확인하고 제품명을 수정한 뒤
                진행하세요. 잘못된 사진은 재고 오염을 일으킬 수 있습니다.
              </Text>
            </View>
          )}

          {/* §1-2/PLAN rule 2 — Lot·유효기간 미확인 시 진행 차단 사유(no-op 금지). datamatrix는 verified로 면제. */}
          {criticalUnconfirmed && (
            <View className="flex-row items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle size={16} color="#ef4444" />
              <Text className="flex-1 text-xs text-red-600 leading-5">
                Lot 번호·유효기한을 확인(터치/수정)해주세요. 자동 인식값은 확인 후 입고됩니다.
                (재고 오염 방지)
              </Text>
            </View>
          )}

          {/* DB 매칭 표시 */}
          {labelResult?.matchedProduct && (
            <View className="flex-row items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 mb-4">
              <Package size={14} color="#059669" />
              <Text className="text-xs font-semibold text-emerald-700">
                DB 매칭: {labelResult.matchedProduct.name}
              </Text>
            </View>
          )}

          {/* 편집 폼 */}
          <View className="gap-3">
            <View>
              <Text className="text-xs font-medium text-slate-600 mb-1">제품명</Text>
              <TextInput
                className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                placeholder="예: Sodium Chloride"
                value={labelForm.productName}
                onChangeText={(v) => updateLabelField("productName", v)}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-slate-600 mb-1">카탈로그 번호</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                  placeholder="Cat. No."
                  value={labelForm.catalogNumber}
                  onChangeText={(v) => updateLabelField("catalogNumber", v)}
                  autoCapitalize="characters"
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Text className="text-xs font-medium text-slate-600">Lot 번호</Text>
                  {(() => {
                    const b = fieldSource(labelForm.lotNumber, lotScanFilled, lotDirty);
                    return b ? <Text className={`text-[9px] px-1.5 py-0.5 rounded ${b.cls}`}>{b.label}</Text> : null;
                  })()}
                  {commitGate.fieldMarks.lot === "needs-confirm" && (
                    <Text className="text-[10px] font-medium text-red-600">· 확인 필요</Text>
                  )}
                </View>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                  placeholder="Lot No."
                  value={labelForm.lotNumber}
                  onChangeText={(v) => updateLabelField("lotNumber", v)}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Text className="text-xs font-medium text-slate-600">유효기간</Text>
                  {(() => {
                    const b = fieldSource(labelForm.expirationDate, expiryScanFilled, expiryDirty);
                    return b ? <Text className={`text-[9px] px-1.5 py-0.5 rounded ${b.cls}`}>{b.label}</Text> : null;
                  })()}
                  {commitGate.fieldMarks.expiry === "needs-confirm" && (
                    <Text className="text-[10px] font-medium text-red-600">· 확인 필요</Text>
                  )}
                </View>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                  placeholder="YYYY-MM-DD"
                  value={labelForm.expirationDate}
                  onChangeText={(v) => updateLabelField("expirationDate", v)}
                />
              </View>
              <View className="w-28">
                <Text className="text-xs font-medium text-slate-600 mb-1">규격 (통 1개)</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                  placeholder="예: 100"
                  keyboardType="numeric"
                  value={labelForm.packSize}
                  onChangeText={(v) => updateLabelField("packSize", v)}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-slate-600 mb-1">제조사</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                  placeholder="제조사명"
                  value={labelForm.brand}
                  onChangeText={(v) => updateLabelField("brand", v)}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-slate-600 mb-1">CAS 번호</Text>
                <TextInput
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
                  placeholder="CAS No."
                  value={labelForm.casNumber}
                  onChangeText={(v) => updateLabelField("casNumber", v)}
                />
              </View>
            </View>
          </View>

          {/* §scan-mobile-multi-merge — 다장 캡처 누적: 폼 유지한 채 카메라 복귀 → 다음 촬영은
              빈 항목만 채움(곡면 병 catalogNo 누적 보완). 채워진/수기 값 보존. */}
          <Pressable
            className="flex-row items-center justify-center gap-1.5 border border-emerald-200 bg-emerald-50 rounded-xl py-3 px-4 mt-4"
            onPress={() => {
              setAccumulate(true);
              setState("scanning");
            }}
          >
            <RotateCcw size={15} color="#059669" />
            <Text className="text-sm font-semibold text-emerald-700">
              다른 각도 재촬영 (빈 항목 채우기)
            </Text>
          </Pressable>

          {/* 액션 */}
          <View className="flex-row gap-3 mt-6">
            <Pressable
              className="flex-row items-center justify-center gap-1.5 border border-slate-200 rounded-xl py-3.5 px-4"
              onPress={resetToScan}
            >
              <RotateCcw size={15} color="#475569" />
              <Text className="text-sm font-semibold text-slate-600">재촬영</Text>
            </Pressable>
            <Pressable
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                commitBlocked ? "bg-slate-200" : "bg-blue-600"
              }`}
              onPress={confirmLabelReceive}
              disabled={commitBlocked}
            >
              <CheckCircle2
                size={16}
                color={commitBlocked ? "#94a3b8" : "white"}
              />
              <Text
                className={`text-sm font-semibold ${
                  commitBlocked ? "text-slate-400" : "text-white"
                }`}
              >
                {isSourcingContext ? "이 라벨로 검색" : labelResult?.matchedInventory?.id ? "입고 처리로 이동" : "신규 등록으로 이동"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── 매칭 성공 → 액션 시트 ───
  if (state === "matched" && matchResult) {
    const actions = [
      {
        key: "detail",
        icon: Package,
        color: "#2563eb",
        bg: "bg-blue-50",
        title: "재고 상세 보기",
        desc: "품목 정보 및 Lot 현황 확인",
      },
      {
        key: "receive",
        icon: ArrowDownToLine,
        color: "#059669",
        bg: "bg-emerald-50",
        title: "입고 처리",
        desc: "새 Lot 입고 등록",
      },
      {
        key: "dispatch",
        icon: ArrowUpFromLine,
        color: "#8b5cf6",
        bg: "bg-purple-50",
        title: "출고 처리",
        desc: "사용/출고 수량 기록",
      },
      {
        key: "label",
        icon: Printer,
        color: "#d97706",
        bg: "bg-amber-50",
        title: "라벨 인쇄",
        desc: "QR 라벨 생성 및 인쇄",
      },
      {
        key: "location",
        icon: MapPin,
        color: "#0891b2",
        bg: "bg-cyan-50",
        title: "위치 지정",
        desc: "보관 위치 변경",
      },
    ];

    // §11.379 — 사용(QR 차감) 의도 진입 시 출고(dispatch) 액션을 상단 우선 노출.
    //   실제 차감은 lot-dispatch route 게이트가 책임(front-only 차감 0).
    if (intent === "use_qr") {
      const di = actions.findIndex((a) => a.key === "dispatch");
      if (di > 0) actions.unshift(actions.splice(di, 1)[0]);
    }

    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
          <Package size={28} color="#059669" />
        </View>
        <Text className="text-lg font-bold text-slate-900 mb-1">
          품목을 찾았습니다
        </Text>
        <Text className="text-xs text-slate-400 mb-6">
          스캔: {matchResult.scannedData}
        </Text>

        <View className="w-full gap-2.5">
          {actions.map((a) => (
            <Pressable
              key={a.key}
              className="flex-row items-center gap-3 bg-white border border-slate-200 rounded-xl p-4"
              onPress={() => handleAction(a.key)}
            >
              <View
                className={`w-10 h-10 rounded-full ${a.bg} items-center justify-center`}
              >
                <a.icon size={18} color={a.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">
                  {a.title}
                </Text>
                <Text className="text-xs text-slate-400">{a.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable className="mt-6" onPress={resetToScan}>
          <Text className="text-sm text-blue-600 font-medium">
            다시 스캔하기
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── 미매칭 → 수동 검색 / 신규 등록 분기 ───
  if (state === "unmatched") {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4">
          <AlertCircle size={28} color="#d97706" />
        </View>
        <Text className="text-lg font-bold text-slate-900 mb-1">
          일치하는 품목 없음
        </Text>
        <Text className="text-sm text-slate-500 text-center mb-1">
          스캔 데이터: {unmatchedData}
        </Text>
        <Text className="text-xs text-slate-400 text-center mb-6">
          등록되지 않은 품목이거나 코드가 올바르지 않습니다.
        </Text>

        <View className="w-full gap-3">
          <Pressable
            className="flex-row items-center justify-center gap-2 bg-blue-600 rounded-xl py-3.5"
            onPress={() => {
              setManualInput(unmatchedData);
              setState("manual");
            }}
          >
            <Search size={16} color="white" />
            <Text className="text-sm font-semibold text-white">수동 검색</Text>
          </Pressable>

          <Pressable
            className="flex-row items-center justify-center gap-2 bg-emerald-600 rounded-xl py-3.5"
            onPress={() => router.replace("/purchases/register")}
          >
            <ArrowDownToLine size={16} color="white" />
            <Text className="text-sm font-semibold text-white">신규 등록</Text>
          </Pressable>

          <Pressable
            className="flex-row items-center justify-center gap-2 border border-slate-200 rounded-xl py-3.5"
            onPress={resetToScan}
          >
            <Text className="text-sm font-semibold text-slate-600">
              다시 스캔
            </Text>
          </Pressable>

          <Pressable className="items-center py-2" onPress={() => router.back()}>
            <Text className="text-sm text-slate-400">닫기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── 에러 상태 ───
  if (state === "error") {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
          <AlertCircle size={28} color="#ef4444" />
        </View>
        <Text className="text-lg font-bold text-slate-900 mb-2">조회 실패</Text>
        <Text className="text-sm text-slate-500 text-center mb-6 leading-5">
          {errorMessage}
        </Text>

        <View className="w-full gap-3">
          <Pressable
            className="flex-row items-center justify-center gap-2 bg-blue-600 rounded-xl py-3.5"
            onPress={resetToScan}
          >
            <Text className="text-sm font-semibold text-white">다시 스캔</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center justify-center gap-2 border border-slate-200 rounded-xl py-3.5"
            onPress={() => {
              setManualInput("");
              setState("manual");
            }}
          >
            <Keyboard size={16} color="#475569" />
            <Text className="text-sm font-semibold text-slate-600">수동 검색</Text>
          </Pressable>
          <Pressable className="items-center py-2" onPress={() => router.back()}>
            <Text className="text-sm text-slate-400">닫기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── 수동 검색 모드 ───
  if (state === "manual") {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-6 pt-20">
          <Text className="text-lg font-bold text-slate-900 mb-1">
            수동 검색
          </Text>
          <Text className="text-xs text-slate-400 mb-6">
            카탈로그 번호 또는 품목명을 입력하세요
          </Text>

          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-800 mb-4"
            placeholder="예: CAT-001 또는 Tris-HCl"
            value={manualInput}
            onChangeText={setManualInput}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={handleManualSearch}
          />

          <Pressable
            className={`rounded-xl py-3.5 items-center mb-3 ${
              manualInput.trim() ? "bg-blue-600" : "bg-slate-200"
            }`}
            onPress={handleManualSearch}
            disabled={!manualInput.trim()}
          >
            <Text
              className={`text-sm font-semibold ${
                manualInput.trim() ? "text-white" : "text-slate-400"
              }`}
            >
              검색
            </Text>
          </Pressable>

          <Pressable className="items-center py-2" onPress={resetToScan}>
            <Text className="text-sm text-blue-600 font-medium">
              스캔으로 돌아가기
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── 메인: 카메라 스캔 화면 (바코드 + 라벨 OCR) ───
  const isLabelMode = scanMode === "label";
  const isBusy = state === "looking" || state === "label-capture";
  // §11.380 Phase 2 — 화면 포커스 + 스캔/촬영 단계에서만 카메라 active(이탈 시 정지).
  const isActive =
    isFocused && (state === "scanning" || state === "label-capture");
  // §11.380 Phase 3 — 라벨 검출 신호. 라벨 모드 스캔 중에만 lock 의미 부여.
  const isLocked = isLabelMode && state === "scanning" && lockState === "locked";

  return (
    <View className="flex-1 bg-black">
      {/* §11.380 Phase 2 — VisionCamera 는 self-closing(자식 없음). 오버레이는 형제 absolute. */}
      {device == null ? (
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-sm text-white/80">
            카메라 장치를 찾을 수 없습니다
          </Text>
        </View>
      ) : (
        <VisionCamera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          photo={true}
          torch={torch ? "on" : "off"}
          codeScanner={scanMode === "barcode" ? codeScanner : undefined}
          frameProcessor={
            scanMode === "label" && state === "scanning"
              ? frameProcessor
              : undefined
          }
        />
      )}
      <View className="flex-1">
          {/* 상단 바 */}
          <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
            <Pressable
              className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
              onPress={() => router.back()}
            >
              <X size={20} color="white" />
            </Pressable>
            <Text className="text-base font-bold text-white">
              {isLabelMode ? "스마트 입고" : "QR / 바코드 스캔"}
            </Text>
            <Pressable
              className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
              onPress={() => setTorch(!torch)}
            >
              {torch ? (
                <FlashlightOff size={18} color="white" />
              ) : (
                <Flashlight size={18} color="white" />
              )}
            </Pressable>
          </View>

          {/* 모드 토글 (바코드 / 라벨) */}
          <View className="items-center">
            <View className="flex-row bg-black/40 rounded-full p-1">
              <Pressable
                className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full ${
                  !isLabelMode ? "bg-white" : ""
                }`}
                onPress={() => setScanMode("barcode")}
              >
                <ScanLine size={14} color={!isLabelMode ? "#0f172a" : "white"} />
                <Text
                  className={`text-xs font-semibold ${
                    !isLabelMode ? "text-slate-900" : "text-white"
                  }`}
                >
                  바코드
                </Text>
              </Pressable>
              <Pressable
                className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full ${
                  isLabelMode ? "bg-white" : ""
                }`}
                onPress={() => setScanMode("label")}
              >
                <Camera size={14} color={isLabelMode ? "#0f172a" : "white"} />
                <Text
                  className={`text-xs font-semibold ${
                    isLabelMode ? "text-slate-900" : "text-white"
                  }`}
                >
                  라벨 촬영
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 가이드 프레임 — §11.380 Phase 3: 라벨 감지(locked) 시 emerald 강조(신호 전용, 진위 아님). */}
          <View className="flex-1 items-center justify-center">
            <View
              className={`w-64 h-64 border-2 rounded-2xl ${
                isLocked ? "border-emerald-400/80" : "border-white/60"
              }`}
            >
              {/* §scan-mobile-align-glow — 비차단 Vivino 정합 글로우(advisory). isLocked(라이브 lock
                  신호) 시 emerald 채움. verdict/촬영 게이팅 아님(§11.375). pointerEvents none → 촬영 무간섭. */}
              {isLocked && (
                <View
                  pointerEvents="none"
                  className="absolute inset-0 rounded-2xl bg-emerald-400/10 border border-emerald-400/40"
                />
              )}
              <View
                className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl ${
                  isLocked ? "border-emerald-400" : "border-white"
                }`}
              />
              <View
                className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl ${
                  isLocked ? "border-emerald-400" : "border-white"
                }`}
              />
              <View
                className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl ${
                  isLocked ? "border-emerald-400" : "border-white"
                }`}
              />
              <View
                className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl ${
                  isLocked ? "border-emerald-400" : "border-white"
                }`}
              />
            </View>
            {isBusy && (
              <View className="absolute">
                <ActivityIndicator color="white" size="large" />
              </View>
            )}
          </View>

          {/* 하단: 모드별 안내 + 액션 */}
          <View className="items-center pb-12 gap-4">
            {isLabelMode ? (
              <>
                {/* §11.380 Phase 3 — 감지 시 안내 강조. UI 텍스트에 진위 판정 표현 금지(§11.375): 감지 신호일 뿐. */}
                <Text
                  className={`text-sm text-center px-8 ${
                    isLocked ? "text-emerald-300 font-semibold" : "text-white/80"
                  }`}
                >
                  {isLocked
                    ? "라벨 감지됨 · 지금 촬영하세요"
                    : "시약 라벨을 프레임 안에 채우고 촬영하세요\nAI가 제품명·Lot·유효기간을 추출합니다"}
                </Text>
                {/* idle 여도 누를 수 있음(막다른 길 금지). locked 는 emerald 강조 신호만. */}
                <Pressable
                  className={`w-16 h-16 rounded-full items-center justify-center ${
                    isBusy ? "bg-white/40" : isLocked ? "bg-emerald-500" : "bg-white"
                  }`}
                  onPress={() => handleCaptureLabel(accumulate)}
                  disabled={isBusy}
                >
                  {state === "label-capture" ? (
                    <ActivityIndicator color={isLocked ? "white" : "#0f172a"} />
                  ) : (
                    <Camera size={26} color={isLocked ? "white" : "#0f172a"} />
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-sm text-white/80">
                  시약 라벨의 QR 또는 바코드를 스캔하세요
                </Text>
                <Pressable
                  className="flex-row items-center gap-2 bg-white/20 rounded-full px-5 py-2.5"
                  onPress={() => {
                    setManualInput("");
                    setState("manual");
                  }}
                >
                  <Keyboard size={14} color="white" />
                  <Text className="text-xs font-medium text-white">
                    직접 입력으로 검색
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
