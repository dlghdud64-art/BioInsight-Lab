import { Redirect } from "expo-router";

export default function Index() {
  // 기본 진입점: 로그인 화면으로 리다이렉트
  return <Redirect href="/(auth)/login" />;
}
