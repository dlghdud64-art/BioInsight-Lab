# §po-candidate-idor — 발주 후보 소유권 검증 부재 (처리 완료)

작성: 2026-08-10
상태: **처리 완료** (2026-08-10, 단일 커밋)
발원: §enforcement-handle-close-sweep 배치12 부수 관측

---

## 0. 취약점

`PATCH /api/po-candidates` · `DELETE /api/po-candidates` 가 소유권을 검증하지 않았다.

```ts
// 이전 (src/lib/persistence/po-candidate-server.ts)
export async function deletePOCandidate(id: string): Promise<void> {
  await prisma.pOCandidate.delete({ where: { id } });   // ← id 단독
}
export async function updatePOCandidateStage(id: string, stage: string, ...) {
  const row = await prisma.pOCandidate.update({ where: { id }, ... });  // ← id 단독
}
```

라우트에도 검증이 없었다. **로그인한 사용자면 누구나 id 만 알면 남의 발주 후보를
지우거나 stage 를 바꿀 수 있었다.**

발주 후보는 구매 흐름의 진입점이라 삭제되면 사용자는 "내가 만든 게 사라졌다" 만
보고 원인에 도달할 경로가 없다.

## 1. 노출 실측 (2026-08-10)

| 항목 | 실측 |
|---|---|
| UI 표면 | **없음.** `grep -rn "api/po-candidates" src` 결과 앱 코드 호출자 0 (문서 주석 1 + 테스트 1). PATCH/DELETE 는 UI 에서 호출되지 않는다 |
| 인증 요건 | 로그인 필요 (익명 불가) |
| 귀속 필드 | **실재.** `POCandidate.userId String`(필수) + `organizationId String?`(선택) |
| 기존 범위 규약 | `GET` 은 `listPOCandidates(session.user.id, ...)` 로 **userId 스코프**. 조직 공유 규약은 없다 |
| 헬퍼 호출자 | 이 라우트 1곳뿐 (`updatePOCandidateStage` / `deletePOCandidate` / `getPOCandidate`) |

→ UI 경로가 없으므로 **우발적 트리거 가능성은 낮다.** 그러나 인증된 사용자가
직접 API 를 호출하면 성립하는 실취약점이다. 귀속 필드가 실재하므로
**최소 diff 로 막을 수 있다** — §supplier-product-ownership-scope 클래스가 아니다.

## 2. 실제 피해 발생 여부 — **확인 불가** (추정하지 않음)

운영 DB 접근 여부와 무관하게 **원리상 확인할 수 없다**:

- `POCandidate` 는 **hard delete** 다(`items` 는 `onDelete: Cascade`). 삭제된 행은 남지 않는다.
- 이 라우트에는 `enforceAction` 이 없었으므로 **audit envelope 이 기록되지 않았다.**
- 헬퍼·라우트 어디에도 `activityLog` / `createAuditLog` 호출이 없다(grep 0건).

즉 과거에 삭제가 일어났는지 판정할 근거가 **애초에 생성되지 않았다.**
"피해 없음" 이 아니라 **"확인 불가"** 로 기록한다.

⚠️ **정정 (2026-08-10, taxonomy 착수 실측 중 발견).** 처음에 "이번 배선으로
앞으로의 삭제는 audit envelope 에 남는다" 고 적었으나 **사실이 아니다.**
`appendAuditEnvelope` 는 모듈 수준 in-memory 배열(`auditStore`, MAX 10000, FIFO)에만
쌓이고 DB 로 넘어가지 않는다(코드 주석: "실제 production에서는 외부 storage로 archive"
— 미구현). Vercel 람다에서는 인스턴스와 함께 사라진다.
→ 이번 배선의 실제 효과는 **lock 집행과 권한 판정 경로 편입**이며, 지속 감사 기록은
§audit-persistence-gap 이 해결되어야 생긴다. 그 전까지 "다음엔 답 가능" 이 아니다.

## 3. 처리

### 3-1. 검증은 라우트가 아니라 헬퍼에

라우트에만 넣으면 다른 호출자가 생길 때 같은 구멍이 재발한다.
`actorUserId` 를 **필수 인자**로 두어 호출자가 빠뜨리면 컴파일이 깨지도록 했다.

```ts
export async function deletePOCandidate(id: string, actorUserId: string): Promise<boolean> {
  const { count } = await prisma.pOCandidate.deleteMany({ where: { id, userId: actorUserId } });
  return count > 0;
}
```

`deleteMany` / `updateMany` + `count` 를 쓴 이유: 조회-후-쓰기 2단계가 아니라
**한 번의 쿼리로 소유 여부와 쓰기를 같이 처리**해 경합 구간을 없앤다.

`getPOCandidate`(현재 호출자 0)도 같은 클래스의 읽기 구멍이라 함께 좁혔다 —
지금 안 막으면 첫 호출자가 생길 때 그대로 노출된다.

### 3-2. 응답은 403 이 아니라 404

남의 후보와 없는 후보를 같은 응답으로 돌려 **존재 여부를 노출하지 않는다.**

### 3-3. enforceAction 배선

§enforcement-coverage-gap 의 확정 사례 2건이므로 E7 을 기다리지 않고 함께 처리했다.
`PATCH` → `sensitive_data_import`, `DELETE` → `sensitive_data_delete`.
검증 400 은 lock 획득 **이전**에 둬서 잘못된 요청이 lock 을 잡지 않는다.
소유권 불일치(404)는 쓰기가 없으므로 `fail()`, 성공은 `complete()`.

### 3-4. sentinel

`src/__tests__/ops/po-candidate-ownership.test.ts` — P1~P5.
부정 단언은 `stripComments` 적용본에 건다.

corrupt→RED 실증: 헬퍼를 `delete({ where: { id } })` 로 되돌리고 라우트의 404
분기를 제거 → **3 assertion RED**(P1 / P1-b / P4-b). 원복 후 7 passed.

## 4. 남은 것

- `targetEntityType: 'ai_action'` 은 실제 대상(POCandidate)과 어긋난다 —
  enum 에 해당 타입이 없다(클래스 ③). §audit-taxonomy-review.
- 조직 단위 공유(같은 organizationId 멤버가 서로의 후보를 다룰 수 있어야 하는지)는
  **규약이 없어 판단하지 않았다.** 현재 GET 규약(userId 스코프)에 맞췄다.
  조직 공유가 필요하다면 GET 부터 함께 바꿔야 하며 별건이다.
