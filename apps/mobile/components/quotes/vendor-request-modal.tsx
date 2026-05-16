/**
 * §11.229b #mobile-vendor-request-modal — 호영님 P0 모바일 운영 (send-only scope).
 *
 * 모바일 견적 detail 에서 vendor 에게 견적 요청 발송. 현장 ad-hoc 발송 정합 —
 * 단일 vendor email 직접 입력 (다중 vendor + supplier book 통합은 별도 cluster).
 *
 * Strategy:
 *   - RN Modal animationType "fade" + transparent (§11.209d-mobile-mutation 패턴 reuse).
 *   - KeyboardAvoidingView (iOS padding / Android height) — 키보드 입력 보장.
 *   - vendor email TextInput (필수) + vendor name TextInput (선택).
 *   - read-only quote summary (title) — 발송 대상 견적 확인.
 *   - send → useVendorRequestMutation.
 *   - empty email → primary button disabled.
 *   - pending → ActivityIndicator + 모든 input disabled.
 *
 * canonical truth lock:
 *   - vendor email 검증은 서버 zod (§11.229c TLD blacklist + bare IP).
 *   - canSend gate (quote.status === "PENDING") 는 caller (quotes/[id]) 책임.
 *   - 모바일 client validation 0 (서버 single source of truth).
 *   - dead button / front-only success 0 (실제 mutation).
 */

import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useVendorRequestMutation } from "../../hooks/use-vendor-request-mutation";

interface VendorRequestModalProps {
  visible: boolean;
  onClose: () => void;
  quoteId: string;
  quoteTitle: string;
  onSuccess?: () => void;
}

export function VendorRequestModal({
  visible,
  onClose,
  quoteId,
  quoteTitle,
  onSuccess,
}: VendorRequestModalProps) {
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorName, setVendorName] = useState("");
  // §11.229b-2 — 운영자 현장 메모 (서버 message?: optional 정합).
  const [message, setMessage] = useState("");
  const mutation = useVendorRequestMutation();

  const isPending = mutation.isPending;
  const canSubmit = vendorEmail.trim().length > 0 && !isPending;

  const reset = () => {
    setVendorEmail("");
    setVendorName("");
    setMessage("");
    mutation.reset();
  };

  const handleClose = () => {
    if (isPending) return; // pending 중 닫기 차단
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      {
        quoteId,
        vendors: [
          {
            email: vendorEmail.trim(),
            name: vendorName.trim() || undefined,
          },
        ],
        // §11.229b-2 — 운영자 현장 메모 (trim 후 empty 시 omit, 서버 default 안내 메시지 사용).
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
          onSuccess?.();
          // iOS/Android cross-platform success 알림.
          if (Platform.OS === "android") {
            // ToastAndroid 는 별도 import 필요 — Alert 으로 통일.
          }
          Alert.alert("발송 완료", "공급사에 견적 요청이 전송되었습니다.");
        },
        onError: (err) => {
          // §11.229c 서버 zod refine 거부 시 한국어 message 그대로 표시.
          const msg = err instanceof Error ? err.message : "전송에 실패했습니다.";
          Alert.alert("전송 실패", msg);
        },
      },
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full bg-white rounded-2xl p-5">
            {/* Header */}
            <Text className="text-base font-bold text-slate-900 mb-1">
              공급사에 견적 요청
            </Text>
            <Text className="text-xs text-slate-500 mb-3 leading-5">
              아래 이메일로 견적 요청 링크가 전송됩니다.
            </Text>

            {/* Quote summary (read-only) */}
            <View className="bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
              <Text className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                대상 견적
              </Text>
              <Text
                className="text-sm text-slate-800"
                numberOfLines={2}
              >
                {quoteTitle}
              </Text>
            </View>

            {/* Vendor email (필수) */}
            <Text className="text-xs font-semibold text-slate-700 mb-1">
              공급사 이메일 *
            </Text>
            <TextInput
              value={vendorEmail}
              onChangeText={setVendorEmail}
              placeholder="vendor@supplier.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isPending}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 mb-3"
            />

            {/* Vendor name (선택) */}
            <Text className="text-xs font-semibold text-slate-700 mb-1">
              공급사 이름 (선택)
            </Text>
            <TextInput
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="예: ABC 시약"
              placeholderTextColor="#94a3b8"
              editable={!isPending}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 mb-3"
            />

            {/* §11.229b-2 — 운영자 현장 메모 (선택). 서버 default 안내 메시지
                 외 추가 컨텍스트가 필요할 때 입력. empty 시 omit. */}
            <Text className="text-xs font-semibold text-slate-700 mb-1">
              메시지 (선택)
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
              maxLength={500}
              placeholder="견적 요청 메시지를 입력하세요 (선택)"
              placeholderTextColor="#94a3b8"
              editable={!isPending}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 mb-4"
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />

            {/* Footer */}
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleClose}
                disabled={isPending}
                className="flex-1 items-center justify-center rounded-xl py-3 border border-slate-200 bg-white"
              >
                <Text className="text-sm font-semibold text-slate-700">취소</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                className={`flex-1 items-center justify-center rounded-xl py-3 ${
                  !canSubmit ? "bg-blue-300" : "bg-blue-600"
                }`}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-sm font-semibold text-white">전송</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
