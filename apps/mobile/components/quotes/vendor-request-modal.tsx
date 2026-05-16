/**
 * §11.229b-3 #mobile-vendor-request-recall — 호영님 §11.229b-2 자연 후속.
 *   modal 안 "최근 발송 공급사" recall section 추가 (multi-select checkbox).
 *   server GET /api/quotes/[id] 의 dedup vendorRequests forward 정합.
 *   handleSubmit 안 recall selected + 수동 입력 vendor merge → vendors array.
 *
 * §11.229b-2 #mobile-vendor-request-message — message TextInput multiline (선택).
 *
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
 *   - supplier/contact readiness → primary button disabled until safe to submit.
 *   - pending → ActivityIndicator + 모든 input disabled.
 *
 * canonical truth lock:
 *   - vendor email 검증은 서버 zod (§11.229c TLD blacklist + bare IP).
 *   - canSend gate (quote.status === "PENDING") 는 caller (quotes/[id]) 책임.
 *   - 모바일 client 는 발송 전 readiness만 표시하고, 서버 zod가 canonical validation.
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

const CONTACT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// §11.229b-3 #mobile-vendor-request-recall — 이전 발송 공급사 type.
//   server GET /api/quotes/[id] dedup vendorRequests forward 정합.
interface RecallVendor {
  vendorEmail: string;
  vendorName: string | null;
}

interface VendorRequestModalProps {
  visible: boolean;
  onClose: () => void;
  quoteId: string;
  quoteTitle: string;
  onSuccess?: () => void;
  /**
   * §11.229b-3 — 이전 발송 공급사 list (dedup by email). 운영자가 checkbox
   * 다중 선택 + 수동 입력 vendor 와 merge 후 발송.
   */
  vendorRequests?: RecallVendor[];
}

export function VendorRequestModal({
  visible,
  onClose,
  quoteId,
  quoteTitle,
  onSuccess,
  vendorRequests = [],
}: VendorRequestModalProps) {
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorName, setVendorName] = useState("");
  // §11.229b-2 — 운영자 현장 메모 (서버 message?: optional 정합).
  const [message, setMessage] = useState("");
  // §11.229b-3 — 이전 발송 공급사 multi-select. email 기준 Set.
  const [selectedRecall, setSelectedRecall] = useState<Set<string>>(new Set());
  const mutation = useVendorRequestMutation();

  const isPending = mutation.isPending;
  const manualEmail = vendorEmail.trim();
  const hasManualVendor = manualEmail.length > 0;
  const hasSupplierSelection = selectedRecall.size > 0 || hasManualVendor;
  const hasInvalidManualContact =
    hasManualVendor && !CONTACT_EMAIL_PATTERN.test(manualEmail);
  const hasValidContact = hasSupplierSelection && !hasInvalidManualContact;
  const previewText =
    message.trim() || `${quoteTitle.trim() || "선택한 견적"} 요청 링크를 전송합니다.`;
  const previewReady = previewText.trim().length > 0;
  const serverErrorMessage =
    mutation.error instanceof Error ? mutation.error.message : null;
  const canSubmit =
    hasSupplierSelection && hasValidContact && previewReady && !isPending;
  const currentBlockReason = !hasSupplierSelection
    ? "공급사 선택 필요"
    : hasInvalidManualContact
      ? "연락처 확인 필요: 이메일 형식을 확인하세요."
      : !previewReady
        ? "메시지 미리보기 필요"
        : serverErrorMessage
          ? `API 오류 확인 필요: ${serverErrorMessage}`
          : "최종 확인 후 전송 가능";
  const readinessSteps = [
    {
      label: "1. 공급사 선택",
      value: hasSupplierSelection ? "선택됨" : "필요",
      ready: hasSupplierSelection,
    },
    {
      label: "2. 연락처 확인",
      value: hasValidContact ? "확인됨" : "연락처 필요",
      ready: hasValidContact,
    },
    {
      label: "3. 메시지 미리보기",
      value: previewReady ? "표시됨" : "필요",
      ready: previewReady,
    },
    {
      label: "4. 최종 발송",
      value: canSubmit ? "가능" : "대기",
      ready: canSubmit,
    },
  ];

  const toggleRecall = (email: string) => {
    setSelectedRecall((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const reset = () => {
    setVendorEmail("");
    setVendorName("");
    setMessage("");
    setSelectedRecall(new Set());
    mutation.reset();
  };

  const handleClose = () => {
    if (isPending) return; // pending 중 닫기 차단
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    // §11.229b-3 — vendors array merge: recall selected + 수동 입력.
    //   recall set 안 email 별로 vendorRequests prop 에서 vendorName lookup.
    //   수동 입력 email 이 있고 trim 후 비어있지 않으면 추가.
    //   동일 email 이 recall + 수동 입력 모두에 있으면 manual 우선 (운영자 의도 정합).
    const vendorsArray: Array<{ email: string; name?: string }> = [];

    // recall 먼저 push
    for (const email of selectedRecall) {
      const found = vendorRequests.find((v) => v.vendorEmail === email);
      if (manualEmail === email) continue; // 수동 입력 중복 시 skip
      vendorsArray.push({
        email,
        name: found?.vendorName ?? undefined,
      });
    }
    // 수동 입력 추가
    if (manualEmail.length > 0) {
      vendorsArray.push({
        email: manualEmail,
        name: vendorName.trim() || undefined,
      });
    }

    mutation.mutate(
      {
        quoteId,
        vendors: vendorsArray,
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

            <View
              testID="mobile-vendor-request-readiness"
              className="border border-blue-100 bg-blue-50 rounded-xl px-3 py-2.5 mb-3"
            >
              <Text className="text-xs font-bold text-blue-900 mb-2">
                발송 전 확인
              </Text>
              {readinessSteps.map((step) => (
                <View
                  key={step.label}
                  className="flex-row items-center justify-between py-0.5"
                >
                  <Text className="text-[11px] text-slate-700">
                    {step.label}
                  </Text>
                  <Text
                    className={`text-[11px] font-semibold ${
                      step.ready ? "text-blue-700" : "text-amber-700"
                    }`}
                  >
                    {step.value}
                  </Text>
                </View>
              ))}
              <Text
                testID="mobile-vendor-request-block-reason"
                className="mt-2 text-[11px] font-semibold text-slate-800"
              >
                {currentBlockReason}
              </Text>
              {!hasSupplierSelection && (
                <Text className="mt-1 text-[11px] text-amber-700">
                  공급사 없음: 공급사 선택 필요
                </Text>
              )}
              {hasInvalidManualContact && (
                <Text className="mt-1 text-[11px] text-amber-700">
                  무효 연락처: 연락처 확인 필요
                </Text>
              )}
              {serverErrorMessage && (
                <Text className="mt-1 text-[11px] text-red-700">
                  서버 오류: API 오류 확인 필요
                </Text>
              )}
            </View>

            {/* §11.229b-3 — 최근 발송 공급사 recall section (multi-select).
                vendorRequests 0개 시 hide. 1개 이상 시 checkbox list. */}
            {vendorRequests.length > 0 && (
              <View className="mb-3">
                <Text className="text-xs font-semibold text-slate-700 mb-1.5">
                  최근 발송 공급사 (다중 선택 가능)
                </Text>
                <View className="border border-slate-200 rounded-xl bg-slate-50 divide-y divide-slate-200">
                  {vendorRequests.map((v) => {
                    const isSelected = selectedRecall.has(v.vendorEmail);
                    return (
                      <Pressable
                        key={v.vendorEmail}
                        onPress={() => !isPending && toggleRecall(v.vendorEmail)}
                        disabled={isPending}
                        className="flex-row items-center px-3 py-2.5"
                      >
                        <View
                          className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "bg-white border-slate-300"
                          }`}
                        >
                          {isSelected && (
                            <Text className="text-white text-xs font-bold">✓</Text>
                          )}
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-sm text-slate-900"
                            numberOfLines={1}
                          >
                            {v.vendorName ?? "(이름 없음)"}
                          </Text>
                          <Text
                            className="text-[11px] text-slate-500"
                            numberOfLines={1}
                          >
                            {v.vendorEmail}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Vendor email (필수) */}
            <Text className="text-xs font-semibold text-slate-700 mb-1">
              공급사 이메일 {vendorRequests.length > 0 ? "(추가 입력)" : "*"}
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

            <View
              testID="mobile-vendor-request-message-preview"
              className="bg-slate-50 rounded-xl px-3 py-2.5 mb-4"
            >
              <Text className="text-[11px] font-semibold text-slate-500 mb-1">
                메시지 미리보기
              </Text>
              <Text className="text-xs text-slate-700 leading-5">
                {previewText}
              </Text>
            </View>

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
                  <Text className="text-sm font-semibold text-white">
                    최종 확인 후 전송
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
