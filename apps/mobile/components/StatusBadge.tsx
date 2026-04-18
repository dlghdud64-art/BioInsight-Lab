import { View, Text } from "react-native";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "bg-slate-100", text: "text-slate-600", label: "초안" },
  PENDING: { bg: "bg-amber-100", text: "text-amber-700", label: "대기" },
  SENT: { bg: "bg-blue-100", text: "text-blue-700", label: "발송완료" },
  IN_PROGRESS: { bg: "bg-blue-100", text: "text-blue-700", label: "진행중" },
  COMPLETED: { bg: "bg-emerald-100", text: "text-emerald-700", label: "완료" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-700", label: "취소" },
  ON_HOLD: { bg: "bg-purple-100", text: "text-purple-700", label: "보류" },
  PURCHASED: { bg: "bg-green-100", text: "text-green-700", label: "구매전환" },
  RESPONDED: { bg: "bg-teal-100", text: "text-teal-700", label: "응답완료" },
  VENDOR_INQUIRY: { bg: "bg-violet-100", text: "text-violet-700", label: "공급사문의" },
  WAITING_REPLY: { bg: "bg-cyan-100", text: "text-cyan-700", label: "회신대기" },
  NEEDS_INSPECTION: { bg: "bg-orange-100", text: "text-orange-700", label: "점검필요" },
  NORMAL: { bg: "bg-emerald-100", text: "text-emerald-700", label: "정상" },
  LOW_STOCK: { bg: "bg-orange-100", text: "text-orange-700", label: "부족" },
  OUT_OF_STOCK: { bg: "bg-red-100", text: "text-red-700", label: "품절" },
  EXPIRED: { bg: "bg-red-100", text: "text-red-700", label: "만료" },
  inventory_reflected: { bg: "bg-emerald-100", text: "text-emerald-700", label: "입고완료" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: status,
  };

  return (
    <View className={`px-2 py-0.5 rounded-full ${style.bg}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>
        {style.label}
      </Text>
    </View>
  );
}
