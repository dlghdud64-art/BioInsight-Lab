# §11.303-hotfix-c Commit Message Draft (.gitattributes CRLF 영구 차단)

```
chore(repo): §11.303-hotfix-c #gitattributes-eol — .gitattributes 추가 + LF normalize 강제 (호영님 Windows 환경 CRLF 재발 영구 차단)

§11.303-hotfix (2 file CRLF → LF) 후속:
§11.298/§11.298c 의 CRLF 가 §11.303-hotfix 으로 2 file fix 됐지만,
호영님 Windows core.autocrlf=true 환경에서 새 commit 시 CRLF 재발
가능. .gitattributes 으로 repo level 자동 LF 변환 강제 — Windows
환경 영구 차단.

근본 원인 분석:
1. 호영님 Windows git config: core.autocrlf=true (Windows 기본)
2. git checkout 시 LF → CRLF 자동 변환
3. git add 시 CRLF → LF 변환 (정상)
4. 그러나 일부 파일이 CRLF 으로 staged + committed (autocrlf 가 binary
   파일로 오인하거나, .gitattributes 부재 시 누락)
5. Vercel build (Linux) 에서 SWC parser 가 JSX 안 `\r` 을 invisible
   character 으로 인식 → "Unexpected token `div`" false positive

.gitattributes 효과:
1. `* text=auto eol=lf` — 모든 text 파일 자동 LF (working tree + repo)
2. extension 별 strict LF — *.tsx / *.ts / *.json / *.md / *.prisma 등
3. *.bat / *.cmd / *.ps1 만 CRLF (Windows-specific 정합)
4. binary file 명시 — line ending conversion 제외 (*.png / *.woff2 / *.pdf 등)
5. git config core.autocrlf 값과 무관하게 repo level 강제

Fix (1 file 신규 + 1 NEW test):

- .gitattributes (NEW, repo root):
  · `* text=auto eol=lf` default rule
  · 16 source extension strict LF (*.ts/.tsx/.js/.jsx/.mjs/.cjs/
    .json/.md/.mdx/.css/.scss/.html/.yaml/.yml/.prisma/.sh/.env*)
  · .gitignore / .gitattributes 자체도 LF
  · 3 Windows-specific extension CRLF (*.bat / *.cmd / *.ps1)
  · 16 binary extension (*.png/.jpg/.jpeg/.gif/.ico/.webp/.svg/.pdf
    /.zip/.tar/.gz/.woff/.woff2/.ttf/.otf/.eot/.mp4/.webm/.mov)
  · §11.303-hotfix-c trace + 배경 + reference link

- apps/web/src/__tests__/regression/gitattributes-eol-303hotfix-c.test.ts
  (NEW, 7 it × 1 nested describe):
  · §11.303-hotfix-c trace (self-referential)
  · .gitattributes file 존재 검증
  · default rule + 4 extension category (source / config / Windows /
    binary) 정합 검증

canonical truth 보존 (회귀 0):
- 기존 file 의 line ending 변경 0 (gitattributes 는 다음 checkout /
  commit 부터 적용)
- 호영님 환경 git config 강제 변경 0 (repo level 만 영향)
- 기존 1849 CRLF file 은 그대로 (별도 normalize batch §11.303-hotfix-b
  후보 — 정상 빌드 중이라 P2)
- .gitignore / package.json / tsconfig / 다른 config file 변경 0

호영님 production effect:
1. 다음 git checkout (호영님 환경) 시 자동 LF 변환
2. 다음 commit 시 새 file 자동 LF (CRLF 재발 차단)
3. 기존 file CRLF 유지 (정상 빌드 중) — touch / re-save 시 LF 변환

§11.303-hotfix 시리즈 진행:
- §11.303-hotfix ✅ 2 file CRLF → LF (Vercel ERROR 해결)
- §11.303-hotfix-c ✅ .gitattributes 추가 (재발 차단, 본 batch)
- §11.303-hotfix-b ⏳ 1849 file CRLF normalize (P2, 정상 빌드 중)
- §11.303-hotfix-d ⏳ pre-commit hook CRLF 차단 (husky, P2)

Out of Scope (별도 batch):
- 1849 다른 CRLF file normalize (§11.303-hotfix-b)
- pre-commit husky hook (§11.303-hotfix-d)
- 호영님 환경 git config core.autocrlf 변경 (호영님 직접 — repo level
  .gitattributes 가 이미 강제하므로 불필요)

Rollback path: git revert <SHA>
- .gitattributes file 삭제 → 다음 commit 부터 자동 변환 0
- sentinel test 삭제

Lessons:
1. CRLF 재발 차단 = .gitattributes repo level 강제. 호영님 환경
   git config 의존하지 않음.
2. extension 별 strict 정의 = "auto" 모호함 차단. SWC / Next.js
   특정 patten 의 false positive 차단.
3. .bat / .cmd / .ps1 만 CRLF — Windows shell 정합.
4. binary file 명시 — git 이 text 으로 오인하여 corrupt 시키는
   위험 차단 (특히 .png / .pdf / .woff2).
5. §11.292c (JSX comment SWC fail) + §11.303-hotfix (CRLF SWC fail)
   + §11.303-hotfix-c (.gitattributes) = 빌드 fail 패턴 3 사이클.
   호영님 push 후 Vercel 결과 자동 확인 습관 권장.
6. Karpathy minimum-diff — 1 file 신규 + 1 NEW test (7 it).
```

## Push

```bash
git add .gitattributes \
        apps/web/src/__tests__/regression/gitattributes-eol-303hotfix-c.test.ts \
        docs/commit-drafts/COMMIT_11.303-hotfix-c-gitattributes.md

git commit -F docs/commit-drafts/COMMIT_11.303-hotfix-c-gitattributes.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인 (§11.303-hotfix 와 결합 효과)
2. 호영님 환경에서 새 file 저장 + git add 후 `git ls-files --eol` 으로
   eol=lf 확인
3. 기존 file 재저장 시 자동 LF 변환 확인 (호영님 환경)
4. `cat -A` 으로 CRLF 부재 검증 (touch 한 file)

## 호영님 환경 후속 조치 (권장)

```bash
# 호영님 Windows 환경에서 — repo 전체 normalize (한 번만):
git add --renormalize .
git commit -m "chore: §11.303-hotfix-b normalize all line endings"
git push origin main

# 효과: 기존 1849 CRLF file 모두 LF 변환. 변경 line 0 (line ending만).
```

이 step 은 §11.303-hotfix-b 별도 batch — 호영님 결정 후 진행.

## 후속 batch (호영님 결정)

| § | scope | 우선도 |
|---|---|---|
| §11.303-hotfix-b | 1849 file CRLF normalize (`git add --renormalize`) | P2 (정상 빌드 중, 정리만) |
| §11.303-hotfix-d | husky pre-commit hook CRLF 차단 | P2 (백업 안전망) |
| §11.303d | ENTERPRISE_INFO 통합 (보류, A 결정) | 보류 |
| 새 P0/P1 | 호영님 다른 지시 | — |
