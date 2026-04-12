import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
}

function formatDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  const [show, setShow] = useState(false);

  return (
    <View>
      {label && (
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </Text>
      )}
      <Pressable
        className="flex-row items-center border border-slate-200 rounded-xl px-4 py-3 gap-2"
        onPress={() => setShow(true)}
      >
        <Calendar size={16} color="#64748b" />
        <Text className="text-sm text-slate-800">{formatDate(value)}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selectedDate) => {
            setShow(Platform.OS === "ios");
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}
    </View>
  );
}
