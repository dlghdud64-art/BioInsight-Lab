/**
 * useObjectGuard — 상세 화면 object 존재 확인 guard
 *
 * deeplink로 진입한 object가 삭제/만료된 경우
 * 빈 화면 대신 안내 메시지 + 목록 이동 옵션을 제공합니다.
 *
 * 사용법:
 *   const { isNotFound } = useObjectGuard(detailQuery);
 *   if (isNotFound) return <ObjectNotFoundView fallbackRoute="/(tabs)/inventory" />;
 */

import { Alert } from "react-native";
import { router } from "expo-router";
import { useEffect } from "react";

interface UseObjectGuardOptions {
  /** React Query의 isError */
  isError: boolean;
  /** React Query의 error */
  error: any;
  /** 데이터가 비어있는지 (조회 성공했지만 null) */
  isEmpty: boolean;
  /** 로딩 완료 여부 */
  isLoaded: boolean;
  /** 에러 시 돌아갈 fallback route */
  fallbackRoute: string;
  /** 화면 이름 (알림용) */
  entityLabel?: string;
}

interface ObjectGuardResult {
  /** object가 존재하지 않음 (삭제/만료) */
  isNotFound: boolean;
  /** 서버 에러 (네트워크 등) */
  isServerError: boolean;
}

export function useObjectGuard({
  isError,
  error,
  isEmpty,
  isLoaded,
  fallbackRoute,
  entityLabel = "항목",
}: UseObjectGuardOptions): ObjectGuardResult {
  const is404 = error?.response?.status === 404;
  const isNotFound = isLoaded && (is404 || isEmpty);
  const isServerError = isError && !is404;

  useEffect(() => {
    if (isNotFound) {
      Alert.alert(
        "대상을 찾을 수 없습니다",
        `요청한 ${entityLabel}이(가) 삭제되었거나 더 이상 존재하지 않습니다.`,
        [
          {
            text: "목록으로 이동",
            onPress: () => {
              try {
                router.replace(fallbackRoute as any);
              } catch {
                router.replace("/(tabs)");
              }
            },
          },
          { text: "홈으로", onPress: () => router.replace("/(tabs)") },
        ],
      );
    }
  }, [isNotFound, fallbackRoute, entityLabel]);

  return { isNotFound, isServerError };
}
