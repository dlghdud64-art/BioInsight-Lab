import { View, Text } from "react-native";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-slate-100", text: "text-slate-600", label: "초안" },
  PENDING: { bg: "bg-amber-100", text: "text-amber-700", label: "대기" },
  IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700", label: "진행중" },
  COMPLETED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "완료" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-700", label: "취소" },
  ON_HOLD: { bg: "bg-purple-100", text: "text-purple-700", label: "보류" },
  NORMAL: { bg: "bg-emerald-100", text: "text-emerald-700", label: "정상" },
  LOW_STOCK: { bg: "bg-orange-100", text: "text-orange-700", label: "부족" },
  OUT_OF_STOCK: { bg: "bg-red-100", text: "text-red-700", label: "품절" },
  EXPIRED: { bg: "bg-red-100", text: "text-red-700", label: "만료" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: status,
  };

  return (
    <View className={`px-2 py-0.5 rounded-full ${style.bg}`}>
      <Text className={`text-[11px] font-semibold ${style.text}`}>
        {style.label}
      </Text>
    </View>
  );
}
