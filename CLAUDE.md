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

🛑 **파일 전체 `grep —` 를 갱신 대상으로 쓰지 말 것.**
   2026-08-16 실측 `dashboard/analytics/page.tsx`: 총 **43건** 중 UI 문구는 **5건**.
   38건은 주석이다. 범위만 보고 잡으면 **주석 38건이 오탐**으로 돈다.

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

```
anchor · 현행 · _주의        구현 **전** 위치 서술. "어디를 고쳐라" 라는 작업 지시다.
                            고쳤으면 stale 이 **정상 종료 상태**다. 갱신 금지 · 삭제 금지.
                            구 문자열은 회귀 sentinel 재료다(역계약 승계에 그대로 쓰인다).
expect · expect_text ·      정본. 불변. **기계 검사는 이것만 쓴다.**
expect_NOT                  anchor 는 사람용 내비게이션이지 검사 기준이 아니다.
```

🛑 위반형: **"검사가 못 찾으니 anchor 를 갱신한다"**
   → fixture 가 구현을 따라가고, 그 순간부터 영구 GREEN 이다.
   구현이 명세를 어겨도 anchor 를 맞추면 통과하므로 명세가 기록으로 강등된다.

실례 2건(같은 계열):
- 2026-08-16 축 C 준비 — anchor 3건이 구현 전 소스를 가리키자 "선행 갱신 필요" 로 처방.
- 직전 트랙 — "앵커를 낮추면 로딩 실패가 불일치 0 으로 위장한다" 로 이미 잠근 형태.

표시가 필요하면 **갱신이 아니라 병기**한다: `"_구현후": "aiReportActions() 로 이동 (<sha>)"`.
원 anchor 문자열은 보존한다.

### 정규식 sentinel — 3원칙 (2026-08-16 승격, 같은 형태 2회)

```
① 접두사 포함    `disabled=` ⊂ `aria-disabled=` · `describedby` ⊂ `aria-describedby`
                 → 속성 정규식은 (?<!aria-) 또는 [\s"] 경계 필수. 짧은 속성명 전부 해당
② 창 시작점      슬라이스를 속성부터 열면 **여는 태그 앞부분이 창 밖**이다
                 → 창은 항상 여는 태그(`<button` · `<div`)부터. 속성부터 열지 않는다
③ 검출력 실증    정규식 sentinel 은 주입 프로브로 corrupt → RED 를 확인한다
                 통과만으로는 무효 단언과 구분 불가
④ 대체 매칭      같은 창 안의 다른 요소가 같은 값을 써서 대신 매칭한다
                 → 토큰 단위로 세지 말고 **분기 단위로 묶는다**
```

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

## Sync Pattern — sandbox ↔ 호영님 환경

- 호영님 환경: `C:\Users\young\ai-biocompare`
- sandbox 변경이 호영님 D:\ / C:\ 환경에 자동 sync 안 됨
- 신규 파일 / 대량 swap: `present_files` 카드로 cowork view → 호영님이 자기 환경에 복사
- 인라인 small swap: chat 에 inline patch (호영님이 직접 edit)
- 호영님 push 회신 받기 전까지 다음 batch sandbox 진입 가능 (sandbox sync 부담 0)
