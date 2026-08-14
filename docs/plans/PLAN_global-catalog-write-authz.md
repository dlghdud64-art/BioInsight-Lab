# §global-catalog-write-authz — 전역 카탈로그를 누가 고칠 수 있는가

- **Status:** 등재 (2026-08-14) · **미측정** · 축: **데이터 무결성** (테넌트 축 아님)
- **발견 경위:** §tenant-isolation 4-3 org 축 대상 판정에서 `Product` 가
  **스코프 컬럼을 하나도 갖지 않는** 전역 모델로 확인됨

---

## 0. 성격

`Product` 는 `organizationId` 도 `scopeKey` 도 `userId` 도 없다 — **전 조직 공용 카탈로그**다.
따라서 여기 쓰는 라우트는 **테넌트 격리 문제가 아니다.** 대신 다른 질문이 남는다:

> **한 조직 사용자가 고친 카탈로그 값이 다른 모든 조직에 그대로 보인다.**
> 그 쓰기에 어떤 권한이 필요한가?

테넌트 축이 아니라 **데이터 무결성 축**이다. 잘못 고쳐도 유출은 아니지만
**전 조직이 함께 틀린 값을 본다.**

## 1. 확인된 경로

| 라우트 | 쓰기 | 관측된 인가 |
|---|---|---|
| `PATCH /api/products/[id]/safety` | `db.product.update` (msdsUrl·storageCondition·safetyNote) | RESEARCHER → **역할게이트 403**, ADMIN 층 미측정 |

⚠️ 안전정보(MSDS URL·보관조건)라 **틀리면 안전 결과가 달라지는 값**이다.
`products/[id]/inspection` · `products/[id]/sds` 도 같은 계열로 함께 봐야 한다
(후자 2건은 §unvalidated-create 와도 겹친다 — 무검증 생성이 확인됐다).

## 2. 아직 모르는 것

- ADMIN(전역 축) 이면 통과하는가, 아니면 별도 검사가 있는가 — **미측정**
- 조직 ADMIN 과 플랫폼 ADMIN 이 같은 `User.role` 축을 쓰므로(§authorization-dual-axis)
  "조직 관리자가 전역 카탈로그를 고칠 수 있다"가 될 소지가 있다

## 3. 측정 설계 (착수 전)

수정형이므로 §tenant-isolation 4-3 수정형 게이트를 그대로 적용:
대상 테이블 확정 → **전 필드 스냅샷**(전역 count 는 UPDATE 를 못 잡는다) → 프로브 → diff → 복원.

## 4. 관계

- §tenant-isolation-placeholder §9.12 — 여기서 갈라져 나왔다
- §authorization-dual-axis — 전역 축(`User.role`)과 조직 축이 겹치는 문제의 실물 후보
- §unvalidated-create — `products/[id]/inspection` 이 양쪽에 걸린다
