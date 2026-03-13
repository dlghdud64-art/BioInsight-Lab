# AI Closed Loop Architecture Spec
## 대시보드 AI 작업함 ↔ 3대 AI 패널 상태 전이·승인 로그·모바일·성능 최적화

> **목적**: 기존 3대 AI 패널(견적/주문/재고)이 대시보드 AI 작업함(Inbox)과 실제 운영 흐름으로 "완벽히 닫히도록(Closed Loop)" 연결성을 깎고 최적화한다.
>
> **범위**: 독립 챗봇 UI 없음. 새 AI 기능 추가 없음. 기존 컴포넌트 간 연결·상태 전이·감사 로그·모바일 UX·성능만 다룬다.

---

## 1. Executive Summary

BioInsight Lab의 AI 운영 흐름은 세 단계로 구성된다:

```
[트리거] → [AI 패널 (생성·검토)] → [Inbox (대기·승인)] → [실행] → [감사 로그]
```

현재 상태:
- 3대 AI 패널(견적/주문/재고)은 각각 독립적으로 `preparePanel()` → Sheet 오픈까지 동작
- AI 작업함(`AiActionInbox`)은 `GET /api/ai-actions?status=PENDING`으로 PENDING 항목을 보여줌
- **끊어진 루프**: 패널에서 생성한 `AiActionItem`이 Inbox에 즉시 반영되지 않고, Inbox에서 승인한 결과가 패널에 피드백되지 않음

이 문서는 4가지 최적화 영역을 정의한다:

| # | 영역 | 핵심 과제 |
|---|------|-----------|
| A | **상태 전이 규칙** | 패널 → Inbox → 실행의 단방향 플로우를 양방향 피드백 루프로 전환 |
| B | **감사/로그 규칙** | 모든 AI 액션(생성·승인·무시·만료)에 `DataAuditLog` 기록 |
| C | **모바일 압축 원칙** | Sheet → BottomSheet 적응, Inbox 카드 1줄 압축 |
| D | **체감 성능 목표** | 패널 오픈 200ms, Inbox 로드 300ms, 승인 응답 500ms |

---

## 2. 최적화 영역 A: 상태 전이 규칙

### 2.1 전체 상태 전이 다이어그램

```
                    ┌──────────────────────────────────────────────────────┐
                    │              AI Closed Loop Flow                     │
                    └──────────────────────────────────────────────────────┘

  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐
  │  TRIGGER     │───▶│  AI PANEL     │───▶│  INBOX        │───▶│  EXECUTE   │
  │              │    │  (Sheet)      │    │  (Dashboard)  │    │           │
  │  • 재발주    │    │  • 생성 중... │    │  • PENDING    │    │  • API    │
  │  • 견적 요청 │    │  • 미리보기   │    │  • 카드 표시   │    │  • Email  │
  │  • 주문 추적 │    │  • 편집       │    │  • 승인/무시   │    │  • DB     │
  └─────────────┘    └──────┬───────┘    └──────┬───────┘    └─────┬─────┘
                            │                    │                  │
                            │    ◀── TanStack ──▶│                  │
                            │    invalidate       │                  │
                            │                    │                  │
                            ▼                    ▼                  ▼
                    ┌──────────────────────────────────────────────────────┐
                    │              DataAuditLog                            │
                    │  entityType: AI_ACTION                               │
                    │  action: CREATED | APPROVED | DISMISSED | EXPIRED    │
                    └──────────────────────────────────────────────────────┘
```

### 2.2 AiActionItem 상태 머신

```
                PENDING
               ╱       ╲
        [승인]           [무시]
             ╲           ╱
         APPROVED    DISMISSED
              │
         EXECUTING
            ╱    ╲
      COMPLETED  FAILED
                    │
               [재시도 → PENDING]
```

**상태 전이 규칙:**

| From | To | Trigger | 조건 | Side Effect |
|------|----|---------|------|-------------|
| _(none)_ | `PENDING` | `POST /api/ai-actions/generate/*` | AI 생성 성공 | Inbox queryKey invalidate |
| `PENDING` | `APPROVED` | `POST /api/ai-actions/[id]/approve` | 사용자 클릭 | `resolvedAt`, `resolvedBy` 설정 |
| `APPROVED` | `EXECUTING` | approve 핸들러 내부 | 즉시 | - |
| `EXECUTING` | `COMPLETED` | 비즈니스 로직 성공 | - | `result` JSON 저장 |
| `EXECUTING` | `FAILED` | 비즈니스 로직 실패 | - | `result.error` 저장 |
| `FAILED` | `PENDING` | 사용자 재시도 | `PATCH /api/ai-actions/[id]` | `resolvedAt` 초기화 |
| `PENDING` | `DISMISSED` | `PATCH /api/ai-actions/[id]` | 사용자 클릭 | `resolvedAt`, `resolvedBy` 설정 |
| `PENDING` | `EXPIRED` | 크론/로드 시 체크 | `expiresAt < now()` | 자동 처리 |

### 2.3 패널 → Inbox 연결 (현재 끊어진 부분)

**문제**: 패널에서 `generate` API 호출 후 `AiActionItem`이 생성되지만, 대시보드 Inbox의 TanStack Query가 즉시 갱신되지 않음.

**해결**: `generate` mutation의 `onSuccess`에서 `ai-actions` queryKey를 invalidate.

```typescript
// 현재 (use-quote-ai-panel.ts L100)
onSuccess: (data) => {
  // draft 미리보기만 설정
  setPanelData(prev => ({ ...prev, draft: { ... } }));
}

// 개선
onSuccess: (data) => {
  setPanelData(prev => ({ ...prev, draft: { ... } }));
  // Inbox 즉시 갱신
  queryClient.invalidateQueries({ queryKey: ["ai-actions"] });
}
```

**적용 대상**: 3개 훅 모두 동일 패턴
- `use-quote-ai-panel.ts` → `generateMutation.onSuccess`
- `use-order-ai-panel.ts` → `followUpMutation.onSuccess`
- `use-inventory-ai-panel.ts` → (현재 mutation 없음, P1 대상)

### 2.4 Inbox → 패널 역방향 연결

**문제**: Inbox에서 "견적 요청 검토하기" CTA 클릭 시 `AiDraftPreviewDialog` 모달만 열림. 해당 견적의 AI 패널(Sheet) 상세 컨텍스트는 제공되지 않음.

**해결**: Inbox CTA 클릭 시 `relatedEntityType`에 따라 라우팅 분기:

```typescript
// ai-action-inbox.tsx 개선
const handleReview = (item: AiActionItem) => {
  switch (item.type) {
    case "QUOTE_DRAFT":
    case "VENDOR_EMAIL_DRAFT":
      // 이메일 초안 → 기존 PreviewDialog로 처리 (현행 유지)
      setPreviewItem(item);
      break;
    case "REORDER_SUGGESTION":
    case "EXPIRY_ALERT":
      // 재고 관련 → 재고 페이지로 이동 + AI 패널 자동 오픈
      router.push(`/dashboard/inventory?aiAction=${item.id}`);
      break;
    case "FOLLOWUP_DRAFT":
      // 주문 관련 → 주문 페이지로 이동 + AI 패널 자동 오픈
      router.push(`/dashboard/orders?aiAction=${item.id}`);
      break;
    default:
      setPreviewItem(item);
  }
};
```

**각 도메인 페이지 수신 처리:**

```typescript
// inventory/page.tsx 개선
const searchParams = useSearchParams();
const aiActionId = searchParams.get("aiAction");

useEffect(() => {
  if (aiActionId) {
    // AiActionItem 조회 → 해당 inventoryId의 아이템으로 패널 자동 오픈
    fetch(`/api/ai-actions/${aiActionId}`)
      .then(res => res.json())
      .then(data => {
        const item = data.item;
        if (item.relatedEntityId) {
          // 해당 재고 아이템으로 AI 패널 자동 오픈
          aiPanel.preparePanel(buildInventoryItemFromAction(item));
        }
      });
  }
}, [aiActionId]);
```

### 2.5 승인 후 결과 피드백

**문제**: 승인 후 생성된 Quote/Email 등의 결과를 사용자에게 알려주지 않음.

**해결**: approve API 응답의 `result` 필드를 활용한 토스트 피드백:

```typescript
// ai-action-inbox.tsx handleApprove 개선
const handleApprove = async (modified) => {
  const result = await approveMutation.mutateAsync({ id, payload });

  // 결과 기반 피드백
  if (result.result?.quoteId) {
    toast({
      title: "견적 요청 생성 완료",
      description: "견적 목록에서 확인할 수 있습니다.",
      action: <Link href={`/dashboard/quotes/${result.result.quoteId}`}>확인하기</Link>
    });
  } else if (result.result?.emailSent) {
    toast({
      title: "이메일 발송 완료",
      description: `${result.result.vendorName}에 이메일이 발송되었습니다.`
    });
  }
};
```

---

## 3. 최적화 영역 B: 감사/로그 규칙

### 3.1 감사 로그 기록 지점

모든 `AiActionItem` 상태 변경은 `DataAuditLog`에 기록한다.

| 이벤트 | entityType | action | 기록 필드 |
|--------|-----------|--------|-----------|
| AI 초안 생성 | `AI_ACTION` | `CREATED` | `{ type, title, priority, aiModel, promptTokens, completionTokens }` |
| 승인 | `AI_ACTION` | `UPDATED` | `{ previousStatus: "PENDING", newStatus: "APPROVED", resolvedBy }` |
| 무시 | `AI_ACTION` | `UPDATED` | `{ previousStatus: "PENDING", newStatus: "DISMISSED", resolvedBy }` |
| 실행 성공 | `AI_ACTION` | `UPDATED` | `{ previousStatus: "EXECUTING", newStatus: "COMPLETED", result }` |
| 실행 실패 | `AI_ACTION` | `UPDATED` | `{ previousStatus: "EXECUTING", newStatus: "FAILED", error }` |
| 자동 만료 | `AI_ACTION` | `UPDATED` | `{ previousStatus: "PENDING", newStatus: "EXPIRED", expiresAt }` |

### 3.2 구현 위치

```typescript
// api/ai-actions/[id]/approve/route.ts
import { createAuditLog } from "@/lib/audit";

// 승인 처리 후
await createAuditLog({
  userId: session.user.id,
  organizationId: orgId,
  entityType: "AI_ACTION",
  entityId: actionItem.id,
  action: "UPDATED",
  changes: {
    previousStatus: "PENDING",
    newStatus: "APPROVED",
    resolvedBy: session.user.id,
    resolvedAt: new Date().toISOString(),
    executionResult: result, // 생성된 quoteId 등
  },
});
```

### 3.3 감사 로그 조회 UI (기존 활용)

기존 `AuditEntityType` enum에 `AI_ACTION`이 이미 추가 예정(플랜 참조). 관리자 감사 로그 페이지에서 `entityType=AI_ACTION` 필터로 AI 작업 이력 전체 조회 가능.

**필터 옵션 추가:**
- "AI 작업" 필터 탭
- action별 하위 필터: 생성 / 승인 / 무시 / 만료

---

## 4. 최적화 영역 C: 모바일 압축 원칙

### 4.1 AI 패널: Sheet → BottomSheet 적응

**원칙**: `md` 이상에서는 우측 Sheet(max-w-[440px]), `sm` 이하에서는 BottomSheet(하단 올라옴, max-h-[85vh]).

**구현 방식**: 기존 Shadcn `Sheet` 컴포넌트의 `side` prop을 반응형으로 전환:

```typescript
// 공통 패턴 (3대 패널 모두 적용)
const isMobile = useMediaQuery("(max-width: 768px)");

<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent
    side={isMobile ? "bottom" : "right"}
    className={cn(
      isMobile
        ? "max-h-[85vh] rounded-t-2xl"
        : "max-w-[440px] w-[440px]"
    )}
  >
```

**BottomSheet 추가 UX:**
- 상단 드래그 핸들 바 (4px × 40px, rounded, bg-slate-300)
- 스와이프 다운으로 닫기 지원
- 섹션별 아코디언 접기 (모바일에서 기본 접힘)

### 4.2 Inbox 카드: 모바일 1줄 압축

**현재**: 아이콘 + 제목 + 설명 + 배지 + CTA 버튼 + 무시 버튼 + 시간 (3줄)

**모바일 압축**: 아이콘 + 제목 + 배지 (1줄) → 탭하면 확장

```
┌─────────────────────────────────────────┐
│ 📦 PBS 1X 재발주 시점 도래  [재고 위험] │  ← 접힌 상태
└─────────────────────────────────────────┘

  탭 시 확장 ↓

┌─────────────────────────────────────────┐
│ 📦 PBS 1X 재발주 시점 도래  [재고 위험] │
│   소진 예상: 5일 후 · 추천 수량: 10ea   │
│   [재발주 우선순위 보기 →]  [무시]  1h   │
└─────────────────────────────────────────┘
```

**구현:**

```typescript
// ai-action-inbox.tsx 모바일 압축
const [expandedId, setExpandedId] = useState<string | null>(null);
const isMobile = useMediaQuery("(max-width: 768px)");

{items.map((item) => {
  const isExpanded = !isMobile || expandedId === item.id;

  return (
    <div
      key={item.id}
      onClick={() => isMobile && setExpandedId(
        expandedId === item.id ? null : item.id
      )}
    >
      {/* 항상 보이는 1줄 */}
      <div className="flex items-center gap-2">
        <IconComp />
        <span className="truncate">{item.title}</span>
        <Badge>{config.badgeLabel}</Badge>
      </div>

      {/* 확장 시에만 보이는 상세 */}
      {isExpanded && (
        <div className="mt-2">
          <p>{item.description}</p>
          <div className="flex gap-2 mt-2">
            <Button onClick={() => handleReview(item)}>
              {config.cta}
            </Button>
            <Button onClick={() => handleDismiss(item.id)}>
              무시
            </Button>
          </div>
        </div>
      )}
    </div>
  );
})}
```

### 4.3 패널 내부 섹션 모바일 최적화

| 섹션 | 데스크톱 | 모바일 |
|------|----------|--------|
| 헤더 + 상태 배지 | 고정 상단 | 고정 상단 (높이 48px) |
| 재고 현황 바 | 수평 진행 바 | 수평 진행 바 (동일) |
| 이슈 경고 목록 | 전체 펼침 | 최상위 1건만 표시 + "N건 더 보기" |
| 재발주 추천 | 전체 테이블 | 카드형 1건 + 스와이프 |
| Lot/유효기한 | 테이블 | 아코디언 접힘 |
| 운영 영향 | 전체 펼침 | 아코디언 접힘 |
| 고정 하단 액션 | 고정 하단 | 고정 하단 (동일) |

---

## 5. 최적화 영역 D: 체감 성능 목표

### 5.1 성능 목표 정의

| 지표 | 목표 | 현재 예상 | 최적화 방법 |
|------|------|-----------|-------------|
| 패널 오픈 TTI | ≤ 200ms | ~100ms | `preparePanel()`은 동기 연산, Sheet 애니메이션만 |
| AI 초안 생성 (GPT-4o) | ≤ 3s | 2~5s | 스트리밍 미적용, 스켈레톤 + 진행 표시 |
| Inbox 첫 로드 | ≤ 300ms | ~200ms | TanStack staleTime 5분, 서버 캐시 |
| 승인 응답 | ≤ 500ms | ~300ms | DB 트랜잭션 + 이메일 비동기 분리 |
| Inbox 갱신 (invalidate) | ≤ 100ms | ~100ms | queryKey invalidate + refetch |

### 5.2 Perceived Performance 전략

#### 5.2.1 낙관적 업데이트 (Optimistic Update)

**무시 버튼**: 클릭 즉시 카드 페이드아웃, 서버 응답 실패 시 롤백

```typescript
// use-ai-actions.ts useDismissAiAction 개선
useMutation({
  mutationFn: async (id: string) => { ... },
  onMutate: async (id) => {
    // 낙관적 제거
    await queryClient.cancelQueries({ queryKey: ["ai-actions"] });
    const prev = queryClient.getQueryData(["ai-actions", "list", ...]);
    queryClient.setQueryData(["ai-actions", "list", ...], (old) => ({
      ...old,
      items: old.items.filter(i => i.id !== id),
      pendingCount: old.pendingCount - 1,
    }));
    return { prev };
  },
  onError: (err, id, context) => {
    // 롤백
    queryClient.setQueryData(["ai-actions", "list", ...], context.prev);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["ai-actions"] });
  },
});
```

#### 5.2.2 스켈레톤 전략

| 컴포넌트 | 스켈레톤 적용 |
|----------|-------------|
| Inbox 전체 | 2개 카드 모양 스켈레톤 (현재 구현됨 ✓) |
| AI 패널 생성 중 | "loading" 상태에서 섹션별 스켈레톤 (현재 구현됨 ✓) |
| 승인 처리 중 | 버튼 Spinner + 배경 dim (현재 구현됨 ✓) |

#### 5.2.3 프리페칭

대시보드 진입 시 AI 작업함 데이터를 프리페치:

```typescript
// dashboard/layout.tsx 또는 page.tsx
const queryClient = useQueryClient();

useEffect(() => {
  queryClient.prefetchQuery({
    queryKey: ["ai-actions", "list", { status: "PENDING", limit: "5" }],
    queryFn: () => fetch("/api/ai-actions?status=PENDING&limit=5").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}, []);
```

#### 5.2.4 이메일 발송 비동기화

승인 후 이메일 발송을 동기 응답에서 분리:

```
승인 클릭 → DB 상태 APPROVED 즉시 반환 (500ms 목표)
         → 백그라운드: sendEmail() (3~10s)
         → 실패 시: status → FAILED, result.error 저장
```

---

## 6. 구현 우선순위

### Phase 1: 연결성 복구 (1~2일)

| # | 작업 | 파일 | 효과 |
|---|------|------|------|
| 1 | generate mutation `onSuccess`에 queryKey invalidate 추가 | `use-quote-ai-panel.ts`, `use-order-ai-panel.ts` | 패널 → Inbox 실시간 동기화 |
| 2 | Inbox CTA에 `relatedEntityType` 기반 라우팅 분기 | `ai-action-inbox.tsx` | Inbox → 도메인 페이지 연결 |
| 3 | 승인 후 결과 토스트 피드백 | `ai-action-inbox.tsx` | Closed Loop 완성 |
| 4 | `useDismissAiAction` 낙관적 업데이트 | `use-ai-actions.ts` | 체감 속도 향상 |

### Phase 2: 감사 로그 (1일)

| # | 작업 | 파일 |
|---|------|------|
| 5 | approve/dismiss API에 `createAuditLog` 호출 추가 | `api/ai-actions/[id]/approve/route.ts`, `api/ai-actions/[id]/route.ts` |
| 6 | generate API에 `createAuditLog(CREATED)` 추가 | `api/ai-actions/generate/*/route.ts` |
| 7 | `AuditEntityType.AI_ACTION` enum 추가 (Prisma) | `schema.prisma` |

### Phase 3: 모바일 UX (1~2일)

| # | 작업 | 파일 |
|---|------|------|
| 8 | `useMediaQuery` 훅 추가 | `hooks/use-media-query.ts` |
| 9 | 3대 AI 패널 Sheet `side` 반응형 전환 | `quote-ai-assistant-panel.tsx`, `order-ai-assistant-panel.tsx`, `inventory-ai-assistant-panel.tsx` |
| 10 | Inbox 카드 모바일 접기/펼치기 | `ai-action-inbox.tsx` |

### Phase 4: 성능 마무리 (0.5일)

| # | 작업 | 파일 |
|---|------|------|
| 11 | 대시보드 프리페치 | `dashboard/page.tsx` 또는 `dashboard/layout.tsx` |
| 12 | 이메일 발송 비동기화 검토 | `api/ai-actions/[id]/approve/route.ts` |

---

## 7. 검증 체크리스트

### Closed Loop 검증

- [ ] 견적 화면에서 "견적 요청 초안 만들기" 클릭 → AI 패널 열림 → 초안 생성 완료 → 대시보드 Inbox에 PENDING 카드 즉시 표시
- [ ] Inbox에서 "견적 요청 검토하기" 클릭 → PreviewDialog 오픈 → 편집 → 승인 → Quote 생성 확인 → 토스트 피드백 표시
- [ ] Inbox에서 "무시" 클릭 → 카드 즉시 페이드아웃 (낙관적) → 서버 반영 확인
- [ ] 재고 페이지 "재발주 검토" → AI 패널 → (P1에서) AiActionItem 생성 → Inbox 표시 → 승인 → 재발주 실행
- [ ] 주문 페이지 "주문 추적 확인" → AI 패널 → Follow-up 생성 → Inbox에 FOLLOWUP_DRAFT 카드 표시

### 감사 로그 검증

- [ ] AI 초안 생성 시 `DataAuditLog(entityType=AI_ACTION, action=CREATED)` 레코드 존재
- [ ] 승인 시 `DataAuditLog(action=UPDATED, changes.newStatus=APPROVED)` 레코드 존재
- [ ] 무시 시 `DataAuditLog(action=UPDATED, changes.newStatus=DISMISSED)` 레코드 존재
- [ ] 관리자 감사 로그 페이지에서 AI_ACTION 필터 동작

### 모바일 검증

- [ ] 375px 뷰포트에서 AI 패널이 BottomSheet로 표시 (하단에서 올라옴)
- [ ] 모바일 Inbox 카드 1줄 표시 → 탭 시 확장 → CTA 버튼 접근 가능
- [ ] BottomSheet 스와이프 다운으로 닫기 동작

### 성능 검증

- [ ] 패널 오픈 TTI ≤ 200ms (Chrome DevTools Performance 탭)
- [ ] Inbox 첫 로드 ≤ 300ms (Network 탭)
- [ ] 무시 버튼 카드 제거 ≤ 100ms (낙관적 업데이트 확인)
- [ ] 승인 응답 ≤ 500ms (Network 탭)
