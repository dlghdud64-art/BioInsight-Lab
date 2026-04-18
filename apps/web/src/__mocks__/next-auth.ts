/**
 * Manual mock for next-auth — prevents ESM parse errors under Vitest.
 * Kept as a plain stub (no vi.fn) since no test overrides these exports directly;
 * they exist only to satisfy the next-auth import chain via vitest.config.ts alias.
 */
export default function NextAuth() { return { handlers: {}, auth: async () => null, signIn: async () => {}, signOut: async () => {} }; }
export const Auth = {};
export const customFetch = {};
