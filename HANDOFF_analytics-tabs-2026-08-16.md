# 인계 — C 트랙 · 지출 분석 탭/액션 분리 fixture 도출 완료

> ## 🔀 다음 세션 첫 줄이 **세 개**다 — 순서 의존은 **없다** (2026-08-16 갱신)
>
> ```
> A  HANDOFF_phase3-entry-2026-08-15.md       Phase 3 <CollapsedRow>  → 제품 상세 화면
> B  DECISION_reorder-handoff-2026-08-15.md   fixture 4화면 1a~1d     → prepare 화면
> C  HANDOFF_analytics-tabs-2026-08-16.md     fixture 3화면 1a~1c     → analytics 화면
> ```
>
> **파일 겹침 0 — 실측:**
> ```
> A  apps/web/src/app/products/[id]/page.tsx · components/products/collapsed-row.tsx
>    __tests__/fixtures/product-detail-comp.json · .render.json
> B  __tests__/fixtures/reorder-handoff-comp.json  (구현 대상 = /quotes/{rfqId}/prepare, 미착수)
> C  __tests__/fixtures/analytics-tabs-comp.json · app/dashboard/analytics/page.tsx
> ```
> → **병렬 가능.** 이 블록이 필요한 이유는 의존 충돌이 아니라 **누락**이다 —
>   "첫 줄" 라벨이 **세 문서에 중복**되어 있어, 한쪽만 보고 출발하면 다른 트랙을 모른다.
>
> ### 🛑 시안 경로 정정 (2026-08-16 실측)
>
> 세 문서의 `C:\Users\young\Desktop\<파일>.html` 표기는 **낡았다.**
> 실제 위치는 전부 `C:\Users\young\Desktop\피드백4\` 하위다 — 정본 md·`.bak.html` 백업도 같은 폴더.
> 해시는 전부 그대로 유효하다(A `6d98bd27…` · B `30b5daae…` · C `8edc9f9b…`).

작성 시각: 2026-08-16
트랙: C (지출 분석 탭) — A(Phase 3 CollapsedRow) · B(재발주 핸드오프) 와 파일 겹침 0
선행: `DECISION_analytics-tabs-2026-08-16.md`
상태: **fixture 도출 완료.** 다음 세션은 이 문서만 읽고 구현에 착수할 수 있어야 한다.

---

## 1. 첫 줄 — 다음 세션은 여기서 시작한다

**`apps/web/src/app/dashboard/analytics/page.tsx` 탭/액션 분리 구현.**

```
착수 차단   없음
fixture     apps/web/src/__tests__/fixtures/analytics-tabs-comp.json  (신규)
대상 파일   apps/web/src/app/dashboard/analytics/page.tsx  (단독)
슬롯        20개 — 1a 1 / 1b 11 / 1c 5 / 공통 3
```

구현 순서 권고: **S1~S5(밑줄형 탭) → S6~S9(액션 행 분리) → S10(페이드 제거) →
S11~S14(데스크톱) → S15~S17(접근성)**. S14 는 S1~S5 토큰을 그대로 재사용하므로
탭 컴포넌트가 하나면 자동 충족된다.

---

## 2. 시안 검증 — 실측

```
sha256 대조   8edc9f9b21eb37933bcd38a061d55422d1a9a3780daeff4ceb93f11d95aa0a4e
              → DECISION §1 정본 해시와 일치. 재해싱 불필요
크기          22,741,557 B (일치)
```

### 헤드리스 렌더 — 뷰포트 4종 전부 고정

```
                390     1440    1920    3840
텍스트노드       40      40      40      40
전 요소          65      65      65      65
pageError        0       0       0       0
```

```
브라우저   /opt/pw-browsers/chromium-1194/chrome-linux/chrome  (playwright 1.56.0)
           🛑 playwright install 금지 — 버전 불일치로 실패
로드       file:// · waitUntil 'load' → "Unpacking" 소멸 대기 + 6s
모집단     #dc-root 서브트리(자기 포함). document 전체로 재면 81 이 나온다
           ← 번들러 로딩 UI(thumbnail svg · loading div) 16개가 섞인다
```

**전 요소 65 는 `#dc-root` 기준이다.** DECISION 의 65 와 일치. 재현 시 모집단을 먼저 맞출 것.

### 분리 계상 — 축을 적는다

```
UI 텍스트                 24
시안 자체 라벨 labels[0]    3   (섹션 eyebrow — 대조 대상 제외)
annotation_excluded       10   (섹션 배지 3 + 주석 박스 7)
doc_header_excluded        3   (배지 "1" + 문서 제목 + 부제)
─────────────────────────────
합                        40
```

직전 트랙 QA 오탐(주석 포함)의 재발 방지축이다. **fixture 라벨 27 은 UI 24 가 아니다.**

---

## 3. 🔴 측정층 발견 — DECISION §4-C 근거 정정

**잠금값은 안 바뀐다. 근거가 바뀐다.**

```
md §1 line 19      밑줄 2.5px #2563eb
시안 authored      border-bottom:2.5px solid #2563eb     ← md 와 일치
렌더 computed      2px   (deviceScaleFactor 1 · 2 양쪽 동일)
```

DECISION §4-C 는 "시안 1b 실측 2px → 시안 오차로 등재" 로 판정했다.
**시안은 md 를 위반하지 않았다.** Chromium 이 border-width 를 정수 device px 로
스냅한 것이고, 이는 렌더 측정층 아티팩트다.

```
축 1 (정적추출 ↔ 렌더 → 렌더가 이긴다) 를 여기에 기계적으로 적용하면 2px 이 이긴다 — 오답이다.
축 1 은 "같은 문서의 두 도출 방법" 규칙이고, 이건 브라우저가 authored 값을 못 보여주는 경우다.
```

**귀결 — 게이트 설계에 직결된다.**
border-width 계열을 렌더 computed 로 검사하면 **영구 RED** 가 난다.
이 축은 소스 문자열(authored)로 검사한다. fixture `_대조규칙.border_width` 에 박아뒀다.

---

## 4. md 잠금 슬롯 2건 — fixture 주석 명시 완료

```
① 1c 데스크톱 탭 스타일 = 밑줄형
   시안: 칩형 (radius 10px · padding 8px 15px · 선택 bg #2563eb/#fff · border-bottom 0)
   🛑 "이_슬롯은_시안이_정본_아님": true        ← fixture _md_override · 1c spec_slots S14
   폐기근거: md §1 line 17 "칩 스타일 폐기 — 필터로 오인됨"
   시안 수정: 하지 않음 (칩 4개 → 밑줄 전환은 바이트 치환 범위 밖)

② 1b 밑줄 두께 = 2.5px
   🛑 "이_슬롯은_시안_렌더가_정본_아님": true   ← §3 정정 반영
   시안 authored 는 정합. 정본이 아닌 것은 시안이 아니라 렌더 computed 값이다
```

⚠️ ①과 ②는 **다른 종류의 불일치**다. ①은 진짜 시안 위반, ②는 측정층 아티팩트.
fixture 는 둘을 분리해 표기했다 — 같은 라벨로 묶으면 다음 세션이 ②를 시안 탓으로 읽는다.

---

## 5. 🛑 커버리지 계수 — md 명세 17 / QA 6 / 미덮임 11

**이번 위반(1c 칩형)은 검사가 잡은 게 아니라 시안이 우연히 어겨서 드러났다.**
시안이 md 를 지켰으면 QA 6항목 전부 GREEN 이고 명세는 검사 밖에 남는다.

### QA 가 덮는 명세 — 6건

```
Q1 390px 스크롤 없이            → S6 (액션 행 분리)
Q2 disabled 사유 인라인          → S9
Q3 헤더 우측 · 탭 행 버튼 0      → S11 · S12
Q4 팀별 보기 진입 (dead branch)  → S13
Q5 페이드 span · overflow 잔존 0 → S10
Q6 버튼 높이 42px 통일           → S6
```

### 🔴 QA 밖 명세 — 11건 (전부 fixture 슬롯으로 직접 앵커)

```
S1  탭 밑줄형 교체 (칩 폐기)        → 1b.spec_slots S1-tab-style-underline-mobile
S2  행 gap 22px · border-bottom 1px → 1b.spec_slots S2-tab-row-container
S3  선택 13.5/700 #0f172a + 2.5px   → 1b.spec_slots S3-tab-selected-token   🛑 md 잠금
S4  비선택 13.5/500 #64748b         → 1b.spec_slots S4-tab-unselected-token
S5  무데이터 #94a3b8 + 빈 상태 안내  → 1b.spec_slots S5-tab-nodata-token
S7  예시 버튼 #fff/#e2e8f0/#475569  → 1b.spec_slots S7-btn-example-token
S8  생성 disabled #e2e8f0/#94a3b8   → 1b.spec_slots S8-btn-generate-disabled-token
S14 데스크톱 밑줄형 통일             → 1c.spec_slots S14-...-desktop          🛑 md 잠금
S15 role="tab" + aria-selected      → spec_slots_공통 S15-tab-role-aria
S16 aria-disabled + describedby     → spec_slots_공통 S16-...
S17 히트 영역 44px                  → spec_slots_공통 S17-hit-area-44
```

**md QA 에는 탭 스타일·토큰·접근성 검사 항목이 하나도 없다.**
S14 가 커버리지 구멍의 대표 사례다 — 우연이 아니었으면 안 잡혔다.

### 🔴 md 내부 충돌 1건 — 신규 발견

```
S6  버튼 높이 42px 통일   (md §1 line 22)
S17 히트 영역 44px 유지   (md §3 line 37)
42px < 44px
```

시각 높이와 터치 영역을 분리해서 만족시킨다 (padding / ::after 확장).
**둘 중 하나를 버리지 말 것** — 버리면 나중에 "왜 42인가/왜 44인가" 가 다시 돈다.

---

## 6. fixture 산출

```
경로     apps/web/src/__tests__/fixtures/analytics-tabs-comp.json
형식     apps/web/src/__tests__/fixtures/product-detail-comp.json 승계 (신규 형식 발명 0)
```

### 라벨 축

```
total_label_count          28   (정본 — `누적 시` 모바일 추가 반영)
mockup_render_label_count  27   (시안 실측)
대조 대상                  25   (labels[0] 3건 제외)

1a  8   Before 현행 재현 — 🛑 구현 대상 아님. 회귀 금지 기준
1b 10   After 모바일 (<sm)  — 시안 9 + 채택 `누적 시` 1
1c 10   데스크톱 (sm+)      — 시안 = 정본 (라벨 축 한정)
```

**앵커를 낮추지 말 것.** 낮추면 로딩 실패가 "불일치 0" 으로 위장한다(직전 트랙 §7.6 규칙).

### 슬롯 축

```
1a   1  (회귀 금지)
1b  11  (S1~S10 + 채택 A1)
1c   5  (S11~S14 + 채택 A1)
공통  3  (S15~S17)
──────
합  20   그중 QA 미덮임 13 (md 명세 11 + 채택 2)
```

### 토큰 축 — 🛑 자기 무결성 전용

```
colors 항목수/합계   1a [12, 25]  ·  1b [13, 22]  ·  1c [11, 28]
```

```
colors      렌더와 fixture 는 모집단이 다르다. 구현 대조에 쓰지 말 것
1c 토큰     칩형 시안 실측이다. 밑줄형 전환 후 값이 바뀐다 — 구현 대조 금지
radius      전 요소로 잰다. 텍스트노드 부모만 재면 컨테이너 radius 를 놓친다
정규화      3자리 shorthand → 6자리 확장 (#fff → #ffffff).
            직전 fixture 에는 없던 규칙 — 이 시안이 shorthand 를 쓴다
```

---

## 7. 앵커는 식별자다 — 라인 번호 금지

md 라인 표기가 근사다. 오프셋이 일정하지 않아 단순 시프트가 아니다.

```
md 표기   L405 tabs · L430 탭 행 · L692 team 렌더
실제      L404        · L430 (정확)  · L689
오프셋    -1 / 0 / -3
```

fixture 는 전부 식별자로 앵커했다:

```
type AnalyticsTab                          타입 선언
const tabs: { id: AnalyticsTab; ... }[]    탭 배열
activeTab / setActiveTab(tab.id)           상태
onClick={() => setReportModalOpen(true)}   AI 리포트 예시 버튼
onClick={runAiAnalysis} disabled={aiLoading || dataInsufficient}
                                           AI 리포트 생성 버튼
title={dataInsufficient ? "리포트 생성에 최소 1건의 …" : undefined}
                                           S9 가 대체할 툴팁
`§mobile-budgets §3` 주석 직후 span (bg-gradient-to-l from-canvas to-transparent, aria-hidden)
                                           S10 이 제거할 페이드 힌트
```

---

## 8. dead branch — 실측 확정 (재조사 불필요)

```
type AnalyticsTab               "overview" | "vendor" | "anomaly" | "team"   team 이 타입엔 있음
useState<AnalyticsTab>          "overview"                                    초기값
const tabs                      [overview, vendor, anomaly]                   team 없음
setActiveTab(tab.id)            유일한 호출
{activeTab === "team" && <TeamAnalyticsView />}                               렌더 존재
URL·쿼리·라우터 기반 설정        0
```

**`activeTab` 이 `"team"` 이 될 경로 0.** S13 이 `{ id: "team", label: "팀별 보기" }` 를
tabs 에 넣으면 해소된다. `<TeamAnalyticsView />` 는 이미 있으므로 신규 컴포넌트 0.

### ⚠️ 식별자 오염 — `sc-camel-active-tab`

```
시안 파일 내   'sc-camel-active-tab'  1건   ← 주석문
               'activeTab'            0건
실제 소스      activeTab === "team"          ← 이쪽이 맞다
```

시안 생성 파이프라인이 camelCase 를 kebab 클래스명으로 오인 변환한 흔적(`sc-` = styled-components 계열 접두어).
**주석문이므로 UI 아님 — annotation_excluded 로 분리 계상돼 fixture 에 안 들어간다.**
다만 다음 세션이 실제 식별자로 읽을 위험이 있어 fixture S13 슬롯에도 박아뒀다.

---

## 9. 채택 — `누적 시` 배지

```
출처    시안 1c `이상 지출 감지` 탭 내부. md 미명세
판정    md §1 line 21 의도의 UI 구현 → 상충이 아니라 보강. 채택
확장    모바일(1b)에도 추가
근거    1b 프레임 x461 w390 · 탭 3개 끝단 x723 · 프레임 우측 x851 → 여유 128px > 배지 39px
토큰    9.5px/700 · bg #f1f5f9 · color #94a3b8 · padding 1.5px 6px · radius 99px
```

QA line 41(390px 스크롤 없이)과 충돌 0. md §2 line 32 "모바일/데스크톱 통일" 원칙과도 정합.

---

## 10. em dash — 이 트랙의 상태

```
UI 문구       0건   (DECISION §1 치환 완료 — "AI 리포트 생성 · 완료된 발주 1건 이상 필요")
문서 제목/주석 4건   위반 아님 — 적용 범위 밖 (DECISION §2)
              "지출 분석 — 모바일 탭/액션 분리" / "Before — 현행 (한 행 5개)" /
              "After — 탭 행 / 액션 행 분리" / "데스크톱 (sm 이상) — 헤더 우측 정렬"
```

**labels[0] 3건에 em dash 가 남아 있는 것은 정상이다.** fixture `_분류판단.em_dash` 에 근거를 박아뒀다.
범위 문구 없이 조항만 올리면 여기서 오탐 4건이 난다 — CLAUDE.md 승격 문안(DECISION §2)에
적용 범위가 함께 들어가야 하는 이유다.

---

## 11. 미착수 — 다음 배치 몫

```
conformance test   analytics-tabs-comp.json 용 vitest sentinel 미작성.
                   product-detail-comp-conformance.test.ts 형식 승계 예정.
                   ⚠️ 이번 세션은 sandbox 라 vitest 실측 불가(npm install 금지) — 작성만 하고
                     GREEN 을 주장하면 직전 트랙과 같은 형태의 오주장이 된다. 그래서 미작성.
compareLabels()    소싱 트랙 Phase 3 EXIT 에서 렌더 산출물에 배선된다.
                   그 전까지 게이트 GREEN = fixture 자기 무결성만 의미한다 (이 트랙도 동일)
CLAUDE.md          em dash 조항 승격 — 총괄 몫 (DECISION §2 문안 그대로, 범위 문구 포함)
```

---

## 12. 이 세션이 남기는 한 문장

> **"시안이 md 를 어겼다" 와 "렌더가 시안을 못 보여준다" 는 다른 사건이다** —
> 1c 칩형은 전자고 1b 2.5px 는 후자다. 잠금값이 같다고 같은 라벨로 묶으면,
> 다음 세션은 고칠 필요 없는 시안을 고치러 간다.
