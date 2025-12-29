const GUEST_KEY_STORAGE_KEY = "bioinsight_guest_key";

// 개발/데모 환경에서 사용할 고정 키 (seed 데이터와 일치)
const DEMO_GUEST_KEY = "guest-demo";

export function getGuestKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  // 개발/데모 환경에서는 항상 guest-demo 사용 (seed 데이터와 일치)
  // TODO: 프로덕션에서는 아래 주석을 해제하여 사용자별 키 생성
  return DEMO_GUEST_KEY;

  /*
  let guestKey = localStorage.getItem(GUEST_KEY_STORAGE_KEY);

  if (!guestKey) {
    guestKey = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(GUEST_KEY_STORAGE_KEY, guestKey);
  }

  return guestKey;
  */
}

export function clearGuestKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GUEST_KEY_STORAGE_KEY);
  }
}








