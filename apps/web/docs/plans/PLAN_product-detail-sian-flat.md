# Implementation Plan: 제품 상세 시안 정합 (콘텐츠 플랫 국소화)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-20
- **Last Updated:** 2026-06-20
- **Estimated Completion:** 2026-06-21

**CRITICAL INSTRUCTIONS** (phase 완료 시): ① 체크박스 갱신 ② quality gate 명령 실행 ③ 전 항목 통과 확인 ④ Last Updated 갱신 ⑤ Notes 기록 ⑥ 그 후 다음 phase.
⛔ quality gate 실패/소스충돌 미해결 상태로 진행 금지. ⛔ dead button / no-op / placeholder success 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 시안 React 원본 `ImprovedPage` (번들 `57f41623` gzip 해제 추출) + 인라인 CSS 전량 — `outputs/sian_source.jsx`, `outputs/sian_template.html`.
- 구현 지시문 `제품 상세 페이지 구현 지시문.html` (§01~§10).

**Secondary References:**
- 현재 구현 `apps/web/src/app/products/[id]/page.tsx` (1341줄, PD-A~N land).
- 서브: `components/products/{product-completeness,quote-tray-bar,price-display}.tsx`, `lib/product-detail/{completeness,spec-fields}.ts`.

**Conflicts Found:**
- 지시문 "PD-A~N 완료"(구조) vs 시각 = 현재 글래스모피즘 / 시안 플랫. → 시안 시각이 truth (호영님 "똑같이").
- 시안 tray-bar = 비교+견적 / 현재 = 견적만(dead-button 회피). → 현재 유지(호영님 확정).

**Chosen Source of Truth:**
- 시각·구조 = 시안 `ImprovedPage`. 단 canonical wiring·dead-button 정책은 현재 유지/강화.

**Environment Reality Check:**
- [x] repo: ai-biocompare, sandbox(Cowork) — 코드만, push/build = operator.
- [x] runnable: `vitest run`, `npm run build`(operator). baseline FAIL_FILE=87.
- [x] blocker: dev 미기동·Vercel URL 미상 → 최종 Chrome 시각검증 이연.

## 1. Priority Fit
- [ ] P1 immediate  [ ] Release blocker  [x] Post-release  [ ] P2
- catalog 가동이 상위 우선(operator 레인). restyle은 Cowork 레인이라 병렬 선행. 데이터 차오른 뒤 시각 발현.

## 2. Work Type
- [x] Design Consistency  [x] Web (same-canvas UI 리팩토링)

## 3. Overview
**설명:** /products/:id 콘텐츠 영역을 시안 플랫 스타일로 정합. 글래스모피즘(blur orb·gradient·rounded-3xl) → 시안 토큰(흰 카드·hairline·radius 18px·accent #2f6be0). **스코프: `.q-embed` 콘텐츠 컨테이너 한정, 전역 셸 불변.**

**Success Criteria:**
- [ ] 히어로: 96px 썸네일 · 품명일치 배지 · 키팩트 세로 구분선 · 완성도 앰버바.
- [ ] 제품 사양: 2카드→단일 카드, 플랫 2열 정의그리드(hairline), spec 아이콘 + "N개 항목 확인" 배지, 미등록 dashed 1줄.
- [ ] 안전·규제: reg-link 3열 카드(reg-label + reg-note), MSDS 없음 = 앰버 배너.
- [ ] 우측 레일: qc-meta 행(Cat.No/납기/최소주문) · stock-mini(→/dashboard/inventory) · 플랫 CTA.
- [ ] 대체품/연관: 시안 카드/행 스타일.
- [ ] sentinel 14개 무회귀(스타일 단언 동반 진화) + 신규 정합 sentinel green.

**Out of Scope (⚠️ 금지):**
- [ ] /compare 라우트·비교 트레이·비교하기 버튼 (별도 트랙 선행).
- [ ] 전역 셸(nav/layout) 스타일 변경.
- [ ] catalog ingest (operator 레인).
- [ ] grade(자사 A~E) 컬럼 직접 렌더 (§sourcing-product-surface 불가침).

**User-Facing Outcome:** 빈 데이터에도 "채워지는 중"으로 읽히는, 시안과 동일한 클린 결정 페이지.

## 4. Product Constraints
**Must Preserve:** [x] rail 구조 [x] same-canvas [x] canonical truth(quote-cart-storage 단일출처) [x] invalidation.
**Must Not Introduce:** [x] page-per-feature [x] dead button/no-op [x] fake success [x] preview가 truth 대체.
**Canonical Truth Boundary:**
- Source of Truth: db.product(useProduct), quote-cart-storage, compare-store.
- Derived: getDisplaySpecs(화이트리스트), computeCompleteness(8필드 고정).
- Persistence: addToQuoteCart / PATCH safety·spec.
**UI Surface Plan:** [x] Existing route section (/products/:id 콘텐츠, .q-embed 스코프).

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
| :-- | :-- | :-- |
| `.q-embed` 스코프 CSS + 콘텐츠 JSX 유틸 정리 | 전역 셸 무영향·국소·가역 | 유틸/스코프 이중 관리 |
| 글래스 유틸(bg-pn/80·rounded-3xl·blur orb) 제거→플랫 클래스 | 시안 정합 | 다수 라인 수정 |
| 시안 색 토큰을 globals.css `.q-embed` 변수로 | Tailwind theme 오염 0 | arbitrary value 일부 |

**Dependencies:** stock-mini→/dashboard/inventory(존재), 영업→/support(존재). 비교 destination 없음→제외.
**Integration Points:** page.tsx, globals.css, product-completeness.tsx, (검토)quote-tray-bar.tsx, sentinel 14 + 신규.

## 6. Global Test Strategy
- Sentinel readFileSync+regex(기존 패턴). 스타일 단언 sentinel는 신값으로 진화 + 회귀0 블록 보존.
- 신규 sentinel `product-detail-sian-flat`: 96px 썸네일·품명일치·단일 사양카드·항목수 배지·qc-meta·stock-mini route·flat(rounded-3xl/ blur 부재 in .q-embed).
- 실행: `vitest run`(sandbox 조회는 격리 /tmp), build/push = operator.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — [x] Complete
- 시안 추출·현재 정독·라우트 확인·범위/ dead-button 확정 완료.
- Gate: 소스충돌 해소(시안=시각truth), 우선순위 기록. **통과.**

### Phase 1: Sentinel 인벤토리 + 정합 sentinel (Red) — [ ]
- 🔴 스타일 단언 sentinel 전수 grep(detail-contrast-slate100, pd-* 14) → 변경 예정 토큰 목록화. 신규 `product-detail-sian-flat.test.ts` 작성(현재 코드 기준 FAIL 확인).
- 🟢 최소 통과 골격 없음(이 phase는 실패 가시화).
- ✋ Gate: 신규 sentinel 실패가 진짜(현재≠시안), 기존 14 여전히 green.
- Rollback: 신규 테스트 파일 삭제.

### Phase 2: 히어로 + 완성도 — [ ]
- 96px 썸네일·품명일치 배지·키팩트 세로 구분선·완성도 앰버바. blur orb·bg-pn/80·rounded-3xl 제거(.q-embed 플랫).
- ✋ Gate: hero sentinel green, detail-contrast(text-slate-900) 보존, loading/empty 유지.
- Rollback: page.tsx hero 블록 revert.

### Phase 3: 제품 사양 통합 + 안전 reg-link — [ ]
- 상세스펙+제품사양 2카드 → 시안 단일 "제품 사양" 카드(플랫 정의그리드, spec 아이콘, "N개 항목 확인" 배지, 미등록 dashed 1줄). 안전 reg-link 3열 카드 + reg-label/reg-note. MSDS 없음 앰버 배너 유지.
- ✋ Gate: spec-fields/완성도 truth 불변, 화이트리스트 유지, dead button 0.
- Rollback: spec/safety 블록 revert.

### Phase 4: 우측 레일 + 대체품/연관 — [ ]
- qc-meta 행(Cat.No/납기/최소주문)·stock-mini(→/dashboard/inventory)·플랫 CTA(gradient 제거)·영업(→/support). 대체품 카드·연관 시안 스타일.
- ✋ Gate: CTA quote-cart truth 결선 불변, stock-mini/영업 실라우트 연결(dead 0), 모바일 바 정합.
- Rollback: rail/alt 블록 revert.

### Phase 5: Build + Sentinel + 시각검증 + Rollback notes — [ ]
- 🔴 smoke path 정의. 🟢 `vitest run` 전수 green + operator `npm run build`(FAIL_FILE=87 무회귀). dev/배포 기동 시 Chrome 시안(개선토글) vs 배포 대조.
- ✋ Gate: build green, sentinel green, dead button 0, rollback 문서화.
- Rollback: phase별 블록 revert / .q-embed 스코프 제거 시 전역 무영향.

## 9. Risk Assessment
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| sentinel 14 동반 진화 누락 | High | Med | 값 변경 전 전수 grep, false-positive 정밀 패턴 |
| 유틸/스코프 specificity 충돌 | Med | Med | 콘텐츠 유틸 제거 후 .q-embed 단일 정의 |
| dev 미기동→시각 미검증 land | Med | Med | sentinel로 구조 보장, 최종 Chrome은 기동 후 |
| catalog 미가동→빈 페이지 | High | Low | restyle은 렌더규칙, 데이터는 operator catalog |

## 10. Rollback Strategy
- P1 실패: 신규 sentinel 삭제. P2~4 실패: 해당 블록 git revert. P5 실패: .q-embed 스코프/유틸 원복(전역 무영향).

## 11. Progress Tracking
- 완료: 20% (P0). 현재 phase: P1. 블로커: dev 미기동(시각검증 이연). 다음: sentinel 인벤토리.

## 12. Notes & Learnings
- [2026-06-20] 시안=JS 번들이나 `57f41623` gzip 해제로 원본 추출 성공 → 정적 정합 가능(인계 "렌더 필수" 우회).
- [2026-06-20] dead button 3건 라우트 실재 확인: inventory/support 존재, /compare 부재.
- [2026-06-20] 범위 = 콘텐츠 플랫 국소화(.q-embed), 전역 셸 불변(호영님 확정).
