# 스키마 상신 — **3종** (설계만, 마이그레이션 보류)

> 초안은 4종이었으나 실측으로 `InventoryAlertLog` 가 탈락했다(§3-1) — 기존
> `NotificationAction` 이 같은 역할을 이미 한다.

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
| 3 | `QuoteListItem.vendorName` | **컬럼 추가** | 워크벤치가 항목별 vendor 를 표시하나 저장 컬럼 없음 |

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

→ **상신은 4종이 아니라 3종이 된다**: `ComplianceLink` · `InventoryAlertSetting` ·
`QuoteListItem.vendorName`.

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

### 독립성 — **3종 전부 서로 독립이다**

| # | 의존 대상 | 다른 3종과의 의존 |
|---|---|---|
| 1 `ComplianceLink` | `Organization` (기존) | 없음 |
| 2 `InventoryAlertSetting` | `ProductInventory`·`User`·`Organization` (기존) | 없음 |
| 3 `QuoteListItem.vendorName` | `QuoteListItem` (기존) | 없음 |

→ **하나씩 배포할 수 있다.** 그게 안전하다(호영님).

### 권장 순서

1. **`QuoteListItem.vendorName`** — 가장 얇다(nullable 컬럼 1개). 롤백 = 컬럼 drop.
   워크벤치 왕복 검증과 직결되므로 먼저.
2. **`ComplianceLink`** — 제품 핵심 가치 축(안전·규제). 표면 복구까지 한 세트.
3. **`InventoryAlertSetting`** — 1개만. 발송 이력은 기존 `NotificationAction` 을 쓴다.
   운영 편의 축이라 마지막.

### 롤백 경로

| # | 롤백 | 데이터 손실 |
|---|---|---|
| 1·2 | `DROP TABLE` (신설 테이블) | 그 테이블에 쌓인 데이터만. 기존 테이블 무영향 |
| 3 | `DROP COLUMN vendorName` | 그 컬럼 값만. **additive nullable 이라 기존 행 무영향** |

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
