fix(api): §11.310b implicit any r — reorder-recommendation route.ts

TS strict noImplicitAny 수정 (pre-push build gate 해소).

Fix:
- recentRecords.map((r) → 인라인 타입 명시
  { id, purchasedAt, vendorName, qty, unitPrice, amount, quoteId }

Cause:
  Prisma select 결과가 TypeScript 에서 잘못 추론됨 → 명시적 타입 어노테이션으로 해소.

Production effect: §11.310b API 동작 변경 없음. 빌드 타입 에러 해소.
Out of Scope: groupBy map (g) — Prisma generic 자동 추론으로 타입 safe.
Rollback path: git revert 이 커밋.