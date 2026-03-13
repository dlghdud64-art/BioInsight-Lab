import { View, TextInput, Pressable } from "react-native";
import { Search, X } from "lucide-react-native";

export function SearchBar({
  value,
  onChangeText,
  placeholder = "검색",
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  return (
    <View className="flex-row items-center bg-slate-100 rounded-xl px-3 h-11">
      <Search size={18} color="#94a3b8" />
      <TextInput
        className="flex-1 ml-2 text-sm text-slate-800"
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}>
          <X size={16} color="#94a3b8" />
        </Pressable>
      )}
    </View>
  );
}
