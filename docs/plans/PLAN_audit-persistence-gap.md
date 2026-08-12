# §audit-persistence-gap (= §audit-foundation ②) — audit envelope 영속화

작성: 2026-08-12
상태: **동결** (호영님 2026-08-12) — 실사용자 트래픽이 생긴 뒤 재개.
"감사 기록은 감사할 행위가 있어야 값어치가 있다."
발원: §audit-foundation ① 설계 중 실측 (`appendAuditEnvelope` 가 in-memory only)

---

## ⚠️ 영속화 전 필독 — `complete()` 는 인자 없이도 envelope 을 append 한다

**착수 시점에 이 절부터 읽을 것.** 이것이 "lock 해제 용도의 complete() 오용" 이
거짓 기록이 되는 메커니즘이다.

```ts
// server-enforcement-middleware.ts — complete(detail?) 구현
complete(detail) {
  appendAuditEnvelope({
    ...,
    beforeState: detail?.beforeState || { action: config.action, status: 'pending' },
    afterState:  detail?.afterState  || { action: config.action, status: 'completed' },
    ...
  });
  failMutation(concurrencyKey);   // lock 해제
}
```

- `complete()` 를 **무인자로 불러도** envelope 이 생성되고, before/after 가
  `status: pending → completed` 기본값으로 채워진다.
- 즉 읽기 전용 핸들러가 lock 해제 목적으로 `complete()` 를 부르면, 영속화가 켜지는
  순간부터 **"이 사용자가 이것을 변경했다" 는 거짓 감사 기록**이 쌓이기 시작한다.
- 실증: `analytics/ai-insight` 가 정확히 이 패턴이었다 (주석 "§11.369-2 — lock 해제").
  `fail()` 로 교정했고, **E8 sentinel**(`enforcement-complete-legitimacy.test.ts`)이
  재발을 감시한다 — 영속화 착수 전에 E8 이 GREEN 인지 확인하라.

## 현재 상태 (2026-08-10 실측)

- `appendAuditEnvelope` 는 모듈 수준 in-memory 배열(`auditStore`, MAX 10000, FIFO)에만
  쌓인다. **DB 쓰기 0.** Vercel 람다에서는 인스턴스와 함께 사라진다.
- `lib/security/audit-persistence-adapter.ts` 에 `governanceAuditLog.create` 를 부르는
  어댑터가 **존재하나** `lib/security/index.ts` 에서만 import 된다 — 배선 여부는 착수 시 실측.
- 별도 경로 `createAuditLog`(→ `AuditLog` 테이블)는 살아 있고 **다른 어휘**(대문자)를 쓴다.
  과거 레코드는 2행뿐 — 마이그레이션 문제 없음(§audit-foundation ① §6).

## 재개 조건과 순서

1. **재개 조건**: 실사용자 트래픽 (호영님 판단).
2. 어휘는 ① 확정분(snake_case, `TargetKind` 구조)을 그대로 쓴다 — 틀린 어휘로
   영속화하는 순간부터 진짜 마이그레이션 비용이 생긴다.
3. `enforceAction` 경로와 `createAuditLog` 경로의 **어휘 통일** 여부가 첫 설계 항목.
4. ③(entityCapabilities)은 ② 이후 — 순서 근거는 `PLAN_audit-taxonomy-review.md` §0.
