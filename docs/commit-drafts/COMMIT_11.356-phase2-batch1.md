# COMMIT — §11.356 Phase 2 batch 1: sentinel 실패 (b) 3건 수정

```
test(regression) §11.356 #phase2-batch1 — sentinel false-positive 3건 정정 (298f 스캔범위 + 284a/284d §11.352 라벨 정합)
```

## 배경
- vitest 풀런 baseline = regression 166 files / 1738 tests, 40 files·71 tests 실패. 이번 batch = 그중 **(b) 테스트 자체 문제** 3건 정정. (a) 미구현 스펙은 별도 — NOTE_11.356-phase2-classification 참조.

## Fix (3 files, 테스트만)
- `workbench-search-radix-298f.test.ts` — **(b) FS스캔 범위 버그**. app-wide "Radix dropdown-menu import 0" 스캔의 import 검사 호출에 `__tests__` 제외 누락 → 테스트 파일(302a)의 단언 regex가 false positive. JSX 스캔과 동일하게 skip 인자 추가. (프로덕션 Radix import 실제 0 — 정상)
- `purchases-kpi-label-relabel-284a.test.ts` — **(b) §11.352 부수효과**. STATUS_MAP/KpiCard 라벨 단언이 옛 "발주 전환 대기" 강제 → §11.352 에서 "발주 인계 대기"로 rename 했으므로 정합(7곳).
- `purchases-base-whitelist-284d.test.ts` — **(b) §11.352 부수효과**. empty-state "발주 전환 대기 중인 건이 없습니다" → "발주 인계 대기..." 정합(2곳).

## 검증 (vitest)
- 3 files → **24 passed** (298f 6 + 284a 12 + 284d 6). 이전 각 1건 이상 실패.

## ⚠️ 작업 메모
- Edit 툴 truncation 재발 → **python/bash 패치로 적용**(멀티바이트 파일 Edit 회피). git show HEAD 복원 후 패치.

## 분류 결론 (batch 1 후, NOTE 참조)
- FS스캔 (b) 계열 = 298f 1건뿐(나머지 amber FS스캔 pass). **소진.**
- 잔여 ~37 = 대부분 **(a) 미구현 스펙 백로그**(색상 sweep·rename·wiring·toast 등). 테스트 일괄수정 불가 → 트랙별 (구현 vs 센티넬 은퇴) 결정.
- 세션 부수효과(§11.352)는 284a/284d로 정리 완료. 추가 세션-부수효과 없음.

## Out of Scope
- (a) 미구현 스펙 구현 — 각 트랙. (b) 외 코드 변경 0.

## Rollback
- 3개 테스트 파일 revert. 독립.
```
footer 없음
```
