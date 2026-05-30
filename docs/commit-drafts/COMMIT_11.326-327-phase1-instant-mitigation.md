fix(quotes,preferences): §11.326+327 Phase 1 #instant-mitigation — 견적 PDF 토스트 actionable + preferences retry 명시 + onError 로깅 (호영님 P0 cluster, 2026-05-30)

호영님 P0 긴급 cluster (§11.326 + §11.327) Phase 1 — 즉시 차단 + 디버깅 가시성.

배경 (호영님 spec 2건):
- §11.326 (호영님 §11.324) 견적 PDF 생성 실패: vendor-dispatch-workbench 토스트 "견적서 생성 실패" raw error 노출, 임시 우회 안내 0
- §11.327 (호영님 §11.325) /api/user/preferences PATCH 20+ 반복 403 Forbidden: useMutation onError silent → 폭주 가시성 0
- 호영님 §6: 두 spec 같은 화면(`/dashboard/quotes`) + 인증 이슈 의심 공통점 → cluster batch

Phase 0 Truth audit 결과:
- §11.326: /api/quotes/[id]/generate-pdf endpoint 존재 (§11.314-b task #97), ownership 3-source 검증 → 403 가능 / 가설 D 유력
- §11.327: /api/user/preferences route 자체는 401 반환, 호영님 보는 403 = middleware/CSRF 매핑 의심
- useMutation default retry=0, onError silent → 폭주 root cause = 다중 caller (7 page) 또는 useEffect feedback loop 의심
- 호영님 §6 정합: CSRF 토큰 fail 가설 강력 (두 spec 공통 원인 가능)

Fix (Phase 1 — 즉시 차단 + 가시성, 2 file Edit):

- apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx (line 349-417):
  · 에러 응답 진단 추가 (line 353-368):
    · status code (403/404/500/4xx) + response body JSON 파싱 (body.error/message)
    · console.error 로깅 ([§11.326] PDF 생성 실패, {status, serverDetail, quoteId})
    · errorTag 라벨링 (403="인증/권한" / 404="견적 없음" / 5xx="서버 오류" / 4xx="요청 오류")
    · throw Error 메시지에 status + serverDetail 포함 → Phase 2 디버깅 단서
  · 토스트 개선 (호영님 spec §5 정합):
    · 옛 title "견적서 생성 실패" → 신 "견적서 PDF를 만들 수 없습니다"
    · 옛 description "raw error.message" → 신 "사유: {reason}\n\n현재 PDF 생성이 불안정합니다. 잠시 후 다시 시도하거나, 메시지 미리보기 내용을 복사해서 직접 메일로 보내실 수 있습니다."
    · friendly + actionable + 임시 우회 안내 (호영님 §7)

- apps/web/src/lib/preferences/user-preferences.ts (line 215-225):
  · useMutation `retry: 0` 명시 (TanStack default 도 0 이지만 폭주 방지 강제 + 코드 의도 명확화)
  · onError silent → `console.warn("[§11.327] preferences PATCH 실패 (silent fallback)", ...)`
    · silent fallback (client localStorage) 유지 (graceful degrade)
    · console.warn 으로 디버깅 가시성 확보 (호영님 spec §2 C "콘솔이 같은 에러로 도배" 부분 해소)

canonical 보존 (회귀 0):
- /api/quotes/[id]/generate-pdf endpoint 동작 변경 0 (caller-side 만 변경)
- /api/user/preferences endpoint 동작 변경 0 (hook-side 만 변경)
- §11.230c (a) server-first hydration + localStorage fallback 정합 유지
- useUserPreferences 7 caller (quotes/inventory/purchases/receiving/safety/purchase-orders/notification-toggles) 영향 0
- vendor-dispatch-workbench 다른 wiring (mailto / sentTracking / setConfirmationOpen) 보존
- §11.314-b PDF + mailto 흐름 보존

호영님 production effect (Phase 1):
1. §11.326: 사용자 토스트 = friendly + actionable, raw error 사라짐 → 임시 우회(메시지 복사) 가능 명시
2. §11.326: console.error 에 status + body + quoteId 로깅 → 호영님 production smoke 시 root cause 빠르게 식별
3. §11.327: useMutation retry 0 강제 명시 → 단일 instance 폭주 추가 차단
4. §11.327: console.warn 으로 폭주 가시성 확보 → "20+ 반복 403" 모니터링 가능

⚠️ Phase 2 호영님 production info 회신 필수 (root cause 확정):
1. /api/quotes/[id]/generate-pdf POST Network status + response body (Phase 1 console.error 출력)
2. /api/user/preferences PATCH 403 response body (Forbidden 사유)
3. middleware 403 매핑 위치 (CSRF check / auth check / rate limit)
4. 사용자 인증 상태 (logged in? org member?)
5. 동일 page 다른 API 호출 정상 여부

가설 분기 표:
| 회신 | §11.326 조치 | §11.327 조치 |
|---|---|---|
| CSRF 토큰 fail (공통) | middleware/csrfFetch 정정 양쪽 동시 해결 | 동일 |
| ownership 매칭 fail | 3-source 검증 logic fix | 별개 |
| useEffect feedback loop | 별개 (PDF 단발) | caller page 의존성 정리 |
| 다중 caller 동시 호출 | 별개 | useMutation singleton/dedup |
| auth session 만료 | 401 → 로그인 redirect | 동일 |

Out of Scope (Phase 2~3):
- root cause 수정 (Phase 2 호영님 info 회신 후)
- /api/quotes/[id]/generate-pdf endpoint 내부 디버깅 (Phase 2)
- middleware/CSRF 정책 수정 (Phase 2)
- useEffect 의존성 정리 (Phase 2 — caller page 별 확인)
- PLAN closeout (Phase 3)

검증 (sandbox 정적 grep):
- vendor-dispatch-workbench 토스트 "견적서 PDF를 만들 수 없습니다" + console.error [§11.326] ✓
- 임시 우회 안내 "메시지 미리보기 내용을 복사해서 직접 메일" ✓
- user-preferences.ts retry: 0 명시 + console.warn [§11.327] ✓
- onError silent → 로깅 1회 swap ✓
- 7 caller 시그니처 영향 0 ✓

Rollback path: git revert <SHA>
- 옛 토스트 raw error / onError silent 복원 (2 file)
- 디버깅 가시성 잃지만 동작 동일

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx `
  apps/web/src/lib/preferences/user-preferences.ts `
  docs/plans/PLAN_11.326-327-quote-pdf-preferences-403-cluster.md `
  docs/commit-drafts/COMMIT_11.326-327-phase1-instant-mitigation.md
git status
git commit -F docs/commit-drafts/COMMIT_11.326-327-phase1-instant-mitigation.md
git push origin main
```

## Production smoke (호영님 즉시 진행 요청)

1. Vercel READY 확인
2. /dashboard/quotes 진입 → DevTools Network/Console 열어두기
3. **§11.327 검증:**
   - Console 에 `[§11.327] preferences PATCH 실패 (silent fallback)` 로깅 확인
   - PATCH 호출 횟수 모니터링 (옛 20+ → 1~3회로 줄어드는지)
   - 만약 여전히 20+ → useEffect feedback loop 또는 다중 caller 가설 강화 (Phase 2)
4. **§11.326 검증:**
   - 견적 발송 전 최종 확인 모달 → "견적서 PDF 다운로드" click
   - Console 에 `[§11.326] PDF 생성 실패 {status, serverDetail, quoteId}` 로깅 확인
   - 토스트 = "견적서 PDF를 만들 수 없습니다" + 임시 우회 안내 노출
   - status 가 403 이면: ownership 3-source 매칭 fail 가설 강화 → endpoint 디버깅 (Phase 2)
   - status 가 500 이면: PDF 라이브러리/폰트 가설 → generateQuoteRequestPdf 디버깅 (Phase 2)
   - status 가 200 인데 caller 측 fail 이면: blob/download 로직 디버깅 (Phase 2)

## Next (호영님 production info 회신 후)

Phase 2: root cause 확정 + 수정
Phase 3: 회귀 + closeout
