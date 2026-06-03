# COMMIT — §11.358-1 F-1: 견적/재고/구매 fetch 실패 에러 UI 정직화

```
fix(mobile) §11.358-1 #fetch-error-ui — 견적·재고·구매 탭 fetch 실패를 빈 상태로 위장하지 않고 ErrorState + 재시도로 정직 표시 (isError 분기 추가)
```

## 무엇 (§11.358-1 근본 = 에러 UI 부재)
- Phase 0 확정: `queryClient` **retry:2 존재**(자동 재시도 O). 근본 체감 결함 = 탭 화면들이 `isError` 미구독 → 실패 시 `data=undefined → filtered=[] → "···없습니다" 빈 상태로 위장.` 사용자가 **실패를 "없음"으로 오인.**
- "간헐·최초진입"(cold-start race)은 retry:2 가 대부분 구제 → 소진 시 노출되는데, 그 노출이 빈 상태로 위장돼 더 혼란.

## Fix (F-1, 읽기 fetch라 외부영향 0)
- `app/(tabs)/quotes.tsx` / `inventory.tsx` / `purchases.tsx`: `useXxx` 에서 `isError` 구독 + 렌더 `isLoading → isError → 리스트` 3분기. `isError` 시 기존 `<ErrorState>`(title/description/**onRetry=refetch()**) 표시.
- 빈 상태(`EmptyState "···없습니다"`)와 **실패 상태 분리** → 위장 제거 + 즉시 수동 재시도(당겨서 새로고침 외 명시 버튼).
- 3탭 동형(견적 신고됐으나 inventory/purchases 동일 갭 확인 → 함께 정합).

## 보류 (Phase 0 판단)
- F-2 retry: 이미 retry:2 — 변경 없음.
- F-3 auth-ready 가드(authPreflight dead): 인터셉터가 per-request 토큰 await라 효과 제한적 + cold start 지연 부작용 → 보류.
- 응답코드 실측: 기기 네트워크탭 필요(sandbox 불가). F-1 은 원인 불문 개선이라 실측 전 안전.

## migration
- **없음.**

## 검증
- 모바일 test 없음 → grep: 3탭 `isError`+`ErrorState`+`onRetry` wiring 확인. 런타임은 Expo(기기 cold-start 재현).

## Out of Scope
- 디테일 화면([id]) 에러 UI 동형(후속). 응답코드 실측 기반 cold-start 추가 완화(필요 시).

## Rollback
- 3탭 isError 분기 + import revert. 읽기 fetch라 독립.
```
footer 없음
```
