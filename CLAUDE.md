# CLAUDE.md — LabAxis 개발 컨벤션

이 문서는 LabAxis repo 에서 코드 작업 시 참조하는 운영 컨벤션입니다.
개발팀 (Claude / Cursor / Cowork) 이 매 batch 마다 읽고 강제합니다.

---

## Product Constraints (절대 원칙)

LabAxis 는 generic SaaS 가 아니라 **연구 구매 운영 OS** 입니다.

- ✅ workbench / queue / rail / dock 구조 유지
- ✅ same-canvas 우선
- ✅ canonical source of truth 보호 (UI state / overlay store 가 truth 대신 들지 못함)
- ❌ page-per-feature 회귀 금지
- ❌ ontology 를 chatbot / assistant / terminal / command palette 로 재해석 금지
- ❌ AI / chatbot UI 신규 제안 금지
- ❌ dead button / no-op / placeholder success / debug / raw label / internal key 금지
- ❌ support center 를 퍼블릭 hero hub 처럼 되돌리기 금지
- ❌ inventory generic reorder 가 expired lot dispose 보다 먼저 뜨는 방향 금지
- ❌ quotes / purchases / orders 를 page-per-feature 로 분절 금지

---

## 타이포 — 구분자

전역 조항. 모바일/데스크톱·화면 종류 무관하게 적용합니다.

- em dash(—, U+2014) UI 문구 사용 금지. 구분자는 가운뎃점(·) 사용.
  적용 범위: 화면에 노출되는 라벨·안내·상태 문구. 문서 제목·주석은 제외.
  이력: 08-09 소싱 md §4 line 48 도입 → 08-01(30b5daae)·08-02(8edc9f9b) 소급 적용.

### 판별 방법 — UI 축 분리

명세 md 에서 UI 문구는 **백틱으로 감싼다.** 검사는 **백틱 span 안**만 본다.

```
UI 축     `발송 검토로 · 공급사 지정 필요`    → 조항 적용
서술 축   "…카드는 발송 검토로 — 즉…"          → 조항 미적용
```

백틱 span 안이라도 **경로·식별자·클래스명은 제외**한다(`docs/specs/…` · `activeTab`).

### 판별 방법 — 소스 파일(.tsx/.ts)

명세 md 와 축이 다르다. 소스에는 백틱 span 이 없다. **문자열 리터럴 · JSX 텍스트만** 본다.

```
적용    "…" · '…' · `…` 안의 화면 노출 문구  ·  JSX 텍스트 노드
        예: reason: `단일 건 ${x} — 고액 지출`   → 조항 적용
제외    // 라인 주석  ·  /* 블록 주석 */  ·  {/* JSX 주석 */}
        예: // §11.244 #6 — 호영님 P0: …        → 조항 미적용
```

🛑 **placeholder 는 제외한다.** `—` 단독은 구분자가 아니라 **빈 값 표기**다.

```
대상   앞뒤에 텍스트가 붙어 있으면 구분자      `완료 — 3건` · `A — B`
제외   문자열 전체가 "—" 이거나 ?? / : 뒤 단독 값이면 placeholder
       `{x ?? "—"}` · `dDayLabel(null) → "—"`
```

이건 조항 취향이 아니라 **계약 충돌**이라서다 — `quote-management-p1` 은 `dDayLabel(null) === "—"`,
`rfq-document-redesign` 은 `?? "—"` fallback 을 **계약으로 잠그고 있다.** placeholder 까지 걸면
그 둘이 RED 가 된다. 조항이 기존 계약을 깨면 그 조항이 틀린 것이다.

🛑 **파일 전체 `grep —` 를 갱신 대상으로 쓰지 말 것.**
   2026-08-16 실측 `dashboard/analytics/page.tsx`: 총 **43건** 중 UI 문구는 **5건**.
   38건은 주석이다. 범위만 보고 잡으면 **주석 38건이 오탐**으로 돈다.

🛑 판별은 손으로 하지 말고 **`__tests__/_helpers/em-dash-scan.ts`** 를 쓴다.
   `^\s*//` 만 지우는 구현은 **줄 끝 주석**을 놓친다(2026-08-16 실측: UI 4건으로 셌으나 실제 2건).
   조항의 집행 도구가 조항보다 좁으면 조항이 없는 것과 같다.

🛑 **적용 범위는 파일 전체다.** 슬롯 축·명세 축으로 돌리면 그 목록 밖 문구가 남는다.
   2026-08-16 실측: fixture 3열 대조로 찾은 2건만 고치고 커밋했는데,
   판별기를 파일 전체에 돌리자 `— 탭해서 지정`(L175)이 더 나왔다.
   그 줄은 시드 슬롯이라 **축 C 가 잡지 않는 자리**였다 —
   조항 소급은 게이트 커버리지와 축이 다르므로 도구를 **파일 단위**로 돌린다.

⚠️ 소급 치환 전 **옛 문안이 sentinel 에 핀됐는지 먼저 grep** 한다.
   패턴이 em dash 를 넘어가면 치환이 RED 를 만든다. 넘지 않으면 무손상이다.

🛑 **전체 행 수를 갱신 대상으로 쓰지 말 것.**
   2026-08-16 실측: 정본 3종 총 **47행** 중 UI 축은 **2행**. 45행은 서술이다.
   범위 문구만 있고 판별 방법이 없으면 이 45행이 **오치환**된다.


⚠️ 적용 범위를 같이 읽을 것. 범위 없이 잡으면 문서 제목·주석까지 걸려 오탐이 난다
(08-02 시안 실측: UI 1건 · 문서 제목/주석 9건).

---

## Mobile Patterns

§11.311 (호영님 P1 2026-05-26) 결정 — "더보기" 하위 화면 외에도 모든 모바일
UI 에 적용하는 공통 원칙. 신규 화면 / 모바일 UX 작업 시 자동 강제.

### 1. KPI 카드 — 한 줄 압축

- KPI 3 개 이하: `grid-cols-3` (모바일 포함 한 줄)
- KPI 4 개: `grid-cols-2` × 2행 또는 `grid-cols-3 lg:grid-cols-4` (4번째는 lg+ 만)
- 카드 패딩 컴팩트: `p-3 md:p-4` (이전 `p-5` 금지)
- 아이콘 인라인 4px: 라벨 옆 인라인 (이전 `w-10 h-10` 컨테이너 + 아이콘 박스 금지)
- count 폰트: `text-lg md:text-xl` (이전 `text-2xl md:text-3xl` 금지)
- 0건 비활성 톤: `bg-gray-50 border-gray-200` + text `text-gray-400`
- 1+건 활성 톤: `bg-white border-slate-300 shadow-sm` + text `text-slate-900`
- 경고/위험 1+건 시 §11.302 red 톤: `bg-red-50 border-red-200 text-red-700`

### 2. 액션 버튼 — 3 개 초과 시 kebab

- 모바일 3 개 이하: `flex` 가로 노출
- 모바일 4 개 이상: 단일 kebab button (`<MoreHorizontal>`) + `<Sheet side="bottom">`
  - sheet 안에 4 button 세로 노출 (각 `h-11 justify-start`)
  - 데스크탑 (md+): 원래 4 button 그대로 노출 (`hidden md:flex`)
- 잘림/overflow 0 보장 (375px 기준)

### 3. First fold 도달

- 필터/배너/KPI 합산 높이가 화면 50% (≈ 350px) 초과하면 안 됨
- AI 인사이트 0건 시 1줄 muted (`bg-gray-50`, `text-gray-500`, ~40px) — 그라데이션 항상 노출 금지
- 활동 내역/리스트가 첫 fold 내 1건 이상 노출

### 4. 0건 상태 최소화

- 데이터 없는 KPI/위젯은 축소/회색 비활성 톤
- empty state 는 컴팩트 (큰 일러스트레이션 + 긴 문구 금지)
- 0건 KPI 카드의 폰트는 `text-gray-400` (활성 1+건 대비 약 30% 약화)

### 5. 브레드크럼 생략

- 모바일에서 eyebrow (예: "보안 및 컴플라이언스") 는 `hidden md:flex`
- 모바일 뒤로가기 네비게이션으로 충분

### 6. 필터 가로 인라인

- 필터 컨테이너 `flex flex-col md:flex-row` 패턴 금지
- 모바일 포함 항상 `flex flex-row gap-2`
- 필터 select width: 모바일 `w-[120px]`, 데스크탑 `md:w-[140px]~[160px]`
- 검색 input: 데스크탑 `hidden md:flex max-w-sm`, 모바일 `<Search>` 아이콘 button → 탭 시 input expand (`isSearchExpanded` state)

### 7. 제목 + 건수 통합

- 제목 옆에 건수 인라인: `<h2>감사 증적 <span>· N건</span></h2>`
- 설명문에 "총 N건" 묻혀있는 패턴 금지 (제목으로 끌어올림)
- 설명문 자체는 모바일 `hidden md:block` (간단한 한 줄도 first fold 절약)

### 8. 터치 영역 ≥ 44px

- 모든 인터랙티브 element: `h-10 w-10` 또는 `min-h-[44px]` (iOS HIG 정합)
- icon-only button: `h-10 w-10` 정사각 (자체 area 보장)
- sheet 안 button: `h-11 justify-start` (한국어 라벨 잘림 방지)

### 9. 색상 — §11.302 신호등 체계

- 위험 (즉시 결품, 0 재고): `bg-red-600 text-white` (배지) / `bg-red-50 border-red-200 text-red-700` (큰 카드)
- 긴급/주의 (낮은 재고, 만료 임박, 검토 필요): **yellow 신호등** — 배지 `bg-yellow-100 text-yellow-700 border-yellow-200`, 큰 카드 `bg-yellow-50 border-yellow-200 text-yellow-800` (§11.283a/302c/302d, 15+ sentinel 잠금)
- 정상: `bg-emerald-100 text-emerald-700` (배지)
- 정보 (실행 가능 CTA): `bg-emerald-600 text-white` (primary), `bg-blue-600 text-white` (분석/검토)
- ✅ 주의색 = **yellow 신호등**(§11.283a/302c/302d — 만료임박·검토·낮은재고). ❌ Tailwind `amber-*`/`orange-*` 금지 유지(16 amber-removed sentinel — 밝은 amber 눈피로로 yellow/red 통일 sweep). 위험=red, 정상=emerald.
- ⚠️ **#b45821 muted amber 이전(2026-06-30 지향)은 미채택/보류** (호영님 2026-07-10 §P6 재결정): 라이브 yellow 신호등 + 15+ inventory sentinel(kpi-283a·priority-banner-302d4·cardbg-302d2·context-320 등)이 yellow=주의를 잠금 → 전환 시 source ~76 spot + sentinel ~15개 재작성·283/302 신호등 반전 필요(대공사, 별도 신중 배치 대상). 재개 시 근거·범위 재승인 후.
- 📌 **302c·302d-1 은퇴→승계 (2026-08-06, §inventory-dead-file-cleanup 2차 — 호영님 분류표 승인)**: 구 302c(KPI)·302d-1(badge) 원 판본은 dead file(`inventory-main.tsx`, importer 0) 세대의 구현 내부명/라인 종속 잠금이라 은퇴. **정책(yellow=주의·amber 금지·위험=red·정상=emerald)은 불변** — yellow=주의 잠금은 라이브(`inventory-content.tsx`) 표면에서 **283a(KPI 만료임박=yellow·재주문=red·안전재고미달=red·0건 톤다운)·302d-2(getCardBg `expiring`→yellow-100)·302d-1 재앵커("우선 사용" Badge yellow-100)** 로 승계 유지(vitest GREEN 실측). 위 계열 표기 §11.283a/302c/302d 중 **302c 는 이제 색상이 아니라 dead-file 구세대 부활 차단 + isReorderNeeded canonical 로 재정의**됨(line 92 구체 나입 283a/302d4/302d2/320 은 무손상).

### 10. JSX 구조 안정성 (Vercel build 회귀 방지)

- JSX comment 를 ternary branch 안 단독 child 으로 두지 말 것 (§11.303-hotfix-e)
- `{condition ? <A /> : <B />}` 안에 `{/* comment */}` + sibling element 금지 (fragment 필수)
- generic `<Array<{ label: string }>>` nested generic 시 SWC parser bug 회피 (§11.303-hotfix-d)
- CRLF → LF 정합 (`.gitattributes` 강제, §11.303-hotfix-c)

---

## Sentinel Test 패턴

### 패턴 — readFileSync + regex

- vitest 환경에서 file 내용 직접 read + 정규식으로 패턴 검증
- 장점: DB / 컴포넌트 mount 없이 빠른 lint-style 검증
- 사용처: §11.282 / §11.297 / §11.298 / §11.302 / §11.306 / §11.307 / §11.309 / §11.311 / §11.312

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.XXX — feature scope", () => {
  it("Feature pattern", () => {
    const src = read("src/path/to/file.tsx");
    expect(src).toMatch(/expected-pattern/);
    expect(src).not.toMatch(/forbidden-pattern/);
  });
});
```

### fixture 필드 지위 분리 (2026-08-16 승격, 같은 형태 2회)

fixture 안의 필드는 **지위가 다르다.** 섞으면 게이트가 스스로 무너진다.

🛑 **지위는 필드명이 아니다.** fixture 마다 필드명이 다르다 — 이름으로 조항을 쓰면
   다음 fixture 에서 매핑이 끊긴다(2026-08-16 실측: reorder fixture 에는 `expect` 도
   `anchor` 도 없고 정본이 `label` 이었다).

```
정본 필드        기계 검사가 **이것만** 쓴다. 불변.
                 analytics-tabs : expect · expect_text · expect_NOT
                 reorder-handoff: label · _시드종속.fixed
작업지시 필드    구현 **전** 위치 서술. "어디를 고쳐라" 라는 지시다.
                 고쳤으면 stale 이 **정상 종료 상태**다. 갱신 금지 · 삭제 금지 · 검사 금지.
                 구 문자열은 회귀 sentinel 재료다(역계약 승계에 그대로 쓰인다).
                 analytics-tabs : anchor · 현행 · _주의
                 reorder-handoff: (없음 — 오염 위험 0)
```

🛑 **fixture 상단에 두 축이 무엇인지 1줄로 선언한다.** 선언이 없으면 축 배선할 때마다
   다시 묻게 된다 — 2026-08-16 B 트랙 착수가 실제로 그 지점에서 멈췄다.

🛑 위반형: **"검사가 못 찾으니 anchor 를 갱신한다"**
   → fixture 가 구현을 따라가고, 그 순간부터 영구 GREEN 이다.
   구현이 명세를 어겨도 anchor 를 맞추면 통과하므로 명세가 기록으로 강등된다.

실례 2건(같은 계열):
- 2026-08-16 축 C 준비 — anchor 3건이 구현 전 소스를 가리키자 "선행 갱신 필요" 로 처방.
- 직전 트랙 — "앵커를 낮추면 로딩 실패가 불일치 0 으로 위장한다" 로 이미 잠근 형태.

표시가 필요하면 **갱신이 아니라 병기**한다: `"_구현후": "aiReportActions() 로 이동 (<sha>)"`.
원 anchor 문자열은 보존한다.

### 🛑 sentinel 은 **명제**를 단언한다 (2026-09-07 승격 · 같은 날 3건 동시 RED)

**이름 · 통짜 문자열 · 공백 · 순서 · 줄번호는 명제가 아니다.**
**정당한 리팩터링으로 깨지는 단언은 그 자체가 결함이다.**

2026-09-07 상시 RED 3건이 **전부 같은 병**이었다. 나란히 놓으면 방향이 보인다 —
명제에서 멀어질수록 나쁘다:

| 층위 | 핀한 것 | 깨진 이유 | 건 |
|---|---|---|---|
| 식별자 | 컴포넌트 **이름** `<MainHeader />` | 정당한 셸 교체 | §11.303-hotfix |
| 텍스트 | prebuild **전체 문자열** | 스텝 1개 정당 추가 | §11.314-d |
| 바이트 | **공백 정렬** 4칸·7칸 기대 | Prisma 포매터가 열 정렬 이동 | §11.348-B-1 |

바이트 층위는 검사가 아니라 **스냅샷**이다 — 포매터만 돌아도 깨진다.

🔑 은퇴시킬 때는 **지우기 전에 명제를 이력에서 복원**한다. 이름만 보고 지우면 명제를 잃는다.
   살아 있는 명제는 **새 이름으로 옮긴다**(2026-09-07 실례: SH15 append-only ·
   SH17 전후 상태 실캡처 → `regression/audit-durability.test.ts` 로 이관, 축도 함께 옮겼다 —
   메모리 API 가 아니라 DB 접근을 본다).

⚠️ 이 3건은 **누군가 그 코드를 건드렸기 때문에** 드러났다. 안 건드린 코드의 같은 형태는
   전부 잠복 중이다 — 축을 넓히면 나온다(실측: `src/lib/security/__tests__/` 를 축에
   더하자 `csrf-batch10` 3건이 즉시 드러났다).

### 🛑 예외 목록에는 **만료일과 소유자**가 있어야 한다 (2026-09-07 신설)

없으면 목록 대신 **0을 단언한다.**

예외 목록이 있는 sentinel 은 **목록이 커지는 방향으로만** 움직인다. "지금은 위반이지만
알고 있음" 이 하나 들어가는 순간 다음 사람이 하나 더 넣는 비용이 0이 된다.
6개월 뒤엔 목록이 본문보다 길다.

실측 2026-09-07(§page-shell-single-source): 첫 판본이 `my/orders/page.tsx` 를 알려진
위반으로 적고 래칫을 뒀는데, 그 근거가 **내 grep 오탐**이었다(import 줄을 잡았다).
예외를 없애고 `toHaveLength(0)` 으로 바꾸자 그 오탐이 그 자리에서 드러났다 —
**목록이 없으면 헐거워질 수도 없다.**

### 정규식 sentinel — 4원칙 (2026-08-16 승격 · ③ 보강 3회차 · ④ 신설 2회차)

```
① 접두사 포함    `disabled=` ⊂ `aria-disabled=` · `describedby` ⊂ `aria-describedby`
                 → 속성 정규식은 (?<!aria-) 또는 [\s"] 경계 필수. 짧은 속성명 전부 해당
② 창 시작점      슬라이스를 속성부터 열면 **여는 태그 앞부분이 창 밖**이다
                 → 창은 항상 여는 태그(`<button` · `<div`)부터. 속성부터 열지 않는다
③ 검출력 실증    정규식 sentinel 은 주입 프로브로 corrupt → RED 를 확인한다
                 통과만으로는 무효 단언과 구분 불가
                 🛑 **주입 범위 = 단언 창의 union.**
                    표면이 N개 파일이면 N개 전부에 주입한다.
                    `.replace()` 는 첫 건만 바꾼다 — 전량이면 `split-join` 또는 `/g`
④ 대체 매칭      같은 창 안의 다른 요소가 같은 값을 써서 대신 매칭한다
                 → 토큰 단위로 세지 말고 **분기 단위로 묶는다**
⑤ 창은 블록으로  payload·속성 목록을 검사하는 창은 **고정 폭 슬라이스로 열지 않는다**
                 → 블록 경계(여는 중괄호 ↔ 대응 닫는 중괄호 · 함수 시작 ↔ 다음 선언)로 연다
```

⑤ — **같은 형태 3회** (2026-09-05 승격):

payload 에 필드가 하나 늘면 뒤 필드가 창 밖으로 밀려 **계약을 지키는 구현이 RED** 가 된다.
그 자리에서 앵커를 갱신하면 게이트가 스스로 무너진다.

```
1·2회  §receiving-extracted-shape  brand 1줄 추가 → slice(idx, idx+400) 밖으로 밀림
                                   scan-category-touched · scan-registration-category 2건 RED
3회    §scan-spec-carry            specification 1줄 추가 → 같은 자리 또 RED
```

🛑 **판별법이 이 조항의 핵심이다.** RED 가 났을 때 먼저 가른다:

```
구현이 계약을 어겼는가?   → 고칠 대상은 구현. 앵커 갱신은 이때만 쓴다.
검사가 구현을 못 따라갔나? → 고칠 대상은 **검사**다.
```

세 번 다 **후자**였다 — 구현은 계약을 지키고 있었다. 이 판별을 건너뛰면 다음 사람은
앵커를 갱신하고, 그때부터 sentinel 은 구현을 따라다니는 그림자가 된다
(§fixture 필드 지위 분리의 "검사가 못 찾으니 anchor 를 갱신한다" 위반형과 같은 뿌리).

구현 예:
```ts
function multiItemsBlock(src: string): string {
  const start = src.indexOf("items: includedLines.map((l) => ({");
  const end = src.indexOf("})),", start);   // 대응 닫는 자리
  return src.slice(start, end);             // 길이에 좌우되지 않는다
}
```

③의 주입 범위 — **같은 형태 3회** (2026-08-16 승격):

```
1회  §analytics-tabs   /g 누락 — 주석만 치환되고 JSX 가 남아 GREEN
2회  §reorder-handoff  1d 표면 2파일 중 1개만 주입 — 남은 파일이 통과시킴
3회  §reorder-handoff  /g 누락 — `견적 요청 발송 준비` 가 주석 L4 + JSX L92 2회 출현
```

🛑 이건 ③의 보강이 아니라 **③을 성립시키는 조건**이다.
   프로브 GREEN 은 `"단언이 검출력 있다"` 는 결론인데, 주입이 창보다 좁으면 그 결론이 틀린다.
   → **검출력 없는 단언이 land 되고, 게이트가 있는데 안 잡는다.**
   ③ 자체가 무력화되는 형태라 조항 인플레보다 이쪽이 비싸다.

⚠️ 반대 방향도 있다 — **전파 경로는 OR 로 묶지 말고 각각 단언한다.**
   경로가 둘이면 하나가 끊기는 것도 회귀다(실측: `notes: reason` 를 끊어도
   `specialNotes` 가 대신 매칭해 GREEN). ④는 **토큰**을 묶으라는 것이고
   이건 **경로**를 가르라는 것이다 — 대상이 다르다.

④ 실례: 탭 **선택 분기**를 통째로 지워도 A1 배지의 `font-bold` 가 통과시켰고,
**무데이터 분기**를 지워도 같은 배지의 `text-[#94a3b8]` 가 통과시켰다(2026-08-16, 2회).
배지가 탭 행 안에 있고 탭과 같은 토큰을 쓰기 때문이며 **우연이 아니라 구조**다.

🛑 형태를 하나 고쳤으면 **같은 창의 형제 슬롯을 전수 훑는다.**
   ②를 고치고 S5 를 안 봐서 같은 결함이 남았다. 형태 수정 후 형제 미점검은
   이 저장소에서 반복된 형태다(sentinel 옛 값 grep 누락 · anchor 처방 · 이번).

🛑 검출 실패는 **러너를 바꾸면 값이 달라진다** — 프로브 결과에 **러너 기준**
   (config 적용 여부)을 함께 적는다. 격리 러너는 `node_modules` 를 안 건드리는
   대가로 `vitest.config.ts` 를 **안 쓴다.** 2026-08-16 실측: 격리 26/26 GREEN 이
   프로젝트 러너에서 25/26 이었다(`environment: "jsdom"` 미적용). **게이트 정본은
   프로젝트 러너다.** 축 없는 수치는 수치가 아니다.

실례: 2026-08-16 §analytics-tabs. 신규 단언 8종 중 **6/8 만 검출**됐고, 못 잡은 2건이
정확히 ①②였다. 실 `disabled` 배선을 끊어도 `aria-disabled` 가 대신 매칭돼 GREEN 이 떴고,
`title=` 검사 창을 `aria-describedby` 부터 열어 그 앞에 붙은 `title=` 을 놓쳤다.
수정 후 8/8. **③이 없었으면 둘 다 GREEN 인 채로 land 됐다.**

🛑 주입 방향도 맞춘다. 방향 있는 단언(전방 스캔 `X[\s\S]{0,600}?Y`)은 주입도 **X 뒤**에
   넣어야 한다. 앞에 넣고 GREEN 이 뜨면 그건 단언이 아니라 프로브 결함이다 —
   둘을 구분하지 않으면 멀쩡한 단언을 약화시킨다.

### 결과를 읽기 전에 **적용·경계를 먼저 확인한다** (2026-09-07 신설)

프로브와 창은 둘 다 "내가 의도한 범위에 실제로 걸렸는가" 를 먼저 봐야 한다.
안 보면 **아무 일도 안 일어난 것이 GREEN 으로 읽힌다.**

**① 프로브의 GREEN 은 프로브가 적용된 뒤에만 결론이다.**
```
❌ 프로브 치환 → 테스트 실행 → GREEN → "검출력 있음"
✅ 프로브 치환 → git diff 로 **적용 확인** → 테스트 실행 → RED 확인
```
실측 2026-09-07(§invite-invalidation Y3): 앵커가 안 맞아 `.replace()` 가 **아무것도 바꾸지 않았는데**
GREEN 이 떴다. 그 GREEN 은 "단언에 검출력이 있다" 가 아니라 **"소스가 그대로다"** 였다.
치환 실패는 조용하다 — `assert` 를 걸거나 `git diff --stat` 으로 변경 유무를 먼저 본다.
🛑 ③(검출력 실증)이 성립하려면 이 확인이 선행돼야 한다. 주입 범위 조항과 같은 뿌리다.

**② 창 경계는 구문(블록)으로 잡는다. 토큰으로 잡으면 안쪽 토큰에 걸린다.**
```
❌ const start = code.indexOf("const fooMutation");
   const end   = code.indexOf("const ", start + 1);   // 본문 안의 const 에 걸린다
✅ blockFrom(code, code.indexOf("useMutation({", start))  // 중괄호 짝
```
실측 2026-09-07: mutation 본문 안의 `const payload` 에 걸려 창이 `onSuccess` **앞에서** 끊겼고,
계약을 지키는 구현이 RED 로 나왔다. 4원칙 ⑤(창은 블록으로)와 같은 항목이며,
그쪽은 **고정 폭**, 이쪽은 **토큰 경계**가 원인이다.

### 상수를 참조하는 단언 — 심볼이 사라지면 비교가 무의미해진다 (2026-09-05 신설)

정규식 4원칙과 **다른 축**이다. 그건 부정 단언의 매칭 문제이고, 이건 **양성 단언이
심볼을 참조**해서 생긴다.

```
❌ expect(r.source).toBe(SOURCE.UNVERIFIED)   // 멤버 삭제 시 undefined === undefined → 통과
❌ expect(new Set(Object.values(E)).size).toBe(3)   // 개수만 센다
✅ expect(Object.values(E).slice().sort()).toEqual(["A", "B", "C"])   // 이름까지 고정
✅ expect(r.source).toBe("UNVERIFIED")   // 개별 비교도 리터럴로 병기
```

실측 2026-09-05(§scan-unit-guard): `UNVERIFIED` 를 enum 에서 지우는 프로브에
**13건 중 1건만 RED** 였다. 잡은 것은 개수 단언 하나뿐이고, 개별 `toBe(E.X)` 는
양쪽이 `undefined` 라 전부 통과했다.

🛑 **개수 단언으로는 부족하다.** 멤버를 **지우는** 것은 개수가 잡지만,
   **값을 바꾸는** 것(`MODEL: "MODEL"` → `MODEL: "model"`)은 개수가 3 그대로이고
   `toBe(E.MODEL)` 도 `"model" === "model"` 로 통과한다 —
   그런데 **DB·API 에는 다른 문자열이 저장된다.** 값 집합을 리터럴로 고정해야 그게 잡힌다.

⚠️ 이 형태는 enum·상수를 참조하는 **모든** 단언에 해당한다(`lotSource`·`categorySource`·
   `unitSource` 계열만이 아니다). 실측 `grep -c "toBe([A-Z][A-Za-z_]*\.[A-Z_]\+)"` = **11곳**.
   선례: `scan-registration-category.test.ts:175` 이 `CATEGORY_SOURCE.UNKNOWN` 을
   리터럴로 핀해 두었다 — 그 형태를 나머지에도 적용한다.

### 측정값에는 측정 위치를 붙인다 (2026-09-06 신설)

**어디서 잰 값인지 없는 수치는 다른 환경의 판정에 쓰일 때 조용히 틀린다.**

```
❌ 왕복 38ms
✅ 왕복 38ms (서울 → 도쿄 · 로컬 operator-shell)
```

실측 2026-09-06: operator 가 로컬에서 잰 왕복 38ms 로 "13왕복 ≈ 494ms → P2028 은
타임아웃이 아니다" 라고 결론냈다. 그 수치로 가설을 반증한 것 **자체는 옳았다** —
그때 잴 수 있는 유일한 값이었다. 틀린 것은 결론이 아니라 **출처를 결론에 붙이지 않은 것**이다.
나중에 `runtime.region = "iad1"`(미 동부)이 나오자 그 계산의 전제가 통째로 무너졌는데,
"로컬 38ms 기준" 이라고 적어 뒀다면 **그 순간 자동으로 무효화**됐을 것이다.
적어 두지 않았기 때문에 며칠짜리 오판으로 남을 뻔했다.

🛑 이건 `lotSource`·`categorySource`·`unitSource` 와 **같은 원칙**이다 —
   값만 두지 말고 **그 값이 어디서 왔는지**를 함께 둔다. 저장 값에 적용한 규칙을
   측정 수치에도 적용한다.

붙일 것: **어디서**(리전·기기) · **무엇에서 무엇으로**(출발↔도착) · **언제**.
적용 범위: 커밋 메시지·계획서·주석·보고 — 수치를 남기는 모든 자리.

### 🛑 파일을 프로그램으로 쓸 때는 개행을 명시한다 (2026-09-07 신설 · **같은 날 2회 재발**)

```
❌ python  io.open(F, "w", encoding="utf-8")        # Windows 에서 \n → \r\n 로 번역된다
✅ python  io.open(F, "w", encoding="utf-8", newline="")
✅ node    fs.writeFileSync(F, s, { encoding: "utf8" })   # 번역 없음
쓰기 후:   CR 바이트를 센다.  for (const x of buf) if (x === 13) cr++
```

**왜 조용한가 — `git diff` 가 답하지 못하는 질문이다.**
`.gitattributes` 의 `* text=auto eol=lf` 가 **커밋 시** 정규화하므로 `git diff --stat` 은
내용 변경만 보여준다. 그런데 **vitest 는 워킹카피 바이트를 읽는다.** 그래서
"diff 4줄" 인데 sentinel 이 무더기로 깨진다.

실측 2026-09-07 · 같은 날 2회:
```
1회  schema.prisma 전체 CRLF(3623 CR) → enum 파서 /\/\/.*$/ 가 \r 을 못 넘어
     `REAGENT // 시약` 이 통째로 멤버가 됨 → 무관한 sentinel 2건 RED
     (JS 의 `.` 은 \n 뿐 아니라 **\r 도 제외**한다 — 이게 함정의 핵심)
2회  api/billing/{route,invoices,payment-methods} 3파일 CRLF(418·68·283 CR)
```

🔑 이건 §11.303-hotfix(CRLF → SWC 파서 → Vercel 배포 20회 연속 ERROR)와 **같은 뿌리**다.
   그쪽은 사람 편집기가 원인이었고 이쪽은 스크립트다. `.gitattributes` 는 커밋을 지키지
   **워킹카피를 지키지 않는다.**

### 🛑 "X를 쓰는가" 에 grep 으로 답하지 않는다 (2026-09-07 신설 · 같은 날 3회)

위 §측정 위치 조항의 확장이다. "측정 도구를 적는다" 보다 강하다 —
**어떤 질문에 어떤 도구가 무효인지**를 지정한다.

```
grep 은 "X 라는 글자가 있는가" 에만 답한다. "X 를 쓰는가" 에는 답하지 못한다.
→ 사용 여부는 **사용 지점의 형태**로 묻는다:  <X  ·  X(  ·  AST
→ 바이트를 세야 할 질문은 **바이트로** 센다:   CR 개수 · 파일 크기
```

실측 2026-09-07 · 3회:
```
1회  grep -c $'\r'          줄을 셌다(바이트를 세야 함) → "CRLF 2064개" 오보, 실제 CR 0
2회  grep -q DashboardSidebar  **import 줄**을 잡았다 → 렌더하지 않는 파일을 위반으로 오판
                              (`<Name` 으로 묻는 sentinel 이 그 오탐을 잡아냈다)
3회  git diff --stat         개행 질문에 내용 diff 로 답했다 → 위 CRLF 사고
4회  grep "db.X.create"      **헬퍼를 통과하는 경로**를 못 봤다 → "초대 수락 감사 0" 오보
                            (실제로는 `createAuditLog(...)` 로 이미 쓰고 있었다)
```

🛑 **조항으로는 안 고쳐진다.** 위 4회차는 이 조항을 **쓴 직후에** 났다.
   "grep 으로 답하지 마라" 는 금지형이고, 금지형은 **대안이 없으면 안 지켜진다**(호영님).
   그래서 절차로 바꾼다.

#### 절차 A — "X 가 기록되는가" 를 물을 때 (2단계 고정)

```
1) X 에 쓰는 **심볼 전량**을 먼저 수집한다
     db.X.create 직접 호출  +  그것을 감싼 **헬퍼 이름**
     예: DataAuditLog → `db.dataAuditLog.create` · `createAuditLog`
2) 그 **심볼 목록**으로 호출처를 찾는다
```

테이블 이름으로 바로 호출처를 찾으면 **헬퍼를 통과하는 경로를 전부 놓친다.**
실측 2026-09-07: `db.dataAuditLog.create` 로만 찾아 "초대 수락 감사 0" 이라고 보고했는데,
그 라우트는 `createAuditLog(...)` 를 `tx` 와 함께 부르고 있었다(멤버 생성과 원자적).

🛑 **심볼은 `이름@모듈` 로 적는다. 이름만 적으면 동명이인에서 다시 틀린다.** (2026-09-10 신설)

```
❌ createAuditLog                          ← 33곳이 뭉개진다
✅ createAuditLog@lib/audit/audit-logger   → AuditLog       18곳
✅ createAuditLog@lib/audit                → DataAuditLog   15곳
```

실측 2026-09-10(Q1 §activity-source-of-truth): **같은 이름의 헬퍼가 둘이고 쓰는 테이블이
다르다.** import 경로로만 갈린다. 위 2026-09-07 오보의 뿌리가 정확히 여기였다 —
절차 A 를 따랐어도 "쓰는 심볼" 칸에 이름만 적었으면 같은 자리에서 또 틀린다.

→ 호출처를 셀 때도 **import 경로를 함께 본다**:
```js
/import\s*\{[^}]*\bcreateAuditLog\b[^}]*\}\s*from\s*["']@\/lib\/audit\/audit-logger["']/
```

⚠️ 즉시 처방은 **개명**이다. 이름이 같은 한 다음 사람도 같은 곳에서 틀린다 —
   조항으로 막는 것보다 이름을 가르는 쪽이 싸다(호영님 2026-09-10).

#### 절차 B — **행이 0일 때 두 원인을 먼저 가른다**

```
배선이 없는가?      ← 코드가 답한다
사건이 없었는가?    ← **데이터가 답한다**
```

오늘 두 번 다 답을 준 것은 코드가 아니라 **prod 행수**였다.
실측 2026-09-07: `DataAuditLog` 의 `INVITE_ACCEPTED` 0건 — 그런데
`OrganizationInvite.acceptedAt is not null` 도 **0건**이었다.
**수락이 한 번도 일어난 적이 없으므로 흔적 0은 정상이다.** 배선 결함이 아니었다.

🔑 이 두 절차의 산출물을 **표로 남긴다** — 표가 다음 사람의 절차 실행을 대신한다.
   `테이블 · 답하는 질문 · **쓰는 심볼** · 행수` 4열. "쓰는 심볼" 칸이 없으면
   다음 사람이 같은 오탐을 반복한다(호영님 2026-09-07).

### 화면이 보여주는 수와 게이트가 판정하는 수는 **같은 함수**에서 나와야 한다 (2026-09-07 신설)

값이 같은 날에도 **계산식이 다르면 결함이다.** 그날 안 드러날 뿐 잠복한다.

실측 2026-09-07:
```
게이트  assertSeatAvailable      members + pendingInvites
화면    /api/billing usage       members 만
```
pending 이 0이라 두 값이 1로 같았다. 하나라도 생기면 화면은 "여유 있음" 인데
초대는 좌석 초과로 막힌다. `87d7941b` 이 조직 상세에서 닫은 형태가 `/billing` 에 남아 있었다 —
**같은 명제를 한 화면에서만 닫으면 형제 슬롯이 남는다**(§4원칙 ⑤ 형제 슬롯 전수와 같은 뿌리).

⚠️ "우회 가능한가" 만 묻지 말 것. 우회가 아니어도 결함일 수 있고,
   그 질문은 이 경우를 배제한다(호영님 자기 정정 2026-09-07).

### 관측 가능한 신호가 없는 변경은 "배포됐는지 확인할 수 없는 변경" 이다 (2026-09-08 신설)

**랜딩 전에 무엇으로 확인할지 정하고, 없으면 만든다.**

실측 2026-09-08 — `64ed727f`(개요 카드 문구 파생)는 **API 로 관측 가능한 신호가 0** 이었다:
```
새 API 필드      0  (summarizeOutstanding 은 클라이언트 표시 헬퍼다)
seatsUsed        pending 초대가 0이라 옛 계산식과 **같은 값** → 구분 불가
확인 방법        브라우저에서 화면 문구를 눈으로 보는 것 하나뿐
```
그 결과 배포 판정에 반나절이 들었고, 세 번 틀렸다 —
빌드 실패 추정(실제는 큐 지연) → `manifestGeneratedAt` 역산(간접 신호) →
**존재하지 않는 필드**의 부재로 판정(3시간 허구 추적).

🛑 셋 다 **간접 신호를 직접 답으로 착각**한 것이다. 처방은 직접 답을 만드는 것이다:
   `/api/health` 의 `deployedCommit`(`VERCEL_GIT_COMMIT_SHA`) — 이제 이 질문은
   한 번의 fetch 로 끝난다. 커밋 SHA 는 공개 식별자라 노출 위험 0이다.

⚠️ "존재하지 않는 것의 부재" 로 판정하지 말 것 — 검증 키를 정할 때 **그 키가 실재하는지**
   먼저 확인한다. 위 3회차가 정확히 그 형태였다(§절차 B 와 같은 뿌리:
   0을 봤을 때 "없어서 0" 인지 "애초에 없는 것" 인지 가른다).

#### 확장 (호영님 2026-09-10) — **부재는 두 가지를 뜻한다**

```
고쳐졌다            ← 코드가 그 자리를 지나가면서 에러를 안 냈다
거기까지 못 갔다    ← 애초에 그 자리에 도달하지 못했다
```

**어느 쪽인지 가르기 전에는 부재를 성공으로 읽지 않는다.**
🔑 **검증은 실패 신호의 부재가 아니라 성공 신호의 존재로 한다.**

실측 2026-09-10 — Prisma 관계 필터가 대시보드 지표를 0으로 만들던 건:
```
❌ 증거로 삼은 것   빌드 로그의 `Unknown argument organizationId` 가 8회 → **0회**
   그 0의 정체     빌드가 **컴파일 단계에서 죽어** prerender 에 도달하지 못했다.
                   고쳐서 사라진 게 아니라 거기까지 못 간 것이다.
✅ 진짜 증거        prod 직접 질의 `processingRequiredCount` 0 → **1**
```
같은 커밋에서 두 번 틀렸다. `product: { organizationId }` 를
`product: { is: { organizationId } }` 로 바꾸고 "고쳤다" 고 보고했는데,
**`Product` 에는 그 필드가 아예 없어서** 두 형태 모두 던진다. 문법을 고치려 했으나
틀린 것은 방향이었다. 세 번째 형태(`ProductInventory` 자기 열)를 **나란히 던져** 갈랐다 —
안 던졌으면 "둘 다 실패하니 다른 원인" 으로 갔다.

🛑 이 오독은 **sentinel 까지 오염시킨다.** 그날 처음 쓴 sentinel 은 틀린 형태
   `product: { is: { organizationId } }` 를 **두 번 단언**하고 있었다 —
   검사가 결함을 굳히고 있었다(호영님: "오늘 잡은 것 중 가장 위험한 형태").
   → 명제를 적기 전에 **그 명제가 참인지 먼저 실측**한다.

#### 실행 절차 — 배포 판정은 **두 번 잰다** (호영님 2026-09-10)

```
값 하나로는 "실패" 와 "아직 도착 안 함" 이 안 갈린다.
→ 간격을 두고 **두 번** 재서 값이 움직이는지부터 본다.
     움직이면  → 큐(배포 진행 중). 기다린다.
     고정이면  → 실패 의심. 그때 원인을 판다.
```

🔑 이 절차는 **잴 값이 있어야** 성립한다. `/api/health` 의 `deployedCommit` 이
   그걸 가능하게 했다 — 그 전에는 잴 값 자체가 없어서 간접 신호로 추측했고,
   하루에 세 번 틀렸다(위 §관측 가능한 신호 참조).
   즉 이 절차는 앞 조항의 **집행 도구**다: 신호를 만들고, 그 신호를 두 번 읽는다.

### 🛑 판정은 **재현 가능해야** 한다 — 판정 절차를 결과와 함께 남긴다 (2026-09-10 신설)

위 §측정 위치 조항이 "수치에 출처를 붙인다" 였다면, 이건 **판정에 절차를 붙인다** 이다.
절차가 없으면 같은 질문이 다시 왔을 때 **다른 답이 나오고, 어느 쪽이 맞는지 모른다.**

실측 2026-09-10 — "이 커밋의 빌드는 통과했는가" 를 `grep` 으로 판정하고 있었다:
```
❌ npm run build | grep -E "Compiled successfully|Failed to compile"
   → `Compiled successfully` 가 찍힌 **뒤에** export 단계에서 죽는 것을 못 본다.
     컴파일은 성공했고 빌드는 실패했다. 둘은 다른 사건인데 grep 이 뭉갰다.
✅ exit code 를 정본으로 하고, 보조로 마커 4종을 센다:
     "Export encountered" · "Failed to compile" · "npm error" · "Type error"
   그리고 **성공 신호의 존재**도 함께 본다 — Route 표가 출력됐는가.
```
🔑 판정 절차를 바꿨으면 **그 절차로 과거 판정을 재실행**한다. 위 건은 그 grep 을 처음
   쓴 커밋을 특정하고 이후 전량을 exit code 로 재판정했다(재작업 대상 0).
   "앞으로는 이렇게 한다" 만 적고 과거를 안 재면, 이미 나간 거짓 판정이 그대로 남는다.

### 🛑 공유 워킹트리에서는 pre-push 가 **남의 미커밋 파일에 인질로 잡힌다** (2026-09-10 신설)

pre-push hook 이 `npm run build` 를 도는데, 그 빌드는 **워킹트리**를 읽는다.
따라서 상대 세션의 미커밋 파일 하나가 내 커밋 전량의 push 를 막는다.

실측 2026-09-10: 상대 세션이 `app/billing/page.tsx` 에 `export function usageTone(...)` 을
추가했다(Next 는 page 파일에서 `default` 외 export 를 허용하지 않는다).
내 커밋 2개는 그 파일과 **무관한데** 반나절 막혔다.

```
❌ --no-verify              hook 우회 금지 조항 위반. 그리고 그 빌드가 진짜 결함을 잡을 수도 있다.
❌ 남의 파일을 내가 고침    소유권 규칙 위반(§병렬 세션 2).
❌ git stash (무인자)       남의 작업분이 사라진다(같은 조항, 실측 2회).
✅ 처방을 상대 세션에 전달하고 기다린다 — 그동안 **다른 축의 일을 한다.**
   전달할 것은 증상이 아니라 **처방**이다: "헬퍼를 lib/ 로 옮기십시오".
```

⚠️ 막힌 동안 "게이트는 GREEN 인데 push 를 못 한다" 를 **보고에 명시**한다.
   커밋이 로컬에 쌓인 상태는 §3-c(승인 대기 커밋)와 겉모습이 같아서, 안 적으면
   다음 사람이 승인 대기로 오해한다.

### 🛑 sentinel 이 적어 둔 **자기 한계는 다음 검사의 시작점**이다 (2026-09-10 신설)

**한계를 적고 GREEN 을 내는 것은 "검사했다" 가 아니라 "여기까지만 봤다" 이다.**
그 GREEN 을 "안전하다" 로 읽으면, 검사가 있는데 결함이 정확히 그 사각지대에 산다.

실측 2026-09-10 — cross-tenant **write** 4건이 기존 sentinel 을 GREEN 으로 통과했다:
```
src/__tests__/security/tenant-scope-coverage.test.ts
  같은 명제("바디의 organizationId 를 검증 없이 data: 에 기입 0")를 이미 단언
  주석에 자기 한계를 적어 뒀다:
      "1. 다른 입력 출처  2. 다른 필드  3. **간접 경유** — 헬퍼/서비스 계층"
  → 그날 나온 4건 중 **3건이 정확히 3번**이었다(createQuote · detectInventoryIssues ·
    createPOCandidate 를 통과). 나머지 1건은 목록에 없던 4번째 형태였다
    (중간 객체 경유 스프레드 — `data:` 블록에 organizationId 라는 글자가 없다).
```
**검사가 자기 사각지대를 알고 있었고, 결함은 거기 있었다.** 목록은 정직했는데 아무도 안 읽었다.

지킬 것:
```
① 한계 목록이 있는 sentinel 이 GREEN 이면 → 보고에 **그 범위를 명시**한다.
   "RED 0" 이 아니라 "<이 형태>에 대해 RED 0" 이라고 적는다.
② 새 결함을 만나면 관련 sentinel 의 한계 목록을 **먼저 읽는다.**
   거기 적혀 있으면 그건 새 발견이 아니라 **예고된 자리**다.
③ 한계를 지웠으면(= 그 형태를 닫았으면) 목록에서도 지우고, 어디가 닫았는지 상호 참조한다.
④ 목록에 없던 형태를 만나면 **목록에 추가**한다 — 닫지 못하더라도.
```

🔑 처방은 검사를 넓히는 것만이 아니다. 위 건에서 3번(헬퍼 경유)은 **정적으로 따라갈 방법이
   없다.** 그래서 `data:` 축이 아니라 **입력 축**에서 잘랐다 —
   `regression/org-session-authority.test.ts` 는 "핸들러가 body 에서 조직을 읽는가" 만 본다.
   한계가 원리적이면 **축을 바꾼다.** 두 sentinel 을 상호 참조로 묶어 둔다.

⚠️ 이건 §예외 목록에는 만료일과 소유자와 **다른 항목**이다. 그쪽은 "알려진 위반" 이고
   이쪽은 "안 보는 형태" 다 — 전자는 목록이 커지는 게 문제이고, 후자는 목록이 **안 읽히는** 게
   문제다.

### 인프라를 만들면 **같은 커밋에서 배선**하고, 배선을 sentinel 로 잠근다 (2026-09-07 신설)

**"나중에 붙인다" 는 배선은 붙은 적이 없다.**

실측 2026-09-07 — 감사 인프라가 **세 벌**이었고 셋 다 마지막 한 줄을 안 이었다:
```
MutationAuditEvent      0행   ← enforceAction 116곳이 complete() 를 부르는데 메모리로만 갔다
GovernanceAuditLog      0행   ← PrismaAuditAdapter "Batch 6 실제 구현" 완성, 호출자 0
CanonicalAuditEvent     0행
StabilizationAuditEvent 0행
IngestionAuditLog       0행
```
그날 아침 "13:17 에 누가 썼는지 모른다" 에 빠진 이유가 이것이다 —
기록이 없었던 게 아니라 **기록하겠다는 코드가 세 벌 있었고 셋 다 안 돌았다.**

🔑 반례(지향): `8119c714` 는 라이브러리 · 배선 · 호출부 sentinel 을 **한 커밋**에 넣었다.

### 패턴 — 회귀 보호 강제

- 새 기능 sentinel 작성 시 **회귀 0** describe 블록 필수
- 기존 보존 항목 (state / handler / wiring / 라벨) 모두 명시 매칭

---

## Commit Convention

- prefix: `feat() / fix() / chore() / refactor() / test() / docs()` + scope
- subject: `§11.XXX #scope-name — 한국어 요약 (호영님 spec / batch 컨텍스트)`
- body: 호영님 spec + Fix (file 별) + canonical truth 보존 + production effect + Out of Scope + Rollback path
- footer: 없음 (Anthropic Co-Authored-By 사용 금지 — 호영님 통제 구조)

---

## 호영님 통제 구조 (verbatim)

- 호영님은 코드/DB/터미널에 직접 접근하지 않음
- 모든 개발 작업을 Claude (Cowork / Cursor) 에게 위임
- evidence 수집은 Claude 가 sandbox 에서 직접 — 단 **local / read-only 한정**.
  prod DB 접속 쓰기·리셋·migrate·`db push`·`migrate diff --shadow-database-url`
  은 sandbox 금지 (DEV_RUNBOOK §9.9 인시던트). 이런 명령은 클로드코드
  operator-shell 단독.
- 🛑 `migrate diff` 는 **`--from-url`(read-only) 만**. `--from-migrations
  --shadow-database-url=<prod>` 절대 금지 — shadow 를 리셋하므로 prod 를 가리키면
  전 데이터 소실 (2026-06-14 실제 사고, DEV_RUNBOOK §9.9).
- production DB 변경 = dry-run → 평이한 한국어 보고 → "진행" 후만 apply.
  파괴적 명령(`--force-reset` / `--accept-data-loss` / `migrate reset` / `db push`)
  은 project-ref echo 확인 + 명시 "진행" 게이트.
- 🛑 sandbox 는 **공유 node_modules 에 패키지 설치 금지** (`npm install` /
  `pnpm add`) — 호영님 Windows 설치본 오염(react 버전 불일치 → `npm run build`
  useContext null prerender 실패 = pre-push hook 불능, 2026-06-14 2차 사고,
  DEV_RUNBOOK §9.9). 조회 도구는 격리 `/tmp` 또는 operator-shell 위임.
- 클로드코드 환경에서만 push (sandbox commit 금지)
- WebFetch / WebSearch 실패 시 bash curl 등 대체 fetch 금지
- NEVER skip hooks unless explicitly requested
- NEVER force push to main/master
- NEVER amend commits unless explicitly requested

---

## 병렬 세션 — 같은 워킹 카피를 두 트랙이 나눠 쓸 때

두 Claude 세션이 `C:\Users\young\ai-biocompare` 를 동시에 쓴다. 실측 사고 2건이
있었고, 원인이 서로 다르므로 처방도 따로다.

### 1. 빌드 산출물 경합 — 세션별 `NEXT_DIST_DIR`

pre-push hook 이 `npm run build` 를 돌리는데, 두 세션이 같은 `.next` 를 쓰면
서로의 manifest 를 지워 ENOENT 로 죽는다(2026-09 실측 **5회+**).

```
NEXT_DIST_DIR=.next-<트랙> NEXT_TSCONFIG=tsconfig.next-<트랙>.json  git push origin main
#  예: NEXT_DIST_DIR=.next-scan NEXT_TSCONFIG=tsconfig.next-scan.json
```

`next.config.js` 의 `distDir` 이 이 env 를 읽는다. **미설정 시 `.next`** 라
Vercel·로컬 dev 는 무변경이다. 산출물은 `.gitignore` 의 `/.next-*/` 가 받는다.

⚠️ **tsc·타입 검사는 빌드와 달리 자동으로 갈라지지 않는다.** 세션별 dist 로 빌드한 라우트 타입은
`tsconfig.json` 의 `include` 가 가리키는 곳에서만 읽힌다. 그래서 세션은 **tsconfig 도 갈라 쓴다**
(§tsconfig-dist-glob P1 `1d1a2a67` · P2 `b3526130`).

```
base  apps/web/tsconfig.json          include = "src" + ".next/types/**/*.ts"   ← 이 둘만
세션  apps/web/tsconfig.next-<트랙>.json  { extends: base, include: ["src", "<dist>/types/**/*.ts"] }
      npm run build 의 prebuild(scripts/ensure-session-tsconfig.js)가 자동 생성 · gitignore 산출물
      next.config.js 의 typescript.tsconfigPath 가 NEXT_TSCONFIG 를 읽는다(미설정 = Next 기본값)
```

🛑 **base 에 `.next-*/types/**` 글롭도, `.next-<트랙>/types/**` 명시 줄도 넣지 말 것.**
   남의 세션 dist 의 **옛 라우트 타입**까지 검사 대상이 되어, 라우트를 지우는 순간
   그 타입이 지운 파일을 import 해 **전 세션 build 가 깨진다**(2026-09 실측 3회).
   P2 프로브 실측: 라우트 1개를 지우자 옛 설정에서 5개 dist 출처로 10건 RED,
   세션 tsconfig 로는 build exit 0.

🔑 **그 명시 줄은 사람이 적은 게 아니다 — Next 가 쓴다.**
   next 14.2.35 `dist/lib/typescript/writeConfigurationDefaults.js:222-236` 은 include 에
   `${distDir}/types/**/*.ts` **문자열이 그대로** 없으면 그 줄을 추가하고 tsconfig 를 다시 쓴다
   (글롭이 덮어도 문자열 비교라 인정하지 않는다). 그래서 `NEXT_DIST_DIR` 만 주고 빌드하면
   그 세션의 줄이 **base 워킹카피에 다시 붙는다**(2026-09-12 실시간 관측).
   → 되돌리거나 남의 작업으로 오해하지 말 것. `NEXT_TSCONFIG` 를 함께 주면 애초에 안 붙는다.

⚠️ `NEXT_TSCONFIG` 를 주면서 그 파일이 없으면 **Next 가 tsconfig 를 새로 만든다**
   (`strict:false` · `extends` 없음 · `@/*` 별칭 없음 → build 실패, 2026-09-12 실측).
   prebuild 배선이 그걸 막는다 — 생성기를 prebuild 에서 떼지 말 것.

⚠️ 라우트를 지우면 **내 dist** 의 옛 타입은 여전히 남는다. 그 세션이 한 번 빌드하면 갱신되지만,
   그 전에 수동 `npx tsc --noEmit` 을 돌리면 지운 라우트 에러가 뜬다. 남의 dist 는 이제 안 걸린다.

🛑 그래도 **tsc 수치는 다른 세션이 빌드 중일 때 불안정하다** — glob 이 잡은 파일을 상대 빌드가
지우면 `TS6053 File not found` 가 뜨고 총계가 튄다(같은 시점 실측 424 → 29). **두 번 돌려
같은 수가 나오는지 확인**하고, 다르면 상대 빌드가 끝난 뒤 다시 잰다.

### 2. 🛑 `git stash` 는 **자기 변경만** — 경로를 지정한다

```
✅ git stash push -u -- <내가 건드린 경로만>
❌ git stash            # 남의 세션 미커밋 변경까지 통째로 밀린다
```

2026-09-04 실측 **2회**: ① 한 세션이 커밋 전 무인자 `stash` 를 돌려 다른 세션의 미커밋
작업분(소스 5 + 계획서)이 사라졌다. ② 같은 날 `--autostash`(= `pull --rebase` / `rebase`
계열이 **자동으로** 거는 stash)로 또 사라졌다 — 이쪽은 `git stash` 를 직접 치지 않아도
발생하므로 위 규칙만으로는 못 막는다. 🛑 **rebase·pull 계열은 워킹트리가 깨끗할 때만**
돌린다(`git status` 확인 후). 남의 세션이 돌린 건 막을 수 없으니, **작업분은 게이트가
끝나는 대로 곧바로 커밋**해 노출 시간을 줄인다.
**유실은 아니다** — `stash list` 에 `autostash` 라는 이름으로 남는다.
`git stash list` → `git stash show --stat` **전 항목**으로 찾고(내 것이 `stash@{0}` 이 아닐 수
있다), 남의 파일이 섞인 stash 는
`git checkout "stash@{N}" -- <내 경로만>` 으로 경로 지정 복원한다.
복원 후 HEAD 가 옮겨졌으면 **게이트를 새 HEAD 기준으로 다시 실측**한다(옛 수치 무효).
🛑 `git stash pop` 이 조용히 실패할 수 있다 — **pop 결과를 믿지 말고 파일 내용을 grep 으로
확인**한다. 2026-09-04 실측: pop 이 안 됐는데 축 수치가 그럴듯해 보여 통과할 뻔했다.

### 3. push 는 **브랜치 단위**다 — 내 커밋만 올라가지 않는다 (2026-09-05 신설)

같은 로컬 main 을 두 세션이 쓰므로, `git push` 는 **그 시점 main 의 모든 커밋**을 올린다.
두 방향 모두 실측됐다.

**① push 가 거부돼도 내 커밋은 이미 올라가 있을 수 있다.**
```
! [remote rejected] main -> main (cannot lock ref ... is at <내 커밋> but expected <이전>)
```
2026-09-05 실측: 내 push 가 ref-lock 으로 거부됐는데, **상대 세션의 push 가 같은 로컬 main 에
있던 내 커밋을 함께 실어** 이미 원격에 올려둔 상태였다.
🛑 **거부 = 미반영이 아니다.** 재작업하기 전에 반드시 확인한다:
```
git fetch origin main && git log --oneline origin/main -3
```

**② 🛑 더 위험한 반대 방향 — 내 push 가 남의 미검증 커밋을 싣는다.**
내가 게이트를 통과시킨 것은 **내 커밋**이지 push 단위가 아니다. 내가 push 하는 순간
상대 세션이 방금 만든 커밋도 함께 원격에 나가고, **그건 내가 재본 적이 없다.**
→ 게이트 보고에 "이 커밋" 과 "이 push" 를 구분해 적는다.
   `git log --oneline @{u}..HEAD` 로 **이번 push 가 싣는 전량**을 먼저 본다.
   내 것이 아닌 커밋이 섞여 있으면 그 사실을 보고에 남긴다(막을 수는 없다 — 같은 브랜치다).

### 3-b. worktree — 허용되나 이 레포에서는 채택하지 않는다

2026-09-04 호영님이 기존 "worktree 사용 금지" 를 **해제**했다(근거: 위 사고 2건).
그러나 실측 결과 이 레포에서는 worktree 가 두 사고를 푸는 수단이 아니다:

- git 은 **같은 브랜치를 두 worktree 에 체크아웃하지 못한다** → 트랙 브랜치가 강제되고,
  🛑 **트랙 브랜치는 Vercel main 자동 배포에 반영되지 않는다** —
  그게 애초에 금지 규칙이 섰던 원래 이유다(혼선 발생 이력).
- 공용 파일(`package-lock.json` · migration manifest · `CLAUDE.md` · `docs/plans/`)의
  겹침은 그대로다. stash 사고가 **머지 충돌로 자리만 옮긴다.**
- 새 worktree 에는 `node_modules` · `.env` 가 없다(둘 다 gitignore) → 트랙마다 재설치가
  붙는데, **sandbox 공유 node_modules 설치 금지** 조항과 정면으로 걸린다.

→ 위 1·2 로 두 사고를 닫는다. 레포 구조·브랜치 전략 변경 0.
   **main 직접 커밋·푸시 흐름은 그대로 유지한다.**
   금지 해제는 기록으로 남긴다 — 나중에 배포 파이프라인이 바뀌면 재검토 대상이다.

### 3-c. §approval-branch-isolation — 승인 대기 커밋은 main 에 두지 않는다 (2026-09-08 신설)

- push 승인 대기 커밋은 main 에 두지 않는다. `wip/<slug>` 에 커밋하고, 승인 즉시
  main 으로 fast-forward 후 push 한다.
  근거: 같은 로컬 main 에 있으면 병렬 세션의 push 가 승인 전 커밋을 함께 실어 보낸다
  (2026-09-08 §mobile-residual-5: `6cfe5ca5` 가 승인 전에 원격으로 나감).
  ⚠️ 3-b(트랙 브랜치)와 목적이 다르다 — 3-b 는 "main 자동 배포에 안 실리게",
  이 조항은 "승인 전까지 main 에 세우지 않게". 승인 후에는 main 으로 올린다.

- 누출은 양방향이며 반대 방향은 막을 수 없다. push 는 조상 커밋 전량을 밀고,
  부분 push 는 이력 재작성 없이 불가하다(같은 건에서 `29388f25` 가 내 push 에 동승).
  따라서 push 결과 보고에는 **실린 커밋 전량을 나열하고, 게이트 대상과 동승분을 구분**한다.
  동승분은 "내가 잰 적 없음" 을 명시한다 — 재지 않은 것을 검증된 것처럼 보고하지 않는다.

---

## Sync Pattern — sandbox ↔ 호영님 환경

- 호영님 환경: `C:\Users\young\ai-biocompare`
- sandbox 변경이 호영님 D:\ / C:\ 환경에 자동 sync 안 됨
- 신규 파일 / 대량 swap: `present_files` 카드로 cowork view → 호영님이 자기 환경에 복사
- 인라인 small swap: chat 에 inline patch (호영님이 직접 edit)
- 호영님 push 회신 받기 전까지 다음 batch sandbox 진입 가능 (sandbox sync 부담 0)
