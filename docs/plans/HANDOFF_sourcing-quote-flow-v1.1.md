# 소싱 견적 담기 흐름 핸드오프 v1.1 (정정본)

- **Status:** 정정 확정 (2026-08-12) · 표시 계층 일부 착수 · §2 구현은 왕복 검증 이후
- **원문:** 소싱 견적 담기 흐름 핸드오프 v1.0
- **정정 근거:** 이 세션 실측 (호영님 지시 2026-08-12 "문서를 먼저 고치세요")

---

## ⚠️ 이 문서의 성격 — 먼저 읽을 것

**v1.0 원문은 이 레포에 없습니다.** 전수 탐색(`*.md` 전체 + 미추적 파일 포함)에서
"재발주안에 합류" · "`{rfqId}`" · "연관 추천" 어느 문자열도 나오지 않았습니다.
원문은 샌드박스 세션에만 있습니다.

따라서 이 문서는 **원문 대체본이 아니라 정정본**입니다. 정정 대상 조항은 호영님이
채팅으로 인용해 주신 문구를 그대로 옮겼고, 옮기지 못한 조항은 손대지 않았습니다.

📌 **원문을 `docs/plans/` 에 넣어 주십시오.** 그래야 v1.1 이 "무엇을 정정했는지" 가
다음 사람에게 대조 가능해집니다. 지금은 정정 항목만 검증 가능합니다.

---

## 1. 정정표

호영님 지시 4건 + **실측 중 추가로 드러난 3건**. 추가분은 표시 계층 4건 착수 직전에
드러났고, 셋 다 **날짜가 박힌 기존 결정**을 뒤집는 요구였습니다.

| # | 항목 | 원문 | 정정 | 근거 |
|---|---|---|---|---|
| ① | **§2 라우트** | `/quotes/{rfqId}/prepare` 신규 라우트, "1c와 동일 컴포넌트 재사용" | `/dashboard/quotes?prepare={id}` **same-route 딥링크**. 신규 라우트 금지 | 재사용 대상 1c 자체가 **라우트를 만들지 않기로 한 결정**이다 — [quote-prepare-panel.tsx:6](../../apps/web/src/components/quotes/prepare/quote-prepare-panel.tsx) *"same-route 딥링크 — 신규 라우트 아님 (호영님 (a)안 확정, page-per-feature 회귀 금지)"* (2026-08-05). CLAUDE.md 제품 제약 `page-per-feature 회귀 금지` |
| ② | **§2 목적지** | 리스트(`/dashboard/quotes`) | **조회 → 없으면 생성 → `?prepare={id}`** 2분기. 리스트는 목적지에서 소멸 | §3 참조 |
| ③ | **§4 quote-cart** | "담김 상태는 quote-cart 레코드에서 파생(front-only 금지)" | **localStorage canonical 유지.** 이행하지 않음 | 호영님 2026-06-11 ⓐ — [quote-cart-storage.ts:5](../../apps/web/src/lib/quote/quote-cart-storage.ts) *"견적함 canonical = provider quoteItems + localStorage 영속. 서버 영속은 POST /api/quotes 단계부터"*. 의도(거울상 금지)는 `quote-cart-changed` 구독 재읽기(계약⑨-2)로 이미 충족 |
| ④ | **시안 1a 배너** | `재발주안에 합류` + `권장 9개` | **삭제.** 만들지 않음 | 재발주안은 **영속 객체가 아니다** — Prisma 에 모델 없음, `ProductInventory` 에서 매 호출 파생. 합류할 그릇이 없다. 금지가 이미 소스에 박혀 있음 — [page.tsx:1133](../../apps/web/src/app/products/[id]/page.tsx) *"'재발주안에 합류' 라벨 금지 — 실제로 합류하는 동작이 없다"* (커밋 `ec762d77`) |
| ⑤ | **§0-4 영업 문의** | "우측 레일에 영업 문의·상시 안내문 잔존 — 정리 대상" / §1 "영업 문의 행 삭제" | **서술 부정확. 조치 없음** | ⓐ 이미 레일 CTA 아래 **각주 한 줄**([page.tsx:1124](../../apps/web/src/app/products/[id]/page.tsx)) — "레일 잔존" 아님. ⓑ 상시 안내문은 v21 §7 에서 이미 정리(첫 담기 toast 로 이전). ⓒ **삭제 시 문의 경로 0** — `products/[id]` 는 자체 layout 이 없고 root layout 이 `MainHeader` 를 렌더하지 않아 `/support` 진입이 이 화면에서 유일 (독립 확인) |
| ⑥ | **toast 삭제** 🆕 | "toast 삭제" | **보류 — B4 결정 교체** | 담기 toast 는 v21 **B4**(호영님 승인 2026-08-09 "진행")로 *신설*된 것이다: "PD-A 상시 신뢰 문구 폐기 → 첫 담기 1회 toast 로 이전(문구 자체는 소멸하지 않는다)". 삭제하면 문구가 **소멸**한다. sentinel 3건이 잠금: `product-detail-sourcing-v21.test.ts:187` · `product-detail-quote-status-pd-a.test.ts:27` · `product-detail-sian-flat.test.ts:110` |
| ⑦ | **sticky `>= 2`** 🆕 | "sticky 바 `cartItems.length >= 2` 조건" | **보류 — PD-D 결정 교체 + 대상 확정 필요** | 대상은 모바일 하단 바가 아니라 **`QuoteTrayBar`**(데스크탑 견적함 트레이)로 읽힌다. 현재 계약은 `if (count === 0) return null` — PD-D §09 *"count 0 = 노출 0(빈 트레이 금지)"*, sentinel `product-detail-quote-tray-pd-d.test.ts:21` 이 **정확히 그 문자열**을 잠근다. ⚠️ `>= 2` 로 바꾸면 **1건 담은 데스크탑 사용자에게서 "견적 진행" 진입이 사라진다**(레일 "견적함 보기"만 남음) |

---

## 2. ② 정정 — "견적 진행" CTA 의 주인

이 세션 1차 보고에서 "견적 진행"을 담김 버튼(`담김 ✓ · 견적함 보기`)으로 지목했으나
**틀렸습니다.** `견적 진행` 이라는 이름의 CTA 는 하나뿐이고
[quote-tray-bar.tsx:60](../../apps/web/src/components/products/quote-tray-bar.tsx) 입니다.

| CTA | 위치 | 목적지 | §2 대상 |
|---|---|---|---|
| **`견적 진행`** | QuoteTrayBar:60 | `/dashboard/quotes` | ✅ **여기 하나** |
| `담김 ✓ · 견적함 보기` (레일) | page.tsx:1095 | `/dashboard/quotes` | ❌ 이름과 목적지가 맞음 |
| `담김 ✓ · 견적함 보기` (모바일) | page.tsx:1273 | `/dashboard/quotes` | ❌ 동일 |
| `재발주 견적 만들기` | page.tsx:255 | `?prepare={새 id}` | ✅ 이미 해결 |
| `작성 중인 견적 열기` | page.tsx:1156 | `?prepare={기존 id}` | ✅ 이미 해결 |

**§0-2 의 지적은 정확합니다.** 그리고 §2 의 교체 대상은 **1곳**입니다 — "견적함 보기" 는
리스트가 이름과 정합하고, 그 라벨·목적지는 v21 **B2** 로 승계 확정된 것이라 건드리지
않습니다.

---

## 3. §2 정답 설계 (호영님 확정 2026-08-12)

```
"견적 진행" 클릭
  → GET /api/quotes?productId={id}&status=PENDING     ← 조회 생략 금지
     있으면 → /dashboard/quotes?prepare={기존 id}
     없으면 → POST /api/quotes → /dashboard/quotes?prepare={새 id}
```

**리스트는 목적지에서 사라집니다.** 이 2분기는 `ec762d77` 의 구조와 같습니다 —
조회 후 있으면 열고 없으면 만든다.

### 재사용 대상 — 화면이 아니라 배선

실측 결과 **구조는 그대로 끌어 쓸 수 있고, 페이로드만 다릅니다.**

| 조각 | 위치 | §2 재사용 |
|---|---|---|
| 조회 | [page.tsx:186](../../apps/web/src/app/products/[id]/page.tsx) `useQuery(["product-draft-quote", id])` → `/api/quotes?productId=&status=PENDING` | ✅ 그대로 |
| 생성 + 이동 | [page.tsx:216](../../apps/web/src/app/products/[id]/page.tsx) `handleCreateReorderQuote` — POST 실패 시 이동 0(placeholder success 금지) | ✅ 구조 그대로 |
| 도착 표면 | `QuotePreparePanel` + `?prepare=` | ✅ 그대로 |
| 페이로드 | title `…재발주 견적` / quantity `reorderShortfall` / specialNotes `안전재고 미달` | ❌ 소싱 담기용으로 별도 |

⚠️ **중복 생성 방지가 이 설계의 핵심이므로 조회를 생략하지 마십시오.** 조회 없이 생성하면
클릭할 때마다 초안이 쌓이고, 그것이 §0-2 보다 나쁜 상태입니다.

### 🛑 미결 1건 — 다품목 견적함의 초안 범위

현행 조회는 **productId 스코프**입니다. 그런데 `QuoteTrayBar` 의 "견적 진행" 은
**견적함 전체**(N건)의 CTA 입니다.

- 견적함에 3개가 담긴 상태에서 "견적 진행" 을 누르면 초안에 몇 개가 들어가야 하는가?
- 이 제품만이면 나머지 2개는 어디로 가는가? 전부면 조회 스코프가 productId 로는 부족하다.

시안 1b(`RFQ-2608-K3M2 · 방금 소싱에서 담김`)는 단일 RFQ 만 보여 주어 판별이 안 됩니다.
**착수 전 확정 필요.** 확정 없이 구현하면 견적함 다품목 사용자에게 조용한 누락이 생깁니다.

---

## 4. 작업 분해

### 지금 가능 (표시 계층 — §product-detail-sourcing-v21 연장)

| 항목 | 상태 |
|---|---|
| 섹션 간 20px / 대체품 카드 간 12px | ✅ 착수 |
| 연관 추천(개인화) 섹션 제거 → 검색/홈 이관 | ✅ 착수 (sentinel 2건 승계) |
| toast 삭제 | 🛑 보류 — 정정⑥ (B4 교체) |
| sticky `>= 2` | 🛑 보류 — 정정⑦ (PD-D 교체 + 대상 확정) |

### DB 필요 (Supabase 이후)

- §2 "견적 진행" 2분기 — Quote 생성·조회가 실제로 되는지가 **이 설계의 전제**
- `?reorder=` 자동 담기 + 권장 수량
- 재발주안 ↔ RFQ 양방향 동기화 — ⚠️ 절반은 이미 있음:
  [reorder-recommendations/route.ts:135](../../apps/web/src/app/api/inventory/reorder-recommendations/route.ts)
  가 productId → active Quote(RFQ ref) 를 매핑한다. 단 그것은 합류(쓰기)가 아니라 **참조(읽기)**
- 담김 상태 quote-cart 파생 — ❌ 정정③ 으로 **폐기**

---

## 5. 착수 순서 (호영님 확정)

1. ✅ 선행 실측 3건
2. ✅ 문서 정정 (이 문서)
3. ⏳ 표시 계층 — 착수분만 (보류 2건은 승인 대기)
4. ⬜ **[Supabase 대기]**
5. ⬜ 왕복 검증 — 담기 → 견적 진행 → prepare → 발송. §2 "리스트 덤핑 금지" 준수 여부까지 확인
6. ⬜ §2 구현 — 왕복으로 현행을 확인한 뒤

> **4를 3 앞에 두지 말 것.** 미검증 기반 위에 새 배선을 쌓으면 안 되는 이유를 두 층에서 찾게 된다.

---

## 6. 등재만 (건드리지 않음)

**§cart-model-orphan** — `Cart`/`CartItem` 모델이 실재하나(schema.prisma:2103·2117,
`sourceType: MANUAL|REORDER|SEARCH`) `/api/cart` 호출자는
[smart-pick-widget.tsx:53](../../apps/web/src/components/dashboard/smart-pick-widget.tsx) **하나뿐**이다.
제품 상세 견적함은 이 모델을 쓰지 않는다(정정③). 별건 — 지금 건드리지 않는다.
