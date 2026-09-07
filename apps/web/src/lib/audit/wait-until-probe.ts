/**
 * §audit-durability 프로브 (호영님 2026-09-07) —
 * **`waitUntil` 이 이 저장소의 route handler 에서 실제로 붙는가**를 배포본에서 잰다.
 *
 * 왜 재야 하는가:
 *   `@vercel/functions` 의 구현은 이렇다.
 *
 *       const waitUntil = (promise) => getContext().waitUntil?.(promise);
 *       getContext = () => globalThis[Symbol.for("@vercel/request-context")]?.get?.() ?? {};
 *
 *   🛑 **옵셔널 체이닝**이다. 컨텍스트가 없으면 예외도 로그도 없이 **조용한 no-op** 이다.
 *   로컬에서는 이벤트루프가 살아 있어 프라미스가 그냥 돌기 때문에(실측: 50ms 뒤 실행됨)
 *   "동작한다" 처럼 보인다. 그런데 서버리스에서 컨텍스트가 없으면 응답 후 인스턴스가
 *   얼어붙어 쓰기가 유실된다 — 지금 고치려는 결함과 **같은 실패**다.
 *
 *   즉 "설치했으니 된다" 로 넘어가면 146곳을 바꾼 뒤에야 안 되는 걸 알게 된다.
 *   호영님 지시: "1개 라우트로 먼저 실측하고 codemod 하십시오."
 *
 * 🔑 이 프로브는 **부작용이 없다.** DB 를 건드리지 않고 컨텍스트 **존재 여부**만 본다 —
 *   클릭 없이 `/api/health` 한 번으로 답이 나온다.
 *
 * 노출 원칙: 값이 아니라 **형태**만 싣는다(§runtime-facts 선례).
 */

/** `@vercel/functions` 가 컨텍스트를 찾는 자리와 **같은 심볼**. 상수를 베끼지 않고 맞춘다. */
const SYMBOL_FOR_REQ_CONTEXT = Symbol.for("@vercel/request-context");

export interface WaitUntilProbe {
  /** 요청 컨텍스트가 이 런타임에 실재하는가. */
  contextPresent: boolean;
  /** 그 컨텍스트가 `waitUntil` 함수를 실제로 제공하는가. 이게 true 여야 유실이 없다. */
  waitUntilCallable: boolean;
}

/**
 * 지금 이 요청에서 `waitUntil` 이 붙는지 본다.
 *
 * 🛑 절대 throw 하지 않는다 — 진단이 본 요청을 깨뜨리면 안 된다.
 */
export function probeWaitUntil(): WaitUntilProbe {
  try {
    const holder = (globalThis as Record<symbol, unknown>)[SYMBOL_FOR_REQ_CONTEXT] as
      | { get?: () => { waitUntil?: unknown } }
      | undefined;
    const ctx = holder?.get?.();
    return {
      contextPresent: !!ctx,
      waitUntilCallable: typeof ctx?.waitUntil === "function",
    };
  } catch {
    return { contextPresent: false, waitUntilCallable: false };
  }
}
