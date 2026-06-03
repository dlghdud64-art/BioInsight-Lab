# COMMIT — §11.356 Phase 2 (1) 298f app-wide 스캔 __tests__ 제외 (test-self 버그)

```
test(regression) §11.356 #298f-scan-exclude-tests — workbench-search-radix-298f import 스캔에 __tests__ 제외 추가 (false positive 제거, JSX 스캔과 정합)
```

## 분류: (b) 테스트 자체 오류
- §11.298f 의 "app-wide Radix dropdown-menu import 0" FS 스캔이 **import 검사 호출에서만 `__tests__` 제외를 누락**. 같은 파일의 JSX-사용 스캔(line 105~)은 `__tests__` 제외가 있음.
- 유일 매칭 = `src/__tests__/regression/dropdown-menu-dead-file-302a.test.ts` (테스트 파일이 단언 regex 안에 `from "@/components/ui/dropdown-menu"` 문자열을 포함) → **프로덕션 잔여 아님, false positive**.
- 프로덕션 코드의 Radix dropdown import 는 실제 0 (정상). 테스트 스캔 범위만 문제.

## Fix
- `__tests__/regression/workbench-search-radix-298f.test.ts`: import 스캔 `findFilesWithPattern(...)` 호출에 skip 인자 `["node_modules",".next",".git","dist",".turbo","__tests__"]` 추가 (JSX 스캔과 동일).

## 검증
- 298f → **6/6 passed** (이전 5/6, app-wide import 스캔 1건 실패였음).

## ⚠️ 작업 메모 (truncation 버그)
- Edit 툴이 이 작은 테스트 파일조차 끝을 truncate → `git show HEAD` 복원 후 **python 패치**로 정확히 적용. 멀티바이트 파일은 Edit 대신 python/bash 패치 권장.

## Out of Scope
- 다른 39개 실패 파일 분류·수정 (Phase 2 진행 중 — NOTE_11.356-phase2 참조).

## Rollback
- skip 인자 1개 제거. 독립.
```
footer 없음
```
