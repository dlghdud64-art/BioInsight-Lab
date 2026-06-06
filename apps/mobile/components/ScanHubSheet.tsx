/**
 * §11.379 #scan-hub — 모바일 스캔 단일 진입 허브 (native 포팅).
 *
 * web ScanHubModal(canonical) 의 입고/사용 2분류 IA 를 native bottom sheet 로 포팅.
 * 홈 quickAction "QR 스캔" → 본 sheet → 입력 유형 선택:
 *   입고 스캔(재고+): 라벨 직접등록 → /scan?intent=receive_label (라벨 OCR 모드)
 *   재고 사용(재고−): QR 재고 사용 → /scan?intent=use_qr (바코드/QR 차감 모드)
 *
 * 다품목 명세 입고(OCR) 는 native 미구현 → 본 hub 미노출(dead button 회피, §11.380 분리).
 * same-canvas: 신규 route 0, RN Modal(transparent slide) overlay(§11.209d-mobile 패턴 reuse).
 * dead button 0 — 각 카드는 실제 router.push(intent) wiring. truth(재고 수량)는 서버, hub 는 라우팅만.
 */

import { Modal, View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import {
  ScanLine,
  QrCode,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  X,
} from "lucide-react-native";

export type ScanIntent = "receive_label" | "use_qr";

interface ScanHubSheetProps {
  visible: boolean;
  onClose: () => void;
}

// §11.379 — 재고 흐름 방향 2그룹. 입고(재고+) / 사용(재고−).
const SCAN_GROUPS = [
  {
    section: "입고 스캔",
    hint: "재고 증가",
    sectionIcon: ArrowDownToLine,
    options: [
      {
        intent: "receive_label" as ScanIntent,
        icon: ScanLine,
        title: "라벨 직접등록",
        desc: "시약·소모품 라벨을 촬영해 재고에 바로 등록",
      },
    ],
  },
  {
    section: "재고 사용",
    hint: "재고 차감",
    sectionIcon: ArrowUpFromLine,
    options: [
      {
        intent: "use_qr" as ScanIntent,
        icon: QrCode,
        title: "QR 재고 사용",
        desc: "QR 코드로 재고를 조회하고 사용량을 차감",
      },
    ],
  },
] as const;

export function ScanHubSheet({ visible, onClose }: ScanHubSheetProps) {
  const go = (intent: ScanIntent) => {
    onClose();
    router.push({ pathname: "/scan", params: { intent } });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute left-0 right-0 top-0 bottom-0 bg-black/40"
          onPress={onClose}
        />
        <View
          testID="scan-hub"
          className="bg-white rounded-t-3xl px-5 pt-3 pb-9"
        >
          {/* grabber */}
          <View className="items-center mb-3">
            <View className="w-10 h-1.5 rounded-full bg-slate-200" />
          </View>

          {/* header */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-base font-bold text-slate-900">스캔</Text>
            <Pressable
              onPress={onClose}
              className="w-10 h-10 items-center justify-center -mr-2"
              accessibilityLabel="닫기"
            >
              <X size={20} color="#64748b" />
            </Pressable>
          </View>

          {/* 2그룹 */}
          <View className="gap-4">
            {SCAN_GROUPS.map((group) => {
              const SectionIcon = group.sectionIcon;
              return (
                <View key={group.section}>
                  <View className="flex-row items-center gap-1.5 px-1 mb-1.5">
                    <SectionIcon size={13} color="#94a3b8" />
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {group.section}
                    </Text>
                    <Text className="text-[10px] font-medium text-slate-400">
                      · {group.hint}
                    </Text>
                  </View>

                  <View className="gap-2">
                    {group.options.map((o) => {
                      const Icon = o.icon;
                      return (
                        <Pressable
                          key={o.intent}
                          testID={`scan-hub-${o.intent}`}
                          onPress={() => go(o.intent)}
                          className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 min-h-[44px] active:bg-slate-50"
                        >
                          <View className="w-9 h-9 rounded-md bg-slate-100 items-center justify-center">
                            <Icon size={18} color="#334155" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-slate-900">
                              {o.title}
                            </Text>
                            <Text className="text-xs text-slate-500" numberOfLines={1}>
                              {o.desc}
                            </Text>
                          </View>
                          <ChevronRight size={18} color="#94a3b8" />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
