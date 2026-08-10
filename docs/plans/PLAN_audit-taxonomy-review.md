# §audit-taxonomy-review — enforceAction 분류 체계 정리 지시문

작성: 2026-08-10
상태: 등재 (미착수)
발원: §enforcement-handle-close-sweep 배치1~10 관측 (누적 후보 22건)

---

## 0. 최상단 고정 규칙

**개별 route 의 `targetEntityType` 을 하나씩 고쳐서 시작하지 않는다.**
아래 3클래스 중 **클래스 ③ 이 존재하므로**, 이 트랙의 첫 단계는 개별 교정이 아니라
**타입 체계 설계**다. 순서를 바꾸면 ③ 에 걸린 route 는 손댈 수가 없고,
①② 만 고친 상태는 "일부만 정확한 분류" 라 오히려 판독을 어렵게 만든다.

## 1. 대상

```ts
// server-enforcement-middleware.ts:72 / server-authorization-guard.ts:119
readonly targetEntityType:
  | 'po' | 'quote' | 'dispatch' | 'approval' | 'order' | 'inventory'
  | 'receiving' | 'ai_action' | 'compare_session' | 'email_draft'
  | 'organization' | 'team' | 'workspace' | 'budget' | 'billing'
  | 'governance' | 'purchase_request' | 'purchase_record' | 'product'
  | 'cart' | 'invite';
```

## 2. 세 클래스 — 성격이 다르므로 대응도 다르다

### 클래스 ① 오분류 — A 를 선언하고 B 를 취급

enum 에 정확한 값이 **있는데** 다른 값이 쓰였다.

- 예: `analytics/*`, `protocol/*` 이 실제로는 다른 대상을 다루면서 `'ai_action'` 선언.
- 예: `shared-lists/bulk` 는 DELETE 인데 `action: 'sensitive_data_import'`
  (`action` 도 authorization 입력이라 같은 성격의 문제).

**대응: 개별 교정 가능.** route 단위로 올바른 값으로 바꾸면 끝난다.

### 클래스 ② 대상 미존재 — 생성 전이라 id 가 없다

핸들 생성 시점에 대상 엔티티가 아직 만들어지지 않았다.

- 예: `purchases/import-file` — `ImportJob` 은 핸들 생성 이후에 create 된다.
- 예: `shared-lists` POST — `SharedList` 는 그 이후에 create 된다.

**대응: 개별 교정 가능.** 단 교정 방식이 ① 과 다르다 — 값을 바꾸는 게 아니라
**핸들 생성 시점을 옮기거나**(대상 확정 후), 생성 전 단계를 별도 분류로 인정할지
결정해야 한다. `'unknown'` 이 정당한 유일한 클래스이기도 하다.

### 클래스 ③ 선택지 부재 — enum 에 정확한 값이 아예 없다 ⚠️

대상은 명확하고 id 도 있는데, **enum 에 그 타입이 존재하지 않는다.**

- `sds/[id]/*` — SDSDocument. enum 에 document/SDS 타입 없음.
- `datasheet/*` — 데이터시트 문서. 동일.
- `shared-lists/*` — SharedList. enum 에 shared_list 없음.

**대응: 개별 교정 불가.** enum 확장이 선행되지 않으면 어떤 값을 넣어도 틀린다.
현재 `'ai_action'` 이 쓰인 것은 "안 쓴 것" 이 아니라 **"쓸 게 없어서 대리로 쓴 것"** 이다.

## 3. 왜 sweep 중에 바꾸지 않았는가 — 그리고 지금 상황의 실측

`targetEntityType` 은 세 곳으로 흘러간다.

1. **audit envelope 기록** (`appendAuditEnvelope`) — **오늘 실제로 영향 있음.**
   틀린 타입으로 감사 기록이 남고 있다.
2. **security event provenance** (`createEventProvenance`) — 동일.
3. **접근 판정** (`checkServerAuthorization` → `hasEntityCapability`) —
   `cap.capabilities.includes(`${targetEntityType}.*`)` 로 매칭된다.

**단, 3번은 현재 작동하지 않는다.** 실측:

```
src/lib/security/server-enforcement-middleware.ts:146
    entityCapabilities: [], // TODO: DB에서 조회
```

`hasEntityCapability` 는 `entityCapabilities.length === 0` 이면 **무조건 true 를 반환**한다.
즉 오늘의 라이브 경로에서 `targetEntityType` 은 접근 판정에 영향을 주지 못한다.
프로덕션 코드에서 이 필드를 채우는 곳은 위 한 줄뿐이다(테스트 제외).

이 사실의 함의는 두 방향이다.

- **완화**: 지금 타입을 고치는 것은 접근 권한을 바꾸지 않는다. 위험이 낮다.
- **경고**: `TODO: DB에서 조회` 가 구현되는 순간 **현재의 오분류가 그대로 접근 규칙이 된다.**
  22건의 틀린 선언이 잠재된 권한 규칙으로 활성화된다.
  → **entityCapabilities 구현보다 taxonomy 정리가 먼저다.** 순서가 뒤집히면
  권한 사고를 만든 뒤에 고치는 셈이 된다.

## 4. 실행 순서 (권고)

1. **타입 체계 설계** — 클래스 ③ 의 대상(문서/SDS/데이터시트/공유링크)을 enum 에
   추가할지, 상위 카테고리(예: `document`)로 묶을지 결정. 이게 첫 단계다.
2. **enum 확장** + 기존 값 무손상 확인 (sentinel).
3. **클래스 ③ route 교정** — 확장된 값으로.
4. **클래스 ① 교정** — 개별.
5. **클래스 ② 결정** — 핸들 시점 이동 vs `'unknown'` 정당 인정. 후자면 그 근거를
   코드 주석과 sentinel 에 명문화한다.
6. 그 다음에야 `entityCapabilities` DB 조회 구현(별건 트랙).

## 5. 부수 효과 — lock 입도

`deriveConcurrencyKey` 는 `targetEntityId` 가 `'unknown'` 이면 `userId` 로 대체한다.
그래서 같은 사용자가 같은 route 로 서로 다른 대상을 동시에 조작하면 서로를 막는다
(예: `shared-lists/[publicId]` PATCH 로 링크 A·B 동시 수정 → 뒤엣것 `concurrent_mutation`).

이걸 풀려면 `targetEntityId` 를 실제 id 로 올려야 하는데, 그 전제가 `targetEntityType`
정합이다. 즉 **이 트랙이 lock 입도 문제의 선행 조건**이다.

## 6. 후보 목록 (누적 22건, 배치별)

| 배치 | 도메인 | 건수 | 주 클래스 |
|---|---|---|---|
| 1~8 | work-queue · inventory · products · quotes · ai · ai-actions · analytics · protocol | 10 | ① ② |
| 9 | datasheet 3 + sds 3 | 6 | ③ (sds·datasheet) |
| 10 | purchases 3 + shared-lists 3 | 6 | ② (purchases) · ③ (shared-lists) |

정확한 route 목록은 각 route 의 `§enforcement-handle-close-sweep` 주석에 인라인으로
남아 있다 (`§audit-taxonomy-review 후보` 로 grep 가능).

## 7. Out of Scope

- `action` 값 정리는 같은 성격이나 별도 축이다. 이 트랙에서 함께 볼지 결정 필요.
- `entityCapabilities` DB 조회 구현은 §4 순서상 **이 트랙 완료 후**.
