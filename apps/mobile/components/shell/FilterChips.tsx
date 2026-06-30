/**
 * §labaxis-mobile-shell — 필터 칩 행(단일 선택, 가로 스크롤). 출처: README ".chiprow".
 *
 * controlled — value/onChange 필수. 실제 큐/리스트 필터링은 호출부가 연결(no-op 금지).
 * danger tone(부족 등)은 로즈. canonical 무관.
 */
import { ScrollView, Pressable, Text } from "react-native";

export interface FilterChip {
  key: string;
  label: string;
  /** 위험 톤(예: 재고 부족). */
  danger?: boolean;
}

interface FilterChipsProps {
  chips: FilterChip[];
  value: string;
  onChange: (key: string) => void;
}

export function FilterChips({ chips, value, onChange }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {chips.map((c) => {
        const on = c.key === value;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className={`min-h-[44px] px-3.5 rounded-full items-center justify-center border ${
              on
                ? "bg-navy-900 border-navy-900"
                : c.danger
                  ? "bg-rose-weak border-rose-line"
                  : "bg-surface-paper border-surface-line"
            }`}
          >
            <Text
              className={`text-[13px] font-semibold ${
                on ? "text-white" : c.danger ? "text-rose-deep" : "text-ink-2"
              }`}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
