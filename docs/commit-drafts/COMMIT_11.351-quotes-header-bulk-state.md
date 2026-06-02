# COMMIT — §11.351 견적 관리 헤더 정리 + 일괄 발송 집계 상태 정합 (#1·#3)

```
fix(quotes) §11.351 #quotes-header-bulk-state — 초안 헤더 버튼 제거 + 일괄 발송 집계 canonical 상태 정합(회신 대기 제외) (호영님 P2)
```

## 호영님 spec (§11.351 rev2 — 본 커밋은 #1·#3, #2 layout shift 별도)
- #1 헤더 과밀 + 불필요 "초안 만들기"(이전 업로드 창, 실가치 0). #3 일괄 발송 집계가 `회신 대기`(이미 발송) 포함 → 거짓 "발송 가능 N" + 중복 발송 위험.

## 진단 (Phase 0 코드 확정)
- #1: 헤더 "견적 요청 초안 만들기" = md+ 버튼(quote-draft-workbench-cta) + 모바일 더보기 드롭다운 항목.
- #3 **근본 원인**: Ctrl+A `handleSelectAll`(1851)가 `sortedQuotes` **전체**를 선택(PENDING 외 회신 대기 포함) → `dispatchableCount`(1897)가 상태 무시하고 `!hardBlocked`만 카운트 → "발송 가능"에 회신 대기 포함. (개별·thead 체크박스는 PENDING-only=정상, Ctrl+A만 누수.)

## Fix (file 별)
- `app/dashboard/quotes/page.tsx`:
  - **#1**: 헤더 md+ "초안 만들기" Button + 모바일 더보기 드롭다운 항목 제거(진입로 hide). `openQuoteDraftWorkbench` 핸들러·QuoteDraftWorkbench 모달 코드 잔존(방안 a, 복구 용이). 새 견적 요청/비교/스캔 유지.
  - **#3a**: Ctrl+A 전체 선택 → `sortedQuotes.filter((q) => deriveRailState(q) === "request_not_sent")`만 선택(회신 대기 제외, 개별 체크박스 isSelectable 와 정합).
  - **#3b**: `dispatchableCount` 루프에 `if (deriveRailState(q) !== "request_not_sent") continue;` 가드 → 발송 가능 = 요청 발송 전만(중복 발송/거짓 집계 차단). BatchActionBar의 "발송 가능 M·회신 대기 K" 분리 라벨이 자동 정확화.
- `__tests__/regression/quotes-header-bulk-state-351.test.ts`: sentinel(5).

## 검증 (vitest)
- quotes-header-bulk-state-351 → **5 tests passed**.

## Canonical truth 보존
- 견적 데이터·상태(canonical) 불변. 선택=UI state. 일괄 집계가 canonical 상태(request_not_sent) 기반으로 파생되도록 정정. 실 mutation(일괄 발송/리마인더/상태변경) wiring 무변경.

## Production effect
- 헤더에서 "초안 만들기" 사라짐(one-primary). Ctrl+A가 발송 대상만 선택 → "발송 가능 N"이 실제 발송 가능 수(회신 대기 제외). 회신 대기 중복 발송 위험 제거.

## Out of Scope (별도 — #2)
- **#2 선택 시 layout shift → 하단 고정 액션 바**: BatchActionBar가 현재 `sticky top-2` + in-flow(KPI 위) + in-flow 배너(2161) 가 KPI 밀어냄. 하단 고정 전환(fixed bottom) + 배너 제거 + 목록 bottom-padding + 모바일 safe-area = 공유 컴포넌트 + 우측 rail layout 상호작용 있는 리팩토링 → 형태 결정 후 별도 batch.

## ⚠️ 배포 주의
- 2개 파일 한 커밋. push 전 `git status` + Vercel green.

## Rollback path
- 헤더 버튼 2블록 복원 + Ctrl+A/dispatchableCount 가드 revert. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
