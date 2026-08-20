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
