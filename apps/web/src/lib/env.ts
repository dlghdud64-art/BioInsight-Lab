export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  console.warn("NEXT_PUBLIC_APP_URL, NEXTAUTH_URL, and VERCEL_URL are not set. Falling back to production domain.");
  return "https://labaxis.co.kr";
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true" || process.env.NODE_ENV === "development";
}
