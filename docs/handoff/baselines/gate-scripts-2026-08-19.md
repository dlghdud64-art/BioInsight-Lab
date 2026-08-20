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
