// Vitest 테스트 환경 설정
// 기존 jest.setup.js 내용을 vitest 로 이관 (Jest 제거, 2026-04-18)

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// 환경 변수 기본값 (로컬 / CI 모두에서 테스트가 실 DB 없이도 import 에러 안나도록)
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Next.js navigation 모킹 — 대부분의 컴포넌트 테스트가 의존
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => "/",
}));
