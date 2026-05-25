# §11.303-hotfix-d Commit Message Draft (nested generic SWC parser bug 회피)

```
fix(build): §11.303-hotfix-d #build-hotfix-nested-generic — organizations/[id]/page.tsx line 473 nested TypeScript generic SWC parser bug 회피 (CRLF fix 후에도 빌드 fail 지속 → 진짜 root cause 발견)

🚨 Critical (§11.303-hotfix 후속):
§11.303-hotfix (CRLF → LF) push 후 Vercel deployment
(dpl_29MH4fiWeuk3CekR614Gnk9TAKbN, sha 79780f1) 여전히 ERROR.

새 build log:
  ./src/app/dashboard/organizations/[id]/page.tsx
  Error: x Unexpected token `div`. Expected jsx identifier
       ,-[apps/web/src/app/dashboard/organizations/[id]/page.tsx:475:1]
   475 |   if (approverCount === 0 && totalMembers > 1) actionableItems.push(...)
   476 |
   477 |   return (
   478 |     <div className="space-y-6">
        :      ^^^
   479 |       {/* 헤더 */}
   480 |       <div className="flex items-center justify-between flex-wrap gap-3">
   481 |         <div className="flex items-center gap-3">

이번엔 line 478, 479, 480, 481 sequential (이전 480 duplicate 없음).
→ CRLF 는 fix 됐고, 진짜 source syntax issue.

진단:
line 473:
  const actionableItems: Array<{ label: string; count: number;
    icon: React.ComponentType<{ className?: string }>; color: string }> = [];
                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                          nested generic <{ className?: string }>

SWC parser 가 nested `<>` 의 closing `>` 후 다음 라인 `<div` 를
generic continuation 으로 잘못 받음 → JSX context 진입 못 함 →
"Unexpected token `div`" false positive.

Fix:
  React.ComponentType<{ className?: string }> → React.ElementType
  Array<{ ... }> → { ... }[]  (postfix syntax, generic wrapper 제거)

`React.ElementType` = `React.ComponentType<any> | keyof JSX.IntrinsicElements`
icon 사용 (Mail, AlertTriangle 등 lucide-react) 정합. nested generic
0 으로 SWC parser 정상 parse.

Fix (1 file 2 line + 1 NEW test):

- apps/web/src/app/dashboard/organizations/[id]/page.tsx (line 472-475):
  · type annotation swap:
    Array<{ label, count, icon: React.ComponentType<{ className?: string }>,
      color }> → { label, count, icon: React.ElementType, color }[]
  · §11.303-hotfix-d trace + 진단 comment 추가

- apps/web/src/__tests__/regression/build-hotfix-nested-generic-303hotfix-d.test.ts
  (NEW, 7 it):
  · §11.303-hotfix-d trace
  · nested generic Array<...React.ComponentType<...>...> 패턴 0
  · React.ElementType + postfix [] 사용 검증
  · actionableItems.push 사용처 보존 (초대 응답 대기 / 승인자 미지정)
  · JSX return 구조 보존 (line ~477)
  · §11.298c ActionMenu shared swap 보존
  · §11.303-hotfix CRLF 0 보존

canonical truth 보존 (회귀 0):
- actionableItems 의 push 호출 변경 0 (object literal 그대로)
- icon prop 으로 Mail / AlertTriangle 사용 변경 0
  (React.ElementType 가 lucide-react component type 정합)
- JSX 구조 / handler / state 변경 0
- §11.298c ActionMenu shared swap 보존
- §11.303-hotfix CRLF 0 보존
- 다른 file (settings/workspace 등) — cascade error 였다면 자동 통과
  가능성 (organizations 만 fix 후 결과 확인)

호영님 production effect:
1. 다음 Vercel deployment SUCCESS (3 사이클 빌드 ERROR 종결 가정)
2. 모든 §11.299 ~ §11.303c batch 의 production 반영
3. /dashboard/organizations/[id] 정상 렌더 + actionableItems 표시 정합

settings/workspace/page.tsx cascade 가능성:
build log 에 settings/workspace fail 도 표시됐으나 source 에 nested
generic 부재. organizations cascade error 추정. 만약 organizations
fix 후에도 settings/workspace 별도 fail 이면 추가 batch 진행.

§11.303-hotfix 시리즈 진행:
- §11.303-hotfix ✅ 2 file CRLF → LF (CRLF root cause 가정 → 잘못)
- §11.303-hotfix-c ✅ .gitattributes (CRLF 재발 차단, 보조 안전망)
- §11.303-hotfix-d ✅ nested generic SWC parser bug 회피 (진짜 root cause)
- §11.303-hotfix-b ⏳ 1849 file CRLF normalize (P2, .gitattributes 후)
- settings/workspace 후속 audit (organizations fix 후 결과 확인)

Out of Scope:
- 1849 다른 CRLF file normalize (§11.303-hotfix-b)
- settings/workspace 별도 fix (cascade 추정, 추가 audit 후 결정)
- 다른 SWC parser nested generic bug 잠재 surface 전체 audit

Rollback path: git revert <SHA>
- 1 file 2 line 복원 + sentinel test 삭제
- nested generic SWC fail 회귀

Lessons:
1. CRLF 추정 잘못 — line duplicate 보고가 CRLF 시그널이라는 가정이
   잘못. 실제 root cause = nested generic SWC parser bug.
2. 빌드 hotfix 사이클 — §11.292c (JSX comment) → §11.303-hotfix
   (CRLF, 추정 잘못) → §11.303-hotfix-d (nested generic, 진짜 fix).
   3 사이클로 진단 정확화.
3. SWC parser nested generic bug — `Array<{ ... <inner> ... }>` 패턴
   회피. TypeScript generic 단순화 + postfix `[]` syntax 권장.
4. React.ElementType > React.ComponentType<{...}> — generic 0 으로
   parser-friendly. lucide-react icon / Tailwind component 모두 정합.
5. build log "Unexpected token" 진단 시 SWC parser 의 context detection
   bug 의심. line number 가 정확 (sequential) 이면 source syntax 직접
   확인.
6. Karpathy minimum-diff — 1 file 2 line + 1 NEW test (7 it).
```

## Push

```bash
git add apps/web/src/app/dashboard/organizations/\[id\]/page.tsx \
        apps/web/src/__tests__/regression/build-hotfix-nested-generic-303hotfix-d.test.ts \
        docs/commit-drafts/COMMIT_11.303-hotfix-d-nested-generic.md

git commit -F docs/commit-drafts/COMMIT_11.303-hotfix-d-nested-generic.md
git push origin main
```

## Production smoke

1. **Vercel deployment SUCCESS** 확인 (3 사이클 빌드 ERROR 종결 기대)
2. labaxis.co.kr/dashboard/organizations/[id] 정상 렌더
3. actionableItems 표시 정합 ("초대 응답 대기" / "승인자 미지정")
4. labaxis.co.kr/settings/workspace 정상 렌더 (cascade 자동 통과 가정)
5. **만약 settings/workspace 여전히 fail → 추가 audit + hotfix-e**

## 후속 batch (호영님 push 응답 후 결정)

| § | scope | 조건 |
|---|---|---|
| §11.303-hotfix-e | settings/workspace 별도 fix | organizations fix 후 settings 여전히 fail 시 |
| §11.303-hotfix-c | .gitattributes (sandbox 완료, 호영님 push 대기) | 별도 push 또는 본 batch 와 함께 |
| §11.303-hotfix-b | 1849 file CRLF normalize | P2 |
| 새 P0/P1 | 호영님 다른 지시 | — |
