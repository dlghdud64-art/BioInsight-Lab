# COMMIT — §11.361-1c: 대시보드 콜드스타트 0-flash 차단

```
fix(dashboard) §11.361-1c #coldstart-flash — stats retry backoff(~12s) 동안 온보딩·0 KPI 거짓 노출을 로딩 스켈레톤으로 차단
```

## 무엇 (§11.361-1b 라이브 검증 중 발견)
- §11.361-1b(throw+retry) 적용 후 Chrome 검증: 콜드스타트 시 stats 첫 호출 500 → retry backoff(1→2→4→8s) → **~12s 후** 정상(재고 부족 2건, System Insight 복귀). 그러나 그 12s 동안 `dashboardStats` 아직 undefined → `rawStats={}` → **온보딩·0 KPI 가 잠깐 노출**(거짓 "데이터 없음" 상태).

## Fix
- `dashboard/page.tsx` early-return 가드 확장:
  - `if (status === "loading" || (statsLoading && !dashboardStats))` → **stats 로딩/재시도 중(데이터 없음)엔 온보딩 대신 로딩 스켈레톤 유지.**
  - retry 소진(최종 실패) 시 `statsLoading` false → 아래로 흘러 기존 fallback(온보딩) — 진짜 실패만 노출.

## 효과
- 콜드스타트에서 "재고 0·온보딩"이 깜빡이지 않고, stats 도착 후 바로 운영 대시보드. 거짓 상태 노출 0.

## 검증
- 런타임(Chrome): §11.361-1b 적용 후 12s 시점 운영 정상 확인(재고 부족 2건, System Insight "예산 운영이 정상"). 본 패치는 그 12s 동안 스켈레톤으로 가림.
- sentinel: `dashboard-onboarding-gate-truth-361.test.ts` 에 가드 단언 추가. Claude Code `npm run test`.

## Rollback
- early-return 조건 원복.
```
footer 없음
```
