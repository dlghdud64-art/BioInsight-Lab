import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, FlatList, Keyboard, TouchableWithoutFeedback } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Search as SearchIcon, X } from "lucide-react-native";
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

  const handleSearch = async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiClient.get("/api/mobile/products/search", {
        params: { q: query.trim(), limit: 20 },
      });
      setResults(res.data.products || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1">
          {/* 검색 헤더 */}
          <View className="px-4 pt-4 pb-3 border-b border-slate-100">
            <Text className="text-lg font-bold text-slate-900 mb-3">제품 검색</Text>
            <View className="flex-row items-center bg-slate-100 rounded-2xl px-4 h-12">
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
