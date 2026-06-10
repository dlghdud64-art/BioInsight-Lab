import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, FlatList, Keyboard, TouchableWithoutFeedback } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { Search as SearchIcon, X, ScanLine } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiClient } from "../../lib/api";

interface Product {
  id: string;
  name: string;
  nameEn?: string;
  brand?: string;
  catalogNumber?: string;
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // §11.37x(c) — 소싱 라벨 스캔 복귀 q 파라미터 (scan.tsx sourcing_label → 검색 복귀).
  const { q: scanQ } = useLocalSearchParams<{ q?: string }>();

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiClient.get("/api/mobile/products/search", {
        params: { q: term.trim(), limit: 20 },
      });
      setResults(res.data.products || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => runSearch(query);

  // §11.37x(c) — 스캔 복귀 시 자동 검색 (read-only 조회, mutation 0).
  useEffect(() => {
    if (typeof scanQ === "string" && scanQ.trim()) {
      setQuery(scanQ);
      runSearch(scanQ);
    }
  }, [scanQ, runSearch]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1">
          {/* 검색 헤더 */}
          <View className="px-4 pt-4 pb-3 border-b border-slate-100">
            <Text className="text-lg font-bold text-slate-900 mb-3">제품 검색</Text>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 flex-row items-center bg-slate-100 rounded-2xl px-4 h-12">
                <SearchIcon size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 ml-2 text-slate-900 text-base"
                  placeholder="시약명, CAS No., 제조사..."
                  placeholderTextColor="#94a3b8"
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearched(false); }}>
                    <X size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
              {/* §11.37x(c) — 소싱 라벨 카메라 진입 (read-only 검색, ScanHub 비복제). 44px 터치. */}
              <TouchableOpacity
                className="w-12 h-12 rounded-2xl bg-slate-100 items-center justify-center"
                accessibilityLabel="라벨 스캔으로 검색"
                onPress={() => router.push("/scan?intent=sourcing_label")}
              >
                <ScanLine size={20} color="#2563eb" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="mt-2 bg-blue-600 rounded-xl h-10 items-center justify-center"
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-semibold">검색</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 결과 */}
          {searched && !loading && results.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-400 text-base">검색 결과가 없습니다</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item }) => (
                <View className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <Text className="text-sm font-semibold text-slate-900">{item.name}</Text>
                  {item.nameEn && (
                    <Text className="text-xs text-slate-500 mt-0.5">{item.nameEn}</Text>
                  )}
                  <View className="flex-row gap-2 mt-2">
                    {item.brand && (
                      <View className="bg-blue-50 rounded-full px-2 py-0.5">
                        <Text className="text-xs text-blue-700 font-medium">{item.brand}</Text>
                      </View>
                    )}
                    {item.catalogNumber && (
                      <View className="bg-slate-100 rounded-full px-2 py-0.5">
                        <Text className="text-xs text-slate-600">{item.catalogNumber}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
