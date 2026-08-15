# §drift-track-scoping — 드리프트 17경로 규모 실측 + 다음 트랙 우선순위

- **Status:** 규모 실측 (2026-08-15) · **착수 전** · A트랙 종료 직후 작성
- **작성 이유:** 분수 보고 규칙 — **규모를 실측하기 전에 순위를 확정하지 않는다**

---

## 0. 결론 먼저

**드리프트 17경로는 단일 트랙이 아니다.** 수정 형태가 셋으로 갈리고,
그중 하나는 **DB 마이그레이션**이라 배포 절차(ADR-002 4스텝)가 붙는다.

```
코드 전용        7경로   ← 필드명 치환 · 참조 제거. 배포 절차 없음
마이그레이션 필요  7경로   ← 스키마에 필드·enum 값 자체가 없다. DDL + rollout 4스텝
원인 미확인       2경로   ← safety/sds/bulk 계열, 500 만 확인
설계 판단 필요     1경로   ← cadence(성공 위장) — 아래 §3
```

## 1. 코드 전용 7경로 (배포 절차 없음)

| 참조 | 실제 | 경로 |
|---|---|---|
| `Quote.listItems` | `items` ✅ 존재 | `quotes/[id]/status` PATCH · `admin/quotes/[id]/items` PATCH · `admin/quotes/[id]` GET |
| `PurchaseRecord.purchaseDate` | `purchasedAt` ✅ 존재 | `safety/spend/export` |
| `QuoteListItem.quoteListId` | `quoteId` ✅ 존재 | `quote-lists/[id]/items` PUT |
| raw SQL `totalAmount` | `amount` ✅ 존재 | `safety/spend/summary` · `safety-spend` |

전부 **이름만 어긋났고 대상 필드는 실재**한다. 치환 + 소비 코드 대조로 끝난다.

⚠️ 단 `quotes/[id]/status` PATCH 는 **§tenant 조건부 이관분** — 수정 시
**대조군 착지 확인**(동일조직 PATCH 200 + row 변경)이 해소 조건이다.

## 2. 마이그레이션 필요 7경로 (DDL + rollout 4스텝)

| 부재 | 성격 | 경로 |
|---|---|---|
| `PurchaseRecord.productId` | 필드 자체 없음 | `safety/spend/unmapped` · `safety-spend/unmapped` |
| `Organization.allowedEmailDomains` | 필드 자체 없음 | `organizations/[id]/security` GET·PATCH |
| `Organization.ssoEnabled` 외 SSO 4필드 | 필드 자체 없음 | `organizations/[id]/sso` |
| `ActivityType` enum — `ITEM_*` · `CADENCE_*` | **enum 값 없음** | `work-queue/{daily-review,cadence-governance,bottleneck-remediation}` GET |
| `QuoteListItem.productName` | 필드 자체 없음 | `quotes/[id]/detail` |

🛑 **이 7경로가 규모의 실체다.** 각각 "필드를 추가할지, 참조를 없앨지"가 **설계 판단**이고,
추가 쪽을 고르면 **prod DDL → 배포 → operator `migrate deploy` → health** 4스텝이 붙는다
(§migration-push-not-apply — 이 repo 는 자동 적용이 ADR-002 로 차단).

기능 관점의 무게:
- `organizations/[id]/security` — **보안 설정 화면이 운영에서 안 열린다**(호출부 4)
- `organizations/[id]/sso` — SSO 설정 화면 동일
- work-queue 3경로 — **콘솔 3화면이 죽어 있다**

## 3. 설계 판단 필요 1경로 — `cadence-governance` POST

드리프트 + **성공 위장**이 겹친다(§drift §1.9). 200 `success:true` 인데 감사 기록 0이고
감사 봉투에는 `'logged'` 라고 적힌다.

> **호영님 보류 결정(2026-08-15): 감사 무결성 축으로 별도 카드를 세울지는
> 드리프트 트랙 착수 시 판단한다. 지금 결정하지 않는다.**

판단 재료 — 규제 맥락에서 "감사 기록이 없는데 있다고 적힌 것"은 격리보다 무거울 수 있다.
드리프트만 고치면 기록은 남지만, **삼키는 `catch` 는 그대로**라 다음 실패도 같은 방식으로 숨는다.

## 4. 원인 미확인 2경로

`safety/sds/bulk` · `safety/sds/bulk/commit` — 500 만 확인, 서버 로그 미수집.
**착수 시 첫 작업은 원인 판정**이다(드리프트인지 다른 것인지도 아직 모른다 — §drift 편입 규칙).

## 5. 다음 트랙 우선순위 — 실측 반영 판단

호영님 기울기(드리프트 → §2 딥링크 → B트랙)에 **동의**한다. 반박 없음. 근거를 실측으로 보강한다:

| 트랙 | 규모 | 푸는 것 | 판단 |
|---|---|---|---|
| **드리프트** | 코드 7 + 마이그레이션 7 + 미확인 2 + 판단 1 | 격리 조건부 이관분 · 죽은 화면 5개(보안설정·SSO·콘솔 3) · 감사 무결성 | **1순위 유지.** 단 **단일 배치 아님** — 코드 전용 7경로가 선행 배치, 마이그레이션 7경로는 설계 판단 후 별도 |
| **§2 딥링크** | 미실측 | 견적 발송 결손 | **2순위 유지** |
| **B트랙** | 선결 3(§audit-taxonomy-review · `organizationIds[]` · §org-attribution-missing 백필) | 게이트 신설 | **3순위 유지.** 지금 열린 구멍 없음 |

### 드리프트 트랙 착수 시 배치 제안

1. **배치 D1 (코드 전용 7경로)** — 배포 절차 0, 즉시 가능. `quotes/[id]/status` 는
   대조군 착지 확인을 해소 조건으로 동반
2. **배치 D2 (원인 미확인 2경로 판정)** — 서버 로그 수집 후 편입/제외 판정
3. **배치 D3 (마이그레이션 7경로)** — "필드 추가 vs 참조 제거" 설계 판단 **먼저 회신**.
   추가 쪽이면 prod DDL 4스텝
4. **배치 D4 (cadence 성공 위장)** — 감사 무결성 축 카드화 여부 판단 포함

## 6. 관계

- §drift-masks-isolation — 이 트랙의 규칙. 형태 3종(필드·raw SQL·enum) + 200 위장
- §tenant-isolation-placeholder §9.23 — 조건부 이관분의 해소 조건이 여기 걸린다
- §migration-push-not-apply — D3 의 배포 절차
