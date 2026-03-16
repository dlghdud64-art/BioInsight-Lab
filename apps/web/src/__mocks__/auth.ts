/**
 * Manual mock for @/auth — prevents next-auth ESM import chain.
 * Uses jest.fn() so tests can override via mockResolvedValue in beforeEach.
 */
const _jest = typeof jest !== "undefined" ? jest : { fn: (impl: any) => impl };
export const auth = _jest.fn(async () => ({ user: { id: "mock-user" } }));
export const signIn = _jest.fn(async () => {});
export const signOut = _jest.fn(async () => {});
export const handlers = { GET: _jest.fn(async () => {}), POST: _jest.fn(async () => {}) };
