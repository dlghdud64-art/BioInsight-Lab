import { useState, useCallback, useRef } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
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

// §11.319 — 라벨 OCR 추출 결과 편집 폼
interface LabelForm {
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
}

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
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>("scanning");
  const [scanMode, setScanMode] = useState<ScanMode>("barcode");
  const [torch, setTorch] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [unmatchedData, setUnmatchedData] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // §11.319 — 라벨 OCR 상태
  const cameraRef = useRef<CameraView>(null);
  const [labelResult, setLabelResult] = useState<LabelScanResponse | null>(null);
  const [labelForm, setLabelForm] = useState<LabelForm>(emptyLabelForm());
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  // §11.340 — Lot/유효기한 출처 추적(라벨 스캔 확인 vs 수기 입력, §11.335 정책).
  const [lotScanFilled, setLotScanFilled] = useState(false);
  const [expiryScanFilled, setExpiryScanFilled] = useState(false);
  const [lotDirty, setLotDirty] = useState(false);
  const [expiryDirty, setExpiryDirty] = useState(false);

  const resetToScan = useCallback(() => {
    setState("scanning");
    setMatchResult(null);
    setUnmatchedData("");
    setErrorMessage("");
    setLabelResult(null);
    setLabelForm(emptyLabelForm());
    setLotScanFilled(false); setExpiryScanFilled(false);
    setLotDirty(false); setExpiryDirty(false);
    setCapturedUri(null);
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

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (state !== "scanning" || scanMode !== "barcode") return;
      performLookup(data, "scan");
    },
    [state, scanMode, performLookup]
  );

  const handleManualSearch = useCallback(() => {
    const query = manualInput.trim();
    if (!query) return;
    performLookup(query, "manual");
  }, [manualInput, performLookup]);

  // §11.319 — 라벨 촬영 → OCR 분석
  const handleCaptureLabel = useCallback(async () => {
    if (state === "label-capture") return;
    setState("label-capture");
    logEvent("label_scan_started", {});
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });
      if (!photo?.base64) {
        throw new Error("촬영 이미지를 가져오지 못했습니다.");
      }
      setCapturedUri(photo.uri ?? null);
      const dataUri = `data:image/jpeg;base64,${photo.base64}`;
      const result = await scanLabel(dataUri);
      setLabelResult(result);
      setLabelForm(mapLabelToForm(result));
      // §11.340 — 스캔 결과 Lot/유효기한 출처 기록.
      setLotScanFilled(Boolean(result.parsed.lotNo));
      setExpiryScanFilled(Boolean(result.parsed.expirationDate));
      setLotDirty(false);
      setExpiryDirty(false);
      logEvent("label_scan_success", {
        confidence: result.parsed.confidence,
        matched: result.matchedProduct ? 1 : 0,
        provider: result.ocrMetadata?.providerUsed ?? "REGEX",
      });
      setState("label-review");
    } catch (err) {
      logEvent("label_scan_failed", { error: String(err) });
      setErrorMessage(
        "라벨 분석에 실패했습니다.\n조명을 확보하고 라벨을 프레임 안에 맞춰 다시 촬영해주세요."
      );
      setState("error");
    }
  }, [state]);

  const updateLabelField = useCallback((key: keyof LabelForm, value: string) => {
    setLabelForm((f) => ({ ...f, [key]: value }));
    // §11.340 — 직접 수정 → 수기 출처로 전환.
    if (key === "lotNumber") setLotDirty(true);
    if (key === "expirationDate") setExpiryDirty(true);
  }, []);

  // §11.340 — 출처 배지(스캔 확인 vs 수기). 스캔으로 채워졌고 미수정 = 검증값.
  const fieldSource = (value: string, scanFilled: boolean, dirty: boolean) => {
    if (scanFilled && !dirty) return { label: "라벨 스캔 확인", cls: "bg-emerald-100 text-emerald-700" };
    if (value.trim()) return { label: "수기 입력", cls: "bg-slate-100 text-slate-500" };
    return null;
  };

  // §11.319 — 입고 prefill: 매칭 재고 있으면 입고(lot-receive), 없으면 신규 등록(register)
  const confirmLabelReceive = useCallback(() => {
    if (!labelForm.productName.trim()) {
      setErrorMessage("제품명을 입력해주세요.");
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
  }, [labelResult, labelForm]);

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

  // ─── 권한 로딩 중 ───
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  // ─── 권한 거부 (Fallback UI 포함) ───
  if (!permission.granted) {
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

        {permission.canAskAgain ? (
          <Pressable
            className="bg-blue-600 rounded-xl px-8 py-3.5 mb-3 w-full items-center"
            onPress={requestPermission}
          >
            <Text className="text-sm font-semibold text-white">
              카메라 권한 허용
            </Text>
          </Pressable>
        ) : (
          <Pressable
            className="flex-row items-center justify-center gap-2 bg-slate-700 rounded-xl px-8 py-3.5 mb-3 w-full"
            onPress={() => Linking.openSettings()}
          >
            <Settings size={16} color="white" />
            <Text className="text-sm font-semibold text-white">
              설정에서 권한 허용
            </Text>
          </Pressable>
        )}

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
    const level = labelResult
      ? mapOcrConfidence(labelResult.parsed.confidence)
      : "low";
    const lowConf = level === "low";
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
                <Text className="text-sm font-bold text-slate-900">AI 분석 완료</Text>
                <View className={`px-2 py-0.5 rounded-full border ${confTone.bg} ${confTone.border}`}>
                  <Text className={`text-[11px] font-medium ${confTone.text}`}>
                    신뢰도: {confTone.label}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-slate-400 mt-0.5">
                추출 데이터를 확인하고 필요 시 수정하세요
              </Text>
            </View>
          </View>

          {/* 저신뢰 재촬영 권유 (비차단) */}
          {lowConf && (
            <View className="flex-row items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle size={16} color="#ef4444" />
              <Text className="flex-1 text-xs text-red-600 leading-5">
                인식 신뢰도가 낮습니다. 조명을 확보하고 라벨을 프레임 안에 채워 재촬영하면
                정확도가 올라갑니다. 그대로 진행할 수도 있습니다.
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
                labelForm.productName.trim() ? "bg-blue-600" : "bg-slate-200"
              }`}
              onPress={confirmLabelReceive}
              disabled={!labelForm.productName.trim()}
            >
              <CheckCircle2
                size={16}
                color={labelForm.productName.trim() ? "white" : "#94a3b8"}
              />
              <Text
                className={`text-sm font-semibold ${
                  labelForm.productName.trim() ? "text-white" : "text-slate-400"
                }`}
              >
                {labelResult?.matchedInventory?.id ? "입고 처리로 이동" : "신규 등록으로 이동"}
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

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "ean13",
            "ean8",
            "code128",
            "code39",
            "code93",
            "upc_a",
            "upc_e",
            "datamatrix",
          ],
        }}
        onBarcodeScanned={
          scanMode === "barcode" && state === "scanning"
            ? handleBarCodeScanned
            : undefined
        }
      >
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

          {/* 가이드 프레임 */}
          <View className="flex-1 items-center justify-center">
            <View className="w-64 h-64 border-2 border-white/60 rounded-2xl">
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
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
                <Text className="text-sm text-white/80 text-center px-8">
                  시약 라벨을 프레임 안에 채우고 촬영하세요{"\n"}
                  AI가 제품명·Lot·유효기간을 추출합니다
                </Text>
                <Pressable
                  className={`w-16 h-16 rounded-full items-center justify-center ${
                    isBusy ? "bg-white/40" : "bg-white"
                  }`}
                  onPress={handleCaptureLabel}
                  disabled={isBusy}
                >
                  {state === "label-capture" ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <Camera size={26} color="#0f172a" />
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
      </CameraView>
    </View>
  );
}
