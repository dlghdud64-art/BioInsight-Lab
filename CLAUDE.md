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
- 긴급 (낮은 재고, 검토 필요): `bg-yellow-100 text-yellow-700` (배지)
- 정상: `bg-emerald-100 text-emerald-700` (배지)
- 정보 (실행 가능 CTA): `bg-emerald-600 text-white` (primary), `bg-blue-600 text-white` (분석/검토)
- ❌ amber / orange 사용 금지 (전체 sweep §11.302d-6 예정, 신규 작업은 yellow 사용)

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
