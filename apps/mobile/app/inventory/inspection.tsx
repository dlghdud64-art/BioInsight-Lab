import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Check,
  X,
} from "lucide-react-native";
import { useCreateInspection } from "../../hooks/useApi";
import { getErrorMessage } from "../../lib/errorMessages";
import { PhotoAttachment, type AttachedPhoto } from "../../components/PhotoAttachment";

type InspectionResult = "PASS" | "CAUTION" | "FAIL";

interface Checklist {
  storageOk: boolean;
  labelOk: boolean;
  expiryOk: boolean;
  conditionOk: boolean;
}

const CHECKLIST_ITEMS: { key: keyof Checklist; label: string; desc: string }[] = [
  { key: "storageOk", label: "보관 상태", desc: "지정 위치에 올바르게 보관되어 있는가" },
  { key: "labelOk", label: "용기/라벨", desc: "용기 손상 없고, 라벨이 명확히 부착되어 있는가" },
  { key: "expiryOk", label: "유효기한", desc: "유효기한 내 사용 가능한 상태인가" },
  { key: "conditionOk", label: "보관 조건", desc: "온도·습도 등 보관 조건이 적합한가" },
];

const RESULT_OPTIONS: {
  value: InspectionResult;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof CheckCircle2;
}[] = [
  {
    value: "PASS",
    label: "양호",
    color: "#059669",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-300",
    icon: CheckCircle2,
  },
  {
    value: "CAUTION",
    label: "주의",
    color: "#d97706",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
    icon: AlertTriangle,
  },
  {
    value: "FAIL",
    label: "불량",
    color: "#dc2626",
    bgColor: "bg-red-50",
    borderColor: "border-red-300",
    icon: XCircle,
  },
];

export default function InspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const createInspection = useCreateInspection();

  const [checklist, setChecklist] = useState<Checklist>({
    storageOk: true,
    labelOk: true,
    expiryOk: true,
    conditionOk: true,
  });
  const [result, setResult] = useState<InspectionResult>("PASS");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<AttachedPhoto[]>([]);

  const toggleCheck = (key: keyof Checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = () => {
    const photoUrls = photos
      .filter((p) => p.status === "success" && p.uploadedUrl)
      .map((p) => p.uploadedUrl!);

    createInspection.mutate(
      {
        id,
        result,
        checklist,
        notes: notes.trim() || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      },
      {
        onSuccess: () => {
          Alert.alert("완료", "점검 기록이 저장되었습니다.", [
            { text: "확인", onPress: () => router.back() },
          ]);
        },
        onError: (err) => {
          Alert.alert("오류", getErrorMessage(err));
        },
      }
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 체크리스트 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <Text className="text-sm font-bold text-slate-900 mb-3">
            점검 항목
          </Text>
          {CHECKLIST_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              className="flex-row items-center gap-3 py-3 border-b border-slate-100"
              onPress={() => toggleCheck(item.key)}
            >
              <View
                className={`w-6 h-6 rounded-md items-center justify-center ${
                  checklist[item.key]
                    ? "bg-emerald-500"
                    : "bg-white border-2 border-slate-300"
                }`}
              >
                {checklist[item.key] ? (
                  <Check size={14} color="white" />
                ) : (
                  <X size={14} color="#cbd5e1" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate-800">
                  {item.label}
                </Text>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {item.desc}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* 결과 선택 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <Text className="text-sm font-bold text-slate-900 mb-3">
            점검 결과
          </Text>
          <View className="flex-row gap-2">
            {RESULT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = result === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  className={`flex-1 items-center py-3 rounded-xl border-2 ${
                    selected
                      ? `${opt.bgColor} ${opt.borderColor}`
                      : "bg-white border-slate-200"
                  }`}
                  onPress={() => setResult(opt.value)}
                >
                  <Icon
                    size={24}
                    color={selected ? opt.color : "#cbd5e1"}
                  />
                  <Text
                    className={`text-xs font-semibold mt-1 ${
                      selected ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 사진 첨부 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <Text className="text-sm font-bold text-slate-900 mb-3">
            사진 첨부
          </Text>
          <PhotoAttachment
            photos={photos}
            onChange={setPhotos}
            context="inspection"
            maxCount={5}
          />
        </View>

        {/* 비고 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">비고</Text>
          <TextInput
            className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 min-h-[80px]"
            placeholder="특이사항을 입력하세요..."
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* 저장 버튼 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-8">
        <Pressable
          className={`items-center rounded-xl py-3.5 ${
            createInspection.isPending ? "bg-blue-400" : "bg-blue-600"
          }`}
          onPress={handleSubmit}
          disabled={createInspection.isPending}
        >
          {createInspection.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">
              점검 기록 저장
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
