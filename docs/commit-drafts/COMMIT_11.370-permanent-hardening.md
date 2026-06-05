fix(auth) §11.370 영구화 — auth.ts trustHost:true 명시 + next-auth beta 버전 pin (env 누락·재배포 누락 리스크 차단)

호영님 spec: §11.370(AUTH_TRUST_HOST=true 추가로 신규 로그인 Configuration 해소) 종결 후 영구화. env 단일 의존 → 코드 명시로 재발 차단.

Fix:
- apps/web/src/auth.ts — NextAuth options 에 trustHost: true 1줄 추가. v5 known-domain 표준. env AUTH_TRUST_HOST 누락/재배포 누락 시에도 host 신뢰 보장.
- apps/web/package.json — next-auth ^5.0.0-beta.25 → 5.0.0-beta.25. caret 제거로 재install/재배포 시 더 높은 beta(설정 스키마 stricter)로 자동 상향 차단. d단계(14.2.35) 무렵 회귀 진입점 봉인.
- apps/web/package-lock.json — pin 반영 lockfile 갱신.

Canonical truth 보존:
- secret(AUTH_SECRET || NEXTAUTH_SECRET) · providers(GoogleProvider) · callback redirect · session/jwt callbacks · invite baseUrl 무변경.
- 외부영향 0 (host 신뢰 출처만 env+코드 이중화).

회귀 검증:
- tsc src 0
- npm run build PASS

Production effect:
- env 누락 시 코드 명시값으로 fallback → 신규 로그인 결정적 동작.
- next-auth beta 자동 상향으로 인한 v5 host-trust 분기 변경 회귀 0.

Out of Scope:
- §11.371-1 진입 가드(스마트입고 모달 open 직전 useSession status 게이트) — 별도 승인 후.
- §11.371-3 OCR 경로 전환(Header 글로벌 → LabelScannerModal) — 별도 승인 후.

Rollback: git revert <hash> — 2 파일 + lockfile, hunk 2개(trustHost 1줄, pin 1줄).
