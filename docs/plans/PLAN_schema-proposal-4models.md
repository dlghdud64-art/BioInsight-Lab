# 스키마 상신 — **4종** (설계만, 마이그레이션 보류)

> 초안 4종 → 실측으로 `InventoryAlertLog` 탈락(§3-1, 기존 `NotificationAction` 재사용)
> → 호영님 판단으로 `NotificationAction.actionType` 에 **`SYSTEM_ALERT` 신설**이 합류(§2-3).
> 결과적으로 다시 4종이다.

작성: 2026-08-12
상태: **설계 상신 (승인 대기)** — 코드·마이그레이션 없음.
적용 선결: §dev-prod-db-separation (개발 DB 분리 + 운영 백업)
발원: §phantom-model-call 전수 (유령 모델 6종) + §quote-item-vendor-column

---

## 0. 대상과 성격

| # | 모델/컬럼 | 성격 | 현재 상태 |
|---|---|---|---|
| 1 | `ComplianceLink` | **모델 신설** | 표면 차단 완료(API 삭제). 제품 상세 규제 링크 블록 미생성 |
| 2 | `InventoryAlertSetting` | **모델 신설** | 라우트 존재하나 호출자 0. 이메일 채널 전체 미구현 |
| ~~3~~ | ~~`InventoryAlertLog`~~ | **탈락** — 기존 `NotificationAction` 재사용(§3-1) | — |
| 3 | `NotificationAction.actionType` 에 `SYSTEM_ALERT` | **enum 값 추가**(additive) | 재고 알림이 `EMAIL_DRAFT`(승인 후 발송) 범주에 잘못 들어감 |
| 4 | `QuoteListItem.vendorName` | **컬럼 추가** | 워크벤치가 항목별 vendor 를 표시하나 저장 컬럼 없음 |

⚠️ `purchase`(ai-pipeline 2건)는 **이 상신에 포함하지 않는다**(호영님 2026-08-10).
무엇을 저장하려 했는지가 불명이라 지금 만들면 두 번 만든다 → §ai-pipeline-purchase-entity.

---

## 1. `ComplianceLink` — 규제/절차 링크

### 1-1. 필드와 관계

기존 코드가 쓰던 형태를 그대로 복원한다(`lib/compliance-links.ts` 의 인터페이스가
사실상 스펙이며, 삭제된 라우트의 `create` payload 와 일치한다).

```prisma
model ComplianceLink {
  id             String   @id @default(cuid())
  organizationId String?  // null = 공용(플랫폼 제공) 링크
  title          String
  url            String
  description    String?  @db.Text
  priority       Int      @default(0)   // 낮을수록 먼저
  enabled        Boolean  @default(true)
  linkType       String   @default("official")  // official | organization
  tags           String[] @default([])
  rules          Json?    // ComplianceLinkRules — hazardCodesAny / pictogramsAny / categoryIn / missingSds
  createdBy      String?  // 등록자(audit)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([enabled])
  @@index([linkType])
}
```

**`Product` 와 직접 FK 를 두지 않는다.** 현행 매칭은 `rules`(위험코드·픽토그램·카테고리·
SDS 부재) 기반 **규칙 매칭**이며 `filterComplianceLinksForProduct` 가 클라이언트에서
수행한다. 제품마다 링크를 수동 연결하는 모델이 아니다 — 규제 링크는 "이 위험군 전체에
적용" 이 자연스럽고, 제품 FK 를 두면 신규 제품마다 재등록이 필요해진다.

⚠️ 다만 `rules` 가 `Json` 이라 스키마가 값을 강제하지 못한다. 입력 검증은
`z.object` 로 애플리케이션에서 잠근다(§enum-input-validation 과 같은 축).

### 1-2. 소유권 축 — **SDS 와 동일 규칙** (호영님 요구)

> **일반 원칙 (호영님 2026-08-12 승격)** — 다른 모델에도 적용한다.
>
> **오등록 피해가 조직 경계를 넘는가**가 `role` 판정과 `소유권` 판정을 가른다.
> - 넘는다 → **role 판정**. 소유 관계가 없거나 있어도 피해가 소유자에 머물지 않는다.
> - 안 넘는다 → **소유권 판정**. 기존 ownerCondition 을 재사용하고 새 규칙을 만들지 않는다.
>
> 이 기준은 "누가 만들었나" 가 아니라 **"틀렸을 때 누가 다치나"** 를 묻는다.


`products/[id]/sds` 의 `docType === "sds"` 게이트를 그대로 따른다:

> global `ADMIN` · `SUPPLIER` · 조직 `ADMIN`/`VIEWER`(=safety_admin) 의 **합집합**

근거(SDS 게이트 주석에서 그대로 승계):
- 규제 링크는 **제품 카탈로그 레벨 안전자료**다. 소유 관계가 없어 role 로만 판정한다.
- **개인 등록을 허용하면 규제 정보 오매칭이 재현된다** — 잘못된 링크가 위험군 전체에
  붙으면 그 위험군의 모든 제품이 틀린 규제 안내를 받는다. SDS 보다 파급이 넓다.
- `organizationId = null`(공용 링크)은 **global ADMIN 만**. 조직 링크는 그 조직의
  ADMIN/VIEWER.

⚠️ **UI 동반 게이트 필수.** 서버만 막으면 버튼은 열려 있고 저장만 403 나는 front-only
실패가 된다 — §product-detail-sourcing-v21 에서 고친 바로 그 클래스다.

---

### 1-3. ⚠️ 복원 조건 — 모델만 만들고 화면을 잊지 않기 위해

`ComplianceLink` 모델이 서면 **아래를 함께 되살린다.** 이 연결이 문서에 없으면
모델만 생기고 화면은 영영 안 돌아온다(호영님 2026-08-12).

| 복원 대상 | 위치 | 폐기 시점 상태 |
|---|---|---|
| 설정 화면 | `src/app/settings/compliance-links/page.tsx` | 삭제 (CRUD 전부 실패했으므로 잃은 기능 0) |
| 제품 상세 규제 링크 블록 | `src/app/products/[id]/page.tsx` | 조회·렌더 미생성. `officialLinks`/`organizationLinks` 를 빈 배열로 고정 |
| API 2 라우트 | `api/compliance-links/route.ts`, `api/compliance-links/[id]/route.ts` | 삭제 |
| csrf 등재 | `csrf-route-registry.ts` | `/api/compliance-links/[id]` 제거됨 |
| **§11.270b** (aria-label) | `settings-compliance-aria-label-270b.test.ts` | **파일 은퇴**(삭제) — 화면 복원 시 함께 되살린다 |
| **§11.270** compliance 3 spot (터치 44px) | `settings-x-button-touch-target-270.test.ts` | 해당 단언만 은퇴. workspace·security 2파일 잠금은 **유지** |
| **§11.298** compliance dropdown | `single-dropdown-4-files-plain-298.test.ts` | 해당 단언만 은퇴. 나머지 3파일 잠금은 **유지** |

**은퇴한 것은 대상이지 정책이 아니다.** 터치 영역 44px · aria-label · Radix dropdown 제거는
다른 화면에서 계속 잠겨 있다. 화면이 돌아오면 그 화면에도 다시 적용한다.

⚠️ 복원 시 **UI 권한 게이트를 서버와 동시에** 넣어야 한다(§1-2 마지막 줄) —
서버만 막으면 front-only 실패가 된다.

## 2. `InventoryAlertSetting` (+ 발송 이력은 기존 모델 재사용)

### 2-1. 필드와 관계

삭제 대상이 아니라 **미구현**이므로, 라우트가 참조하던 필드에서 역산한다.

```prisma
model InventoryAlertSetting {
  id             String    @id @default(cuid())
  inventoryId    String
  userId         String?   // 수신자(개인)
  organizationId String?
  alertType      String    // low_stock | expiring | ...
  enabled        Boolean   @default(true)
  lastNotifiedAt DateTime? // 중복 발송 억제 기준
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  inventory    ProductInventory @relation(fields: [inventoryId], references: [id], onDelete: Cascade)
  user         User?            @relation(fields: [userId], references: [id], onDelete: SetNull)
  organization Organization?    @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([inventoryId, userId, alertType])   // 같은 재고·수신자·유형 중복 설정 방지
  @@index([organizationId])
  @@index([enabled])
}
```

### 2-2. 소유권 축 — **ComplianceLink 와 다르다** (호영님 요구: 다른 이유를 명시)

`InventoryAlertSetting` 은 **조직 단위 운영 설정**이며 안전 정보가 아니다.

| 축 | `ComplianceLink` | `InventoryAlertSetting` |
|---|---|---|
| 대상 | 제품 카탈로그(조직 경계 밖까지 파급) | 그 조직의 재고 1건 |
| 오등록 피해 | **다른 조직 사용자**가 틀린 규제 안내를 받는다 | 본인/자기 조직이 알림을 못 받거나 더 받는다 |
| 판정 | role (소유 관계 없음) | **소유권**(`ProductInventory` 의 owner/org) |

→ 재고 소유자 또는 그 조직 멤버면 자기 재고의 알림 설정을 만들 수 있다.
`ProductInventory` 의 기존 ownerCondition 을 그대로 재사용한다 — 새 규칙을 만들지 않는다.

### 3-1. `InventoryAlertLog` — 실측 결과 **만들지 않는다** (기존 모델 재사용)

호영님 요구("별도 모델이어야 하는 근거를 쓰고, 근거가 약하면 기존 것을 쓰라")에 따라
대체 후보를 **실측**했다.

| 후보 | 판정 |
|---|---|
| `ActivityLog` | ❌ `metadata Json` 구조라 중복 발송 방지 조회에 인덱스가 안 걸린다 |
| `AuditLog` | ❌ 감사는 **사람의 행위** 기록이다. 시스템 자동 발송을 섞으면 감사 조회가 오염된다 |
| `NotificationEvent` + `NotificationAction` | ✅ **맞는다 — 아래** |

#### 실측: `NotificationAction` 이 이미 발송 이력 모델이다

```prisma
model NotificationAction {
  actionType     String    // "IN_APP", "EMAIL_DRAFT", "QUEUE_ITEM", "ESCALATION"
  recipientId    String?
  recipientEmail String?
  status         String    // PENDING, GENERATED, REVIEWED, APPROVED, SENT, READ, FAILED
  payload        Json?
  entityType     String    // denormalized for query
  entityId       String    // denormalized for query
  ...
}
model NotificationEvent {
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

- **수신자·이메일·상태·전문**이 전부 있다. `status: SENT/FAILED` 전이도 이미 구현돼 있다
  (`lib/notifications/action-executor.ts` — 라이브 쓰기 확인).
- **중복 발송 방지 조회**가 `entityType='INVENTORY' + entityId=inventoryId + createdAt`
  인덱스로 성립한다. `InventoryAlertLog` 를 만드는 유일한 근거였던 조회 패턴이 이미 있다.
- 재고 이벤트 타입도 이미 정의돼 있다: `INVENTORY_LOW` · `INVENTORY_EXPIRING`
  (`lib/notifications/event-types.ts`).
- `detectInventoryIssues` 가 이미 이 경로로 in-app/푸시를 보내고 있다 —
  **이메일 채널만 이 인프라에 얹으면 된다.**

#### 결론

**`InventoryAlertLog` 를 만들지 않는다.** 근거였던 조회 패턴이 기존 모델로 충족된다.
모델 하나는 영구 유지비다(호영님).

⚠️ 다만 `NotificationAction` 의 `EMAIL_DRAFT` 는 **자동 발송을 금지**하는 설계다
(주석: "이메일 본문 생성 후 GENERATED 전이 — 자동 발송 금지"). 재고 부족 알림을
자동 발송하려면 그 정책과 충돌한다 → **승인 항목 3** 으로 올린다.
현행 AI P1 불변 규칙("승인 전 외부 전송 금지")과 같은 축이라 임의로 넘지 않는다.

→ 발송 이력 모델은 만들지 않는다. 대신 **actionType 신설**이 필요하다(§2-3).

### 2-3. `SYSTEM_ALERT` actionType 신설 — **분류 오류의 교정** (호영님 2026-08-12)

앞서 "EMAIL_DRAFT 자동 발송 금지 정책과 충돌" 으로 상신했으나, **정책 충돌이 아니라
분류 오류**라는 판단을 받았다. 그 판단을 그대로 기록한다.

AI P1 불변("승인 전 외부 전송 금지")이 막는 위험은 둘이다:
① AI 환각이 나가는 것 ② 외부 상대에게 회수 불가능하게 도달하는 것.
**재고 부족 알림은 어느 쪽도 아니다.**

| | `EMAIL_DRAFT` | 재고 부족 알림 |
|---|---|---|
| 콘텐츠 | AI 생성 | **결정론적** — 임계값 비교 결과를 템플릿에 렌더 |
| 수신자 | 벤더(외부) | **자기 조직 구성원**(내부) |
| 의미 | AI 가 초안을 쓰고 사람이 승인해 보낸다 | **시스템이 사실을 통보한다** |

같은 모델에 들어갈 뿐 **다른 범주**다. `EMAIL_DRAFT` 의 자동 발송 금지를 푸는 것이
아니라 **애초에 다른 actionType 을 쓴다.**

```
NotificationAction.actionType: "IN_APP" | "EMAIL_DRAFT" | "QUEUE_ITEM" | "ESCALATION"
                             + "SYSTEM_ALERT"   ← 신설 (additive)
```

`actionType` 은 `String` 이므로 스키마 마이그레이션이 필요 없을 수 있다 —
**착수 시 실측**: 값이 DB enum 인지 String 인지. String 이면 코드 상수만 늘리면 된다.
(현행 스키마: `actionType String` — 마이그레이션 불요로 보이나 확인 후 확정)

#### ⚠️ 자동 발송 허용 조건 3개 — **이 판단의 본체** (전부 만족해야 한다)

> 1. **콘텐츠가 결정론적일 것** (AI 생성이 아닐 것)
> 2. **수신자가 조직 내부일 것**
> 3. **사용자가 사전에 옵트인했을 것**
>
> **셋 중 하나라도 빠지면 `EMAIL_DRAFT` 경로로 돌아간다** — 승인 후 발송.

조건 3이 `InventoryAlertSetting` 의 존재 이유를 강화한다 — **설정 모델이 곧 사전 승인**이다.
따라서 **설정이 없으면 발송하지 않는 구조**로 둔다(설정 부재 = 옵트인 없음 = 발송 금지).
"기본값으로 전체 발송" 같은 폴백을 두지 않는다.


---

## 3. `QuoteListItem.vendorName` — 컬럼 추가

```prisma
model QuoteListItem {
  // ... 기존 필드
  vendorName String?   // 초안 단계 항목별 공급사 이름(자유 입력/선택)
}
```

- **`selectedVendorRequestId` 와 다르다.** 그쪽은 §quote-item-vendor-selection 의
  **확정** truth(FK to `QuoteVendorRequest`)이고, 이건 **초안 단계 표시값**이다.
  워크벤치는 요청 발송 **전에** 항목별 공급사를 다룬다.
- 소유권 축 없음 — 부모 `Quote` 의 스코프를 그대로 따른다.
- 현재는 `raw` 스냅샷 blob 안에 `vendorName` 으로 보존만 하고 표시는 미배선.
  컬럼이 생기면 그 경로를 정식화하고 `raw` 폴백은 제거한다.

---

## 5. 마이그레이션 순서 · 독립성 · 롤백

### 독립성 — **4종 전부 서로 독립이다**

| # | 의존 대상 | 다른 3종과의 의존 |
|---|---|---|
| 1 `ComplianceLink` | `Organization` (기존) | 없음 |
| 2 `InventoryAlertSetting` | `ProductInventory`·`User`·`Organization` (기존) | 없음 |
| 3 `SYSTEM_ALERT` actionType | `NotificationAction` (기존) | **2 와 논리적 연결**(설정 없으면 발송 안 함) — 스키마 의존은 없다 |
| 4 `QuoteListItem.vendorName` | `QuoteListItem` (기존) | 없음 |

→ **하나씩 배포할 수 있다.** 그게 안전하다(호영님).

### 권장 순서

1. **`QuoteListItem.vendorName`** — 가장 얇다(nullable 컬럼 1개). 롤백 = 컬럼 drop.
   워크벤치 왕복 검증과 직결되므로 먼저.
2. **`ComplianceLink`** — 제품 핵심 가치 축(안전·규제). 표면 복구까지 한 세트.
3. **`InventoryAlertSetting` + `SYSTEM_ALERT`** — 한 세트. 발송 이력은 기존
   `NotificationAction` 을 쓴다. 운영 편의 축이라 마지막.

### 롤백 경로

| # | 롤백 | 데이터 손실 |
|---|---|---|
| 1·2 | `DROP TABLE` (신설 테이블) | 그 테이블에 쌓인 데이터만. 기존 테이블 무영향 |
| 3 | actionType 값 사용 중단 | 스키마 변경이 없으면 롤백도 없다(코드 상수 제거). 기존 행은 그 값을 가진 채 남는다 |
| 4 | `DROP COLUMN vendorName` | 그 컬럼 값만. **additive nullable 이라 기존 행 무영향** |

전부 **additive** 다 — 기존 컬럼 변경·삭제가 없으므로 롤백이 기존 데이터를 건드리지 않는다.

### 적용 절차 (§dev-prod-db-separation 준수)

1. 개발 DB 에서 `prisma migrate dev` 로 마이그레이션 생성
2. 개발 DB 에 운영 마이그레이션 54개 재생 후 스키마 동일성 확인
3. 운영 백업 1회 (호영님)
4. 운영 적용은 **`npm run prisma:migrate`(= migrate deploy) 로만**. DIRECT_URL(5432) 필수
5. 적용 후 `/api/health` 확인

---

## 6. 승인 요청 항목

1. `ComplianceLink` — `Product` FK 없이 `rules` 규칙 매칭 유지가 맞는가
2. `ComplianceLink` 소유권 — SDS 합집합 + **공용 링크(`organizationId=null`)는 global ADMIN 만** 이 맞는가
3. **재고 부족 이메일 자동 발송 vs 초안 생성** — `NotificationAction` 의 `EMAIL_DRAFT` 는
   **자동 발송 금지** 설계다(승인 후 발송). 재고 부족 알림을 자동 발송하려면 그 정책과
   충돌한다. AI P1 불변 규칙("승인 전 외부 전송 금지")과 같은 축이라 판단이 필요하다.
4. 배포 순서 — vendorName → ComplianceLink → InventoryAlertSetting
