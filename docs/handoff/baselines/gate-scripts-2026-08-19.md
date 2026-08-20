# 게이트 스크립트 기준선 — ripgrep 설치 직후 (2026-08-19)

**목적**: 숨어 있던 위반이 무엇이었는지 **고치기 전에** 고정한다.
기준선 없이 고치기 시작하면 무엇이 숨어 있었는지가 영원히 사라진다.
(⑧-2 에서 UTF-8 변환 후 실사한 것과 같은 형태)

## 환경

```
설치        winget · BurntSushi.ripgrep.MSVC · ripgrep 15.2.0
바이너리     %LOCALAPPDATA%\Microsoft\WinGet\Packages\BurntSushi.ripgrep.MSVC_…\rg.exe
설치 전 상태  실 바이너리 0 — 에이전트 셸의 rg 는 함수 shim 이라 자식 셸이 못 봤다
             → rg 기반 check 스크립트 7개가 exit 127 을 삼키고 공허 통과
HEAD        44cb99a7
```

## 기준선

| 스크립트 | exit | ⛔ | 비고 |
|---|---|---|---|
| check-no-native-select | **1** | **13** | exit code 분기 적용본. 실 위반 ~8 + 오탐 5(테스트 4·JSX 주석 1) |
| check-no-inline-hex-bg | **1** | **1** | 🆕 미수정본인데도 위반 검출 — rg 가 생기자 처음으로 실제 스캔 |
| check-no-userinventory-usage | 0 | 0 | |
| check-no-tailwind-dark-class | 0 | 0 | |
| check-csrf-fetch-regression | 0 | 0 | 🛑 **공허 0 이다.** lookbehind 가 rg 기본 엔진 미지원(parse error)인데 `\|\| true` 가 삼킨다. `-P` 필요 |
| check-api-orphan-caller | ⏳ | — | rg 가 생기자 **10분 초과** — 이전엔 즉시 끝났다(아무것도 안 해서) |
| check-api-surface-coverage | ⏳ | — | 동상 |

🛑 **`0건` 이 두 종류다.** userinventory·tailwind-dark 는 진짜 0 이고,
   csrf 는 **검증 자체가 실패한 0** 이다. 표에서 둘을 갈라 적는다 —
   합쳐 적으면 이 카드가 silent-fail 을 그대로 재생산한다.

## 기준선 완성 (7/7) + 🛑 러너 기준 정정

```
스크립트                        로컬 exit   ⛔    CI 조건에서
check-no-native-select              1      13    동일 (rg 있으면 1 · 없으면 2)
check-no-inline-hex-bg              1       1    동일 — BLOCK 게이팅 없음(무조건 exit 1)
check-no-userinventory-usage        0       0    동일
check-no-tailwind-dark-class        0       0    동일 (BLOCK=1 이어도 0건이라 0)
check-csrf-fetch-regression         0       0    🛑 공허 0 (lookbehind parse error 를 || true 가 삼킴)
check-api-surface-coverage          0       8    **advisory** — CI 도 env 미설정이라 exit 0
check-api-orphan-caller             0       5    🛑 **CI 는 exit 1** ← 아래
```

🛑 **orphan-caller 는 내 로컬 측정과 CI 조건이 다르다.**
```
로컬 실행    env 없음 → "(advisory mode …)" → exit 0
CI 워크플로   env: LABAXIS_API_ORPHAN_CALLER_BLOCK: "1"  → exit 1
스크립트 L149  if [ "${LABAXIS_API_ORPHAN_CALLER_BLOCK:-0}" = "1" ]; then exit 1
```
   스텝 이름이 `(block)` 인데 로컬 기본값은 advisory 라 **같은 스크립트가 두 결과를 낸다.**
   CLAUDE.md §"러너 기준을 병기한다" 가 여기 그대로 적용된다 — 축 없는 수치는 수치가 아니다.

## 🧭 CI 상태 — 두 갈래 (실행 로그 미확인)

CI 스텝은 **순차 실행이고 첫 실패에서 멈춘다.** 1번이 inline-hex-bg 다.

```
가드 CI 등록      2026-04-28
inline-hex 위반   2026-07-22  budget/page.tsx:350  style={{ background: "#f0fdf4" }}
                  (e2c195f4 §mobile-budgets P1–P4)
```

```
(A) CI 에 rg 가 있다   → 2026-07-22 부터 **약 4주간 CI RED** 였어야 한다.
                        그렇다면 내 변경은 원인이 아니다 — 이미 빨갰다.
(B) CI 에 rg 가 없다   → 1·2번이 공허 통과하고 **3번(내 수정본)이 첫 실패**가 된다.
                        그렇다면 CI 를 빨갛게 만든 것은 내 변경이다.
```

🛑 **어느 쪽인지는 실행 로그를 봐야 갈린다. gh 미설치로 미측정이다.**
   (A)가 맞다면 "CI 가 4주간 빨간 채로 아무도 안 봤다" 는 별개의 큰 사실이 된다.

## 즉시 수정 금지

이 기준선을 남기는 것이 이번 단계의 산출이다. 위반 처리는 다음 단계다:

```
1  필터 정제      게이트가 무엇을 세는가 — 전후 목록 diff + 오탐 근거 필수
2  실 위반 처리   §11.75 native <select> 8건 + inline-hex 1건 — **제품 트랙**
3  나머지 스크립트 형태 A 3개 · csrf(분기+`-P` 둘 다) · B·C
```

## ⏱ 시한부 조건 (호영님 2026-08-19)

CI 가 RED 인 상태를 오래 두면 **그 자체가 신호를 죽인다.**
"항상 빨간 체크" 는 아무도 안 보는 체크가 된다 — 오늘 242 RED 가 정확히 그 상태였다.
→ 위 1·2 를 **다음 작업으로 못 박는다.** 3보다 앞이다.
