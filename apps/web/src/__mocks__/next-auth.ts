/**
 * Manual mock for next-auth — prevents ESM parse errors in Jest
 */
export default function NextAuth() { return { handlers: {}, auth: async () => null, signIn: async () => {}, signOut: async () => {} }; }
export const Auth = {};
export const customFetch = {};
