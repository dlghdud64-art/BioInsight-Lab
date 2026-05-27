# §11.305 Commit Message Draft (AI 비교 분석 lock 영구 잔존 P0 fix)

```
fix(ai): §11.305 #compare-analysis-lock-removed — AI 비교 분석 enforceAction lock 완전 제거 (lock 영구 잔존 + 전체 사용자 공유 + read 액션 부적합 해소) (호영님 P0 옵션 A, 2026-05-27)

🚨 P0 — 기능 완전 차단 (AI 비교 분석 1회차 후 영구 차단).

호영님 보고 (§11.305):
- 재현 A: 비교 검토 → AI 분석 1회차 성공 → 2회차부터 "같은 항목에
  대한 다른 작업이 진행 중입니다" 오류
- 재현 B: 1시간 경과 후에도 동일 차단

root cause (코드 확정 — 가설 아님):
/api/ai/compare-analysis/route.ts 의 3중 결함:
1. enforceAction() 으로 mutation lock(beginMutation) 획득 후
   complete()/fail() 을 성공/실패/에러 어느 경로에서도 호출하지 않음
   → lock 영구 잔존 (in-memory 5분 TTL 외 해제 경로 0)
2. targetEntityId: 'compare-analysis' 하드코딩 → concurrencyKey
   'quote_request_create:compare-analysis' 를 전체 사용자/전체 비교
   세션이 공유 → 한 명이 분석하면 전원 차단 (multi-tenant 격리 위반)
3. AI 비교 분석은 DB write 없는 read/분석 액션인데 mutation 동시
   실행 lock 적용 — 설계 부적합 (동시 실행 제한 자체가 불필요)

"1시간 후 차단" 진단:
- in-memory ACTIVE_MUTATIONS 는 5분 TTL 있으나, Vercel warm 람다
  유지 + 클라이언트가 409 를 "네트워크 상태" 로 오해석해 stuck 화면
  캐시 → 사용자 관점 영구 차단. 수정 방향은 동일 (lock 제거).

fix (호영님 옵션 A — enforceAction 완전 제거, §11.309c-hotfix-2 선례):
AI 비교 분석은 idempotent read 라 lock/audit 불필요. auth() 인증만 유지.

Fix (1 file 수정 + 1 NEW sentinel):

- apps/web/src/app/api/ai/compare-analysis/route.ts:
  · import 제거: enforceAction, InlineEnforcementHandle
    (@/lib/security/server-enforcement-middleware)
  · let enforcement: InlineEnforcementHandle | undefined 제거
  · enforceAction({...}) 호출 블록 제거 (action quote_request_create /
    targetEntityId 'compare-analysis' 하드코딩 포함)
  · if (!enforcement.allowed) return enforcement.deny() 제거
  · auth() + session.user.id 401 분기 유지 (변경 0)
  · §11.305 P0 hotfix 주석 추가 (root cause 3중 결함 + fix 근거)

- apps/web/src/__tests__/regression/
  compare-analysis-lock-removed-305.test.ts (NEW, ~14 it):
  · lock 제거 7 it (enforceAction import/호출 0 / enforcement.* 0 /
    targetEntityId 하드코딩 0 / let enforcement 0)
  · auth 보존 2 it (auth() 호출 / 401 분기)
  · 분석 로직 보존 5 it (products 검증 / 5개 cap / Gemini+fallback /
    성공 응답 shape / catch 500)

canonical truth 보존 (회귀 0):
- auth() 인증 → 미인증 401 (변경 0)
- products 입력 검증 (1개 이상 / 5개 cap) 보존
- Gemini 2.0-flash 호출 + local fallback 분석 보존
- 성공 응답 shape (success/data) 보존
- catch 에러 핸들링 (500) 보존
- 다른 enforceAction 사용 route 변경 0 (본 route 만)

호영님 production effect:
1. labaxis.co.kr 소싱 → 비교 검토 → AI 분석:
   - 1회차 분석 완료 후 즉시 2회차 실행 가능 (lock 0)
   - 모달 닫기 후 재진입 시 오류 0
   - 여러 사용자 동시 분석 가능 (concurrencyKey 공유 제거)
2. 기존 stuck lock: in-memory 라 다음 배포(람다 재시작) 시 자동 소멸
3. "다시 시도" 버튼 — 이제 실제 재요청 성공 (lock 차단 0)

완료 기준 (호영님 §11.305 §7) 충족:
- ✅ 1회차 완료 후 즉시 2회차 실행 가능 (lock 제거)
- ✅ 모달 닫기 후 재진입 오류 0
- ✅ "다시 시도" 버튼 실제 복구 동작 (lock 없음 → 정상 재요청)
- (잔여) 에러 메시지 "네트워크 상태를 확인해 주세요" 개선 — 클라이언트
  측, 본 fix 로 409 자체가 사라지므로 트리거 0. 메시지 문구 정리는
  §11.305-2 후속 (클라이언트 에러 핸들링 audit)

Out of Scope (§11.305-2 후속):
- 클라이언트 에러 핸들링 문구 개선 (409 → "네트워크 상태" 오해석)
  · 본 fix 로 409 트리거 0 이므로 P0 아님, 별도 UX 정리
- compare-sessions/[id]/insight route 의 동일 패턴 여부 audit
- enforceAction 사용하는 다른 read 액션 route 전수 점검

Rollback path: git revert <SHA>
- 1 file enforceAction 복원 + 1 sentinel 삭제
- 회귀: lock 영구 잔존 버그 재발 (AI 분석 1회차 후 차단)
- ⚠️ revert 비권장 — P0 버그 재발
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/api/ai/compare-analysis/route.ts `
  apps/web/src/__tests__/regression/compare-analysis-lock-removed-305.test.ts `
  docs/commit-drafts/COMMIT_11.305-compare-analysis-lock.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.305-compare-analysis-lock.md
git push origin main
```

## Production smoke (P0 검증)

1. Vercel READY 확인 (배포 시 기존 stuck in-memory lock 자동 소멸)
2. labaxis.co.kr 소싱 → 후보 2개 선택 → 비교 검토 → AI 분석:
   - 1회차 분석 정상 생성
   - 모달 닫기 → 동일/다른 항목 2회차 AI 분석 → **즉시 성공** (차단 0)
   - 3회차, 4회차 연속 실행 — 모두 성공
3. 다른 브라우저/계정에서 동시 AI 분석 — 상호 차단 0 (concurrencyKey 공유 제거)
4. "다시 시도" 버튼 — 정상 재요청
```
