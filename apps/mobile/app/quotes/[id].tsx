import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Calendar, Package, User, MessageSquare, ShoppingCart, Truck, ChevronRight, Edit3, RefreshCw, Clock, ArrowRight, Send, Check, X } from "lucide-react-native";
import {
  useQuoteDetail,
  useQuoteHistory,
  useQuoteApproval,
  // §11.209d-mobile-mutation — 결재 승인/반려 mutation hooks
  useApproveQuote,
  useRejectQuote,
  // §11.209d-mobile-request-approval-cta — 결재 요청 mutation hook
  useRequestApproval,
  // #post-approval-purchase-order-flow Phase 4.3 — order tracking
  useOrderByQuote,
  useUpdateOrderStatus,
  // Phase 4.2-A2 — vendor email 발송 (현장 도구)
  useSendOrderEmail,
  // Phase 4.2-G — mobile PDF download (현장 도구)
  useDownloadOrderPdf,
} from "../../hooks/useApi";
import type { QuoteStatusHistory } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";
import { ErrorState } from "../../components/ErrorState";
// §11.229b #mobile-vendor-request-modal — 호영님 P0 모바일 운영 (send-only scope).
import { VendorRequestModal } from "../../components/quotes/vendor-request-modal";
import { iconColor, spinnerColor } from "../../theme/colors";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n?: number) {
  if (n == null) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  PENDING: "대기",
  SENT: "발송완료",
  IN_PROGRESS: "진행중",
  RESPONDED: "회신도착",
  COMPLETED: "완료",
  CANCELLED: "취소",
  ON_HOLD: "보류",
  PURCHASED: "구매전환",
};

function StatusLabel({ status }: { status: string | null }) {
  if (!status) return <Text className="text-xs text-slate-400">-</Text>;
  return (
    <Text className="text-xs font-semibold text-slate-700">
      {STATUS_LABEL[status] || status}
    </Text>
  );
}

function TimelineItem({ item, isLast }: { item: QuoteStatusHistory; isLast: boolean }) {
  return (
    <View className="flex-row">
      {/* 타임라인 도트 + 선 */}
      <View className="items-center mr-3" style={{ width: 16 }}>
        <View className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-200 mt-1" />
        {!isLast && <View className="w-0.5 flex-1 bg-slate-200 mt-1" />}
      </View>

      {/* 내용 */}
      <View className="flex-1 pb-4">
        <View className="flex-row items-center gap-1.5 mb-1">
          <StatusLabel status={item.previousStatus} />
          <ArrowRight size={10} color={iconColor.muted} />
          <StatusLabel status={item.newStatus} />
        </View>
        {item.reason && (
          <Text className="text-xs text-slate-500 mb-0.5">{item.reason}</Text>
        )}
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-slate-400">{item.changedBy}</Text>
          <Text className="text-xs text-slate-400">{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading, isError, refetch } = useQuoteDetail(id);
  const { data: history } = useQuoteHistory(id);
  // §11.209d-mobile Phase 2 — 결재 정보 (timeline 표시 위해)
  const { data: approval } = useQuoteApproval(id);
  // #post-approval-purchase-order-flow Phase 4.3 + 1.2 — order tracking.
  // 결재 승인 후 자동 생성된 Order 의 status / 배송 정보. canonical truth =
  // 1 Quote → N Order (vendor 별, option A). Phase 1.2 swap: single → array.
  const { data: orders = [] } = useOrderByQuote(id);
  const updateOrderStatus = useUpdateOrderStatus();
  // Phase 4.2-A2 — vendor email 발송 mutation (현장 도구).
  const sendOrderEmail = useSendOrderEmail();
  // Phase 4.2-G — mobile PDF download mutation (현장 도구).
  const downloadOrderPdf = useDownloadOrderPdf();
  // §11.209d-history-expand-mobile — 이전 결재 이력 expand state
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // §11.209d-mobile-mutation — 반려 사유 RN Modal state. cross-platform —
  // Alert.prompt 는 iOS 전용. canonical mutation = web /api/request/[id]/reject.
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const approveQuote = useApproveQuote();
  const rejectQuote = useRejectQuote();
  // §11.209d-mobile-request-approval-cta — 결재 요청 mutation
  const requestApproval = useRequestApproval();
  const isMutating =
    approveQuote.isPending || rejectQuote.isPending || requestApproval.isPending;

  // §11.209d-mobile-mutation — 승인 핸들러. Alert.alert 으로 confirm 후 mutation.
  const handleApprove = () => {
    if (!approval?.latestPendingRequestId) return;
    const requestId = approval.latestPendingRequestId;
    Alert.alert(
      "결재 승인",
      "이 결재 요청을 승인하시겠습니까?\n\n승인 시 구매 주문이 자동 생성됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "승인",
          style: "default",
          onPress: () => {
            approveQuote.mutate(
              { quoteId: id, requestId },
              {
                onSuccess: () => {
                  Alert.alert("결재 완료", "결재가 승인되었습니다.");
                },
                onError: (err: any) => {
                  const msg =
                    err?.response?.data?.error ??
                    err?.message ??
                    "결재 승인 중 오류가 발생했습니다.";
                  Alert.alert("결재 승인 실패", msg);
                },
              },
            );
          },
        },
      ],
    );
  };

  // §11.209d-mobile-request-approval-cta — 결재 요청 핸들러.
  // server validation 8-step 통과 시 NOT_REQUIRED → PENDING 전환.
  // approver 자동 매핑 = workspace 첫 ADMIN/OWNER (server-side).
  const handleRequestApproval = () => {
    Alert.alert(
      "결재 요청",
      "워크스페이스 관리자에게 결재 요청을 보냅니다.\n진행하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "요청",
          style: "default",
          onPress: () => {
            requestApproval.mutate(
              { quoteId: id },
              {
                onSuccess: () => {
                  Alert.alert(
                    "결재 요청 완료",
                    "결재 요청이 발송되었습니다. 결재자가 검토 후 처리합니다.",
                  );
                },
                onError: (err: any) => {
                  const msg =
                    err?.response?.data?.message ??
                    err?.response?.data?.error ??
                    err?.message ??
                    "결재 요청 중 오류가 발생했습니다.";
                  Alert.alert("결재 요청 실패", msg);
                },
              },
            );
          },
        },
      ],
    );
  };

  // §11.209d-mobile-mutation — 반려 핸들러. Modal 의 TextInput 으로 사유 입력 후 mutation.
  const handleRejectSubmit = () => {
    if (!approval?.latestPendingRequestId) return;
    const requestId = approval.latestPendingRequestId;
    const reason = rejectReason.trim();
    if (reason.length < 2) {
      Alert.alert("반려 사유 입력", "반려 사유를 2자 이상 입력해 주세요.");
      return;
    }
    rejectQuote.mutate(
      { quoteId: id, requestId, reason },
      {
        onSuccess: () => {
          setRejectModalVisible(false);
          setRejectReason("");
          Alert.alert("결재 반려", "결재가 반려되었습니다.");
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.error ??
            err?.message ??
            "결재 반려 중 오류가 발생했습니다.";
          Alert.alert("결재 반려 실패", msg);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color={spinnerColor} />
      </View>
    );
  }

  if (isError || !quote) {
    return (
      <View className="flex-1 bg-white">
        <ErrorState
          title="불러오기 실패"
          description="견적 정보를 가져올 수 없습니다."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const canConvert = ["COMPLETED", "RESPONDED"].includes(quote.status);
  const canSend = quote.status === "PENDING";

  // §11.229b #mobile-vendor-request-modal — 호영님 P0 모바일 운영.
  //   기존 Alert.alert + setTimeout fake success (dead button + front-only) 제거.
  //   진정한 wiring — VendorRequestModal mount → useVendorRequestMutation POST
  //   /api/quotes/[id]/vendor-requests. 서버 §11.229c zod 가 vendor email 검증.
  const [vendorModalVisible, setVendorModalVisible] = useState(false);

  const handleSendRequest = () => {
    setVendorModalVisible(true);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 기본 정보 카드 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <View className="flex-row items-start justify-between mb-3">
            <Text className="text-base font-bold text-slate-900 flex-1 mr-2">
              {quote.title}
            </Text>
            <StatusBadge status={quote.status} />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color={iconColor.muted} />
              <Text className="text-xs text-slate-500">
                생성: {formatDate(quote.createdAt)}
              </Text>
            </View>
            {quote.requesterName && (
              <View className="flex-row items-center gap-2">
                <User size={14} color={iconColor.muted} />
                <Text className="text-xs text-slate-500">
                  요청자: {quote.requesterName}
                </Text>
              </View>
            )}
            {quote.totalAmount && (
              <View className="flex-row items-center gap-2">
                <Package size={14} color={iconColor.muted} />
                <Text className="text-sm font-bold text-blue-600">
                  총액: {formatAmount(quote.totalAmount)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* §11.209d-mobile Phase 2 — 결재 timeline. internalApprovalStatus
            !== "NOT_REQUIRED" 시만 visible. canonical = PurchaseRequest. */}
        {approval && approval.internalApprovalStatus !== "NOT_REQUIRED" && (
          <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-slate-900">내부 결재</Text>
              <Text
                className={
                  approval.internalApprovalStatus === "APPROVED"
                    ? "text-xs font-semibold text-emerald-700"
                    : approval.internalApprovalStatus === "PENDING"
                      ? "text-xs font-semibold text-amber-700"
                      : approval.internalApprovalStatus === "REJECTED"
                        ? "text-xs font-semibold text-rose-700"
                        : "text-xs font-semibold text-slate-500"
                }
              >
                {approval.internalApprovalStatus === "APPROVED"
                  ? "결재 완료"
                  : approval.internalApprovalStatus === "PENDING"
                    ? "결재 대기"
                    : approval.internalApprovalStatus === "REJECTED"
                      ? "결재 반려"
                      : "결재 불필요"}
              </Text>
            </View>

            <View className="gap-2">
              {approval.approvalRequestedAt && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">결재 요청 시각</Text>
                  <Text className="text-xs font-mono text-slate-700">
                    {new Date(approval.approvalRequestedAt).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}
              {approval.approverName && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">결재자</Text>
                  <Text className="text-xs font-medium text-slate-700">
                    {approval.approverName}
                  </Text>
                </View>
              )}
              {/* §11.209d-contact — approver email/phone (있을 때만 visible).
                  React Native Linking.openURL 로 외부 mailto:/tel: 호출
                  (Expo Router 의 router.replace 는 in-app navigation 만). */}
              {approval.approverEmail && (
                <Pressable
                  className="flex-row items-center justify-between"
                  onPress={() => {
                    if (approval.approverEmail) {
                      Linking.openURL(`mailto:${approval.approverEmail}`).catch(() => {
                        // 사용자 device 에 email 앱 0 시 graceful — toast 또는 silent
                      });
                    }
                  }}
                >
                  <Text className="text-xs text-slate-500">이메일</Text>
                  <Text className="text-xs font-mono text-blue-600">
                    {approval.approverEmail}
                  </Text>
                </Pressable>
              )}
              {approval.approverPhone && (
                <Pressable
                  className="flex-row items-center justify-between"
                  onPress={() => {
                    if (approval.approverPhone) {
                      Linking.openURL(`tel:${approval.approverPhone}`).catch(() => {
                        // 사용자 device 에 dialer 0 시 graceful
                      });
                    }
                  }}
                >
                  <Text className="text-xs text-slate-500">연락처</Text>
                  <Text className="text-xs font-mono text-blue-600">
                    {approval.approverPhone}
                  </Text>
                </Pressable>
              )}
              {approval.approvalDecidedAt && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">
                    {approval.internalApprovalStatus === "APPROVED" ? "승인 시각" : "반려 시각"}
                  </Text>
                  <Text className="text-xs font-mono text-slate-700">
                    {new Date(approval.approvalDecidedAt).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}
              {approval.rejectionReason && (
                <View className="pt-2 border-t border-slate-100">
                  <Text className="text-xs text-slate-500 mb-1">반려 사유</Text>
                  <Text className="text-xs text-rose-700 leading-5">
                    {approval.rejectionReason}
                  </Text>
                </View>
              )}
              {/* §11.209d-mobile-mutation — 결재자가 모바일에서 직접 승인/반려.
                  PENDING + canApprove === true 시만 visible (dead button 0).
                  canonical = web /api/request/[id]/{approve,reject}. 표시 형식만
                  분기 — server enforceAction + ADMIN role check 가 truth. */}
              {approval.internalApprovalStatus === "PENDING" && approval.canApprove && (
                <View className="pt-3 mt-2 border-t border-slate-100 flex-row gap-2">
                  <Pressable
                    onPress={handleApprove}
                    disabled={isMutating}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3 ${
                      approveQuote.isPending ? "bg-emerald-400" : "bg-emerald-600"
                    }`}
                  >
                    {approveQuote.isPending ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Check size={16} color="white" />
                        <Text className="text-sm font-semibold text-white">승인</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setRejectModalVisible(true)}
                    disabled={isMutating}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3 border ${
                      rejectQuote.isPending
                        ? "bg-rose-50 border-rose-200"
                        : "bg-white border-rose-300"
                    }`}
                  >
                    {rejectQuote.isPending ? (
                      <ActivityIndicator size="small" color="#e11d48" />
                    ) : (
                      <>
                        <X size={16} color="#e11d48" />
                        <Text className="text-sm font-semibold text-rose-600">반려</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
              {/* §11.209d-history-expand-mobile — 이전 결재 이력 expand.
                  historyEntries.length > 1 (latest 외 추가 entries 존재) 시만
                  button visible. dead button 0. */}
              {approval.historyEntries && approval.historyEntries.length > 1 && (
                <View className="pt-2 border-t border-slate-100">
                  <Pressable
                    onPress={() => setHistoryExpanded((v) => !v)}
                    className="flex-row items-center"
                  >
                    <Text className="text-xs text-slate-500">
                      {historyExpanded
                        ? "이전 결재 이력 숨기기"
                        : `이전 결재 이력 ${approval.historyEntries.length - 1}건 보기`}
                    </Text>
                  </Pressable>
                  {historyExpanded && (
                    <View className="mt-2 gap-2">
                      {approval.historyEntries.slice(1).map((entry) => (
                        <View
                          key={entry.id}
                          className="bg-slate-50 rounded p-2 border border-slate-200"
                        >
                          <View className="flex-row items-center justify-between mb-1">
                            <Text
                              className={
                                entry.status === "APPROVED"
                                  ? "text-xs font-semibold text-emerald-700"
                                  : entry.status === "REJECTED"
                                    ? "text-xs font-semibold text-rose-700"
                                    : entry.status === "CANCELLED"
                                      ? "text-xs font-semibold text-slate-500"
                                      : "text-xs font-semibold text-amber-700"
                              }
                            >
                              {entry.status === "APPROVED"
                                ? "결재 완료"
                                : entry.status === "REJECTED"
                                  ? "결재 반려"
                                  : entry.status === "CANCELLED"
                                    ? "취소"
                                    : "결재 대기"}
                            </Text>
                            <Text className="text-[10px] font-mono text-slate-500">
                              {new Date(entry.requestedAt).toLocaleString("ko-KR", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                          </View>
                          {entry.approverName && (
                            <Text className="text-[10px] text-slate-600">
                              결재자: {entry.approverName}
                            </Text>
                          )}
                          {entry.rejectionReason && (
                            <Text className="text-[10px] text-rose-700 mt-0.5 leading-4">
                              반려 사유: {entry.rejectionReason}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* #post-approval-purchase-order-flow Phase 4.3 + 1.2 — 주문 추적
            카드. orders empty 시 hide (결재 승인 전 또는 cancelled). vendor
            별 N개 Order 를 vertically stack (Phase 5 에서 vendor grouping
            heading 추가). */}
        {orders.map((order) => (
          <View key={order.id} className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-slate-900">주문 추적</Text>
              <Text className="text-[11px] font-mono text-slate-400">
                {order.orderNumber}
              </Text>
            </View>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-slate-500">현재 상태</Text>
                <Text
                  className={
                    order.status === "DELIVERED"
                      ? "text-xs font-semibold text-emerald-700"
                      : order.status === "SHIPPING"
                        ? "text-xs font-semibold text-amber-700"
                        : order.status === "CANCELLED"
                          ? "text-xs font-semibold text-rose-700"
                          : order.status === "CONFIRMED"
                            ? "text-xs font-semibold text-indigo-700"
                            : "text-xs font-semibold text-blue-700"
                  }
                >
                  {order.status === "ORDERED"
                    ? "주문 완료"
                    : order.status === "CONFIRMED"
                      ? "확인됨"
                      : order.status === "SHIPPING"
                        ? "배송 중"
                        : order.status === "DELIVERED"
                          ? "배송 완료"
                          : order.status === "CANCELLED"
                            ? "취소됨"
                            : order.status}
                </Text>
              </View>
              {order.expectedDelivery && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">예상 배송일</Text>
                  <Text className="text-xs font-mono text-slate-700">
                    {new Date(order.expectedDelivery).toLocaleDateString("ko-KR")}
                  </Text>
                </View>
              )}
              {order.actualDelivery && (
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">실제 배송일</Text>
                  <Text className="text-xs font-mono text-slate-700">
                    {new Date(order.actualDelivery).toLocaleDateString("ko-KR")}
                  </Text>
                </View>
              )}
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-slate-500">총액</Text>
                <Text className="text-sm font-bold text-blue-600">
                  ₩{order.totalAmount.toLocaleString("ko-KR")}
                </Text>
              </View>
            </View>
            {/* 상태 변경 — DELIVERED / CANCELLED 외 다음 단계 button */}
            {order.status !== "DELIVERED" && order.status !== "CANCELLED" && (
              <View className="pt-3 mt-2 border-t border-slate-100 flex-row gap-2">
                {order.status === "ORDERED" && (
                  <Pressable
                    onPress={() =>
                      updateOrderStatus.mutate(
                        { orderId: order.id, status: "CONFIRMED" },
                        {
                          onSuccess: () =>
                            Alert.alert("주문 추적", "확인됨 상태로 변경되었습니다."),
                          onError: (err: any) =>
                            Alert.alert(
                              "변경 실패",
                              err?.response?.data?.error ?? err?.message ?? "오류",
                            ),
                        },
                      )
                    }
                    disabled={updateOrderStatus.isPending}
                    className="flex-1 items-center justify-center rounded-xl py-3 bg-indigo-600"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {updateOrderStatus.isPending ? "변경 중..." : "확인 처리"}
                    </Text>
                  </Pressable>
                )}
                {order.status === "CONFIRMED" && (
                  <Pressable
                    onPress={() =>
                      updateOrderStatus.mutate(
                        { orderId: order.id, status: "SHIPPING" },
                        {
                          onSuccess: () =>
                            Alert.alert("주문 추적", "배송 중 상태로 변경되었습니다."),
                          onError: (err: any) =>
                            Alert.alert(
                              "변경 실패",
                              err?.response?.data?.error ?? err?.message ?? "오류",
                            ),
                        },
                      )
                    }
                    disabled={updateOrderStatus.isPending}
                    className="flex-1 items-center justify-center rounded-xl py-3 bg-amber-600"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {updateOrderStatus.isPending ? "변경 중..." : "배송 시작"}
                    </Text>
                  </Pressable>
                )}
                {order.status === "SHIPPING" && (
                  <Pressable
                    onPress={() =>
                      updateOrderStatus.mutate(
                        { orderId: order.id, status: "DELIVERED" },
                        {
                          onSuccess: () =>
                            Alert.alert("주문 추적", "배송 완료 처리되었습니다."),
                          onError: (err: any) =>
                            Alert.alert(
                              "변경 실패",
                              err?.response?.data?.error ?? err?.message ?? "오류",
                            ),
                        },
                      )
                    }
                    disabled={updateOrderStatus.isPending}
                    className="flex-1 items-center justify-center rounded-xl py-3 bg-emerald-600"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {updateOrderStatus.isPending ? "변경 중..." : "배송 완료"}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* #post-approval-purchase-order-flow Phase 4.2-A2 — vendor 정보
                + 이메일 발송. 모바일은 현장/엣지 도구라 PDF 다운로드는 web
                한정 — 모바일은 출장 중 vendor 발송 트리거에 집중. dead button
                0 (vendor 또는 vendor.email 미설정 시 disabled). */}
            <View className="pt-3 mt-3 border-t border-slate-100">
              <Text className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                공급사
              </Text>
              {order.vendor ? (
                <>
                  <Text className="text-sm font-semibold text-slate-900">
                    {order.vendor.name}
                    {order.vendor.nameEn ? (
                      <Text className="text-xs font-normal text-slate-500">
                        {" "}
                        ({order.vendor.nameEn})
                      </Text>
                    ) : null}
                  </Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    {order.vendor.email ?? "이메일 미설정"}
                    {order.vendor.phone ? ` · ${order.vendor.phone}` : ""}
                  </Text>
                </>
              ) : (
                <Text className="text-sm text-slate-400">공급사 지정 없음</Text>
              )}
              {/* #post-approval-purchase-order-flow Phase 4.2-G — PDF
                  다운로드 + share sheet (현장 도구). expo-file-system +
                  expo-sharing 의존. 호영님 host install:
                  `npx expo install expo-file-system`. */}
              <Pressable
                onPress={() => {
                  downloadOrderPdf.mutate(
                    {
                      orderId: order.id,
                      orderNumber: order.orderNumber,
                      // Phase 2.3 step 4 — storage URL 우선 (재생성 0)
                      poDocumentUrl: order.poDocumentUrl,
                    },
                    {
                      onError: (err: any) =>
                        Alert.alert(
                          "PDF 다운로드 실패",
                          err?.message ?? "오류",
                        ),
                    },
                  );
                }}
                disabled={downloadOrderPdf.isPending}
                className="mt-3 items-center justify-center rounded-xl py-3 bg-white border border-slate-300"
              >
                <Text className="text-sm font-semibold text-slate-700">
                  {downloadOrderPdf.isPending
                    ? "PDF 처리 중..."
                    : order.poDocumentUrl
                      ? "발주서 PDF 열기"
                      : "발주서 PDF 생성"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!order.vendor?.email) {
                    Alert.alert(
                      "발송 불가",
                      "공급사 이메일이 설정되지 않아 발송할 수 없습니다.",
                    );
                    return;
                  }
                  sendOrderEmail.mutate(
                    { orderId: order.id },
                    {
                      onSuccess: () =>
                        Alert.alert(
                          "이메일 발송 완료",
                          "공급사에게 발주서를 발송했습니다.",
                        ),
                      onError: (err: any) =>
                        Alert.alert(
                          "발송 실패",
                          err?.response?.data?.error ??
                            err?.message ??
                            "오류",
                        ),
                    },
                  );
                }}
                disabled={
                  sendOrderEmail.isPending ||
                  !order.vendor ||
                  !order.vendor.email
                }
                className={`mt-3 items-center justify-center rounded-xl py-3 ${
                  !order.vendor || !order.vendor.email
                    ? "bg-slate-100 border border-slate-200"
                    : "bg-indigo-600"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    !order.vendor || !order.vendor.email
                      ? "text-slate-400"
                      : "text-white"
                  }`}
                >
                  {sendOrderEmail.isPending
                    ? "발송 중..."
                    : "공급사 이메일 발송"}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* 벤더 응답 */}
        {quote.vendorResponses && quote.vendorResponses.length > 0 && (
          <View className="mx-4 mt-4">
            <Text className="text-sm font-bold text-slate-900 mb-2">
              벤더 응답 ({quote.vendorResponses.length}건)
            </Text>
            {quote.vendorResponses.map((vr: any, idx: number) => (
              <View
                key={vr.id || idx}
                className="bg-white rounded-xl border border-slate-200 p-3.5 mb-2"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm font-semibold text-slate-800">
                    {vr.vendorName}
                  </Text>
                  <Text className="text-sm font-bold text-blue-600">
                    {formatAmount(vr.totalAmount)}
                  </Text>
                </View>
                <View className="flex-row gap-3">
                  {vr.deliveryDays && (
                    <View className="flex-row items-center gap-1">
                      <Truck size={12} color={iconColor.muted} />
                      <Text className="text-xs text-slate-500">
                        납기 {vr.deliveryDays}일
                      </Text>
                    </View>
                  )}
                  {vr.notes && (
                    <Text className="text-xs text-slate-400">{vr.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 품목 리스트 */}
        <View className="mx-4 mt-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">
            품목 ({quote.items?.length ?? 0}개)
          </Text>
          {(quote.items ?? []).map((item: any, idx: number) => (
            <View
              key={item.id || idx}
              className="bg-white rounded-xl border border-slate-200 p-3.5 mb-2"
            >
              <Text className="text-sm font-medium text-slate-800" numberOfLines={2}>
                {item.productName}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row gap-3">
                  {item.brand && (
                    <Text className="text-xs text-slate-500">{item.brand}</Text>
                  )}
                  <Text className="text-xs text-slate-500">
                    {item.quantity} {item.unit || "ea"}
                  </Text>
                </View>
                {item.totalPrice && (
                  <Text className="text-sm font-semibold text-slate-700">
                    {formatAmount(item.totalPrice)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 메모 미리보기 */}
        <Pressable
          className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4 flex-row items-center justify-between"
          onPress={() => router.push({ pathname: "/quotes/memo", params: { id } })}
        >
          <View className="flex-row items-center gap-2 flex-1">
            <MessageSquare size={14} color={iconColor.muted} />
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">메모</Text>
              <Text className="text-xs text-slate-400 mt-0.5" numberOfLines={1}>
                {quote.description || "메모를 입력하세요..."}
              </Text>
            </View>
          </View>
          <Edit3 size={16} color={iconColor.muted} />
        </Pressable>

        {/* 상태 변경 이력 */}
        {history && history.length > 0 && (
          <View className="mx-4 mt-4 mb-4">
            <View className="flex-row items-center gap-1.5 mb-3">
              <Clock size={14} color={iconColor.emphasis} />
              <Text className="text-sm font-bold text-slate-900">상태 변경 이력</Text>
            </View>
            <View className="bg-white rounded-xl border border-slate-200 p-4">
              {history.map((h, idx) => (
                <TimelineItem key={h.id} item={h} isLast={idx === history.length - 1} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 하단 액션 바 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-8 gap-2">
        {/* 상태 변경 */}
        <Pressable
          className="flex-row items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200"
          onPress={() => router.push({ pathname: "/quotes/status-change", params: { id } })}
        >
          <View className="flex-row items-center gap-2">
            <RefreshCw size={16} color={iconColor.emphasis} />
            <Text className="text-sm font-semibold text-slate-700">상태 변경</Text>
          </View>
          <ChevronRight size={16} color={iconColor.muted} />
        </Pressable>

        {/* §11.209d-mobile-request-approval-cta — 결재 요청 (NOT_REQUIRED +
            본인 소유 + in_app_approval policy 시 server canRequestApproval
            === true). 자동 매핑된 결재자에게 요청 발송. dead button 0. */}
        {approval?.canRequestApproval && (
          <Pressable
            className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              requestApproval.isPending ? "bg-violet-400" : "bg-violet-600"
            }`}
            onPress={handleRequestApproval}
            disabled={isMutating}
          >
            {requestApproval.isPending ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text className="text-sm font-semibold text-white">요청 중...</Text>
              </>
            ) : (
              <>
                <Send size={16} color="white" />
                <Text className="text-sm font-semibold text-white">결재 요청</Text>
              </>
            )}
          </Pressable>
        )}

        {/* 견적 발송 */}
        {canSend && (
          <Pressable
            className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              sendState === "sending" ? "bg-blue-400" : sendState === "sent" ? "bg-emerald-600" : "bg-blue-600"
            }`}
            onPress={handleSendRequest}
            disabled={sendState !== "idle"}
          >
            {sendState === "sending" ? (
              <>
                <ActivityIndicator size="small" color="white" />
                <Text className="text-sm font-semibold text-white">발송 중...</Text>
              </>
            ) : sendState === "sent" ? (
              <Text className="text-sm font-semibold text-white">발송 완료</Text>
            ) : (
              <>
                <Send size={16} color="white" />
                <Text className="text-sm font-semibold text-white">견적 요청 발송</Text>
              </>
            )}
          </Pressable>
        )}

        {/* 주문 전환 */}
        {canConvert && (
          <Pressable
            className="flex-row items-center justify-center gap-2 bg-emerald-600 rounded-xl py-3.5"
            onPress={() => router.push({ pathname: "/quotes/order-confirm", params: { id } })}
          >
            <ShoppingCart size={16} color="white" />
            <Text className="text-sm font-semibold text-white">구매 주문으로 전환</Text>
          </Pressable>
        )}
      </View>

      {/* §11.229b #mobile-vendor-request-modal — 공급사 발송 Modal.
          기존 Alert.alert + setTimeout fake success 제거 (dead button → real wiring).
          실제 POST /api/quotes/[id]/vendor-requests + §11.229c zod 검증. */}
      <VendorRequestModal
        visible={vendorModalVisible}
        onClose={() => setVendorModalVisible(false)}
        quoteId={id}
        quoteTitle={quote.title}
        onSuccess={() => refetch()}
      />

      {/* §11.209d-mobile-mutation — 반려 사유 입력 Modal.
          cross-platform (iOS/Android) — Alert.prompt 는 iOS 전용. 사유는
          server 가 graceful nullable 이지만 모바일 UX 는 2자 이상 강제. */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!rejectQuote.isPending) {
            setRejectModalVisible(false);
            setRejectReason("");
          }
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full bg-white rounded-2xl p-5">
            <Text className="text-base font-bold text-slate-900 mb-1">결재 반려</Text>
            <Text className="text-xs text-slate-500 mb-3 leading-5">
              요청자에게 반려 사유가 그대로 전달됩니다. 명확하게 작성해 주세요.
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              maxLength={500}
              placeholder="반려 사유를 입력하세요 (예: 예산 검토 필요)"
              placeholderTextColor="#94a3b8"
              editable={!rejectQuote.isPending}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 mb-3"
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  if (!rejectQuote.isPending) {
                    setRejectModalVisible(false);
                    setRejectReason("");
                  }
                }}
                disabled={rejectQuote.isPending}
                className="flex-1 items-center justify-center rounded-xl py-3 border border-slate-200 bg-white"
              >
                <Text className="text-sm font-semibold text-slate-700">취소</Text>
              </Pressable>
              <Pressable
                onPress={handleRejectSubmit}
                disabled={rejectQuote.isPending}
                className={`flex-1 items-center justify-center rounded-xl py-3 ${
                  rejectQuote.isPending ? "bg-rose-400" : "bg-rose-600"
                }`}
              >
                {rejectQuote.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-sm font-semibold text-white">반려</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
