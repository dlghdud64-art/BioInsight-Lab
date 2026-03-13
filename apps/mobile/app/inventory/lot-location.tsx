import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { MapPin } from "lucide-react-native";
import { useUpdateInventoryLocation } from "../../hooks/useApi";

const STORAGE_CONDITIONS = [
  { key: "room", label: "실온 (15~25°C)" },
  { key: "cold", label: "냉장 (2~8°C)" },
  { key: "frozen", label: "냉동 (-20°C)" },
  { key: "ultra", label: "초저온 (-80°C)" },
  { key: "dark", label: "차광 보관" },
  { key: "dry", label: "건조 보관" },
];

export default function LotLocationScreen() {
  const { id, lotNumber, lotLocation, lotStorage } = useLocalSearchParams<{
    id: string;
    lotNumber?: string;
    lotLocation?: string;
    lotStorage?: string;
  }>();
  const updateLocation = useUpdateInventoryLocation();

  const [location, setLocation] = useState(lotLocation || "");
  const [storage, setStorage] = useState(lotStorage || "");

  const hasChanged = location.trim() !== (lotLocation || "").trim() ||
    storage !== (lotStorage || "");

  const handleSave = () => {
    if (!location.trim()) {
      Alert.alert("오류", "보관 위치를 입력하세요.");
      return;
    }

    updateLocation.mutate(
      { id, location: location.trim() },
      {
        onSuccess: () => {
          Alert.alert("완료", "위치가 저장되었습니다.", [
            { text: "확인", onPress: () => router.back() },
          ]);
        },
        onError: () => Alert.alert("오류", "위치 저장에 실패했습니다."),
      }
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <View className="flex-1 px-5 pt-4">
        <View className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
          <View className="flex-row items-center gap-2 mb-1">
            <MapPin size={16} color="#64748b" />
            <Text className="text-sm font-bold text-slate-700">위치 지정</Text>
          </View>
          <Text className="text-xs text-slate-500">
            {lotNumber || "Lot 미지정"}
            {lotLocation ? ` · 현재: ${lotLocation}` : " · 위치 미지정"}
          </Text>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">
            보관 위치 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="예: 냉장고 A-2, 시약장 B-1, 냉동실 3층"
            value={location}
            onChangeText={setLocation}
            autoFocus
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">보관 조건</Text>
          <View className="flex-row flex-wrap gap-2">
            {STORAGE_CONDITIONS.map((c) => (
              <Pressable
                key={c.key}
                className={`px-3 py-2 rounded-lg border ${
                  storage === c.key
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-slate-200"
                }`}
                onPress={() => setStorage(storage === c.key ? "" : c.key)}
              >
                <Text
                  className={`text-xs font-medium ${
                    storage === c.key ? "text-white" : "text-slate-600"
                  }`}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="px-5 py-4 pb-8 border-t border-slate-100 bg-white">
        <Pressable
          className={`rounded-xl py-3.5 items-center ${hasChanged ? "bg-slate-800" : "bg-slate-200"}`}
          onPress={handleSave}
          disabled={!hasChanged || updateLocation.isPending}
        >
          {updateLocation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`text-sm font-semibold ${hasChanged ? "text-white" : "text-slate-400"}`}>
              저장
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
