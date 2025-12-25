/**
 * Guest Key 관리 유틸리티
 * 비로그인 사용자를 위한 임시 식별자 생성 및 관리
 */

const GUEST_KEY_STORAGE_KEY = "bioinsight_guest_key";

/**
 * 랜덤 guest key 생성
 * 형식: guest_${timestamp}_${random}
 */
export function generateGuestKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `guest_${timestamp}_${random}`;
}

/**
 * localStorage에서 guest key 가져오기
 * 없으면 새로 생성하여 저장
 */
export function getGuestKey(): string {
  if (typeof window === "undefined") {
    return ""; // 서버 사이드에서는 빈 문자열 반환
  }

  try {
    let guestKey = localStorage.getItem(GUEST_KEY_STORAGE_KEY);
    
    if (!guestKey) {
      guestKey = generateGuestKey();
      localStorage.setItem(GUEST_KEY_STORAGE_KEY, guestKey);
    }
    
    return guestKey;
  } catch (error) {
    console.error("Failed to get/set guest key:", error);
    // localStorage 접근 실패 시 세션용 임시 키 생성
    return generateGuestKey();
  }
}

/**
 * guest key 삭제 (로그인 시 호출)
 */
export function clearGuestKey(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(GUEST_KEY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear guest key:", error);
  }
}

/**
 * guest key 갱신 (새로운 키 발급)
 */
export function refreshGuestKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const newKey = generateGuestKey();
  try {
    localStorage.setItem(GUEST_KEY_STORAGE_KEY, newKey);
  } catch (error) {
    console.error("Failed to refresh guest key:", error);
  }
  return newKey;
}

/**
 * fetch 요청에 guest key 헤더 추가
 */
export function addGuestKeyHeader(headers: HeadersInit = {}): HeadersInit {
  const guestKey = getGuestKey();
  
  return {
    ...headers,
    "x-guest-key": guestKey,
  };
}








