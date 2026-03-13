import { useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Flashlight, FlashlightOff, Settings } from "lucide-react-native";
import { lookupInventory } from "../hooks/useApi";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLooking, setIsLooking] = useState(false);
  const [torch, setTorch] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isLooking) return;
    setScanned(true);
    setIsLooking(true);

    try {
      // 스캔 결과로 재고 조회 (catalogNumber 또는 품목명으로 매칭)
      const inventoryId = await lookupInventory({
        catalogNumber: data,
        productName: data,
      });

      if (inventoryId) {
        router.replace(`/inventory/${inventoryId}`);
      } else {
        Alert.alert(
          "품목 없음",
          `"${data}"에 해당하는 재고 품목을 찾을 수 없습니다.`,
          [
            { text: "다시 스캔", onPress: () => { setScanned(false); setIsLooking(false); } },
            { text: "닫기", onPress: () => router.back() },
          ]
        );
        setIsLooking(false);
      }
    } catch {
      Alert.alert("오류", "품목 조회에 실패했습니다.", [
        { text: "다시 스캔", onPress: () => { setScanned(false); setIsLooking(false); } },
      ]);
      setIsLooking(false);
    }
  };

  // 권한 로딩 중
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  // 권한 거부
  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-bold text-slate-900 mb-2">
          카메라 권한 필요
        </Text>
        <Text className="text-sm text-slate-500 text-center mb-6">
          QR/바코드 스캔을 위해 카메라 접근 권한이 필요합니다.
        </Text>
        {permission.canAskAgain ? (
          <Pressable
            className="bg-blue-600 rounded-xl px-6 py-3 mb-3"
            onPress={requestPermission}
          >
            <Text className="text-sm font-semibold text-white">권한 허용</Text>
          </Pressable>
        ) : (
          <Pressable
            className="flex-row items-center gap-2 bg-slate-100 rounded-xl px-6 py-3 mb-3"
            onPress={() => Linking.openSettings()}
          >
            <Settings size={16} color="#475569" />
            <Text className="text-sm font-semibold text-slate-700">
              설정에서 권한 허용
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.back()}>
          <Text className="text-sm text-slate-400">뒤로 가기</Text>
        </Pressable>
      </View>
    );
  }

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
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* 오버레이 */}
        <View className="flex-1">
          {/* 상단 바 */}
          <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
            <Pressable
              className="w-10 h-10 rounded-full bg-black/40 items-center justify-center"
              onPress={() => router.back()}
            >
              <X size={20} color="white" />
            </Pressable>
            <Text className="text-base font-bold text-white">QR / 바코드 스캔</Text>
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
              {/* 코너 강조 */}
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
            </View>
            {isLooking && (
              <View className="absolute">
                <ActivityIndicator color="white" size="large" />
              </View>
            )}
          </View>

          {/* 하단 안내 */}
          <View className="items-center pb-12">
            <Text className="text-sm text-white/80">
              시약 라벨의 QR 또는 바코드를 스캔하세요
            </Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
