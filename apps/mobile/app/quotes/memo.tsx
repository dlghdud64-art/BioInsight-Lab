import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { useQuoteDetail, useUpdateQuoteMemo } from "../../hooks/useApi";

export default function QuoteMemoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading, isError, refetch } = useQuoteDetail(id);
  const updateMemo = useUpdateQuoteMemo();
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (quote?.description) {
      setMemo(quote.description);
    }
  }, [quote?.description]);

  const handleSave = () => {
    updateMemo.mutate(
      { id, description: memo.trim() },
      {
        onSuccess: () => {
          Alert.alert("완료", "메모가 저장되었습니다.", [
            { text: "확인", onPress: () => router.back() },
          ]);
        },
        onError: () => Alert.alert("오류", "메모 저장에 실패했습니다."),
      }
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError || !quote) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-bold text-slate-900 mb-1">불러오기 실패</Text>
        <Text className="text-sm text-slate-500 text-center mb-4">견적 정보를 가져올 수 없습니다.</Text>
        <Pressable className="bg-blue-600 rounded-xl px-6 py-3" onPress={() => refetch()}>
          <Text className="text-sm font-semibold text-white">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const hasChanged = memo.trim() !== (quote.description ?? "").trim();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <View className="flex-1 px-5 pt-4">
        <Text className="text-base font-bold text-slate-900 mb-1">{quote.title}</Text>
        <Text className="text-xs text-slate-400 mb-4">견적에 대한 메모를 작성하세요</Text>

        <TextInput
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700"
          placeholder="메모를 입력하세요..."
          multiline
          textAlignVertical="top"
          value={memo}
          onChangeText={setMemo}
          autoFocus
        />
      </View>

      <View className="px-5 py-4 pb-8 border-t border-slate-100 bg-white">
        <Pressable
          className={`rounded-xl py-3.5 items-center ${hasChanged ? "bg-blue-600" : "bg-slate-200"}`}
          onPress={handleSave}
          disabled={!hasChanged || updateMemo.isPending}
        >
          {updateMemo.isPending ? (
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
