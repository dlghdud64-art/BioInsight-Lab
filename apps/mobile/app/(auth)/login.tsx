import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Chrome } from "lucide-react-native";
import { login } from "../../lib/api";
import { signInWithGoogle } from "../../lib/oauth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 포커스 상태
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setOauthLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.success) {
        router.replace("/(tabs)");
      } else {
        setError(result.error ?? "Google 로그인에 실패했습니다.");
      }
    } catch {
      setError("Google 로그인 중 오류가 발생했습니다.");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError(null);

    // 유효성 검사
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const data = await login(email.trim(), password);

      // 토큰 저장
      await SecureStore.setItemAsync("accessToken", data.accessToken);
      await SecureStore.setItemAsync("refreshToken", data.refreshToken);

      // 홈 탭으로 이동
      router.replace("/(tabs)");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 400) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (status === 429) {
        setError("너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 justify-center px-6 py-10">

              {/* 로고 & 브랜드 */}
              <View className="items-center mb-10">
                <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center mb-4 shadow-lg">
                  <Text className="text-white text-3xl font-extrabold">B</Text>
                </View>
                <Text className="text-2xl font-extrabold text-blue-900 tracking-tight">
                  BioInsight{" "}
                  <Text className="text-teal-500">Lab</Text>
                </Text>
                <Text className="text-sm text-slate-500 mt-1">
                  검색·견적·구매·재고를 한곳에서
                </Text>
              </View>

              {/* 폼 제목 */}
              <Text className="text-xl font-bold text-slate-900 mb-1">
                로그인
              </Text>
              <Text className="text-sm text-slate-500 mb-6">
                계정에 로그인하여 시작하세요
              </Text>

              {/* 에러 메시지 */}
              {error && (
                <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle size={16} color="#ef4444" />
                  <Text className="text-sm text-red-600 flex-1">{error}</Text>
                </View>
              )}

              {/* 이메일 입력 */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-slate-700 mb-1.5">
                  이메일
                </Text>
                <View
                  className={[
                    "flex-row items-center h-12 rounded-xl border px-4 gap-2",
                    emailFocused
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-slate-50",
                  ].join(" ")}
                >
                  <Mail
                    size={18}
                    color={emailFocused ? "#2563eb" : "#94a3b8"}
                  />
                  <TextInput
                    className="flex-1 text-slate-900 text-base"
                    placeholder="name@company.com"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      setError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* 비밀번호 입력 */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-slate-700 mb-1.5">
                  비밀번호
                </Text>
                <View
                  className={[
                    "flex-row items-center h-12 rounded-xl border px-4 gap-2",
                    passwordFocused
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-slate-50",
                  ].join(" ")}
                >
                  <Lock
                    size={18}
                    color={passwordFocused ? "#2563eb" : "#94a3b8"}
                  />
                  <TextInput
                    ref={passwordRef}
                    className="flex-1 text-slate-900 text-base"
                    placeholder="비밀번호 입력"
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#94a3b8" />
                    ) : (
                      <Eye size={18} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* 로그인 버튼 */}
              <TouchableOpacity
                className={[
                  "h-14 rounded-xl items-center justify-center shadow-sm",
                  loading || !email || !password
                    ? "bg-blue-300"
                    : "bg-blue-600",
                ].join(" ")}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-bold text-base">
                      로그인 중...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-white font-bold text-base">
                    로그인
                  </Text>
                )}
              </TouchableOpacity>

              {/* 구분선 */}
              <View className="flex-row items-center gap-3 my-6">
                <View className="flex-1 h-px bg-slate-200" />
                <Text className="text-xs text-slate-400">또는</Text>
                <View className="flex-1 h-px bg-slate-200" />
              </View>

              {/* Google 로그인 */}
              <TouchableOpacity
                className={[
                  "h-14 rounded-xl items-center justify-center flex-row gap-3 border",
                  oauthLoading ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white",
                ].join(" ")}
                onPress={handleGoogleLogin}
                disabled={oauthLoading || loading}
                activeOpacity={0.8}
              >
                {oauthLoading ? (
                  <ActivityIndicator color="#2563eb" size="small" />
                ) : (
                  <Chrome size={20} color="#4285F4" />
                )}
                <Text className="text-slate-700 font-semibold text-base">
                  {oauthLoading ? "로그인 중..." : "Google 계정으로 로그인"}
                </Text>
              </TouchableOpacity>

              {/* 안내 문구 */}
              <View className="items-center mt-4">
                <Text className="text-sm text-slate-500 text-center leading-relaxed">
                  계정이 없으신가요?{"\n"}
                  <Text className="text-blue-600 font-semibold">
                    PC 웹에서 회원가입
                  </Text>
                  을 진행해주세요.
                </Text>
              </View>

              {/* 하단 법적 고지 */}
              <Text className="text-xs text-slate-400 text-center mt-8 leading-relaxed">
                로그인하면 BioInsight Lab의{"\n"}
                <Text className="text-slate-500 underline">서비스 이용약관</Text>
                {" "}및{" "}
                <Text className="text-slate-500 underline">개인정보처리방침</Text>
                에 동의하는 것으로 간주됩니다.
              </Text>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
