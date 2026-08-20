# §gate-script-silent-fail — 셸 게이트가 도구 실패를 "위반 0" 으로 통과시킨다

**등재 2026-08-19** · `583f72db` body 의 §11.298e silent fail 언급을 전수로 확대 측정

## 🔑 실증 — 존재하지 않는 경로를 줘도 통과한다

```
$ SRC_DIR="/nonexistent/path/xyz" bash scripts/check-no-native-select.sh
✅ No native <select> usage detected in /nonexistent/path/xyz/**
exit=0
```

**게이트가 아무것도 안 보고 GREEN 을 냈다.**

## 크기

```
scripts/check-*.sh          11개
`|| true` 형태 사용          8개
도구 실패(exit 2)를 0건과 가르는 스크립트   **0개**
```

전수 스캔(레포 전체 · ts/tsx/js/json/yml/sh/ps1): `|| true` 17건 · `2>/dev/null` 13건 = 30건.
게이트·테스트 경로에 29건.

## 구조

```sh
HITS=$(rg -n '<select\b' "$SRC_DIR" -t ts 2>/dev/null | grep -vE ':[[:space:]]*(//|\*)' || true)
if [ -n "$HITS" ]; then  … VIOLATIONS++ …  fi
```

세 겹으로 실패가 사라진다:

```
2>/dev/null   rg 에러 메시지 은폐
|| true       exit 1(0건 · 정상) 과 exit 2(도구 실패) 를 **같은 값으로** 만든다
[ -n "$HITS" ] 빈 문자열 → 위반 0 → 통과
```

🛑 `|| true` 자체는 결함이 아니다. `set -e` 아래에서 "매치 0" 이 스크립트를 죽이지 않게 하는
   정당한 관용구다. 결함은 **exit 1 과 exit 2 를 안 가르는 것**이다.

## 왜 지금 등재하나

`583f72db` body 가 §11.298e 의 `grep … || true` silent fail 을 스스로 지목하고 고쳤다.
그러나 고친 것은 **한 인스턴스의 증상**(`_workbench/search` 의 Radix import)이고
**패턴은 그대로**다. 같은 계열로 `data-table.tsx`(⑧-2)도 있었다 —
`application-wide grep 0` 이라는 문구가 두 번 거짓이었고 원인이 각각 달랐다(누락 · 인코딩).

→ **"application-wide 0" 을 보증한 셸 게이트의 결론은 전부 재확인 대상이다.**

## 🔑 공통 처방 — 개별 처방 3건보다 위에 있다

§11.298 계열을 오늘 세 번 만났다. **원인은 셋 다 다른데 결과는 하나**다:

```
누락        검증이 대상 파일을 목록에 안 넣었다        (§11.298e → data-table.tsx)
인코딩      검증이 파일을 읽었으나 매칭 불가였다        (UTF-16LE → utf8 로 읽어 ASCII 0)
exit code   검증이 도구 실패를 0건으로 읽었다          (|| true 가 exit 1 과 2 를 합침)
──────────────────────────────────────────────────────
결과        **검증이 아무것도 안 보고 통과했다**
```

원인별로 고치면 네 번째 원인에서 또 뚫린다. 결과 쪽을 막는다:

```
🔑 검증은 "대상에 닿았음" 을 **스스로 단언한다.**
   읽은 파일 수 > 0  ·  읽은 바이트 > 0  ·  매칭 시도 대상 > 0
```

셋 다 이 단언 하나에 걸린다 — 목록이 비어도, 내용이 안 읽혀도, 도구가 죽어도 RED 다.
같은 형태를 이미 쓰고 있다: `encoding-integrity` 의 `scanned > 2000`,
§11.279-holes 의 `PAGE.length > 100000`, 프로브의 `landed` 확인.
**흩어져 있던 것을 규칙으로 올린다.**

⚠️ 임계값은 "0 초과" 가 아니라 **실측값 근처**로 잡는다. 0 초과만 보면
   1,997개 중 3개만 읽어도 통과한다.

## 🔴 1개 수정 후 실측 — 예상보다 크다

`check-no-native-select.sh` 하나를 고치자 **두 가지가 즉시 드러났다.**

### ① 이 머신에 ripgrep 바이너리가 없다

```
Get-Command rg        →  실 바이너리 없음
bash -c "command -v rg" →  없음
내 대화형 셸의 rg      →  **셸 함수 shim**(에이전트 환경 주입) — 자식 셸이 못 본다
```

→ `scripts/check-*.sh` 중 **rg 사용 7개**는 이 머신에서 **한 번도 실제로 스캔한 적이 없다.**
  구 코드가 `2>/dev/null || true` 로 exit 127(command not found)을 삼키고
  `✅ 통과 · exit 0` 을 냈다.

```
로컬 pre-commit   check-no-inline-hex-bg.sh (rg 기반) → **매 커밋 공허 통과**
CI                labaxis-surface-guard.yml 가 inline-hex-bg + userinventory 실행
                  ubuntu-latest · ripgrep 명시 설치 없음
                  ⚠️ 러너 이미지에 포함되는 것으로 알지만 **실행해 확인한 것은 아니다**
```

🛑 카드 최초 등재 시 표현은 `GREEN 을 낼 수 있다` 였다. 실측 결과는 `그렇게 해 왔다` 다.

### ② 고치자 숨어 있던 위반 13건이 나왔다 — 다만 오탐 포함

```
13건 내역
  실 위반(.tsx 의 native <select>)   ~8건   MsdsBulkRegisterModal · receiving-desktop-list
                                            · batch-dispatch-sheet · batch-reminder-sheet
                                            · _workbench/search · protocol/bom · pricing · legal
                                            · settings/suppliers
  오탐 — 테스트 파일                  4건   not.toMatch(/<select/) 를 "사용" 으로 셌다
  오탐 — JSX 주석                     1건   {/* … native <select> 로 swap … */}
                                            필터가 줄머리 // · * 만 걸러 중간 주석을 못 본다
```

🛑 **이건 실패가 아니라 정상 작동이다.** 게이트가 처음으로 대상을 봤고,
   본 김에 자기 필터의 정밀도 부족까지 드러냈다. 두 항목은 갈라서 처리한다:

```
필터 정제   __tests__ 제외 + JSX 주석 처리          이 트랙(게이트 신뢰도)
실 위반 8건  §11.75 native <select> 금지 위반         **별건 트랙** — 제품 결함
```

### 프로브 4축 (러너 = bash · rg 함수 export 후)

```
① 정상 실행            → exit 1  실 위반 13건 검출          ✅ 검출
② 없는 경로            → exit 2  "스캔 대상 부족"           ✅ 도구 실패가 통과 안 됨
③ 위반 1건 주입        → exit 1  14건                       ✅ 증분 검출
④ 주입 원복            → exit 1  13건                       ✅ 바이트 복원
⑤ rg 부재(원래 상태)   → exit 2  "rg exit 127"              ✅ 구 코드는 여기서 exit 0 이었다
```

## 착수 시 처방 (구현 전 판정 필요)

```
① exit code 분기        rg: 0=매치 1=무매치 2=에러.  `|| [ $? -eq 1 ]` 로 2 만 실패시킨다
② 스캔 실증             대상 파일 수를 세고 0 이면 RED (vitest sentinel 의 '무의미 통과 방지'와 같은 축)
③ 2>/dev/null 제거      에러를 봐야 ①이 작동한다
🛑 8개를 한 번에 고치지 말 것 — 1개로 형태를 세우고 프로브(없는 경로 → RED)로 실증한 뒤 전개
```

## 관련

- `583f72db` §11.298f (silent fail 언급 · 인스턴스 수정)
- `f6277b9c` ⑧-2 data-table.tsx (같은 §11.298 계열 · 원인은 인코딩)
- 같은 형태: `CARD_suite-red-168.md` §범위 — 게이트가 신호이기를 멈추는 지점
