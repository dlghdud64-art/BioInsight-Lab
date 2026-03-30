import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Printer, FileText, Tag as TagIcon, Minus, Plus } from "lucide-react-native";
import { useInventoryDetail } from "../../hooks/useApi";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type PrintMode = "a4-multi" | "label-printer";

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function buildLabelHtml(info: {
  productName: string;
  brand: string;
  lotNumber: string;
  qty: string;
  unit: string;
  expiry: string;
  location: string;
  storage: string;
}) {
  return `
    <div style="border:2px solid #333;border-radius:8px;padding:14px;width:280px;font-family:sans-serif;page-break-inside:avoid;margin:6px;">
      <div style="font-size:14px;font-weight:bold;margin-bottom:2px;">${info.productName}</div>
      <div style="font-size:10px;color:#666;margin-bottom:10px;">${info.brand}</div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="font-size:18px;font-weight:bold;text-align:center;letter-spacing:2px;margin:10px 0;">${info.lotNumber || "N/A"}</div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:#666;">수량</span><span style="font-weight:600;">${info.qty} ${info.unit}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:#666;">유효기한</span><span style="font-weight:600;">${formatDate(info.expiry)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:#666;">위치</span><span style="font-weight:600;">${info.location || "-"}</span></div>
      ${info.storage ? `<div style="display:flex;justify-content:space-between;font-size:11px;"><span style="color:#666;">보관</span><span style="font-weight:600;">${info.storage}</span></div>` : ""}
    </div>
  `;
}

export default function LotLabelScreen() {
  const { id, lotNumber, lotQty, lotUnit, lotExpiry, lotLocation, lotStorage } =
    useLocalSearchParams<{
      id: string;
      lotNumber?: string;
      lotQty?: string;
      lotUnit?: string;
      lotExpiry?: string;
      lotLocation?: string;
      lotStorage?: string;
    }>();
  const { data: inventory } = useInventoryDetail(id);

  const [mode, setMode] = useState<PrintMode>("a4-multi");
  const [labelCount, setLabelCount] = useState(4);
  const [isPrinting, setIsPrinting] = useState(false);

  const productName = inventory?.productName || inventory?.product?.name || "";
  const brand = inventory?.brand || inventory?.product?.brand || "";

  const labelsPerPage = mode === "a4-multi" ? 8 : 1;
  const pageCount = Math.ceil(labelCount / labelsPerPage);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const info = {
        productName,
        brand,
        lotNumber: lotNumber || "",
        qty: lotQty || "0",
        unit: lotUnit || "ea",
        expiry: lotExpiry || "",
        location: lotLocation || "",
        storage: lotStorage || "",
      };

      const labels = Array(labelCount).fill(0).map(() => buildLabelHtml(info)).join("");

      const isA4 = mode === "a4-multi";
      const html = `
        <html>
          <head>
            <style>
              @page { margin: ${isA4 ? "15mm" : "2mm"}; size: ${isA4 ? "A4" : "62mm 100mm"}; }
              body { margin: 0; padding: 0; }
              .grid { display: flex; flex-wrap: wrap; gap: 8px; ${isA4 ? "justify-content: center;" : ""} }
            </style>
          </head>
          <body><div class="grid">${labels}</div></body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("완료", "라벨 PDF가 생성되었습니다.");
      }
    } catch {
      Alert.alert("오류", "라벨 생성에 실패했습니다.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
    >
      <View className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5">
        <View className="flex-row items-center gap-2 mb-1">
          <Printer size={16} color="#7c3aed" />
          <Text className="text-sm font-bold text-purple-700">라벨 인쇄</Text>
        </View>
        <Text className="text-xs text-purple-600">
          {lotNumber || "Lot 미지정"} · {lotQty || 0} {lotUnit || "ea"}
        </Text>
      </View>

      {/* 인쇄 모드 선택 */}
      <Text className="text-sm font-medium text-slate-700 mb-2">출력 모드</Text>
      <View className="flex-row gap-3 mb-5">
        <Pressable
          className={`flex-1 p-3.5 rounded-xl border items-center gap-1.5 ${
            mode === "a4-multi"
              ? "border-purple-400 bg-purple-50"
              : "border-slate-200 bg-white"
          }`}
          onPress={() => setMode("a4-multi")}
        >
          <FileText size={20} color={mode === "a4-multi" ? "#7c3aed" : "#94a3b8"} />
          <Text className={`text-xs font-semibold ${mode === "a4-multi" ? "text-purple-700" : "text-slate-500"}`}>
            A4 다중 배치
          </Text>
          <Text className="text-[11px] text-slate-400">8장/페이지</Text>
        </Pressable>
        <Pressable
          className={`flex-1 p-3.5 rounded-xl border items-center gap-1.5 ${
            mode === "label-printer"
              ? "border-purple-400 bg-purple-50"
              : "border-slate-200 bg-white"
          }`}
          onPress={() => setMode("label-printer")}
        >
          <TagIcon size={20} color={mode === "label-printer" ? "#7c3aed" : "#94a3b8"} />
          <Text className={`text-xs font-semibold ${mode === "label-printer" ? "text-purple-700" : "text-slate-500"}`}>
            라벨 프린터용
          </Text>
          <Text className="text-[11px] text-slate-400">62mm 롤</Text>
        </Pressable>
      </View>

      {/* 라벨 수량 */}
      <Text className="text-sm font-medium text-slate-700 mb-2">라벨 수량</Text>
      <View className="flex-row items-center justify-center gap-4 mb-5 bg-slate-50 rounded-xl p-4">
        <Pressable
          className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center"
          onPress={() => setLabelCount(Math.max(1, labelCount - 1))}
        >
          <Minus size={16} color="#64748b" />
        </Pressable>
        <Text className="text-2xl font-bold text-slate-900 w-12 text-center">
          {labelCount}
        </Text>
        <Pressable
          className="w-10 h-10 rounded-full bg-white border border-slate-200 items-center justify-center"
          onPress={() => setLabelCount(Math.min(50, labelCount + 1))}
        >
          <Plus size={16} color="#64748b" />
        </Pressable>
      </View>

      {/* 인쇄 미리보기 정보 */}
      <View className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 gap-2">
        <Text className="text-xs font-semibold text-slate-600 mb-1">인쇄 정보</Text>
        <View className="flex-row justify-between">
          <Text className="text-xs text-slate-400">라벨 수량</Text>
          <Text className="text-xs font-medium text-slate-700">{labelCount}장</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-slate-400">예상 페이지</Text>
          <Text className="text-xs font-medium text-slate-700">{pageCount}페이지</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-slate-400">출력 모드</Text>
          <Text className="text-xs font-medium text-slate-700">
            {mode === "a4-multi" ? "A4 다중 배치" : "라벨 프린터용"}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-slate-400">품목</Text>
          <Text className="text-xs font-medium text-slate-700" numberOfLines={1}>
            {productName}
          </Text>
        </View>
      </View>

      {/* 인쇄 버튼 */}
      <Pressable
        className="bg-purple-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
        onPress={handlePrint}
        disabled={isPrinting}
      >
        {isPrinting ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Printer size={16} color="white" />
            <Text className="text-sm font-semibold text-white">
              {labelCount}장 인쇄
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}
