# §csrf-raw-fetch — raw fetch 뮤테이션 9건 (기준선 · 처분 안 함)

**등재 2026-08-19** · `check-csrf-fetch-regression.sh` 를 고치자 처음으로 나온 결과

🛑 **기준선만 기록한다. 고치지 않았다.** 알림 404 와 같은 절차다.

## 🛑 2026-08-20 갱신 — 세 번이 겹쳤다: 백틱 사각지대 · 모드 확정 · 유입 2건 처분

**(1) 세 번째 결함 — 기준선 9건은 부분집합이었다.**
문자 클래스 `[\"\x27]` 가 백틱을 안 잡는다. `fetch(\`/api/.../${id}\`)` 템플릿 리터럴
mutation(동적 ID — mutation 의 다수형)이 전부 사각지대였다.
백틱 포함 전수는 **72건** — `baselines/csrf-raw-fetch-2026-08-20.txt` (러너 축 다름 · 파일 헤더 참조).
표본 4건 소스 대조 4/4 진성. 스크립트는 백틱 포함으로 수정했고, 8/19 러너(rg 15.2.0+PCRE2)
재실행 대조가 대기다 — 이 VM 의 rg 13 은 PCRE2 미탑재라 Pass 2 를 못 돌린다.

**(2) LABAXIS_CSRF_MODE = full_enforce 확정 (소스 대조 + 프로덕션 실측 결합).**
```
실측 2026-08-20  요금 페이지 Free CTA 클릭 → POST /api/billing/plan-select 403
                 → "일시적 오류" 배너 · 신규 고객 전환 1번 버튼 dead
대조             plan-select 는 registry 상 required · highRisk 아님
                 라우트 소스에 403 반환 코드 0 → 403 은 미들웨어 발
                 soft_enforce 는 highRisk 만 차단 → 비-highRisk 차단 = full_enforce
방증             /api/analytics/rum POST 403 (전 페이지 · 역시 비-highRisk)
전제             배포본 미들웨어 = 레포. Vercel env 확인은 확인 사살 (지시문)
```
→ **따름정리: 72건 중 exempt 라우트 대상(vendor/receiving token · pricing-assistant) 제외
   전부가 지금 프로덕션 dead button 이다.** 조직 관리·재고·설정·팀·workbench 견적 패널·
   예산 스토어까지 — "9건의 잠복 부채" 가 아니라 광역 현재 장애다.
⚠️ 미해소 모순 축: 8/18 폐루프는 성공했다. 폐루프가 밟은 mutation 이 전부 csrfFetch 경유였는지,
   아니면 full_enforce 전환이 8/18 이후인지 — env 변경 이력으로 갈린다. 판정 전 단정 금지.

**(3) 처분 1·2/9 — 유입 2건.**
`app/pricing/page.tsx` `/api/billing/plan-select`(:214→217) · `/api/leads`(:261→265) csrfFetch 전환.
plan-select 는 403 실측 후 수정, leads 는 같은 파일 같은 형태(제출 실측 안 함 — 표기 아닌 형태 근거).
🛑 남은 70건은 처분 안 함. 한 배치로 묶지 않는다 — 화면 계열별 분할 + 계열마다 실측 1건.

## 🔑 이 스크립트는 **한 번도 스캔한 적이 없다**

두 결함이 겹쳐 있었고, 둘 다 `2>/dev/null` + `|| true` 가 삼켰다:

```
(1) Pass 1  --type tsx     → rg: unrecognized file type: tsx · exit 2
                             (-t ts 가 이미 .ts·.tsx 를 포함한다. 같은 레포의
                              check-no-inline-hex-bg.sh 주석이 이미 그렇게 적어뒀다)
(2) Pass 2  (?<!csrf)      → rg 기본 엔진(Rust regex) lookbehind 미지원 · exit 2
                             -P(PCRE2) 필요
```

Pass 1 이 먼저 죽어 `RAW_FETCH_FILES` 가 비었고, **루프가 0회 돌아** 항상
`✅ No raw fetch mutation regressions detected · exit 0` 이었다.

⚠️ 세션 초반 백로그 항목 **"csrf-raw-fetch 전면 스캔"** 의 성격이 이걸로 확정된다:
   *스캔을 아직 안 돌린 것이 아니라, 스캔이 존재한 적이 없다.*

## 기준선 — 9건

```
app/admin/users/page.tsx:1674
app/dashboard/pricing/page.tsx:101
app/dashboard/purchase-orders/new/page.tsx:105
app/pricing/_components/pricing-assistant.tsx:31
app/pricing/page.tsx:214
app/pricing/page.tsx:261
app/protocol/bom/page.tsx:175
components/safety/MsdsBulkRegisterModal.tsx:60
components/safety/MsdsBulkRegisterModal.tsx:86
```

🔑 **`purchase-orders/new/page.tsx:105` 는 경로 C 의 `/api/orders/draft` 호출부다.**
   ⑪ 트랙에서 "발주 생성 화면이 PurchaseRecord 만 만든다" 로 측정한 그 경로가
   **CSRF 토큰 없이 POST** 하고 있다. 403 가능성 — 두 트랙이 같은 줄에서 만난다.

⚠️ 세션 초반에 고친 CSRF 403 블로커(`e0518824` csrfFetch 승계)와 **같은 형태가 9곳 더** 있다.

## 착수 시 선행 판정

```
1  9건 각각이 실제 403 을 내는가 — 정적 판독이다. 프로덕션 실측 필요
   (csrfFetch 미사용 = 즉시 403 인지, 일부 엔드포인트는 CSRF 면제인지)
2  일괄 치환 vs 개별 — csrfFetch 는 시그니처가 fetch 와 같아 치환이 기계적이나,
   🛑 9곳을 한 배치로 묶지 않는다(§11.75 와 같은 규율)
3  purchase-orders/new 는 ⑪ 트랙과 겹친다 — 어느 트랙에서 고칠지 먼저 정한다
```

## 프로브 3축 (러너 = bash · ripgrep 15.2.0)

```
① 없는 경로        → exit 2  "스캔 대상 부족 — 0개 (기대 2000+)"   ✅
② 정당한 0건       → exit 0  "✅ No raw fetch mutation regressions"  ✅ 오탐 0
③ -P 제거          → exit 2                                        ✅ 엔진 결함이 통과 안 됨
```

③이 이 스크립트 고유 축이다 — 다른 스크립트엔 lookbehind 가 없다.

## 관련

- `CARD_gate-script-silent-fail.md` — 왜 눈이 멀어 있었나
- `baselines/csrf-raw-fetch-2026-08-19.txt` — 기준선 원본
- `e0518824` — 세션 초반에 고친 같은 형태 1건
