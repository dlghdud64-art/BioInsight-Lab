import { View, Text, Pressable, Modal } from "react-native";
import { X } from "lucide-react-native";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable className="bg-white rounded-t-2xl px-5 pt-4 pb-10" onPress={() => {}}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            {title && (
              <Text className="text-base font-bold text-slate-900">{title}</Text>
            )}
            <Pressable
              className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              onPress={onClose}
            >
              <X size={16} color="#64748b" />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
