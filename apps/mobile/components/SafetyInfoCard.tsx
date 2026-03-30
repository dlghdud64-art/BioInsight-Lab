import { View, Text, Pressable } from "react-native";
import { Linking } from "react-native";
import {
  ShieldAlert,
  Thermometer,
  FileText,
  AlertTriangle,
} from "lucide-react-native";

// GHS 위험코드 → 한국어 라벨
const HAZARD_LABELS: Record<string, string> = {
  H200: "불안정한 폭발물",
  H290: "금속부식성",
  H302: "경구 유해",
  H314: "심한 피부 화상·눈 손상",
  H315: "피부 자극성",
  H318: "심한 눈 손상",
  H319: "심한 눈 자극성",
  H330: "흡입 치명적",
  H335: "호흡기 자극",
  H400: "수생환경 유해",
};

// PPE 코드 → 한국어 라벨
const PPE_LABELS: Record<string, string> = {
  gloves: "보호장갑",
  goggles: "보안경",
  mask: "방독마스크",
  labcoat: "실험복",
  faceshield: "안면보호대",
  respirator: "호흡보호구",
  boots: "안전화",
};

// GHS 픽토그램 → 아이콘 색상
const PICTOGRAM_COLORS: Record<string, string> = {
  corrosive: "#dc2626",
  exclamation: "#f59e0b",
  flame: "#ef4444",
  skull: "#7f1d1d",
  health: "#2563eb",
  environment: "#16a34a",
  explosive: "#b91c1c",
  oxidizer: "#ea580c",
  gas: "#6366f1",
};

interface SafetyInfoCardProps {
  msdsUrl?: string | null;
  hazardCodes?: string[];
  pictograms?: string[];
  storageCondition?: string | null;
  ppe?: string[];
  safetyNote?: string | null;
}

export function SafetyInfoCard({
  msdsUrl,
  hazardCodes,
  pictograms,
  storageCondition,
  ppe,
  safetyNote,
}: SafetyInfoCardProps) {
  const hasAnyData =
    msdsUrl ||
    (hazardCodes && hazardCodes.length > 0) ||
    (pictograms && pictograms.length > 0) ||
    storageCondition ||
    (ppe && ppe.length > 0) ||
    safetyNote;

  if (!hasAnyData) return null;

  return (
    <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
      <View className="flex-row items-center gap-2 mb-3">
        <ShieldAlert size={16} color="#dc2626" />
        <Text className="text-sm font-bold text-slate-900">안전 정보</Text>
      </View>

      {/* GHS 위험등급 배지 */}
      {hazardCodes && hazardCodes.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs text-slate-400 mb-1.5">위험등급 (GHS)</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {hazardCodes.map((code) => (
              <View
                key={code}
                className="bg-red-50 border border-red-200 rounded-md px-2 py-1"
              >
                <Text className="text-xs font-semibold text-red-700">
                  {code}
                </Text>
                {HAZARD_LABELS[code] && (
                  <Text className="text-xs text-red-500">
                    {HAZARD_LABELS[code]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 픽토그램 */}
      {pictograms && pictograms.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs text-slate-400 mb-1.5">경고 표시</Text>
          <View className="flex-row flex-wrap gap-2">
            {pictograms.map((p) => (
              <View
                key={p}
                className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex-row items-center gap-1"
              >
                <AlertTriangle
                  size={12}
                  color={PICTOGRAM_COLORS[p] || "#f59e0b"}
                />
                <Text className="text-xs font-medium text-amber-800 capitalize">
                  {p}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 보관 조건 */}
      {storageCondition && (
        <View className="flex-row items-center gap-2 mb-2">
          <Thermometer size={14} color="#64748b" />
          <Text className="text-xs text-slate-600">{storageCondition}</Text>
        </View>
      )}

      {/* 보호장비 (PPE) */}
      {ppe && ppe.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs text-slate-400 mb-1.5">보호장비 (PPE)</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {ppe.map((item) => (
              <View
                key={item}
                className="bg-blue-50 border border-blue-200 rounded-md px-2 py-1"
              >
                <Text className="text-xs font-medium text-blue-700">
                  {PPE_LABELS[item] || item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 안전 메모 */}
      {safetyNote && (
        <View className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
          <Text className="text-xs text-amber-800">{safetyNote}</Text>
        </View>
      )}

      {/* MSDS 버튼 */}
      {msdsUrl && (
        <Pressable
          className="flex-row items-center justify-center gap-2 bg-slate-100 border border-slate-200 rounded-xl py-2.5"
          onPress={() => Linking.openURL(msdsUrl)}
        >
          <FileText size={14} color="#475569" />
          <Text className="text-xs font-semibold text-slate-700">
            MSDS 문서 보기
          </Text>
        </Pressable>
      )}
    </View>
  );
}
