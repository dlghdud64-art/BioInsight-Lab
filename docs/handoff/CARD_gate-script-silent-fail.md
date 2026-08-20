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

### 프로브 6축 (러너 = bash · rg 함수 export 후)

🛑 **⑥은 1차 프로브에서 빠져 있었다.** 레포에 실 위반 13건이 있어 정상 실행으로는
   "위반 0 → GREEN" 을 잴 수 없었고, 그래서 **안 쟀다.**
   → 패턴만 절대 없는 토큰으로 바꿔 0건 상황을 만들어 실증했다(경로·파일수는 그대로).
   검출 축만 재고 오탐 축을 못 재면, 임계를 잘못 잡아 **정상 상태를 영구 RED** 로 만들 수 있다.

   🛑 **두 겹으로 본다. ②가 더 위험하다.**
   ```
   ① 못 잰다는 판단이 틀렸다      방법이 있었다(패턴만 바꾸기) — 실력의 문제
   ② 못 잰다고 판단했으면 **보고**했어야 한다   조용히 빠뜨렸다 — 보고의 문제
   ```
   ①은 다음 사람이 고칠 수 있다. ②는 **축이 있었다는 사실 자체가 사라진다.**
   못 재는 축은 "못 쟀음" 으로 보고하면 같이 방법을 찾을 수 있다.
   이번엔 스스로 잡았지만 그건 운이다 — 규칙으로 만들 수 없는 종류의 운이다.
   후보 ⑩(재조준을 검출만으로 검증하지 않는다)과 같은 자리다.

```
① 정상 실행            → exit 1  실 위반 13건 검출          ✅ 검출
② 없는 경로            → exit 2  "스캔 대상 부족"           ✅ 도구 실패가 통과 안 됨
③ 위반 1건 주입        → exit 1  14건                       ✅ 증분 검출
④ 주입 원복            → exit 1  13건                       ✅ 바이트 복원
⑤ rg 부재(원래 상태)   → exit 2  "rg exit 127"              ✅ 구 코드는 여기서 exit 0 이었다
⑥ 위반 0 → GREEN      → exit 0  "✅ No native <select>"    ✅ **오탐 0** — 정당한 0건이 막히지 않는다
```

## 🛑 정정 (2026-08-19) — CI 배선 보고가 틀렸다

`2007d9a6` 커밋 body 에 이렇게 적었다:

> 이 스크립트는 훅·CI 어디에도 배선돼 있지 않다 … 따라서 exit 1 이 다른 흐름을 막지 않는다.

**거짓이다.** `labaxis-surface-guard.yml` 이 **check 스크립트 7개를 전부 실행**하고
`check-no-native-select.sh` 는 3번째 **block 스텝**이다(continue-on-error 없음).

🛑 **원인 — 내 측정을 내가 잘랐다.** workflows 디렉터리 grep 결과를 `head -5` 로 잘라
   앞 5줄만 보고 "그것 + userinventory" 로 결론지었다. 6번째 줄부터가 native-select 였다.
   후보 ④(요약이 원문을 이김)의 **자기 버전**이다 — 남이 쓴 요약도 아니고
   **내가 방금 만든 절단본**을 근거로 삼았다.

### 결과 — CI 가 지금 RED 일 수 있다

```
구 코드   rg 부재 → exit 127 삼킴 → exit 0 (공허 통과)
신 코드   rg 부재 → exit 2   ·   rg 존재 → exit 1 (위반 13건)
→ 어느 쪽이든 이 스텝은 이제 실패한다
```

⚠️ Vercel 배포는 Actions 와 독립이라 **배포는 안 막힌다.** 막히는 것은 GitHub Actions 체크다.

### CI 도 원래 공허했다는 정황

```
native-select 가드 CI 등록   2026-04-28  (block 전환 04-29)
위반 도입 시점               06-17 legal · 06-27 pricing · 07-08 receiving-desktop-list
```
가드가 먼저 있었고 위반이 나중에 들어왔다. CI 에 rg 가 있었다면 **6/17 부터 두 달간 RED** 였어야 한다.
활발히 push 되는 레포에서 성립하기 어렵다 → CI 스텝도 공허 통과 중이었을 가능성이 높다.
🛑 **정황이지 측정이 아니다.** gh 미설치로 실행 로그를 못 봤다.

## 📐 순서 판정 (2026-08-19) — **ripgrep 판단이 먼저다**

질문: rg 부재/버전이 나머지 6개의 exit code 분기 **형태**에 영향을 주는가 → **준다. 두 층에서.**

### 층 1 — 부재: 8개 전부에 걸린다
rg 바이너리가 없으면 전 스크립트가 exit 127 이다. 분기를 넣으면 **8개가 동시에 RED** 가 된다.
고쳐도 이 환경에서는 아무것도 검증하지 못한다.

### 층 2 — 엔진 종류: 개별 스크립트의 수정 **내용**이 달라진다
```
check-csrf-fetch-regression.sh L60
  rg -n '(?<!csrf)fetchs*(' …
실측  rg: regex parse error  (?:(?<!csrf)fetch…)  · exit 2
      rg 기본 엔진(Rust regex)은 lookbehind 미지원. -P(PCRE2) 필요.
      -P 를 붙이면 exit 0 · 정상 동작 확인.
```
🛑 **이 스크립트는 rg 가 설치돼 있었어도 검증을 한 적이 없다.** `|| true` 가 파싱 오류를 삼켰다.
   exit code 분기만 넣으면 RED 가 뜨고, 그 RED 를 없애려면 `-P` 추가가 필요하다 —
   즉 수정이 "분기 추가" 하나로 안 끝난다.

### 형태가 균일하지 않다 — 3축
```
A 단일 rg + 필터        no-native-select(수정 완료) · no-tailwind-dark · no-userinventory
                        · no-inline-hex(스캔 2회)      → 같은 형태로 전개 가능
B per-file rg -q 루프    api-surface-coverage           → 닿았음 단언 위치가 다르다
C mktemp 다단계          api-orphan-caller · api-surface-coverage
                        → 중간 산출물(TEMP_*) 크기도 닿았음 단언 대상이다
```

**→ 순서: ripgrep 판단 → (설치 시) 형태 A 4개 배치 → B·C 개별 → 필터 정제**
   🛑 각 스크립트의 닿았음 임계는 **개별 실측**이다. `3000` 을 복사하면 그게 이번 발견의 재생산이다.

## 🧪 필터 정제 — 제품 트랙과 섞지 않는다

```
필터 정제   게이트가 **무엇을 세는가**        (이 트랙)
§11.75 8건  세어진 것을 **고치는가**          (제품 트랙)
```

정제하다 위반 수가 줄면 그게 **필터 개선인지 위반 해소인지 구분이 안 된다.**

```
🛑 정제 전후로 위반 목록을 파일로 남기고 diff 로 대조한다.
   빠진 건마다 "오탐이었다" 의 근거를 남긴다(테스트 파일 / JSX 중간 주석 / …).
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
