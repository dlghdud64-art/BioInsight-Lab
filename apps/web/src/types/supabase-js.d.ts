/**
 * @supabase/supabase-js 타입 선언 (패키지 미설치 시 fallback)
 * 실제 패키지가 설치되면 node_modules 타입이 우선합니다.
 */
declare module "@supabase/supabase-js" {
  export interface SupabaseClient {
    from(table: string): {
      select(columns?: string): any;
      insert(data: any): any;
      upsert(data: any, options?: any): any;
      update(data: any): any;
      delete(): any;
    };
    auth: {
      getUser(): Promise<{ data: { user: { id: string } | null } | null }>;
    };
    storage: {
      from(bucket: string): any;
    };
  }

  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}
