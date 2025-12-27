const GUEST_KEY_STORAGE_KEY = "bioinsight_guest_key";

export function getGuestKey(): string {
  if (typeof window === "undefined") {
    return "";
  }

  let guestKey = localStorage.getItem(GUEST_KEY_STORAGE_KEY);

  if (!guestKey) {
    guestKey = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(GUEST_KEY_STORAGE_KEY, guestKey);
  }

  return guestKey;
}

export function clearGuestKey(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(GUEST_KEY_STORAGE_KEY);
  }
}
