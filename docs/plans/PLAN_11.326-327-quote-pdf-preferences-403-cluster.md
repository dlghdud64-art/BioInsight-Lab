# Implementation Plan: §11.326 + §11.327 — 견적 PDF 실패 + preferences 403 폭주 (P0 cluster)

- **Status:** 🔄 In Progress (§11.326 Phase 3 sandbox closeout 작성, §11.327 Phase 2 sandbox audit 완료 — 호영님 info/Vercel 회신 대기)
- **Spec received:** 2026-05-30 (호영님 spec §11.324 + §11.325 둘 다 P0 긴급, 번호 충돌 매핑 §11.326 + §11.327)
- **Started:** 2026-05-30 (§11.314 Phase 2 종결 후 진입)
- **Last Updated:** 2026-05-30 (Phase 3 closeout sentinel + §11.327 audit 결과 추가)
- **Scope:** P0 cluster (2 spec 통합 — 호영님 §6 "공통 인증 이슈면 합쳐서 처리" 정합)
- **호영님 모델 권장:** Opus 4.7 (조사 + 즉시 차단), root cause 가 복잡하면 Opus 4.8 재검토

## 진행 요약 (2026-05-30)

| Batch | Status | 다음 |
|---|---|---|
| §11.326 Phase 0+1 | ✅ push 완료 | — |
| §11.326 Phase 2 (commit 9abc1f07) | ✅ push 완료 | Vercel 결과 대기 |
| §11.326 Phase 3 (sentinel + closeout) | 🔄 sandbox 작성 완료 | 시나리오 1 시 즉시 push |
| §11.327 Phase 1 (commit f80f5e05) | ✅ push 완료 | — |
| §11.327 Phase 2 sandbox audit | 🔄 완료 (가설 D 강화) | 호영님 production info 4 회신 |
| §11.328 (입고 데이터 모델) | ⏳ 미진입 | SPEC file sync 대기 |

## §11.327 Phase 2 sandbox audit 결과 (root cause 가설 강화)

**middleware.ts 발견:**
- line 5: "API route CSRF gate (Batch 10)" 명시
- LABAXIS_CSRF_MODE env 기반 rollout
- 5 fail event type: csrf_missing_token / csrf_token_mismatch / csrf_token_expired / csrf_origin_mismatch / csrf_token_format
- CSRF 검증 fail 시 응답 코드 → 403 매핑 가능 (호영님 보는 403 ←→ middleware CSRF 403)

**csrfFetch wrapper (lib/api-client.ts:311) 발견:**
- POST/PUT/PATCH/DELETE 에 x-labaxis-csrf-token 자동 첨부
- cookie 에서 토큰 읽기 → 없으면 /api/security/csrf-token bootstrap
- #csrf-fetch-race-condition-fix: 403 응답 시 refreshCsrfToken → fresh !== csrfToken 면 1회 retry, fresh === csrfToken 면 skip (무한 loop 차단)

**가설 강화:**
- ⭐⭐ D (CSRF) — middleware CSRF gate 존재 + csrfFetch race-condition retry 1회 → **20+ 폭주는 다중 caller (7 page) 또는 useEffect feedback loop 추가 결합 시만 발생**
- ⭐ F (useEffect feedback loop) — caller page 의 useEffect 가 query.data 변경 시 mutation trigger → response → cache update → 다시 useEffect → mutation 무한 (가장 유력한 second-order 원인)
- ❌ A/B (세션 만료 / guest) — route 자체 401, 호영님 보는 403 != 401, middleware 매핑

**호영님 4 info 회신 받으면 root cause 즉시 분기 (이미 spec 명시):**
1. response body — csrf_* event 코드 매칭 → 가설 D 확정
2. request headers — x-labaxis-csrf-token 첨부 여부 → csrfFetch race-condition 추적
3. 다른 PATCH/POST 정상 여부 → CSRF gate 영향 범위
4. 로그인 직후 vs 시간 후 → 세션 만료 (csrf_token_expired) 또는 hydration race

---

## 🔖 번호 매핑

- 호영님 spec §11.324 (PDF 생성 실패) → **§11.326** (§11.324 = 랜딩 Triage 사용 완료)
- 호영님 spec §11.325 (preferences 403 폭주) → **§11.327** (§11.325 = product detail entry 사용 완료)
- 두 spec = 같은 화면(`/dashboard/quotes`) + 인증 이슈 의심 공통점 → cluster batch

---

## 0. Truth Reconciliation ✅ COMPLETE (2026-05-30 sandbox)

### §11.326 — 견적 PDF 생성 실패

**Audit 결과:**
- ✅ `/api/quotes/[id]/generate-pdf/route.ts` **존재** (194 lines, §11.314-b task #97)
- ✅ caller: `components/quotes/dispatch/vendor-dispatch-workbench.tsx` line 349 `csrfFetch(...generate-pdf, POST)`
- ✅ 에러 토스트 (line 403-408): `error.message` 그대로 노출 ("견적서 생성에 실패했습니다")
- endpoint 인증 검증: auth() + ownership 3-source (owner / org member / guestKey) → 403 Forbidden 반환 가능

**가설 검증 결과:**
- ❌ A (endpoint 미구현) — 기각, route.ts 존재
- ⭐ B (endpoint 존재 + 오류) — 라이브러리/폰트/데이터 누락 가능성
- ⭐ D (인증 이슈) — ownership 3-source 매칭 실패 → 403 가능성 (§11.327 와 공통 가능)
- ❓ C (전송 API 미구현) — 본 spec scope 외 (mailto MVP 보존 중)

### §11.327 — preferences 403 폭주

**Audit 결과:**
- ✅ `/api/user/preferences/route.ts` **존재** (line 193-220: auth fail = **401 Unauthorized**, 403 아님!)
- ✅ caller hook: `lib/preferences/user-preferences.ts` `useUserPreferences()` 7 page 사용
- useMutation: retry 정책 0 (default), onError silent (line 222)
- debounce 400ms (line 230)
- caller pages: quotes / inventory / purchases / receiving / safety / purchase-orders / notification-toggles

**가설 검증 결과:**
- ❌ B/C — 401 != 403, route.ts 자체 인증은 401 반환
- ⭐⭐ D (CSRF 토큰 누락/만료) — middleware 가 CSRF fail → 403 매핑 가능 (가장 유력)
- ⭐ F (useEffect 무한 루프) — caller page 의 server data 동기화 feedback loop 가능성
- ⭐ G (다중 컴포넌트 동시 호출) — 7 caller 동시 mount 시 mutation 다중 발생
- ❌ H (실패 시 재호출) — onError silent, default retry 0

### 호영님 §6 cross-reference — 공통 인증 이슈

| 항목 | §11.326 | §11.327 |
|---|---|---|
| auth fail 응답 | 403 (ownership 매칭 실패) | 401 (server) → 403 (middleware/CSRF?) |
| route 인증 | auth() + ownership 3-source | auth() + session.user.id |
| csrfFetch 사용 | ✅ | ✅ |
| 동일 화면 발생 | `/dashboard/quotes` | `/dashboard/quotes` |
| **공통 가설** | **CSRF 토큰 fail → 403** | **CSRF 토큰 fail → 403** |

⭐ 호영님 spec §6 "공통 원인이면 합쳐서 처리" 정합 — **CSRF 토큰 fail 가설 강력**

---

## 1. Priority Fit
- [x] **P0 긴급** (둘 다 호영님 spec 명시)
- §11.326 견적 전송 차단 = high impact
- §11.327 서버 부하 (20+ retry) + 디버깅 가시성 손상 = high impact

## 2. Work Type
- [x] Bug (인증/재시도 루프)
- [x] Debug (Phase 2 root cause 확정)

## 3. Phase 구조

### Phase 0: Truth Lock ✅ COMPLETE (위 §0)

### Phase 1: 즉시 차단 (sandbox 작업, ~30m) — 현재 진행
- §11.326 토스트 개선 (raw error 노출 제거 + actionable + 임시 우회 안내)
- §11.327 retry 정책 명시 (`retry: 0`) + onError 로깅 1회 (silent → warn)

### Phase 2: Root cause 확정 (호영님 production info 회신 의존)
- 호영님 회신 필요 항목:
  1. /api/quotes/[id]/generate-pdf POST Network status (403 / 500 / data error)
  2. /api/user/preferences PATCH 403 response body (Forbidden / CSRF / Unauthorized)
  3. middleware 403 매핑 위치 (CSRF check / auth check / rate limit)
  4. 사용자 인증 상태 (logged in? org member?)
  5. 동일 page 다른 API 호출 정상 여부

### Phase 3: Root cause 수정 + 회귀 + closeout
- CSRF 토큰 fail 확정 시: middleware/csrfFetch 정정
- ownership 매칭 fail 확정 시: 3-source 검증 fix
- useEffect 무한 루프 확정 시: 의존성 정리

## 4. 가설별 분기 표

| 회신 | §11.326 조치 | §11.327 조치 |
|---|---|---|
| CSRF 토큰 fail | middleware/csrfFetch 정정 (양쪽 동시 해결) | 동일 |
| ownership 매칭 fail (§11.326) | 3-source 검증 logic fix | 별개 (§11.327 별도 진입) |
| useEffect feedback loop (§11.327) | 별개 (PDF 단발 호출) | caller page 의존성 정리 |
| 다중 caller 동시 호출 (§11.327) | 별개 | useMutation singleton/dedup |
| auth session 만료 | 401 → 로그인 redirect | 동일 |

## 5. Out of Scope
- §11.318-CORRECTION 환각 억제 (별개 spec)
- §11.314 Phase 2 SMTP (이미 종결)
- /api/quotes/[id]/generate-pdf endpoint 자체 신규 구현 (이미 존재)

## 6. Risk
| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| sandbox 에서 production root cause 확정 불가 | High | High | 호영님 production info 회신 의존, Phase 2 진입 전 보고 |
| Phase 1 즉시 차단이 새 버그 유발 | Low | Med | 토스트/로깅 swap 만, 핵심 logic 변경 0 |
| §11.326 + §11.327 다른 root cause 일 가능성 | Med | Med | Phase 2 cross-reference 정확 audit |

## 7. Rollback
- Phase 1 fail: 토스트/retry 옛 패턴 복원
- Phase 2 fail: root cause 수정 revert + 가설 재검토
