# ▶ 다음 세션 착수 순서 (2026-08-24 갱신 · 이 블록을 먼저 읽는다)

> 아래 본문은 **2026-07-05 기준이라 오래됐다.** 역할·통제 구조(§0)만 유효하고
> 나머지는 이력이다. 지금 착수할 것은 이 블록이다.

## 1순위 — §purchased-falls-through-to-not-sent (위험 button)

`docs/handoff/CARD_purchased-falls-through-to-not-sent.md`

이월 중 유일하게 **되돌릴 수 없는 외부 부작용**에 도달한다. PURCHASED 견적에 [발송]
CTA 가 붙고, `isSelectable` 이 같은 축이라 일괄 체크박스로 여러 건이 한 번에 재전송된다.

🔑 **착수 순서 주의 (로컬 세션 판정 2026-08-24):**
```
먼저   isSelectable 차단 — 표시가 틀린 건 오정보지만 일괄 선택은 실행이다
       두 축이 같은 함수를 쓴다는 것이 결함의 원인이므로 분리 자체가 수정의 일부다
       화면 문법 판정을 기다리는 동안에도 선택 축은 막을 수 있다
나중   RailState 문법 판정 — PURCHASED 를 넣을지 퍼널 밖으로 뺄지 (카드의 측정 5항목)
```

⚠️ **오독 주의.** 이 증상은 지금 화면에서 안 보인다. 견적 6QRG 가 4상 취소로 COMPLETED
로 돌아가 조건(PURCHASED)이 없어졌기 때문이지 고쳐져서가 아니다. 재현하려면 발주를
다시 접수해야 한다.

## 이월 (우선순위 순)

```
1  🛑 3상 미실측          order_confirmed 원장 · 단일 차감(이중 계상 0)이 계약 테스트로만
                          증명돼 있다. 프로덕션 실측 0. P0~P4 "완료" 로 읽지 말 것.
                          PurchaseRecord 0 인 견적을 **정상 흐름으로** COMPLETED 까지 올려서
                          실측 — DB 로 밀면 검증 대상 경로를 건너뛴다.
                          후보 7건: cmsg9zzut… · cmsg9vqk5… · cmqrnil47… · cmqj9raak…
                                    cmqtqoebr… · cmqnj71gb… · cmqjfi5ef…
2  위험 button           위 1순위 (실행에 도달하는 유일한 항목)
3  §money-path-behavior-suite-red   돈길 behavior 4건 RED (넉 달) · 승계/은퇴 판정 선행
4  P3-4                  /quotes/[id] 리다이렉트 흡수 — 6건 기능 이식 선행 · sentinel ③④ skip 대기
5  레거시 구멍            PurchaseRecord.orderId additive DDL — 별도 슬라이스·별도 승인
6  DB 비밀번호 회전       열린 리스크 (호영님 보류 중 · 개발단계 판정)
```

## 오늘 확립된 규칙

```
게이트 스코프   라우트 파일을 건드리는 커밋은 그 라우트의 __tests__/api/<경로> 를 포함한다
배포 확인       /api/health 의 migrations.manifestGeneratedAt vs 커밋 시각
                (Vercel MCP·Chrome 불필요 · 공개 엔드포인트)
                ⚠️ "언제 빌드됐나" 이지 "무엇이 빌드됐나" 가 아니다 — 재배포·롤백이면
                시각은 나중이어도 코드는 옛것. VERCEL_GIT_COMMIT_SHA 를 얹으면 동일성이 된다.
인벤토리 2축     "어디 있나"(위치) vs "누가 그것에 기대나"(피의존) — 둘 다 P0 에 넣는다
목 규율          목이 where 를 실제로 적용하게 만든다. 안 하면 목이 필터 회귀를 흡수한다.
```

---

# 새 세션 인계 지시문 — LabAxis (2026-07-05 기준)

> 이 문서를 **세션 시작 시 먼저 읽고** 이어가세요. CLAUDE.md(레포 루트) 컨벤션과 함께 강제됩니다.

---

## 0. 역할·통제 구조 (필수 숙지)

- **호영님 = CEO.** 코드/DB/터미널 직접 접근 안 함. 모든 개발을 Claude에 위임. **순수 기술 확인(project-ref 등)은 호영님께 묻지 말 것** — Claude/operator 선에서 처리. 호영님껜 **실제 결정**(스키마 go, 규제값, 방향)만 여쭙기.
- **Cowork(현 세션) = sandbox.** 워킹트리 구현 + `present_files`. **push 금지, prod DB 접근 금지.**
- **operator(클로드코드) = build/commit/push + migration 실행.** sandbox가 구현 → operator가 빌드·테스트·푸시.
- **리듬:** Cowork 구현 → operator 빌드·푸시 → 회신 → 다음 단위. 섹션/phase 단위로 반복.

## 1. 🛠 작업 방식 교훈 (이 세션에서 확립)

- **sandbox bash 마운트가 stale/truncated** — 큰 파일에서 grep/line-count/div-balance가 실제와 불일치. **검증은 반드시 Read 툴(ground truth) 우선.** bash는 top 영역·작은 파일에만 신뢰.
- **build 실행 시 필터 파이프 금지** — `Select-String` 등 파이프가 exit code를 오염(과거 "exit 255" 오인). `npm run build --workspace=web` 단독 실행.
- **sentinel = readFileSync+regex** (vitest). 신규 기능마다 회귀 0 블록. 코드 문자열 assert는 **동적화 시 stale** → old-value sweep 후 진화 필요(예: 하드코딩 fetch URL 바뀌면 그 assert도 갱신).
- **orphan import 제거** — 기능 제거 시 남는 import는 lint 게이트 실패. 함께 정리.
- **migration = operator + 호영님 "진행" 게이트.** dry-run → 평이한 한국어 영향 보고 → 승인 후 apply. additive/default로 무회귀.

## 2. ✅ 이번 세션 완료 (전부 origin/main 라이브)

### A. 설정(Settings) 고도화 §1~§4 — `apps/web/src/app/dashboard/settings/page.tsx`
- §1.3 거버넌스 칩(SectionCard governance) · §1.4 승인한도 amber · §1.5 워크스페이스 연결 CTA · §1.6 세션 read-only · §1.7 활동로그 제거
- §2 금액별 승인 규정(ApprovalTierRow 배지·구간·막대, amber #b45821) · 역할 3템플릿(RBAC enum 무변경)
- §3 알림(중복토글 제거·2열 매트릭스·email 기본값 5건) · §4 청구(특전칩·결제수단카드·등록모달 PCI 준수)
- 커밋: `439c87c2`(§1) · `46dd7c7e`(§2) · `700ebc6a`(§3) · (§4 커밋)

### B. 운영 지원 센터 고도화 P1~P5 — `apps/web/src/app/dashboard/support-center/page.tsx`
- P1 통합검색+⌘K(`7f557c92`) · P2 안전카테고리+리더+AI 근거검색(`1a2fb7b6`) · P3 칩6+아코디언+프리필(`58ae8d44`) · P4 파이프라인+SLA+답변본문+CSRF fix(`c667556a`) · P5 종결
- **§5 AI 도우미 = 근거 검색형**(매뉴얼 인덱스 실매칭, LLM 생성/할루시네이션 0). 이 원칙 유지.
- 계획: `docs/plans/PLAN_support-center.md`

### C. SM-S1 안전 대상 카테고리 org 설정 — 트랙 종결
- P1 스키마(`Organization.safetyCategories String[] @default(["REAGENT"])`)+migration(prod apply)+엔드포인트(`GET/PATCH /api/organizations/[id]/safety-settings`) `40d2ee89`
- P2 safety API category 다중값 `in[]` `01ddd8bd` · P3 안전페이지 토글+fetch 동적화 `d8861abc`
- **무회귀 핵심:** 설정 없으면 REAGENT(2026-07-04 "안전=시약 한정" 보존). 계획: `docs/plans/PLAN_SM-S1-safety-categories.md`

## 3. ⏳ 미결 — 호영님 결정/입력 필요

- **DMSO H227** — 보유 SDS에 H227 있으면 `hazardCodes:["H227"]`, 없으면 빈 배열. 회신 시 CAS 55종 표 확정. (규제값이라 임의 확정 금지)
- **SM-P4d** — 데모 시약 org 정합(young을 org-bioinsight-lab 멤버+ProductInventory 시딩) go/no-go. 선택(필수 아님).
- **안전 e2e smoke** — 배포 후 브라우저 실증: SM-S1 토글 저장 200·목록 재스코프, 지원센터 문의 CSRF 200(엣지 런타임이라 빌드로 못 잡음).

## 4. 📋 등록된 후속 트랙 (착수 가능, 지정 필요)

- `#settings-role-member-count` — 설정 §2.3 실 멤버수 규모-적응(멤버 API 배선)
- `#settings-notification-persist` — 알림 선호 실 지속(현 handleNotificationSave=no-op, 엔드포인트+스키마 필요=operator)
- `#billing-pg-billingkey` — 결제수단 실 PG(토스페이먼츠) 빌링키 연동
- `#support-ai-rag` — 지원센터 AI 실 RAG(현재는 인덱스 검색형)
- MSDS 카테고리 확장 후속(SM-S1 이후 UX 다듬기)

## 5. 🚫 제품 원칙 (CLAUDE.md 발췌 — 위반 금지)

workbench/queue/rail/dock 유지 · same-canvas · canonical truth 보호 · **page-per-feature 금지** · **ontology를 chatbot/command-palette로 재해석 금지**(단 §5 AI 도우미·⌘K는 호영님 승인된 예외) · **dead-button/no-op/placeholder success 금지** · 주의색 = muted amber `#b45821`(쨍한 yellow 금지) · 지원센터를 퍼블릭 hero hub로 회귀 금지.

## 6. 다음 세션 첫 액션 권장

1. 이 문서 + CLAUDE.md 읽기.
2. 호영님께 다음 트랙 지정 요청(§3 결정 항목 또는 §4 트랙 중).
3. 멀티-surface/스키마 트랙이면 **labaxis-feature-planner 스킬 → truth reconciliation → 승인 → 구현**.
4. 구현은 Read 툴 검증 우선, operator에 빌드·푸시 핸드오프.
