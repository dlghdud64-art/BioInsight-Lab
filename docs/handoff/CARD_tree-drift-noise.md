# §tree-drift-noise — 상시 워킹트리 드리프트 2건 (백로그)

**등재 2026-08-19** · ⑪ Phase 1-1 착수 전 ⑤ 규칙(트리 상태 확인) 수행 중 실측

🛑 **Phase 1 을 막지 않는다.** 카드로만 등재한다.

## 실측

```
 M .claude/launch.json                        로컬 dev 설정
 M apps/web/src/generated/migration-manifest.json   타임스탬프 한 줄
```

세션 시작 시점부터 있었고 이번 배치들이 만든 것이 아니다.

## 1. migration-manifest.json — 타임스탬프가 diff 를 만든다

```
- "generatedAt": "2026-08-14T03:42:37.241Z"
+ "generatedAt": "2026-08-19T13:43:34.443Z"
```

🔑 **마이그레이션 목록은 불변**이다. 재생성 때마다 이 한 줄만 바뀐다.

연동 sentinel 3개는 GREEN(17 passed):
`migration-drift` · `generate-migration-manifest` · `quote-item-vendor-selection-schema`

**제안**: `generatedAt` 을 매니페스트에서 뺀다. 무해하지만 비용이 있다 —
⑤ 규칙(파괴적 명령 전 트리 확인)을 수행할 때마다 **무해한 diff 가 판단을 요구**한다.
"매번 뜨니까 무시" 가 습관이 되면 그 옆에 뜬 진짜 변경도 같이 무시된다.

⚠️ 빼기 전에 확인할 것: `generatedAt` 을 읽는 코드가 있는가
(드리프트 감지가 시각을 쓰면 제거가 기능 삭제다).

## 2. .claude/launch.json — 로컬 dev 설정

`Next.js Dev Server` / `Prisma Studio` → `labaxis-web` 단일 항목으로 축소된 상태.
제품 코드가 아니다.

**제안**: `.gitignore` 대상 후보. 단 팀 공유 설정이면 반대로 커밋해야 한다 —
**어느 쪽인지 정하지 않은 것이 현 상태**이고, 정하면 드리프트가 사라진다.

## 착수 시 선행 판정

```
1  generatedAt 소비자 전수 — 있으면 제거가 아니라 분리(별도 파일)
2  launch.json 이 공유 설정인가 개인 설정인가 — 정하면 gitignore 또는 커밋
🛑 둘 다 "무해하니 방치" 로 닫지 말 것. 방치의 비용은 diff 노이즈가 아니라
   **⑤ 규칙 수행 시의 판단 부하**다. 상시 노이즈는 상시 RED 와 같은 형태다
   (§suite-red-168 — 신호가 상시면 신호가 아니다).
```

## 관련

- 실측 시점 HEAD `d37e9c5e`
- 같은 형태: `CARD_suite-red-168.md` (상시 RED 가 새 RED 를 묻는다)
