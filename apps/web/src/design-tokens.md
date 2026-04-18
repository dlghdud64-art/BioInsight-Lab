# LabAxis Design Token System v2 — Role-based

## 구조 원칙

이 시스템은 **역할 기반 3계층**으로 구성됩니다.
색 family(Primary/Secondary/Tertiary)가 아니라, **사용 역할**이 먼저 보입니다.

기존 generic palette 구조(Primary / Secondary / Tertiary / Neutral)는 폐기되었습니다.
shadcn/ui 라이브러리 내부 호환용 HSL 토큰만 예외적으로 유지되며, 직접 호출은 금지됩니다.

---

## 1. Public Role Tokens

landing / intro / pricing 전용. App 내부에서 사용 금지.

| Token | Value | 역할 |
|-------|-------|------|
| `--public-brand-field-strong` | `#0F172A` | hero, flagship scene (가장 깊은 배경) |
| `--public-brand-field-soft` | `#13203A` | hero 변형, 약간 밝은 brand field |
| `--public-support-plane-1` | `#1E293B` | section lifted wrapper (1단계) |
| `--public-support-plane-2` | `#24324A` | section lifted wrapper (2단계) |
| `--public-surface-card-1` | `#162033` | mockup wrapper, consult box |
| `--public-surface-card-2` | `#1B2640` | floating object, elevated card |
| `--public-close-layer` | `#0B0F19` | footer, 마지막 닫힘 장면 |
| `--public-primary-action` | `#3B82F6` | CTA button, active/selected state |
| `--public-primary-action-hover` | `#2563EB` | CTA hover |
| `--public-text-strong` | `#F8FAFC` | headline, 중요 값 |
| `--public-text-body` | `#CBD5E1` | body copy |
| `--public-text-muted` | `#94A3B8` | caption, secondary text |
| `--public-border-soft` | `rgba(255,255,255,0.08)` | 카드/섹션 경계 (약) |
| `--public-border-strong` | `rgba(255,255,255,0.14)` | 카드/섹션 경계 (강) |
| `--public-network-line` | `rgba(148,163,184,0.18)` | plexus, 네트워크 라인 |
| `--public-hero-haze` | `rgba(59,130,246,0.16)` | hero 중앙 haze (blue only) |

**추가 상수 (Public inline)**
- `MUTED_ACCENT = #8da4c2` — capability indicator, stage label, soft icon

---

## 2. App Surface Tokens

dashboard / workbench / 운영면 전용. Public page에서 사용 금지.

| Token | Value | 역할 |
|-------|-------|------|
| `--app-bg` | `#111827` | 앱 전체 기본 바탕 |
| `--app-panel-1` | `#182233` | 첫 번째 카드/패널 |
| `--app-panel-2` | `#1F2937` | 두 번째 카드/패널 |
| `--app-panel-3` | `#273449` | 세 번째 카드/패널 |
| `--app-rail-bg` | `#1F2937` | right rail, side surface |
| `--app-dock-bg` | `#0F172A` | sticky dock, lower action area |
| `--app-workbench-bg` | `#030712` | 가장 깊은 작업면 |
| `--app-table-row` | `#1E293B` | 테이블 기본 행 |
| `--app-table-row-hover` | `#26364D` | 테이블 hover |
| `--app-table-row-active` | `#334155` | 테이블 selected |
| `--app-focus-ring` | `#3B82F6` | 포커스 링 |
| `--app-divider` | `rgba(255,255,255,0.08)` | 구분선 |

---

## 3. Semantic Tokens

상태 전용. App 내부의 text / badge / label / icon / small accent에만 사용.
대면적 배경·wrapper fill 금지. Public page에서 사용 절대 금지.

| Token | Value | 역할 |
|-------|-------|------|
| `--status-success` | `#10B981` | 승인, 완료, 정상 |
| `--status-warning` | `#F59E0B` | 검토, 재주문, 미확인 |
| `--status-danger` | `#EF4444` | 부족, 실패, 차단 |
| `--status-info` | `#3B82F6` | 진행 중, 참고 |

---

## Component Role Mapping

아래는 **토큰 → 컴포넌트 매핑**입니다.
색 family가 아니라 **사용 역할**이 먼저 보입니다.

### Public Page

| 컴포넌트 | 토큰 |
|----------|------|
| Hero 배경 | `public-brand-field-strong` |
| Hero haze (중앙 빛) | `public-hero-haze` (blue radial) |
| Section wrapper (올린 면) | `public-support-plane-1` / `public-support-plane-2` |
| Floating card | `public-surface-card-1` / `public-surface-card-2` |
| Footer | `public-close-layer` |
| CTA button fill | `public-primary-action` |
| CTA button hover | `public-primary-action-hover` |
| Headline text | `public-text-strong` (white) |
| Body text | `public-text-body` |
| Caption / muted text | `public-text-muted` |
| Card / section border | `public-border-soft` or `public-border-strong` |
| Network diagram line | `public-network-line` |
| Stage label / capability indicator | `MUTED_ACCENT (#8da4c2)` |
| Pill dot (hero) | `public-primary-action` (blue) |
| Toggle active knob | `public-primary-action` (blue) |
| Discount badge | blue tint (`rgba(59,130,246,0.08)`) + `public-primary-action` text |
| Featured card highlight | blue rgba border + `public-primary-action` name |
| Plan card check icon | `MUTED_ACCENT` (soft blue-gray) |
| Comparison table check | `MUTED_ACCENT` + typography weight + row contrast |
| Badge / pill (neutral) | `public-surface-card-2` bg + `public-text-body` text + subtle border |

### App (Dashboard / Workbench)

| 컴포넌트 | 토큰 |
|----------|------|
| App 기본 바탕 | `app-bg` |
| Workbench center panel | `app-workbench-bg` |
| Right rail | `app-rail-bg` |
| Bottom dock | `app-dock-bg` |
| 카드/패널 | `app-panel-1` → `app-panel-2` → `app-panel-3` |
| 테이블 행 | `app-table-row` / hover / active |
| Focus ring | `app-focus-ring` |
| 구분선 | `app-divider` |
| Warning badge | `status-warning` (text/icon only) |
| Error indicator | `status-danger` (text/icon only) |
| Success state | `status-success` (text/icon only) |
| Info label | `status-info` (text/icon only) |

---

## Usage Rules

### Public Rules
- Public page는 `brand-field / support-plane / surface-card / close-layer` scene grammar로만 구성
- blue는 CTA / active / selected에만 사용
- capability indicator = `MUTED_ACCENT (#8da4c2)` 또는 `public-text-muted`
- badge/pill = neutral surface + subtle border, 색상 의미 부여 금지
- support-plane은 반복 배경이 아니라 특정 section 역할에만 사용
- close-layer는 footer / 마지막 장면 전용

### Public Semantic 격리 규칙 (절대)
- Public 페이지에서 `status-success` / `status-warning` / `status-danger` / `status-info` 사용 절대 금지
- Public 페이지에서 emerald/green 계열 (`#4edea3`, `#10B981`, `#00a572`, `rgba(78,222,163,...)`) 사용 금지
- Public 페이지에서 amber/orange 계열 (`#ffb95f`, `#F59E0B`, `rgba(245,158,11,...)`) accent 사용 금지
- semantic color를 hero / section wrapper / large card fill에 사용 금지

### App Rules
- App은 `bg / panel / rail / dock / workbench / row` 역할로만 구성
- 상태 표현이 아닌 배경면에 semantic color 금지
- selection은 `focus-ring` + `active row` hierarchy로 해결

### Semantic Rules
- text / badge / label / icon / small accent에만 사용
- 대면적 배경이나 wrapper tone에 사용 금지
- App 내부 전용, Public 사용 금지

---

## 금지 사항

- `bg-green-500`, `text-blue-400`, `border-slate-700` 등 raw color utility 금지
- `bg-primary`, `text-secondary` 등 shadcn generic naming 직접 호출 금지 (라이브러리 내부 전용)
- `neutral`로 뭉뚱그린 호출 금지
- Primary / Secondary / Tertiary generic palette 구조 사용 금지

---

## shadcn/ui Library Compat

shadcn/ui 컴포넌트(Button, Dialog, Input 등)가 내부적으로 참조하는 HSL 토큰입니다.
이 토큰들은 **라이브러리 내부 전용**이며, 직접 `bg-primary` / `text-secondary`로 호출해서는 안 됩니다.

대신 항상 위의 role-based 토큰을 사용하세요:
- Public page CTA → `public-primary-action` (O) / `bg-primary` (X)
- App panel → `app-panel-2` (O) / `bg-secondary` (X)
- Status badge → `status-warning` (O) / `text-destructive` (X, 역할 불명확)

---

## Tailwind 호출 예시

```
bg-public-support-plane-1      ← section wrapper
text-public-text-strong         ← headline
border-public-border-soft       ← card border
bg-public-primary-action        ← CTA button

bg-app-panel-2                  ← dashboard panel
bg-app-table-row-active         ← selected table row

text-status-warning             ← warning badge text (App only)
```
