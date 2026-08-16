# 인계 — Phase 3 착수 대기

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

작성 시각: 2026. 8. 15.
상태: **시안 정합 트랙 선행 조건 해소.** 다음 세션은 이 문서만 읽고 시작할 수 있어야 한다.
선행 커밋: `500878cb` (렌더 검증) · DECISION 문서 1건 (카드 2건 반영 완료)

---

## 1. 첫 줄 — 다음 세션은 여기서 시작한다

**Phase 3 `<CollapsedRow>` 구현 + ②-a red 치환.**

```
착수 차단  없음
보류       §0-B amber 8토큰 전수 일치 게이트 (해제 조건: §0-B yellow 확정)
동반       "2개 보유 · 안전재고 미달"  #b45309 → #b91c1c
```

`<CollapsedRow>` 는 **3회 사용 확정 컴포넌트**다. 중간에 끊기면 부분 잔여가 남으므로
컨텍스트를 확보한 상태에서 착수한다.

### 🛑 위 §1 은 2026-08-16 실측으로 **폐기됨** — 착수 전 반드시 읽을 것

```
GREEN 3  상세 스펙 0건   ✅ 기구현   page.tsx:663-681 <CollapsedRow label="상세 스펙">
                                     액션은 v21 §1 로 canEditSpec 게이트 안 `스펙 편집`.
                                     buyer `정보 요청` 링크는 의도적 폐기(dead link 0)
GREEN 4  SDS 0건        ✅ 기구현   page.tsx:849-873 <CollapsedRow label="SDS/MSDS 문서">
GREEN 5  규제 포털       ⛔ 은퇴 확정 — 구현하면 RED
                                     v21 §5(2026-08-09 승인)로 CollapsedRow 폐기 →
                                     주요 2기관 버튼 + `더보기 ${rest.length}개 기관 ›`
                                     계약⑥ = PAGE_CODE.not.toMatch(/CollapsedRow label="국내 규제기관 포털"/)
                                     **역방향 잠금**이다
②-a red  ✅ 기적용   page.tsx:1233  below ? "text-[#b91c1c]" : "text-slate-900"
                                     repo 내 #b45309 잔존 3건은 전부 §0-B 보류 축(안전재고 아님)
```

**즉 `<CollapsedRow>` 사용은 3회가 아니라 2회로 확정됐고, 세 번째 자리는 v21 §5 가
다른 형태로 승계했다.** "중간에 끊기면 부분 잔여" 논거는 소멸했다.
production 코드 변경분 0건 — 2026-08-16 배치는 **Phase 3 EXIT 배선만** 수행했다(§8).

```
확인 필요  PLAN §11 Phase Checklist 에 `[x] Phase 3 complete (596e7ebf→ab0e4e2d · 48/48 GREEN)` 와
          `[ ] Phase 3 complete` 가 동시에 있다. 중복 4줄(`[ ] Phase 2/3/4/5`)은 잔존 템플릿으로
          보이나 판정은 총괄 몫. 이 모순이 이번 배치가 "이미 끝난 일"에 착수한 직접 원인이다.
확인 필요  product-completeness.tsx 는 production importer 0 (dead file, 승계자 = PendingInfoRow).
          보류 중인 §0-B amber 8토큰 게이트가 dead file 표면을 잠그고 있다 — CLAUDE.md 302c 가
          이미 겪은 형태(dead file 세대 잠금 → 은퇴→승계)와 동형. §0-B yellow 확정 배치 착수 전
          "이 토큰이 살아 있는 표면이 어디냐" 를 먼저 판정할 것.
```

---

## 8. Phase 3 EXIT 배선 결과 (2026-08-16)

게이트를 **축 3개로 분해**했다. 축 A/B 만 GREEN 이고 축 C 는 미배선이다.

```
축 A  fixture 자기 무결성 + 비교기 실증        🟢  기존 9 it (무손상)
      의미하는 것    fixture 내부 정합 · 비교기 탐지력/정밀도
      의미 못하는 것  시안 정합 · 제품 화면 정합 (둘 다 아님)

축 B  fixture ↔ 시안 실렌더                    🟢  신규 7 it (이번 배선)
      의미하는 것    fixture 112 가 시안 렌더에 실재 (중복 개수까지 · missing 0 · extra 0)
      의미 못하는 것  제품 화면 정합 — actual 이 시안이지 제품이 아니다

축 C  fixture ↔ 제품 화면                      ⛔ 미배선
      §7.6 "적용 지점 = Phase 3/4/5 EXIT · Phase 6" 이 요구하는 축. 아직 없다
```

총계 9 → **16 GREEN** (refinement 48 포함 **64/64**). +7 은 의도된 증가분 —
Phase 5 baseline-delta 0 항목에서 승인 주석 대조 대상이다.

### 렌더 실측 (독립 재현)

```
시안        Desktop\피드백4\소싱 견적 담기 흐름 개선 (단독).html
sha256      6d98bd270f728714c2055c53beb90f4fd4e72ff65d58fd5e9c897d1e762543f5  ✅ 일치
엔진        Chromium 1194 (/opt/pw-browsers/chromium-1194/chrome-linux/chrome, playwright install 미사용)
텍스트노드   126 고정 — 뷰포트 390/1440/1920/3840 전부. 다중집합도 4종 동일(드리프트 0)
            직전 세션 실측 126(=130 폐기)을 독립 재현
pageError 0 · consoleError 0
분리 계상    렌더 126 − fixture 112 = 잔여 14 → `non_ui_nodes` 로 명시 분리
            (시안 문서 제목·부제·섹션번호·주석). 측정 모집단 축을 fixture 상단에 기재
산출물      __tests__/fixtures/product-detail-comp.render.json  (신규)
            source path / sha256 / bytes / engine / extraction / viewports / node counts / 도출일 고정
```

### 게이트 자기검증 — 5종 변이 전부 RED (§7.6 요구)

```
렌더 라벨 1건 손상          → RED  (다중집합 대조)
중복 1건만 제거             → RED  (Set 대조였다면 통과했다)
노드 1건 삭제               → RED
뷰포트 카운트 1개 드리프트   → RED
부분 로딩 (126→60)          → RED  (앵커 위장 방어)
fixture 측 라벨 1건 손상     → RED  (양방향)
정상                        → GREEN 64/64 (오탐 0)
```

축 C 미배선은 **단언으로** 남겼다 —
`expect(Object.keys(RENDER)).not.toContain("product_render_nodes")`.
남겨두지 않으면 축 A·B GREEN 이 제품 정합으로 읽힌다.

### 축 C 가 못 된 이유 — 추정 아님

```
1  §7.6 이 요구하는 "렌더 결과"는 구현된 앱 화면이다. Next 앱 기동 + 시드 제품 필요.
   sandbox 는 공유 node_modules 설치 금지 · 마운트 FS 45s 타임아웃 · 컨테이너에 repo/DB 없음
2  fixture 112 중 1b(24)·1c(37)는 /quotes/{rfqId}/prepare · /app/search 표면 = Phase 4/5 산출물.
   Phase 3 EXIT 에서 축 C 로 잴 수 있는 것은 1a(51) 부분집합뿐
3  1a 안에도 ₩45,000 · 2026. 5. 12. · Sigma-Tech Korea · 시약 카테고리 거래 4회 같은
   시드 데이터 종속 라벨이 있어 대조 대상 재분류가 선행돼야 한다
```

**선결 = "시드 제품 1건 확정 + 데이터 종속 라벨 분리". 별도 배치.**
지금 축 B 가 GREEN 이라는 사실은 **제품 화면에 대해 아무것도 말하지 않는다.**

---

## 2. 이 세션에서 닫힌 것

### 렌더 검증 — 직전 인계문서 §1 첫 줄 해소

```
fixture 라벨 112     🟢 렌더 전량 확인 — missing 0
                        중복 개수까지 일치 (상세 ›×3 · PBS-3×2 · 상세 보기×2 · Cat.×2)
조건부 렌더           🟢 0건
JS 생성 UI 텍스트     🟢 0건
특수문자 3종          🟢 보존 · ASCII 오염 0
총 텍스트노드 130     🔴 폐기 → 실측 126
colors 앵커           ⚪ 렌더 대조 불가 판정
게이트                🟢 9/9 GREEN (배선 이후 최초 가동)
```

**fixture 라벨 축 🟡 → 🟢 승격.** 직전 세션이 우려한 조건부 렌더·JS 치환은 없었다.

### 판정 2건 확정 — DECISION 문서 참조

```
①  배너 미생성 유지 + 근거 문장 교체
    "불변식 3개 미설계" → "1개 미설계, 그 1개가 이중 생성 판정 기준"
②  amber 3곳 분해 배치
    ②-a 안전재고 미달 → red   : Phase 3 동반 (§0-B 무관)
    ②-b 작성중 카드·공급사 없음 : 별도 배치 (§0-B 토큰 정본 층)
```

---

## 3. 🛑 게이트 GREEN 의 의미 — 오독 금지

**게이트는 아직 시안을 보지 않는다.**

`compareLabels()` 가 화면 산출물에 미배선이므로 ①②③ 실증은 전부
`fixture ↔ fixture` 비교다 (`compareLabels(exp, [...exp].reverse())` — 자기 자신의 역순).

```
현재 GREEN 이 의미하는 것   fixture 자기 무결성 + 비교기 정밀도
현재 GREEN 이 의미 못하는 것 시안 정합
렌더 대조 활성 시점          Phase 3 EXIT
```

이번 렌더 대조는 **게이트 밖에서** 수행됐다. 게이트 안으로 들어오는 것이 Phase 3 EXIT 의 일이다.

---

## 4. ⚠️ 렌더 재현 경로 — 스크립트는 세션과 함께 사라진다

이번 도출에 쓴 스크립트는 sandbox 컨테이너에만 있었다. **다음 세션은 아래로 재현한다.**

```
시안 파일   C:\Users\young\Desktop\소싱 견적 담기 흐름 개선 (단독).html
크기        22,907,433 B
sha256      6d98bd270f728714c2055c53beb90f4fd4e72ff65d58fd5e9c897d1e762543f5
            ← 채팅 업로드본과 동일 확인됨. 파일이 바뀌면 이 해시부터 다시 잡을 것
```

### 재현 절차

```
1  Chromium 헤드리스 (Claude in Chrome 확장 불필요)
   executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome
   ※ playwright install 금지 — 버전 불일치로 chromium_headless_shell-1234 를 찾다 실패한다
2  file:// 로 로드 → waitUntil 'load'
3  언팩 대기: document.body.innerText 에서 "Unpacking" 소멸까지 + 6s
4  TreeWalker(SHOW_TEXT) 로 텍스트노드 전량, 공백 정규화 후 빈 문자열 제외
5  다중집합 대조 — Set 대조 금지 (중복이 사라져 줄어든 것이 통과로 읽힌다)
```

### 측정 축 함정 2건 — 반드시 읽을 것

```
1  radius 를 텍스트노드 부모만 재면 12px 이 최대로 나와 "14–16 미준수" 로 오독된다.
   전 요소(245개) 측정에서 14px 6건 / 16px 5건 확인 — 스펙 준수다.
   카드 컨테이너는 텍스트를 직접 담지 않는다.

2  colors 는 렌더와 fixture 가 같은 축이되 **모집단**이 다르다.
   렌더는 색 미지정 요소가 #000000 기본값으로 119건 잡히고,
   fixture 는 소스 문자열에 실제로 쓰인 hex 만 센다.
   렌더 33종/367  vs  fixture 73종/211 — 양방향으로 서로를 대체하지 못한다.
   → colors 앵커는 fixture 자기 무결성 지표로만 쓴다.
```

---

## 5. 대기 중 — 별도 배치

```
②-b + §0-C 재판정   amber → yellow 치환. 대비 실측표는 DECISION §2 에 입력값으로 있음
                     yellow 는 AA 전량 유지 (최대 손실 0.22) — §0-C 의 대비 근거는 소멸
보더 대비 미달       #fde68a/#fffbeb = 1.20 · #fef08a/#fefce8 = 1.13 — 둘 다 3.0 미달
                     치환이 만드는 문제가 아니라 현행 시안이 이미 그렇다. 담당 배치 미정
감사 무결성 트랙     커밋 2 미착수 — 감사 실패는 여전히 조용하다
개발 DB 비밀번호     회전 미완 (비차단, 위생)
```

---

## 6. 이 세션의 절차 기록

### 착수 지연 — 총괄이 바로잡았다

렌더 검증에 브라우저 확장이 필수라고 판단해 "두 전제 미충족"으로 멈췄다.
**헤드리스로 가능한 일이었고, 시안 파일도 총괄 디스크에 있었다.**
직전 세션이 여섯 턴 소모한 것과 같은 형태다.

```
교훈  차단을 보고하기 전에 차단이 아닌 경로를 먼저 소진한다.
      "필요한 도구가 없다" 와 "그 도구가 필요하다" 는 다른 주장이다.
```

### 동형 반복 2회 — 근거 없음 ≠ 근거를 안 봄

```
1회  1차 추출이 헤더를 잘라 문서 제목을 못 봄  → "설계 근거 없음"
2회  같은 폴더의 지시문 md 를 안 읽음          → "불변식 3개 미설계"
```

두 번 다 판단은 정직했고 소스 확인이 불완전했다. **판정 전 소스 전수 확인을
절차에 넣지 않으면 3회가 난다.** 이번엔 md 가 시안 HTML 과 같은 폴더·같은 날짜에 있었다.

### 마운트 git — 이 repo 에 안 맞는다

```
git status  45s 타임아웃 → index.lock 잔류
git commit  45s 타임아웃 → index.lock 잔류
```
두 번 다 락을 `_to_delete/git-lock-20260815/` 로 치웠다(이 도구는 삭제가 안 된다).
**커밋·푸시는 클로드코드 환경에서 한다** — CLAUDE.md 규약과도 일치한다.

---

## 7. 이 세션이 남기는 한 문장

> **근거가 틀린 채로 결론만 맞는 카드는 결론을 지키지 못한다** —
> 배너 미생성은 유지됐지만 그것을 살린 것은 결정 자체가 아니라
> "무엇을 막을지는 적혀 있고 무엇이 중복인지가 없다" 는 한 줄이었다.
