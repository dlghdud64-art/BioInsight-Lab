# LabAxis Design Token System v2

## 3계층 구조

### 1. Public Role Tokens
landing / intro / pricing 전용. App 내부에서 사용 금지.

| Token | Value | 역할 |
|-------|-------|------|
| `--public-brand-field-strong` | `#0F172A` | hero, flagship scene (가장 깊은 배경) |
| `--public-brand-field-soft` | `#13203A` | hero 변형, 약간 밝은 brand field |
| `--public-support-plane-1` | `#1E293B` | section lifted wrapper (첫 번째 단계) |
| `--public-support-plane-2` | `#24324A` | section lifted wrapper (두 번째 단계) |
| `--public-surface-card-1` | `#162033` | mockup wrapper, consult box |
| `--public-surface-card-2` | `#1B2640` | floating object, elevated card |
| `--public-close-layer` | `#0B0F19` | footer, 마지막 닫힘 장면 |
| `--public-primary-action` | `#3B82F6` | CTA, active, selected |
| `--public-primary-action-hover` | `#2563EB` | CTA hover |
| `--public-text-strong` | `#F8FAFC` | headline, 중요 값 |
| `--public-text-body` | `#CBD5E1` | body copy |
| `--public-text-muted` | `#94A3B8` | caption, secondary text |
| `--public-border-soft` | `rgba(255,255,255,0.08)` | 카드/섹션 경계 (약) |
| `--public-border-strong` | `rgba(255,255,255,0.14)` | 카드/섹션 경계 (강) |
| `--public-network-line` | `rgba(148,163,184,0.18)` | plexus, 네트워크 라인 |
| `--public-hero-haze` | `rgba(59,130,246,0.16)` | hero 중앙 haze |

### 2. App Surface Tokens
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

### 3. Semantic Tokens
상태 전용. 대면적 배경 금지.

| Token | Value | 역할 |
|-------|-------|------|
| `--status-success` | `#10B981` | 승인, 완료, 정상 |
| `--status-warning` | `#F59E0B` | 검토, 재주문, 미확인 |
| `--status-danger` | `#EF4444` | 부족, 실패, 차단 |
| `--status-info` | `#3B82F6` | 진행 중, 참고 |

## Usage Rules

### Public Rules
- blue는 CTA / active / selected에만 사용
- support-plane은 반복 배경이 아니라 특정 section 역할에만 사용
- close-layer는 footer / 마지막 장면 전용
- public page는 brand-field / support-plane / surface-card / close-layer scene grammar로만 구성
- semantic color를 hero/section wrapper/large card fill에 사용 금지

### App Rules
- app은 bg / panel / rail / dock / workbench / row 역할로만 구성
- 상태 표현이 아닌 배경면에 semantic color 금지
- selection은 focus-ring + active row hierarchy로 해결

### Semantic Rules
- text / badge / label / icon / small accent에만 사용
- 대면적 배경이나 wrapper tone 해결용으로 사용 금지

### 금지 사항
- `bg-green-500`, `text-blue-400`, `border-slate-700` 등 raw color utility 금지
- `bg-primary`, `text-secondary`, `tertiary` generic naming 금지
- `neutral`로 뭉뚱그린 호출 금지

## Tailwind 호출 예시
```
bg-public-support-plane-1
text-public-text-strong
border-public-border-soft
bg-app-panel-2
bg-app-table-row-active
text-status-warning
```
