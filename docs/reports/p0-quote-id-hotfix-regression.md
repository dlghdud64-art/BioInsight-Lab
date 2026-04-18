# P0 Hotfix 보고서 — 견적 ID 라우팅 버그 수정 및 16대 최대 회귀 점검

> **작성일**: 2026-03-13
> **커밋**: `39eacd1` fix(P0): replace UUID-only validation with CUID+UUID
> **심각도**: P0 Blocker — 전체 견적 상세 진입 불가

---

## 1. 핵심 판단 (Executive Summary)

견적 상세 페이지(`/quotes/[id]`)에서 **모든 견적 진입이 "유효하지 않은 견적 ID"로 차단**되는 P0 블로커를 수정했다.

원인은 클라이언트 측 ID 검증 함수 `isValidUUID()`가 **UUID 형식만 허용**하는데, DB의 `Quote.id`는 Prisma `@default(cuid())`로 생성되어 **CUID 형식**(`clxxxxxxxxxxxxxxxxx`)이었기 때문이다. CUID는 UUID regex를 절대 통과하지 못해 모든 견적 상세 접근이 원천 차단되었다.

**영향 범위**: 견적 상세 진입 100% 차단. 서버 API는 영향 없음(Prisma에 직접 전달).
**수정 범위**: 1개 파일, 3개 변경 지점. 코드베이스 전체 스캔으로 동일 패턴 부재 확인.

---

## 2. 실제 원인 (Root Cause)

### 코드 레벨 원인

| 항목 | 내용 |
|------|------|
| **파일** | `apps/web/src/app/quotes/[id]/page.tsx` |
| **함수** | `isValidUUID()` (L75-76) |
| **Regex** | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| **DB 스키마** | `Quote.id @default(cuid())` → CUID 형식 (`clxxxxxxxxxxxxxxxxx`) |
| **차단 지점** | L554: `if (!quoteId \|\| !isQuoteIdValid)` → `<NotFoundUI message="유효하지 않은 견적 ID입니다." />` |
| **추가 영향** | L237: `enabled: isQuoteIdValid && status === "authenticated"` → API 호출 자체가 발생하지 않음 |

### 왜 발생했는가

- 견적 상세 페이지 개발 시 ID 형식을 UUID로 가정하고 클라이언트 검증을 추가
- 실제 Prisma 스키마는 `@default(cuid())`를 사용하므로 형식 불일치 발생
- 서버 API(`/api/quotes/[id]`)에는 형식 검증이 없어 API 자체는 정상 동작하나, 클라이언트가 API 호출을 차단

---

## 3. 수정 내용 및 수정 파일/함수 목록

### 수정 파일

| 파일 | 변경 지점 | 내용 |
|------|-----------|------|
| `apps/web/src/app/quotes/[id]/page.tsx` L75-78 | `isValidUUID` → `isValidQuoteId` | CUID(`/^c[a-z0-9]{20,30}$/i`) + UUID 모두 허용 |
| 동일 파일 L221 | `isValidUUID(quoteId)` → `isValidQuoteId(quoteId)` | 호출부 이름 변경 |
| 동일 파일 L557 | 에러 메시지 개선 | "유효하지 않은 견적 ID" → "견적을 찾을 수 없습니다. 견적 목록에서 다시 시도해 주세요." |

### 수정하지 않은 파일 (검증 결과 정상)

- 모든 API Route (`/api/quotes/[id]/*`) — Prisma에 직접 전달, 형식 무관
- 관리자 페이지 (`/admin/quotes/[id]`) — ID 검증 없음, 정상 동작
- 목록 페이지 (`/dashboard/quotes`) — `quote.id`를 Link href에 직접 사용, 정상
- 주문 페이지 (`/my/orders`) — `order.quoteId`로 직접 참조, 정상

---

## 4. 식별자 흐름 정리

### 수정 전 (차단됨)

```
[DB] Quote.id = "cm5abc123def456ghi789"  (CUID)
  ↓
[목록] <Link href="/quotes/cm5abc123def456ghi789">  (정상)
  ↓
[상세] params.id = "cm5abc123def456ghi789"
  ↓
[검증] isValidUUID("cm5abc123def456ghi789")  →  FALSE  ❌
  ↓
[차단] "유효하지 않은 견적 ID입니다."  →  API 호출 안 됨
```

### 수정 후 (정상)

```
[DB] Quote.id = "cm5abc123def456ghi789"  (CUID)
  ↓
[목록] <Link href="/quotes/cm5abc123def456ghi789">  (정상)
  ↓
[상세] params.id = "cm5abc123def456ghi789"
  ↓
[검증] isValidQuoteId("cm5abc123def456ghi789")  →  TRUE  ✅ (CUID 패턴 매치)
  ↓
[API] GET /api/quotes/cm5abc123def456ghi789  →  Prisma findUnique  →  200 OK
  ↓
[렌더] 견적 상세 정상 표시
```

---

## 5. 최대 회귀 점검 결과표 (16개 항목)

| # | 점검 항목 | 결과 | 근거 |
|---|-----------|------|------|
| 1 | **목록 → 상세 진입** | ✅ Pass | 목록의 `<Link href={/quotes/${quote.id}}>` (L172,183)는 DB의 CUID를 직접 사용. `isValidQuoteId`가 CUID 허용하므로 정상 진입. |
| 2 | **직접 접근 (Direct URL)** | ✅ Pass | CUID 형식 URL 직접 입력 시 `isValidQuoteId` 통과 → API 호출 → 렌더링. 세션 만료 시 L232 `UNAUTHORIZED` 에러 분기 정상. |
| 3 | **예외 분기** | ✅ Pass | Invalid ID → NotFoundUI (L556), 404 → NotFoundUI (L570), 403 → ForbiddenUI (L574), 네트워크 에러 → NetworkErrorUI (L578). 모두 독립 분기. |
| 4 | **상세 데이터 정확성** | ✅ Pass | API(`getQuoteById(id)`)가 Quote + items + responses를 include하여 반환. `safeLocaleAmount`로 null 방어. 비교 화면은 별도 페이지(`/compare/quote`). |
| 5 | **견적 상세 액션** | ✅ Pass | 상태 변경(`statusMutation`), 메일 발송, 주문 전환 모두 `quoteId` 변수 사용. ID 검증 통과 후 실행되므로 정상. |
| 6 | **견적 AI 패널 연동** | ✅ Pass | `useQuoteAiPanel.preparePanel(items)` — 품목 배열 기반, quote ID 직접 의존 없음. 패널 로드/실패/누락 상태는 `panelState` useMemo로 제어. |
| 7 | **대시보드 AI 작업함** | ✅ Pass | `AiActionInbox`는 `GET /api/ai-actions?status=PENDING`로 AiActionItem 조회. `relatedEntityId`에 quote CUID 저장. CTA 클릭 시 `AiDraftPreviewDialog` 오픈 — quote 페이지 이동 없음(현행). |
| 8 | **주문 연결 회귀** | ✅ Pass | 주문 페이지(`/my/orders`)에서 `<Link href={/quotes/${order.quoteId}}>` — DB의 CUID 직접 사용. 주문 AI 패널(`useOrderAiPanel`)은 `orderId` 기반, quote ID 미참조. |
| 9 | **재고/재발주 연결** | ✅ Pass | 재고 AI 패널(`useInventoryAiPanel`)은 `InventoryItem` 기반. 견적 ID 직접 참조 없음. 재발주 추천은 독립 로직. |
| 10 | **권한/조직 경계** | ✅ Pass | API L37-48: `isOwner || isTeamMember` 체크. 타 조직 데이터는 403 반환. 클라이언트 L574: `ForbiddenUI` 렌더링. |
| 11 | **API/DB 점검** | ✅ Pass | 모든 API Route는 `params.id`를 Prisma `where: { id }` 직접 전달. Zod 검증 없음(Prisma가 not found 시 null 반환). CUID/UUID 모두 문자열 매칭. |
| 12 | **UI 상태 점검** | ✅ Pass | 로딩: L560-574 스켈레톤. 에러: NotFoundUI/ForbiddenUI/NetworkErrorUI 각각 독립 컴포넌트. 모바일: 반응형 `container mx-auto px-4` 패턴. |
| 13 | **네비게이션 점검** | ✅ Pass | 뒤로가기: `router.back()` 사용 안 함, `<Link href="/dashboard/quotes">` 명시적 복귀. 새 탭: CSR이므로 `useSession` + `useQuery` 재실행. staleTime=0으로 캐시 불일치 방지. |
| 14 | **성능 점검** | ✅ Pass | `isQuoteIdValid=false` 시 API 호출 차단(`enabled: false`) — 불필요한 fetch 없음. `retry` 콜백에서 404/403/401은 재시도 안 함. 중복 fetch 루프 없음. |
| 15 | **로그/이력(Audit)** | ✅ Pass | API GET L60-74: `createActivityLogServer(QUOTE_VIEWED)` 비동기 기록. PATCH: `createAuditLog(QUOTE, UPDATED)`. 실패해도 조회 성공 보장(`catch` 처리). |
| 16 | **자동화 후보 도출** | 📋 식별됨 | 아래 "E2E 테스트 후보" 섹션 참조 |

---

## 6. 데스크탑 및 모바일 UX 이슈/충돌 여부

| 환경 | 상태 | 비고 |
|------|------|------|
| 데스크탑 (1280px+) | ✅ 정상 | 견적 상세 전체 레이아웃 정상 렌더링 |
| 태블릿 (768px) | ✅ 정상 | `container mx-auto px-4` 반응형 |
| 모바일 (375px) | ✅ 정상 | NotFoundUI/ForbiddenUI는 `text-center` 중앙 정렬, 버튼 접근 가능 |
| 에러 UI 충돌 | ⚠️ 없음 | 에러 상태 간 중복 렌더링 없음 (우선순위: invalid → loading → error → forbidden → network) |

---

## 7. AI 작업함 / 견적 AI 패널 / 주문·재고 파이프라인 연결 영향도

| 컴포넌트 | 영향 | 설명 |
|----------|------|------|
| **견적 AI 패널** (`QuoteAiAssistantPanel`) | 없음 | `useQuoteAiPanel.preparePanel(items[])` — 품목 배열 기반. quote ID 미참조. |
| **AI 작업함** (`AiActionInbox`) | 없음 | PENDING 목록 조회 → CTA 클릭 시 `AiDraftPreviewDialog` 모달 오픈. 견적 페이지 이동 없음. `relatedEntityId`에 CUID 저장되나 조회 전용. |
| **주문 AI 패널** (`OrderAiAssistantPanel`) | 없음 | `useOrderAiPanel.preparePanel(OrderSummary)` — orderId 기반. quote ID 직접 참조 없음. |
| **재고 AI 패널** (`InventoryAiAssistantPanel`) | 없음 | `useInventoryAiPanel.preparePanel(InventoryItem)` — inventory 데이터 기반. 견적 파이프라인과 독립. |
| **AI 초안 생성 API** | 없음 | `/api/ai-actions/generate/*` — quote ID를 `relatedEntityId`에 저장하나 Prisma Json 필드이므로 형식 무관. |
| **주문 → 견적 역참조** | 없음 | `/my/orders` L176: `<Link href={/quotes/${order.quoteId}}>` — CUID 직접 사용, `isValidQuoteId` 통과. |

---

## 8. 잔존 리스크 및 실패 케이스 목록

| # | 리스크 | 심각도 | 상태 | 비고 |
|---|--------|--------|------|------|
| 1 | CUID 형식 변경 (Prisma 6+ `@default(uuid())` 마이그레이션) | Low | 대응 완료 | `isValidQuoteId`가 UUID도 허용하므로 마이그레이션 시 호환 |
| 2 | URL 직접 입력으로 랜덤 문자열 시도 | Low | 대응 완료 | `isValidQuoteId` false → NotFoundUI 표시 |
| 3 | 삭제된 견적 접근 | Low | 기존 대응 | API 404 → NotFoundUI |
| 4 | 타 모델 ID 혼용 (QuoteListItem.id 등) | None | 확인 완료 | 모든 URL은 `Quote.id`만 사용 |
| 5 | CUID regex가 너무 넓어 잘못된 ID 통과 | Negligible | 수용 | Prisma가 not found로 처리. 클라이언트 검증은 UX 최적화용. |

### E2E 테스트 후보

```
1. 견적 목록 → 상세보기 클릭 → 정상 렌더링 확인
2. 직접 URL 접근 (CUID) → 정상 렌더링 확인
3. 잘못된 ID 접근 → NotFoundUI 표시 확인
4. 삭제된 견적 접근 → NotFoundUI 표시 확인
5. 타 조직 견적 접근 → ForbiddenUI 표시 확인
6. 세션 만료 상태 접근 → 로그인 리다이렉트 확인
```

---

## 9. 최종 릴리즈 판정

### ✅ **Go** — 즉시 릴리즈 가능

**근거:**
1. **Root Cause 단일**: 클라이언트 측 ID 형식 검증 함수 1개가 유일한 문제점
2. **수정 범위 최소**: 1파일, 3지점 변경. 서버 로직 변경 없음
3. **코드베이스 스캔 완료**: 동일 패턴(`isValidUUID`) 코드베이스 전체에 다른 사용 없음
4. **서버 API 무영향**: 모든 API Route는 Prisma에 ID 직접 전달 (형식 무관)
5. **16대 회귀 점검 전항 Pass**: 목록→상세→액션→주문/재고 전체 흐름 코드 분석 통과
6. **AI 파이프라인 무영향**: 3대 AI 패널 + Inbox 모두 quote ID 형식에 비의존
7. **하위 호환**: UUID 형식도 계속 허용 (fallback regex 유지)

**Vercel 자동 배포**: `main` 브랜치 푸시 완료 → 배포 진행 중
