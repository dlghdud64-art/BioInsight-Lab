import { View, Text, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useCreatePurchase, useBatchImportPurchases } from "../../hooks/useApi";
import { DatePicker } from "../../components/DatePicker";
import { Edit3, ClipboardList, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react-native";

// ─── 타입 ─────────────────────────────────────────────────────
interface ParsedRow {
  purchasedAt: string;
  vendorName: string;
  itemName: string;
  catalogNumber?: string;
  unit?: string;
  qty: number;
  unitPrice?: number;
  amount?: number;
  category?: string;
}

type Mode = "quick" | "paste";
type Step = "entry" | "review";

// ─── TSV/CSV 파서 ─────────────────────────────────────────────
const TSV_HEADERS = ["purchasedAt", "vendorName", "category", "itemName", "catalogNumber", "unit", "qty", "unitPrice", "amount"] as const;

function parsePastedText(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: ["데이터가 비어 있습니다."] };

  const errors: string[] = [];
  const rows: ParsedRow[] = [];

  // 첫 행이 헤더인지 감지 (purchasedAt 또는 구매일 포함)
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("purchasedat") || firstLine.includes("구매일") || firstLine.includes("itemname") || firstLine.includes("제품명");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  // 구분자 감지: 탭 또는 쉼표
  const delimiter = dataLines[0]?.includes("\t") ? "\t" : ",";

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = hasHeader ? i + 2 : i + 1;
    const cols = dataLines[i].split(delimiter).map((c) => c.trim());

    if (cols.length < 4) {
      errors.push(`${lineNum}행: 최소 4열 필요 (구매일, 벤더, 제품명, 수량)`);
      continue;
    }

    const purchasedAt = cols[0] || "";
    const vendorName = cols[1] || "";
    const category = cols[2] || undefined;
    const itemName = cols[3] || "";
    const catalogNumber = cols[4] || undefined;
    const unit = cols[5] || undefined;
    const qty = parseInt(cols[6] || "1", 10);
    const unitPrice = cols[7] ? parseInt(cols[7], 10) : undefined;
    const amount = cols[8] ? parseInt(cols[8], 10) : undefined;

    if (!purchasedAt) { errors.push(`${lineNum}행: 구매일 누락`); continue; }
    if (!vendorName) { errors.push(`${lineNum}행: 벤더명 누락`); continue; }
    if (!itemName) { errors.push(`${lineNum}행: 제품명 누락`); continue; }
    if (isNaN(qty) || qty <= 0) { errors.push(`${lineNum}행: 수량 오류`); continue; }
    if (!amount && !unitPrice) { errors.push(`${lineNum}행: 금액 또는 단가 필요`); continue; }

    rows.push({ purchasedAt, vendorName, category, itemName, catalogNumber, unit, qty, unitPrice, amount });
  }

  return { rows, errors };
}

// ─── 간편입력 폼 ──────────────────────────────────────────────
function QuickEntryForm() {
  const params = useLocalSearchParams<{
    prefill?: string;
    productName?: string;
    vendor?: string;
    amount?: string;
    unit?: string;
  }>();

  const [form, setForm] = useState({
    productName: params.productName ?? "",
    vendor: params.vendor ?? "",
    amount: params.amount ?? "",
    quantity: "",
    unit: params.unit ?? "ea",
    category: "",
    notes: "",
  });
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const createPurchase = useCreatePurchase();

  const handleSave = () => {
    if (!form.productName.trim()) {
      Alert.alert("오류", "제품명을 입력하세요.");
      return;
    }
    if (!form.amount.trim() || isNaN(Number(form.amount))) {
      Alert.alert("오류", "금액을 올바르게 입력하세요.");
      return;
    }

    createPurchase.mutate(
      {
        productName: form.productName.trim(),
        vendor: form.vendor.trim() || undefined,
        amount: Number(form.amount),
        quantity: form.quantity ? Number(form.quantity) : undefined,
        unit: form.unit || "ea",
        category: form.category.trim() || undefined,
        purchasedAt: purchaseDate.toISOString(),
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.replace({
            pathname: "/purchases/complete",
            params: { count: "1", total: form.amount },
          });
        },
        onError: () => {
          Alert.alert("오류", "등록에 실패했습니다. 다시 시도해주세요.");
        },
      }
    );
  };

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          제품명 <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="시약/장비명 입력"
          value={form.productName}
          onChangeText={(v) => update("productName", v)}
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">벤더</Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="공급업체명"
          value={form.vendor}
          onChangeText={(v) => update("vendor", v)}
        />
      </View>

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">
            금액 (₩) <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="0"
            keyboardType="numeric"
            value={form.amount}
            onChangeText={(v) => update("amount", v)}
          />
        </View>
        <View className="w-24">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">수량</Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="1"
            keyboardType="numeric"
            value={form.quantity}
            onChangeText={(v) => update("quantity", v)}
          />
        </View>
      </View>

      <View className="flex-row gap-3 mb-4">
        <View className="w-24">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">단위</Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="ea"
            value={form.unit}
            onChangeText={(v) => update("unit", v)}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">카테고리</Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="시약, 소모품, 장비 등"
            value={form.category}
            onChangeText={(v) => update("category", v)}
          />
        </View>
      </View>

      <View className="mb-4">
        <DatePicker label="구매일" value={purchaseDate} onChange={setPurchaseDate} />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">비고</Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="추가 메모"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={form.notes}
          onChangeText={(v) => update("notes", v)}
        />
      </View>

      <Pressable
        className="bg-blue-600 rounded-xl py-3.5 items-center"
        onPress={handleSave}
        disabled={createPurchase.isPending}
      >
        {createPurchase.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-sm font-semibold text-white">구매 내역 등록</Text>
        )}
      </Pressable>
    </>
  );
}

// ─── 붙여넣기 입력 (TSV/CSV) ──────────────────────────────────
function PasteEntryForm({ onParsed, disabled }: { onParsed: (rows: ParsedRow[]) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleParse = () => {
    if (!text.trim()) {
      Alert.alert("오류", "데이터를 붙여넣어 주세요.");
      return;
    }
    const { rows, errors } = parsePastedText(text);
    setParseErrors(errors);

    if (rows.length === 0) {
      Alert.alert("파싱 실패", errors.join("\n") || "유효한 데이터가 없습니다.");
      return;
    }

    if (errors.length > 0) {
      Alert.alert(
        "일부 행 오류",
        `${rows.length}건 파싱 성공, ${errors.length}건 오류.\n오류 행은 제외하고 진행합니다.`,
        [
          { text: "취소", style: "cancel" },
          { text: "계속", onPress: () => onParsed(rows) },
        ]
      );
    } else {
      onParsed(rows);
    }
  };

  return (
    <>
      <View className="mb-3">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          데이터 붙여넣기 <Text className="text-red-500">*</Text>
        </Text>
        <Text className="text-xs text-slate-400 mb-2">
          탭(TSV) 또는 쉼표(CSV) 구분 데이터를 붙여넣으세요.
        </Text>
      </View>

      {/* 열 순서 안내 */}
      <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
        <Text className="text-xs font-semibold text-slate-600 mb-1">열 순서 (필수*)</Text>
        <Text className="text-xs text-slate-500 leading-5">
          구매일* | 벤더* | 카테고리 | 제품명* | Cat.No | 단위 | 수량* | 단가 | 금액
        </Text>
        <Text className="text-xs text-slate-400 mt-1">
          첫 행이 헤더이면 자동 건너뜁니다. 금액 또는 단가 중 하나는 필수.
        </Text>
      </View>

      <TextInput
        className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 min-h-[200px]"
        placeholder={"2024-03-01\tSigma\t시약\tSodium Chloride\tS7653\tmL\t5\t15000\t75000\n2024-03-02\tThermo\t소모품\tPipette Tips\tF171503\tbox\t10\t8000\t80000"}
        multiline
        textAlignVertical="top"
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {parseErrors.length > 0 && (
        <View className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <View className="flex-row items-center gap-1.5 mb-1">
            <AlertCircle size={14} color="#ef4444" />
            <Text className="text-xs font-semibold text-red-600">파싱 오류</Text>
          </View>
          {parseErrors.slice(0, 5).map((err, i) => (
            <Text key={i} className="text-xs text-red-500">{err}</Text>
          ))}
          {parseErrors.length > 5 && (
            <Text className="text-xs text-red-400 mt-1">외 {parseErrors.length - 5}건...</Text>
          )}
        </View>
      )}

      <Pressable
        className={`rounded-xl py-3.5 items-center mt-4 ${disabled ? "bg-slate-200" : "bg-blue-600"}`}
        onPress={handleParse}
        disabled={disabled}
      >
        <Text className={`text-sm font-semibold ${disabled ? "text-slate-400" : "text-white"}`}>
          데이터 확인 ({text.trim().split("\n").filter(Boolean).length}행)
        </Text>
      </Pressable>
    </>
  );
}

// ─── 리뷰 화면 ────────────────────────────────────────────────
function ReviewScreen({ rows, onBack, onConfirm, isSubmitting }: {
  rows: ParsedRow[];
  onBack: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  const totalAmount = rows.reduce((sum, r) => sum + (r.amount || (r.unitPrice || 0) * r.qty), 0);

  return (
    <>
      <Pressable className="flex-row items-center gap-2 mb-4" onPress={onBack}>
        <ArrowLeft size={16} color="#64748b" />
        <Text className="text-sm text-slate-500">뒤로</Text>
      </Pressable>

      <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <View className="flex-row items-center gap-2 mb-1">
          <CheckCircle size={16} color="#2563eb" />
          <Text className="text-sm font-bold text-blue-700">등록 확인</Text>
        </View>
        <Text className="text-xs text-blue-600">
          {rows.length}건 · 총 ₩{totalAmount.toLocaleString("ko-KR")}
        </Text>
      </View>

      {/* 행 목록 */}
      {rows.map((row, i) => (
        <View
          key={i}
          className="bg-white border border-slate-200 rounded-xl p-3 mb-2"
        >
          <View className="flex-row items-start justify-between mb-1">
            <Text className="text-sm font-semibold text-slate-800 flex-1 mr-2" numberOfLines={1}>
              {row.itemName}
            </Text>
            <Text className="text-sm font-bold text-blue-600">
              ₩{(row.amount || (row.unitPrice || 0) * row.qty).toLocaleString("ko-KR")}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
            <Text className="text-xs text-slate-400">{row.purchasedAt}</Text>
            <Text className="text-xs text-slate-400">{row.vendorName}</Text>
            <Text className="text-xs text-slate-400">{row.qty}{row.unit || "ea"}</Text>
            {row.catalogNumber && (
              <Text className="text-xs text-slate-400">Cat.{row.catalogNumber}</Text>
            )}
          </View>
        </View>
      ))}

      <View className="flex-row gap-3 mt-4">
        <Pressable
          className="flex-1 border border-slate-200 rounded-xl py-3.5 items-center"
          onPress={onBack}
          disabled={isSubmitting}
        >
          <Text className="text-sm font-semibold text-slate-600">수정</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-blue-600 rounded-xl py-3.5 items-center"
          onPress={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-sm font-semibold text-white">
              {rows.length}건 등록
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────
const MODES: { key: Mode; label: string; icon: typeof Edit3 }[] = [
  { key: "quick", label: "간편 입력", icon: Edit3 },
  { key: "paste", label: "붙여넣기", icon: ClipboardList },
];

export default function PurchaseRegisterScreen() {
  const params = useLocalSearchParams<{ prefill?: string }>();
  const [mode, setMode] = useState<Mode>(params.prefill ? "quick" : "quick");
  const [step, setStep] = useState<Step>("entry");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  const batchImport = useBatchImportPurchases();

  const handleParsed = (rows: ParsedRow[]) => {
    setParsedRows(rows);
    setStep("review");
  };

  const handleBatchSave = () => {
    batchImport.mutate(
      { rows: parsedRows },
      {
        onSuccess: (data) => {
          const totalAmount = parsedRows.reduce(
            (sum, r) => sum + (r.amount || (r.unitPrice || 0) * r.qty),
            0
          );
          const navigateToComplete = () => {
            router.replace({
              pathname: "/purchases/complete",
              params: {
                count: String(data.successRows),
                total: String(totalAmount),
              },
            });
          };
          if (data.errorRows) {
            Alert.alert(
              "일부 실패",
              `${data.successRows}건 성공, ${data.errorRows}건 실패`,
              [{ text: "확인", onPress: navigateToComplete }]
            );
          } else {
            navigateToComplete();
          }
        },
        onError: () => {
          Alert.alert("오류", "등록에 실패했습니다. 다시 시도해주세요.");
        },
      }
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {step === "review" ? (
        <ReviewScreen
          rows={parsedRows}
          onBack={() => setStep("entry")}
          onConfirm={handleBatchSave}
          isSubmitting={batchImport.isPending}
        />
      ) : (
        <>
          {/* 모드 선택 탭 */}
          <View className="flex-row bg-slate-100 rounded-xl p-1 mb-5">
            {MODES.map((m) => (
              <Pressable
                key={m.key}
                className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${
                  mode === m.key ? "bg-white shadow-sm" : ""
                }`}
                onPress={() => setMode(m.key)}
              >
                <m.icon size={14} color={mode === m.key ? "#2563eb" : "#94a3b8"} />
                <Text
                  className={`text-sm font-medium ${
                    mode === m.key ? "text-blue-600" : "text-slate-400"
                  }`}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 모드별 폼 */}
          {mode === "quick" && <QuickEntryForm />}
          {mode === "paste" && <PasteEntryForm onParsed={handleParsed} disabled={batchImport.isPending} />}
        </>
      )}
    </ScrollView>
  );
}
