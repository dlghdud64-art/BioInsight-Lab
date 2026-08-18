# §suite-red-168 — 전체 스위트 상시 RED 168건 (백로그)

**등재 2026-08-17** · §receiving-detail-redesign 배치 중 실측 · 대기열

## 🛑 게이트가 빨간 상태가 상시면 RED 는 신호가 아니다

```
2026-08-17 실측 (프로젝트 vitest · dashboard + regression + design)
  배치 전 (aeb688bc)   44파일 168건 실패
  배치 후 (4b7eb82f)   44파일 168건 실패
  → 이번 배치가 만든 신규 실패 **0건**
```

**측정 방법**: `git checkout HEAD~1` 로 배치 이전 상태를 만들어 같은 명령을 돌렸다.
stash 가 아니라 커밋 대조를 쓴 이유 — 이 배치는 파일 삭제 2건을 포함해 stash 로는 상태가 안 맞는다.

⚠️ 이 카드는 **"168건이 무해하다" 는 뜻이 아니다.** 이번 배치와 무관하다는 것만 증명했다.
168건 각각이 실제 결함인지 sentinel 노후인지는 **미판정**이다.

## 왜 지금 등재하나

RED 168 이 상시면 새 RED 가 묻힌다. 오늘 배치에서 실제로 그 위험이 있었다 —
receiving 관련 RED 6건이 168건 속에 섞여 있었고, **파일명으로 걸러내지 않았으면 못 봤다.**

```
게이트가 잡아야 하는 것   이번 변경이 만든 회귀
게이트가 실제로 내는 것   상시 168 + 이번 변경분
→ 차이를 사람이 매번 손으로 걸러야 한다
```

## 범위 — 미측정

44파일의 성격을 안 갈랐다. 알려진 것만:

```
관련 백로그   project_full_suite_triage (메모리) — 실측 assertion 242/66 + collection 41 = 107파일
              "확정 B 0 · ai-pipeline 38건 test-resolution 전용" 이라고 적혀 있다
             → 이 168 과 같은 모집단인지 **대조 안 됨**
파일 계열     대부분 dashboard/quotes · regression. receiving 계열은 이번 배치로 0
```

## 착수 시 선행 판정

```
1  이 168 이 project_full_suite_triage 의 107파일과 같은 모집단인가
   같으면 그 카드에 합류 · 다르면 별건
2  분류 축 — 오늘 세운 3분류가 그대로 쓰인다
   (a) sentinel 낡음   구현이 진화, 검사가 안 따라옴  → 승계
   (b) 제품 결함       → 미이행 목록
   (c) 중복 보장       → 삭제
   + (d) 결정 은퇴     승인된 결정이 계약을 뒤집음   → 이력 보존 + 역방향 잠금 검토
3  🛑 삭제로 끝내지 말 것 — 오늘 두 번 겪었다. 근거(sha·사유)를 강제해야 재발이 막힌다
```

## 관련

- 측정 커밋 `4b7eb82f` (§receiving-detail-redesign P1~P3)
- 3분류 + (d) 근거: `DECISION_reorder-handoff-2026-08-15.md` §9 `§decision-retired`
- 오늘 승계 실례: `87642da5`(reorder-review-310 4건) · 이번 배치(quarantine 3건)
