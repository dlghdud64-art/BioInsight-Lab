import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const GUEST_KEY_COOKIE_NAME = "bil_guest";
const GUEST_KEY_MAX_AGE = 60 * 60 * 24 * 30; // 30일

/**
 * guestKey 쿠키를 읽거나 없으면 생성하여 반환
 * 모든 quote-list API에서 사용
 */
export async function getOrCreateGuestKey(): Promise<string> {
  const cookieStore = await cookies();
  let guestKey = cookieStore.get(GUEST_KEY_COOKIE_NAME)?.value;

  if (!guestKey) {
    guestKey = randomUUID();
    cookieStore.set(GUEST_KEY_COOKIE_NAME, guestKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_KEY_MAX_AGE,
    });
  }

  return guestKey;
}











