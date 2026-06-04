# COMMIT — §11.361-1b: 대시보드 stats 500 swallow → throw+retry (System Insight 실종 근본)

```
fix(dashboard) §11.361-1b #stats-query-retry — stats 쿼리가 500을 null로 삼켜 retry 미작동(→KPI 0·온보딩 오판·System Insight 실종)하던 것을 throw+retry(backoff)로 정정
```

## 무엇 (Claude in Chrome + Vercel 런타임 로그 근본 추적)
- 증상: 대시보드 "재고 부족 0 · 온보딩 · System Insight 사라짐". 단 `/api/dashboard/stats`는 (재시도 시) `lowStockAlerts:2, totalInventory:3` 정상 반환. 세션 authenticated. 배포 최신(www→6db8ffd7).
- **네트워크 캡처:** 페이지 첫 stats 호출 = **500**, 이후 호출 = 200.
- **Vercel 런타임 로그:** `/api/dashboard/stats` 500 = `prisma:error Invalid prisma...` (간헐 — 2h 내 2건). 첫 콜 500→재호출 200 = **콜드스타트 Prisma 커넥션 transient**(스키마 버그 아님 — 매번이 아니라 간헐).
- **진짜 근본:** stats `queryFn` 이 `!response.ok` 시 `return null` (throw 아님) → react-query 가 **"성공(null)"로 처리 → retry 미작동** → 간헐 500 1회로 `dashboardStats=null` 영구 → `rawStats={}` → 전 KPI 0 → 온보딩 게이트가 재고 0 으로 오판 → **운영 전용 System Insight 배너 숨김.**

## Fix
- `dashboard/page.tsx` stats `queryFn`: `!response.ok` 시 **throw** (이전 `return null` 제거) → react-query 가 에러로 인식.
- `retry: 1 → 3` + `retryDelay` 지수 backoff(1s→…→8s) → 콜드스타트 500 후 **따뜻한 재시도 200** 으로 stats 정상화.
- 결과: stats 채워짐 → §11.361-1 게이트(재고>0)가 운영 모드 전환 → KPI(재고 부족 2) + System Insight 정상 노출.

## 관계
- §11.361-1(온보딩 게이트 재고 포함)은 정확했으나 **이 500-swallow 가 stats 자체를 0 으로 만들어 마스킹.** 둘이 합쳐져야 truth 정상.

## 검증
- 런타임(Chrome): 첫 콜 500 / 재시도 200 / stats 2·3 확인. 세션 정상.
- sentinel `dashboard-onboarding-gate-truth-361.test.ts` 에 throw+retry 단언 추가. ⚠️ sandbox node_modules 소실 → Claude Code `npm run test`.
- 배포 후 Chrome 재검증: 대시보드가 "재고 부족 2건" + System Insight 노출하는지.

## Out of Scope
- 서버측 Prisma 콜드스타트 커넥션 안정화(pooling/warmup)는 별도 — 본 fix 는 클라 회복성으로 증상 해소.

## Rollback
- queryFn throw→return null + retry 원복.
```
footer 없음
```
