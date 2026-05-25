# §11.303-hotfix Commit Message Draft (Vercel 빌드 ERROR CRLF hotfix)

```
fix(build): §11.303-hotfix #build-crlf — 2 fail file CRLF → LF 변환 (20 Vercel deployment 연속 ERROR 해결)

🚨 Critical:
§11.298 + §11.298c (2026-05-24) 이후 20 Vercel deployment 연속 ERROR
(§11.299 ~ §11.303c). production 배포 차단.

Build log error:
  ./src/app/dashboard/organizations/[id]/page.tsx:475-480
    x Unexpected token `div`. Expected jsx identifier
  ./src/app/settings/workspace/page.tsx:388-393
    x Unexpected token `div`. Expected jsx identifier
  > Build failed because of webpack errors

Root cause analysis:
1. Source code 자체는 정상 (JSX 구조 valid)
2. SWC parser 의 line tracking 오류 (line 480/393 duplicate 보고)
3. cat -A 검증 결과: line endings 가 `^M$` = CRLF (Windows \r\n)
4. CRLF lines count:
   - organizations/[id]/page.tsx: 1676 CRLF
   - settings/workspace/page.tsx: 779 CRLF
5. SWC 가 JSX 안 `\r` 을 invisible character 으로 인식 → line 꼬임
   + Unexpected token. 한글 (UTF-8 multi-byte) + 깊은 nesting
   조합에서 특히 fail.

호영님 환경 (Windows) git 자동 변환 (core.autocrlf=true) 으로 file
저장 시 CRLF 변환. §11.298 / §11.298c swap commit 이 최초 노출.

Fix (2 file CRLF → LF + 1 NEW sentinel test):

- apps/web/src/app/dashboard/organizations/[id]/page.tsx:
  · tr -d '\r' 으로 1676 CRLF → 0 LF 변환
  · JSX / TypeScript 구조 변경 0

- apps/web/src/app/settings/workspace/page.tsx:
  · tr -d '\r' 으로 779 CRLF → 0 LF 변환
  · JSX / TypeScript 구조 변경 0

- apps/web/src/__tests__/regression/build-hotfix-crlf-303hotfix.test.ts
  (NEW, 6 it × 2 nested describe):
  · §11.303-hotfix trace (self-referential)
  · 2 file CRLF 0 회귀 차단 (Buffer 직접 0x0d count)
  · 핵심 JSX 구조 보존 (return / 헤더 comment / MainHeader)
  · §11.298c ActionMenu + §11.298 plain swap trace 보존

canonical truth 보존 (회귀 0):
- JSX 구조 / props / handler / state 변경 0 (line ending 만 swap)
- §11.298 / §11.298c swap 결과 그대로 보존
- ActionMenu shared component 사용 보존
- 다른 1849 CRLF file 은 그대로 (별도 batch 권장 — 정상 빌드 중)

호영님 production effect:
1. 다음 Vercel deployment SUCCESS (20 연속 ERROR 종결)
2. 모든 §11.299 ~ §11.303c batch 의 production 반영
3. /dashboard/organizations/[id] + /settings/workspace 정상 렌더

§11.303-hotfix 후속 (별도 batch, 권장):
- §11.303-hotfix-b: apps/web/src 전체 1849 CRLF file LF normalize
  (대량 변경, scope 크지만 정상 빌드 중이라 P2)
- §11.303-hotfix-c: .gitattributes 추가 (`* text=auto eol=lf`)
  Windows 환경에서 자동 변환 차단 (호영님 환경 영구 fix)
- §11.303-hotfix-d: pre-commit hook CRLF 차단 (husky)

Out of Scope:
- 1849 다른 CRLF file (정상 빌드 중 — normalize 별도)
- .gitattributes (별도 batch)
- §11.303d ENTERPRISE_INFO 통합 (보류, 호영님 결정 권장안 A)

Rollback path: git revert <SHA>
- 2 file CRLF 복원 → 빌드 fail 회귀

Lessons:
1. CRLF + JSX + 한글 multi-byte = SWC parser fail. SWC 가 `\r` 을
   line counting 시 invisible character 으로 인식 → line tracking
   꼬임 + Unexpected token false positive.
2. error log 의 line number duplicate (480/480, 393/393) = CRLF
   diagnostic 시그널. 향후 동일 패턴 발견 시 즉시 cat -A 검증.
3. 호영님 Windows 환경 core.autocrlf=true 권장. 또는 repo level
   .gitattributes 강제 (별도 batch §11.303-hotfix-c).
4. 1849 file CRLF + 정상 빌드 = SWC 가 보통 CRLF 처리 OK, 특정
   패턴 (JSX nesting + 한글) 만 fail. 전체 normalize 없이 fail file
   만 hotfix 가능.
5. 빌드 audit 즉시 진행 — 호영님 push 후 Vercel 결과 확인 습관
   (§11.292c 이후 두 번째 빌드 hotfix).
6. Karpathy minimum-diff — 2 file CRLF→LF + 1 NEW test (6 it).
```

## Push

```bash
git add apps/web/src/app/dashboard/organizations/\[id\]/page.tsx \
        apps/web/src/app/settings/workspace/page.tsx \
        apps/web/src/__tests__/regression/build-hotfix-crlf-303hotfix.test.ts \
        docs/commit-drafts/COMMIT_11.303-hotfix-crlf.md

git commit -F docs/commit-drafts/COMMIT_11.303-hotfix-crlf.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인 (20 연속 ERROR 종결)
2. labaxis.co.kr/dashboard/organizations/[organizationId] 정상 렌더
3. labaxis.co.kr/settings/workspace 정상 렌더
4. §11.299 ~ §11.303c 의 모든 batch 변경 production 반영 확인:
   - 활동 로그 한글화 (§11.299)
   - audit 페이지 cleanup (§11.300)
   - Radix dropdown 전부 plain (§11.298 family)
   - 재고 KPI 신호등 (§11.302c-3)
   - dead file cleanup (§11.302a/b/e-1)
   - 플랜 페이지 Credit 제거 (§11.303 + §11.303c)
5. `git ls-files --eol` 또는 `file <path>` 으로 LF 확인:
   - organizations/[id]/page.tsx → "LF terminators"
   - settings/workspace/page.tsx → "LF terminators"

## 후속 batch (호영님 결정)

| § | scope | 우선도 |
|---|---|---|
| §11.303-hotfix-b | 1849 file CRLF normalize (전체) | P2 (정상 빌드 중) |
| §11.303-hotfix-c | .gitattributes 추가 + Windows 자동 변환 차단 | P1 권장 (재발 차단) |
| §11.303-hotfix-d | pre-commit hook CRLF 차단 (husky) | P2 |
| §11.303d | ENTERPRISE_INFO 통합 (보류, A 결정) | 보류 |
| 새 P0/P1 | 호영님 다른 지시 | — |
