/**
 * Manual mock for @/auth — prevents next-auth ESM import chain.
 * Uses vi.fn() so tests can override via mockResolvedValue in beforeEach.
 * (Migrated from jest to vitest on 2026-04-18.)
 */
import { vi } from "vitest";

export const auth = vi.fn(async () => ({ user: { id: "mock-user" } }));
export const signIn = vi.fn(async () => {});
export const signOut = vi.fn(async () => {});
export const handlers = {
  GET: vi.fn(async () => {}),
  POST: vi.fn(async () => {}),
};
