# Implementation Plan: 소싱 카운터 표시 단일화 · 담기 타이밍/토스트 완화 (§sourcing-counter-timing)

- **Status:** ⏳ Pending (P0~P4)
- **Started:** 2026-07-25
- **Last Updated:** 2026-07-25
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 truth 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **결정 교체 게이트(호영님 승인 2026-07-25 "생성 교체 승인"):** 본 트랙은 §sourcing-quote-ux
  P2 담기 타이밍/토스트 sentinel + P5 "카운트 3면 일치" 검증을 **교체**한다. 옛 sentinel 대체 =
  별도 커밋 + 승인 주석 필수. 카운트 **값** 로직·서버 상태·리포트 관문은 무접촉(§quote-ux 종결분 보존).

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 `소싱 카운터·타이밍 핸드오프.md`(2026-07-25) — 1a 헤더 정리 · 1b 하단 바 1줄 세그먼트 ·
  1c 담기 타이밍 완화 + 하단 다크 pill 토스트 · QA 7항
- 프로토타입 `소싱 카운터·타이밍 정리.dc.html`

**Secondary References:**
- §sourcing-quote-ux 종결분(1624a272) — P2 담기 애니(fly 0.55s cubic-bezier(.22,.9,.36,1)·#2563eb·상단
  토스트 1800ms) · P5 카운트 3면 일치 검증. **본 트랙이 교체 대상.**
- 전역 select 토큰·§global-filters 공용 컴포넌트(무접촉 승계)

**실측 확정(직전 세션 런타임, www.labaxis.co.kr/app/search):**
- 헤더 카운터 `비교 후보 N / 견적 후보 N` **존재** + 조언 `비교 후 요청 전환이 적절합니다` = 클릭불가 죽은 텍스트
- 하단 바 **2줄**(견적 줄 · 비교 줄 각자 카운트/CTA)
- 토스트 = **상단** 초록 pill ~2.0s(1800ms 타이머+페이드)
- 담기 fly = `sourcing-flying-chip` transition `0.55s`(550ms)·#2563eb·getBoundingClientRect 실좌표
- 레일 탭(견적함/비교함/상세) 클릭 전환 배선 존재
- 카운트 값 = localStorage(`quote-cart-storage-v2`·`compare-storage`) 파생, 서버 영속은 요청 생성부터(③b)

**Conflicts Found (P0 실측 대상):**
- `차단 N` 레드 배지 위치·문구 — 핸드오프 §2/§4가 "기존 차단 3 레드"라 주장, 직전 세션 미포착.
  가격 미정(무가) 품목을 **견적함**에 담았을 때 하단 바에 나타날 것으로 추정 — P0 실측.
- 하단 바 세그먼트 레일 전환: 현재 레일 탭 클릭 핸들러 재사용 가능한지 미확인 — P0 실측.
- 담기 타이밍·토스트 sentinel 실파일 위치(§quote-ux P2 sentinel `sourcing-quote-ux-p1.test.ts`
  내 어느 어서션이 550ms/1800ms/#2563eb 상단 pin인지) — P0 재확인.

**Chosen Source of Truth:**
- 핸드오프 + 프로토타입. 카운트 **값** = 서버/스토리지 파생(불변), 본 작업은 **표시 계층만**(중복 표시
  제거·타이밍·배지 색·토스트 위치). canonical truth 무접촉.

**Environment Reality Check:**
- [x] main HEAD(§sourcing-quote-ux 종결 1624a272 이후) · F9 격리/실 vitest · F10 build 가용
- [x] 프로덕션 스모크 경로: sandbox(Claude in Chrome, 호영님 로그인 세션) — 타이밍·궤적 런타임 검증 필수

## 1. Priority Fit
- [x] Post-release / UX 개선 — 비블로커. 단 죽은 텍스트 카운터·과경고 레드 배지는 정직성/no-op 클래스 →
  표시 정리 우선. 카운트 **값** 정합은 §quote-ux에서 종결(무접촉).

## 2. Work Type
- [x] Design Consistency(카운터 표시 단일화·배지 색·토큰) · [x] Web(소싱 헤더/하단 바/애니) ·
  [x] Feature(하단 바 세그먼트 레일 전환) · [ ] 모델/스키마 변경 0 · [ ] 카운트 값 로직 변경 0

## 3. Overview

**Feature Description:**
소싱 화면의 담김 개수 **표시**를 하단 바 단일 위치로 모으고(헤더의 죽은 카운터 삭제), 하단 바를 2줄→1줄
세그먼트(견적함/비교함 배지=레일 전환)로 통합. 담기 시퀀스를 ~600ms→≈1.3s로 완화(모프 380·플라잉
820 arc·hold 120·범프 520 글로우)하고, 상단 대형 토스트를 검색창 미가림 하단 다크 pill(2.6s)로 이관.
~~과경고 `차단 N` 레드 배지를 yellow로 완화~~ **← P0 실측 후 철회**(§12 Notes 2026-07-25: `차단 N`=하드 차단(공급사 없음=요청 불가) → red 유지·무접촉).

**Success Criteria (핸드오프 §4 QA 7항 = 인수 기준):**
- [ ] 헤더에 담긴 개수 카운터 부재(결과 맥락만: `검색 결과 N건` + 매칭 품질 + 정렬/필터/재고)
- [ ] 하단 바 1줄, 견적함/비교함 세그먼트로 레일 전환(dead 세그먼트 0)
- [ ] 카운트가 하단 바·레일에서 항상 일치(단일 소스 — 값은 §quote-ux 파생 승계)
- [ ] 담기 총 시간 ≈1.3s, 플라잉 칩 arc 궤적이 목적지 배지에 정확 도착(getBoundingClientRect 실좌표)
- [ ] 토스트 하단 다크 pill(#0f172a)·2.6s·자동 소멸·검색창 미가림
- [ ] prefers-reduced-motion 폴백(이동·범프 생략, 모프·카운트 상태 변화만)

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 카운트 **값** 계산·서버 상태·localStorage 스키마
- [ ] AI 비교 리포트 관문/데이터 상태(§quote-ux 종결분)
- [ ] 리포트=레일 카운트 파생 로직(값 일치는 이미 종결, 표시 위치만 정리)

**User-Facing Outcome:**
검색 결과 헤더는 결과 맥락만, 담김 개수·조언·CTA는 하단 1줄 바에 집약. 담기 시 어디로 담겼는지 시선
추적 가능(느린 arc + 배지 범프 글로우), 토스트가 검색창 안 가림. (`차단 N` red 배지는 하드 차단이라 유지 — P0 판정.)

## 4. Product Constraints

**Must Preserve:**
- [x] workbench/queue/rail/dock — 레일(견적함/비교함/상세) 구조 유지, 세그먼트는 레일 전환 트리거
- [x] same-canvas — 소싱 단일 화면 내 정리, 신규 페이지 0
- [x] canonical truth — 카운트 값 = 서버/스토리지 파생(무접촉), 표시만 재배치
- [x] 카운트 단일 소스 — 표시 위치를 하단 바로 단일화(중복 3표시 → 하단 바 주표시 + 레일 배지)

**Must Not Introduce:**
- [x] page-per-feature 회귀 0 · dead 세그먼트/no-op/placeholder 0 · 헤더 죽은 텍스트 제거(정직성)
- [x] fake success 0(토스트=보조, 상태 주인공=하단 바/레일)

**Canonical Truth Boundary:**
- Source of Truth: 견적 후보/비교 목록 = 서버 상태 + localStorage draft(§quote-ux ③b)
- Derived Projection: 하단 바 세그먼트 배지·레일 탭 배지·담김 요약 = 동일 소스 파생
- Snapshot/Preview: 애니메이션 칩·배지 범프 = 파생 표시(비지속)
- Persistence Path: 무접촉(요청 생성부터 서버 영속 — §quote-ux)

**UI Surface Plan:**
- [x] Existing route section(소싱 헤더 · 하단 바 · 결과행 담기 버튼)
- [ ] 신규 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 헤더 카운터 삭제·하단 바 단일 표시 | 죽은 텍스트 제거 + 표시 중복 3→1 | 헤더 상단 즉시 가시성 일부 감소(하단 바로 대체) |
| 하단 바 세그먼트 = 레일 전환 트리거 | 기존 레일 탭 핸들러 재사용(신규 store 0) | 세그먼트↔레일 탭 2입구 — 동일 핸들러로 정합 유지 필요 |
| 플라잉 arc = 베지어 path/키프레임 | 시선 추적 구간 820ms 곡선 | 직선 대비 구현 복잡 ↑(getBoundingClientRect 2점 + 제어점) |
| ~~배지 레드→yellow 토큰 교체~~ | **← P0 철회**(a판정): `차단 N`=하드 차단(공급사 없음=요청 불가) → red 유지. 무가=이미 muted. | — |

**Dependencies:**
- Required Before Starting: §sourcing-quote-ux 종결(1624a272) — 완료
- External Packages: framer-motion(기존, §quote-ux P2 도입분 재사용)
- Existing Touched: `_workbench/search/page.tsx`(헤더·하단 바·fly 헬퍼) · `sourcing-result-row.tsx`(담기 버튼
  모프) · 담기 토스트 리졸버 · 하단 바/레일 컴포넌트(P0 실파일 확정)

**Integration Points:**
- fly 헬퍼(flySourcingChip) 타이밍·arc 궤적 · 담기 버튼 모프 duration · 하단 바 세그먼트 onClick=레일 전환 ·
  토스트 컴포넌트(위치·색·duration·문구) · 가격 미정 배지 색 토큰

## 6. Global Test Strategy

- 정적 sentinel(readFileSync+regex 계약) RED→GREEN — 표시 계약(헤더 카운터 부재-lock·세그먼트 존재·
  yellow 토큰·타이밍 값·하단 pill 토큰·문구) 검증.
- 한계 명시: arc 궤적·타이밍 체감·토스트 위치는 정적 계약 부분 검증만 — **P4 런타임 게이트가 최종**.
- 결정 교체: 옛 P2 sentinel(550ms/1800ms/#2563eb 상단)·P5 3면 검증 어서션 진화 시 **별도 커밋 + 승인 주석**,
  옛 값 부재-lock 전환(회귀 방지).

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Done (2026-07-25 · 차단 red=하드 차단 판정·3면 매핑·fly target 확정)
- **RED:** `차단 N` 레드 배지 실측(무가 품목 견적함 담기 → 하단 바) · 세그먼트 레일 전환 현 배선 · 옛 P2/P5
  sentinel 어서션 위치·pin 값 확정 · 헤더/하단 바/토스트/fly 실파일 경로 확정
- **GREEN:** 결정 교체 대상 목록 pin(모프450→380·fly550→820·토스트 상단1800→하단2600·3면→2면) · 무접촉
  경계(카운트 값 로직) 확정
- **REFACTOR:** scope 최소화 — 표시 계층 파일만
- **✋ Gate:** 충돌 0 · 교체 대상 실파일/실어서션 확정 · 카운트 값 무접촉 경계 문서화
- **Rollback:** planning-only

### Phase 1: 계약 · Failing Tests (sentinel 진화)
- Status: [x] Done (2026-07-25 · 신규 RED 4 + 보존 가드 · P2-e 1800→2600 교체)
- **RED:** 신규/진화 sentinel 작성(RED 확인):
  · 헤더 담김 카운터(`비교 후보`/`견적 후보` 헤더 노출) **부재-lock**
  · 하단 바 세그먼트(견적함/비교함 배지 + onClick 레일 전환) 존재
  · ~~가격 미정 배지 yellow · 옛 레드 `차단` 부재-lock~~ **← P0 철회(a판정): `차단 N` red 유지·무접촉**
  · 담기 타이밍 값(모프 380·fly 820·hold 120·범프 520) · 하단 pill(#0f172a·2600ms·문구)
  · reduced-motion 폴백 마커
- **GREEN:** 최소 계약 스캐폴딩 · 옛 P2 어서션(550/1800/#2563eb 상단) → 신값 pin 교체(**결정 교체 주석**) ·
  옛 P5 "3면 일치(top 포함)" → "2면(badge=bottom)" + top 부재-lock 교체
- **REFACTOR:** 어서션 정밀 pin(false-pass·self-trip 회피 — 주석 내 토큰 제거)
- **✋ Gate:** RED 실재 · 기존 접촉 sentinel delta 0(교체분 제외 명시) · F10 무관(test-only)
- **Rollback:** sentinel 커밋 revert

### Phase 2: 헤더 정리 + fly target 이동 (계약 1·6) + step3 반응형 1줄 — ✅ 완료
- Status: [x] 계약 1·6 GREEN(2026-07-25) · step3 반응형 1줄(§11.252f 부분 진화 승인 'b') 완료
- **GREEN(완료):**
  · 헤더: 상태바 `비교 후보 N`/`견적 후보 N` 카운터 제거 → 결과 맥락만(검색 결과 N건 + 필터/재고 + 다음 행동 조언 1줄 잔류)
  · fly target: `data-fly-target`(compare/quote) 상태바 span → 하단 바 세그먼트 `<Badge>` 이동 + 첫 담김 double rAF 안정화
  · 이전선택맥락 카드·차단 N red·2행 바 구조 무접촉(§11.252f 보존)
- **🛑 상신 대기(별도 승인):** 하단 바 2줄→1줄 세그먼트 재구성 = **§11.252f("소싱 액션 바 1줄 강제→2행 독립 구조", search-action-bar-2row-252f)**
  잠긴 결정을 정면으로 뒤집음(2행→1행). "접촉 sentinel delta 0" 게이트와도 충돌 → §11.252f 결정 교체 승인 후 진행.
  이관 보류분: 조언 문구 하단 바 이관 · 좌 세그먼트(#2563eb/#cbd5e1) · 중앙 담김 요약 · 우 CTA 재배치.
- **REFACTOR:** 세그먼트 onClick = 기존 focus key(setCompareFocusKey/setQuoteFocusKey) 재사용(신규 store 0) · same-canvas 보존
- **✋ Gate:** [x] F9 계약 1·6 GREEN · [x] dead/no-op 0 · [x] F10 EXIT 0 · [x] 접촉 sentinel delta 0(258b/268c는 baseline drift)
- **Rollback:** P2 커밋 revert

### Phase 3: 담기 타이밍 완화 + 하단 다크 pill 토스트
- Status: [x] Done (2026-07-25 · 계약 3·4 GREEN 전환 · counter-timing 8/8 · quote-ux 18/18 · F10 EXIT 0)
- **GREEN(완료):** 모프 380ms(row framer 0.38s) · 플라잉 820ms arc(getBoundingClientRect 2점 + 수직 제어점 lift=dist*22%,
  하드코딩 좌표 0, Web Animations keyframes) · 도착 hold 120ms · 배지 범프 520ms(scale 1→1.4→1 + 글로우) ·
  토스트 하단 다크 pill(#0f172a·2600ms·자동 소멸·문구 "견적 후보에 담았어요 · 가격은 견적 요청 후 확정", 병합/오류는 resolver 원문) ·
  prefers-reduced-motion(flySourcingChip·bump 조기 return = 이동·범프 생략, 모프·카운트만) · CT 타이밍 상수화(380/820/120/520).
- **REFACTOR:** DOM cleanup(anim.onfinish + setTimeout 백업 remove, 칩 잔존 0) · 총 ≈1.3s
- **결정 교체(완료):** P2-e `/1800/`→`/2600/` 반영 → quote-ux-p1 18/18 GREEN. 옛 1800 page 전무. resolver 무접촉(guard-3 "확정됩니다" 보존).
- **✋ Gate:** [x] F9 계약 3·4 GREEN · [x] reduced-motion 마커 · [x] 접촉 88/88 delta 0(252f 2행 무저촉) · [x] F10 EXIT 0
- **Rollback:** P3 커밋 revert

### Phase 4: 스모크 · 종결
- Status: [ ] Pending
- sandbox 프로덕션 런타임: QA 7항 전건(헤더 카운터 부재 · 하단 바 1줄 세그먼트 레일 전환 · 카운트 하단바=레일
  일치 · yellow 배지 · 담기 ≈1.3s arc 도착 · 하단 pill 2.6s 미가림 · reduced-motion) + baseline-delta 0
- **✋ Gate:** QA 판정표 · baseline-delta 0 · build EXIT 0 · 미검증 항목 증거 등급 구분 기록
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Optional Addenda
- **A. Workflow(소싱):** 세그먼트 = workflow route 상 레일 전환 트리거(정당, strong contextual) · 신규 store/
  ontology 재해석 금지 · 기존 레일 탭 핸들러 재사용.

## 9. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 결정 교체 sentinel 충돌(P2/P5 옛값) | 확정 | Med | 별도 커밋 + 승인 주석 + 옛값 부재-lock |
| arc 궤적 구현 복잡 | Med | Low | getBoundingClientRect 2점 + 베지어 제어점 · 정적 계약 부분검증 + P4 런타임 최종 |
| 세그먼트↔레일 탭 2입구 정합 | Med | Med | 동일 핸들러 재사용 · 카운트 값 단일 소스 파생 유지 |
| 카운트 값 로직 오접촉 | Low | High | Out of scope 명시 · 표시 계층 파일만 접촉 |
| 접촉 sentinel 임의 진화 | Med | Med | 교체분 외 delta 0 · 판정 상신(관례) |

## 10. Rollback Strategy
- P2/P3 커밋 분리 revert · 마이그레이션 0 · 애니메이션은 reduced-motion 경로가 사실상 기능 폴백 ·
  결정 교체 sentinel은 별도 커밋이라 독립 revert 가능.

## 11. Progress Tracking
- Overall: 90% · Current: step3 완료(반응형 1줄, §11.252f 부분 진화 승인 'b') · Next: P4 스모크·종결
- [x] P0 · [x] P1 · [x] P2(1·6 + step3 반응형 1줄) · [x] P3 · [ ] P4

## 12. Notes & Learnings
- [2026-07-25] 계획 생성(호영님 "생성 교체 승인"). §sourcing-quote-ux 직속 후속. 결정 교체 3건 승인:
  ① 담기 타이밍(모프450→380·fly550→820 arc·hold+120·범프450→520 글로우) ② 토스트(상단1800→하단 다크
  pill 2600·문구 변경) ③ P5 카운트 검증 3면(top 포함)→2면(badge=bottom)+top 부재-lock. 카운트 **값**·
  서버 상태·리포트 관문 무접촉(§quote-ux 종결분 보존).
- [2026-07-25] P0 Truth Lock 실측:
  · **QA-4 배지 완화 거부(정직성 역행)**: `summary.blocked`=`calculateRequestReadiness` hard_blocker 산출, 유일 hard_blocker=
    **"공급사 없음 → 견적 요청 불가"**(request-readiness.ts:93-98). `차단 N` red=진짜 하드 차단 → red→yellow 완화 시 "요청 불가"를
    주의로 약화=정직성 역행 → **호영님 판정 'a'(red 유지·무접촉)**. 무가=이미 muted(slate-400)·검토=이미 yellow. §3 SC 배지 완화 항목 삭제.
  · **3면 카운터 매핑**: 상태바 1025/1028(data-fly-target·현 fly 도착점)=**삭제** · 이전선택맥락 카드 1506/1509("N건")=**유지**(별개 semantic) ·
    하단 바 세그먼트 배지=**단일 소스 유지**. self-trip 회피: 상태바 `비교 후보 {compareIds.length}`(직접) vs 카드 `…{…}건`(nested+건) 구분.
  · **fly target**: 상태바 삭제 → `data-fly-target` 하단 바 세그먼트 배지 이동. 첫 담김 조건부 렌더(showSourcingActionDock) 엣지 → P3에서 바 마운트 후 rAF fly 시작으로 해소.
- [2026-07-25] P1 sentinel 진화: 신규 `sourcing-counter-timing-p1.test.ts` RED + 결정 교체(sourcing-quote-ux-p1 P2-e `/1800/`→`/2600/`·상단→하단 pill·옛 1800 부재-lock, 별도 커밋·승인 주석).
- ~~잔여 정리(P2 대상)~~ **완료(2026-07-25)**: §8 Phase2 제목 "+배지 완화" 제거·"레드→yellow" 삭제 · §7 Phase1 "가격미정 yellow·차단 부재-lock" 철회 · §9 Risk "배지 레드→yellow" 철회(모두 a판정 반영).
- [2026-07-25] P2 구현(계약 1·6 GREEN):
  · 헤더: 상태바 카운터(비교/견적 후보 N) 제거 → 결과 맥락만. 다음 행동 조언 1줄 잔류(하단 바 이관은 1줄 재구성과 함께 상신 대기).
  · fly target: `data-fly-target` 상태바 span → 하단 바 세그먼트 `<Badge>` 이동. 첫 담김 조건부 렌더 엣지 = **double rAF**(setState 커밋+페인트 후 fly 시작)로 해소.
  · self-trip 수정: 계약(1) 정규식이 clear-all 다이얼로그 `견적 후보 {quoteItems.length}건`을 오매칭 → 상태바형 `…}<`(span 닫힘) 앵커로 정밀화(별도 test 커밋).
  · 접촉 delta 0: 252f(2행)·252e·312 통과. 258b(4)·268c(2)는 **clean HEAD에서도 실패=baseline drift**(내 delta 0).
- **🛑 상신(P2 잔여)**: 하단 바 2줄→1줄 세그먼트 재구성은 **§11.252f("1줄 강제→2행 독립", search-action-bar-2row-252f)** 잠금을 뒤집음.
  "접촉 sentinel delta 0" 게이트와 충돌 → §11.252f 결정 교체 승인 후 진행. 승인 시 조언 이관·좌 세그먼트·중앙 요약·우 CTA 재배치.
- [2026-07-25] §11.252f 범위 실측(step 3 교체 판정 선결):
  · (a) **전 뷰포트 2행** — sentinel/렌더 어디에도 sm/md 뷰포트 한정 없음. 비교행(`compareIds.length>0 &&`)·견적행(`quoteItems.length>0 &&`)이
    전 뷰포트에서 조건부 스택. 바 컨테이너(#0f172a)도 뷰포트 게이팅 없음.
  · (b) `min-h-[44px]`=터치 타겟(iOS HIG) · 조건부 숨김=담긴 것만 독립 표시(0건 행 숨김). iPhone SE 375px 잘림 0·CTA 축약(sm:hidden) invariant 보호.
  · (c) 데스크톱도 2행(1줄 아님). "2행"은 compare+quote 둘 다 담겼을 때만; 하나면 이미 1행.
  · **판정**: step 3 "무조건 1줄"=전 뷰포트 전면 교체=§11.252f 정면 뒤집기. **절충 권고 = 반응형 분기(md+ 1줄 세그먼트 / 모바일 2행 유지)** —
    §11.252f 모바일 터치·잘림 보호를 지키며 데스크톱 1줄 목표 달성. 전면 1줄은 375px 회귀 위험 → 비권장. 호영님 방향 상신 대기.
- [2026-07-25] P3 구현(계약 3·4 GREEN): flySourcingChip arc(820ms Web Animations, 수직 제어점 실측)·hold 120·배지 범프 520(scale+글로우)·
  모프 380(row 0.38s)·하단 다크 pill(#0f172a·2600·"견적 후보에 담았어요 · 가격은 견적 요청 후 확정", 병합/오류 resolver 원문)·reduced-motion 조기 return.
  P2-e 2600 교체 GREEN, resolver 무접촉(guard-3 보존). 접촉 88/88 delta 0. F10 EXIT 0.
- [2026-07-25] step3 구현(호영님 승인 'b', §11.252f 부분 진화): md+ 1줄 세그먼트 바(hidden md:flex) + 모바일 2행(md:hidden) 보존.
  · 좌 세그먼트(견적함/비교함, 활성 #2563eb/비활성 #cbd5e1·disabled, focus key 레일 전환·신규 store 0) · 중앙 요약(견적 후 확정·가격 미정 muted·차단 red) ·
    우 조언(헤더서 이관)+비교 리포트+전체 해제(데스크톱 회귀 방지)+견적 요청서 만들기(#16a34a).
  · fly target: md+ 세그먼트 배지 + 모바일 배지 양쪽(flySourcingChip visible 매칭 → 뷰포트별 하나 도착). double rAF 유지.
  · sentinel 진화: 252f 헤더 승인 주석 + md:hidden/hidden md:flex 공존 어서션 · counter-timing step3 계약 5. 접촉 74/74 delta 0(252f 교체분).
  · 검증: counter-timing 13/13 · 252f 진화 GREEN · F10 EXIT 0. 잔여: P4 런타임(md+/모바일 분기 육안).
