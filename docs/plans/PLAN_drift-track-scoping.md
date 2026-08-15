# §drift-track-scoping — 드리프트 17경로 규모 실측 + 다음 트랙 우선순위

- **Status:** 규모 실측 (2026-08-15) · **D1 §2 착수** (사양서 §0 차단 해제)
  - 🔓 **§0 삭제** — 차단 근거("프로브 반복이 노출면을 넓힌다")가 실측으로 깨졌다.
    프로브는 localhost HTTP + 세션 쿠키만 전송하고 DB 자격증명은 서버가 로컬에서 읽을 뿐이다.
    `.env` 3파일 전부 gitignore · git 커밋 이력 0 · 개발 DB 실사용자 데이터 0
    → §measurement-layer-blindness **§1.75(차단 조건도 실측 대상)** 로 승격
  - 개발 DB 비밀번호 회전: **비차단 위생 항목으로 강등**. 개발/운영 자격증명·프로젝트 ref
    모두 별개임을 호영님이 확인 → D1 과 의존 없음, D1 이후 처리
  - §2(치환) → §3(프로브) **연속 배치**로 진행
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

## 7. D1 재정의 (2026-08-15, 호영님 지시 + 앵커 교차 확인 결과)

사양서 §1 의 독립 안전망이 카드 목록의 **모집단 정의 오류**를 잡았다(§drift §1.10).
그 결과 D1 범위를 아래로 축소·재정의한다.

```
포함:  purchaseDate → purchasedAt   (라우트 5 + lib 2)
       quoteListId  → quoteId       ← 앵커 사전 확인 통과(아래)
보류:  listItems                    ← 응답 코드 확인 완료, 재판정 아래
제외:  raw SQL 3컬럼                ← §raw-sql-audit 대기(해동 안 함)
제외:  safety/spend/unmapped 계열   ← D3 단일 귀속
```

### `quoteListId` 앵커 사전 확인 — **통과**

전역 13히트 중 **Prisma 참조는 카드 경로 1곳뿐**이다(`quote-lists/[id]/items` 83·88·110).
나머지는 전부 비-Prisma:
`quote-lists/route.ts:106`(logger 필드) · `lib/export/quote-export.ts:301`(요약 객체 키,
그 파일에 Prisma 호출 0) · `components/quote-list/export-button.tsx`(prop) ·
`lib/store/quote-draft-store.ts`(스토어 상태).

→ **치환 대상은 3라인, 카드 밖 히트 없음. D1 유지.**

### `listItems` 응답 코드 확인 — **이미 죽어 있다**

```
GET /api/admin/quotes/{id}   → 500  "Failed to fetch quote"   ← 프론트 화면이 쓰는 API
GET /api/admin/quotes        → 200                            ← 목록(별개, listItems 미사용)
```

**판정: "화면이 깨진다" 가 아니라 "이미 깨져 있다".**
`admin/quotes/[id]` 상세 화면은 현재 데이터를 못 받는다. 따라서 `listItems → items` 치환은
**계약 변경이 아니라 복구**이고, 프론트의 `quote.listItems` 참조를 함께 고치는 것은
D1 범위 안이다(DDL 불요 → D3 이관 근거 없음).

⚠️ 단 프론트 수정이 붙으므로 **완료 조건에 렌더 확인**이 들어간다:

> **드리프트 해소 = 500 소멸 + 화면 실렌더**

🛑 **여기에 §2.5 를 인용하지 않는다** (2026-08-15 교정).
§2.5 는 **org 축 판정 규칙**이다 — 교차 403 + row 0 **AND** 동일조직 200 + row 실제 변경.
거기서 "대조군"은 **다른 조직 컨텍스트**를 뜻한다.
`admin/quotes/[id]` 화면이 렌더되는지는 **드리프트 해소 확인**이지 격리 판정이 아니다.

규칙명이 유사 사례에 늘어붙으면 다음 세션이 **"§2.5 충족"을 org 축 판정으로 읽는다** —
§placeholder-success 가 경고한 "충족된 것처럼 읽히는 문구"와 같은 형태다.
§2.5 는 프로브 단계에서 `quotes/[id]/status` PATCH 에만 적용한다.

### §2 재개 시 추가 조건 — 프론트 참조도 앵커 대상

`quote.listItems` 참조가 "1파일"이라는 것은 **도출 결과이지 확인 결과가 아니다.**
이 배치에서 라우트 기준 도출이 lib 을 통째로 놓친 직후다.

> **프론트 참조도 전역 count 로 교차 확인한다. 카드 밖 히트가 나오면 §4 정지.**

## 8. D1b 프로브 결과 (2026-08-15) — 선언 `DECLARATION_D1b.json` 🔒

정온(quiesce) 프로토콜 첫 적용. **하한 = 관측 최대 착지 지연 × 2 = 1890ms** (실측, 임의값 아님).

| 프로브 | 응답 | 정온(전/후) | 델타 | 판정 |
|---|---|---|---|---|
| P5 `quotes/{A}/status` PATCH | 200 | 소급 1회 | `ActivityLog:3→5` | 완전 손실만 배제 — **해소 아님, D4 잔류** |
| P1 `quote-lists/{B}/items` 교차 | 404 | 1회/1회 | 0 | guestKey 축 차단 — **org 분모 불가산** |
| P2 `quote-lists/{A}/items` 대조 | **500** | 1회/1회 | 0 | **미해소** — 드리프트 2건 잔존 |
| P3 `recommendations/personalized` | 200 | 1회/1회 | 0 | ✅ 해소 (lib 2파일) |
| P4 `recommendations/purchase-patterns` | 200 | 1회/1회 | 0 | ✅ 해소 |

선언 밖 변경 0 · 정온 미성립 0 · ④ 정지 0. 복원 완료(Quote 원값 · 역할 ADMIN→RESEARCHER).

### 🔴 P2 — 같은 경로에 드리프트 **3개**

`quote-lists/[id]/items` PUT 이 D1 치환 후에도 500 이다. 원인은 **다른 드리프트**였다:

| # | 참조 | 실제 | 상태 |
|---|---|---|---|
| 1 | `quoteListId` | `quoteId` ✅ | D1 치환 완료 |
| 2 | `vendor` (line 91) | `vendorName` ✅ | **잔존 — 런타임 확진** |
| 3 | `snapshot` (line 98) | `raw` ✅ | **잔존 — 정적 확인**(Prisma 가 #2 에서 먼저 멈춰 런타임 미도달) |

셋 다 **이름만 어긋났고 대상 필드는 실재** → 전부 코드 전용. DDL 불요, D3 이관 근거 없음.

🛑 **카드 스키마 결함의 실증이다.** 카드가 `경로 → 드리프트 1` 이라 D1 은 1건만 고치고
"경로 해소" 를 기대했다. **(경로 × 드리프트) 쌍 기준** 재도출이 왜 필요한지가 여기서 확정됐다.
필드명 단위 정규식 도출은 이 경로에서 **3분의 1만** 잡았다.

### ⚠️ 부수 발견 (유출 아님, 목록만) — deleteMany 선행 데이터 손실 형태

```
deleteMany({ where:{ quoteId } })   ← 먼저 실행, 성공
createMany({ data:[...] })          ← 드리프트로 실패 → 500
```
트랜잭션이 아니다. 항목이 있는 리스트에 PUT 하면 **기존 항목이 지워진 채 500** 이 난다.
이번 픽스처는 기존 0건이라 실손실 0. 즉시 수정하지 않는다(목록만).

### D1c 잔여 (신설)

`quote-lists/[id]/items` PUT — `vendor→vendorName` · `snapshot→raw` 치환 + 재프로브.
deleteMany/createMany 트랜잭션화는 **별건**(드리프트 아님).

## 9. 🔁 모집단 대체 (2026-08-15) — §drift-pair-rederivation 으로 이관

이 카드의 `경로 → 드리프트 1` 목록(17경로)은 **모집단으로서 폐기**한다.
전수 재도출 결과가 이를 대체한다:

```
구 카드   17경로 (드리프트 1개씩 가정)
재도출    55쌍 / 21경로 (라우트 15 + lib 6) — 21경로 중 13경로가 드리프트 2개 이상
```

D1/D1b 의 **실측 결과**(§7·§8)는 유효하므로 남긴다. 바뀐 것은 **모집단**이다.
D1c 이후 배치 편성은 §drift-pair-rederivation §4 를 따른다.

## 10. D3 완료 조건 (2026-08-15 추가)

1. (나) 드리프트 해소 — 필드/enum **추가** 방향 (호영님 확정: 참조 제거 아님)
2. 🛑 **D1c 8경로 치환분 재프로브** — 경로가 살아나는 시점에 함께 검증한다.
   빠지면 검증 없는 치환분이 GREEN 뒤로 조용히 통과한다 → **D3 미완**
3. `Product.organizationId` 는 D3 안에서도 **별도 잠금** — 카탈로그를 조직 소유로
   바꾸는 제품 결정이며 §global-catalog-write-authz 에서 만난다

### 죽은 화면 5개 — 호영님 회신 (2026-08-15): **전부 존치**

| 화면 | 판단 | 근거 |
|---|---|---|
| 보안설정 · SSO | 존치 | ① 이 잡았고 403 까지 살아 있다. 기능은 있고 드리프트만 얹혔다 |
| work-queue 콘솔 3 | 존치 | 500 의 원인은 enum 값 부재 — 참조 제거가 아니라 **enum 추가**로 닫힌다 |

📌 **정정** — work-queue enum 드리프트의 위치는 라우트 3개가 아니라
`lib/work-queue/work-queue-service.ts` **1파일**이다(3라우트는 소비자).
ActivityType 에 ITEM_* 8 + CADENCE_* 4 = **12값 추가**로 닫힌다.

## 6. 관계

- §drift-masks-isolation — 이 트랙의 규칙. 형태 3종(필드·raw SQL·enum) + 200 위장
- §tenant-isolation-placeholder §9.23 — 조건부 이관분의 해소 조건이 여기 걸린다
- §migration-push-not-apply — D3 의 배포 절차
