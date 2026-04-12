import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
} from "lucide-react-native";
import { lookupInventory } from "../hooks/useApi";
import { logEvent } from "../lib/analytics";

type ScanState = "scanning" | "looking" | "matched" | "unmatched" | "manual" | "error";

interface MatchResult {
  inventoryId: string;
  scannedData: string;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>("scanning");
  const [torch, setTorch] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [unmatchedData, setUnmatchedData] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const resetToScan = useCallback(() => {
    setState("scanning");
    setMatchResult(null);
    setUnmatchedData("");
    setErrorMessage("");
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
      if (state !== "scanning") return;
      performLookup(data, "scan");
    },
    [state, performLookup]
  );

  const handleManualSearch = useCallback(() => {
    const query = manualInput.trim();
    if (!query) return;
    performLookup(query, "manual");
  }, [manualInput, performLookup]);

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
          QR/바코드 스캔을 위해 카메라 접근 권한이 필요합니다.{"\n"}
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

  // ─── 메인: 카메라 스캔 화면 ───
  return (
    <View className="flex-1 bg-black">
      <CameraView
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
        onBarcodeScanned={state === "scanning" ? handleBarCodeScanned : undefined}
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
              QR / 바코드 스캔
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

          {/* 가이드 프레임 */}
          <View className="flex-1 items-center justify-center">
            <View className="w-64 h-64 border-2 border-white/60 rounded-2xl">
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
            </View>
            {state === "looking" && (
              <View className="absolute">
                <ActivityIndicator color="white" size="large" />
              </View>
            )}
          </View>

          {/* 하단: 안내 + 수동 검색 버튼 */}
          <View className="items-center pb-12 gap-4">
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
          </View>
        </View>
      </CameraView>
    </View>
  );
}
