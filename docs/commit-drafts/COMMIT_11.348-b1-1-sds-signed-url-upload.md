# COMMIT — §11.348-B-1 B1-1: SDS 서명URL 완성 + 업로드

```
feat(safety) §11.348-B-1-1 #sds-signed-url-upload — SDS signed-url TODO 제거(실 Supabase createSignedUrl + msdsUrl 폴백) + 파일 업로드 POST + service-role 스토리지 헬퍼
```

## 무엇 (orphaned 라우트 실기능화 — migration 0)
- B1-0(SDSDocument 모델 적용) 위에서: ① signed-url 라우트의 TODO(임시 경로) 제거 → 실제 Supabase 서명 URL. ② SDS 파일 업로드 경로 신설(데이터 생성처).

## Fix (file별)
- 신규 `lib/safety/sds-storage.ts`: service-role 서버 Supabase 클라이언트(lazy) + `uploadSdsFile`(파일→스토리지 {bucket,path}) + `createSdsSignedUrl`(1시간, 실패/미설정 시 null) + `StorageNotConfiguredError`. po-pdf-storage 패턴 정합, silent fake success 금지. env: `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SDS_BUCKET`(기본 "sds-documents").
- `api/sds/[id]/signed-url/route.ts`: `bucket+path` 있으면 `createSdsSignedUrl` → 실패/미설정 시 `Product.msdsUrl`(레거시 단일 URL) 폴백. 임시 `/api/sds/[id]/download` 잔재 제거.
- `api/products/[id]/sds/route.ts`: POST 추가 — multipart `file` → `uploadSdsFile` → `SDSDocument.create`(source="upload", 조직 스코프=요청자 첫 조직 or null). 스토리지 미설정 시 **503 graceful**(`STORAGE_NOT_CONFIGURED`).

## 설계
- 정본 우선순위: SDSDocument(bucket/path) 서명URL > `Product.msdsUrl`(레거시 폴백). (Open Q "msdsUrl vs SDSDocument" 해소.)
- 스토리지 = Supabase service-role(서버). 비공개 버킷 + 단기 서명URL(노출 최소).
- 업로드는 **보관만** — canonical 안전필드(Product) 승격은 사람 승인(`api/sds/[id]/apply`, B1-3 연계).

## CSRF
- 업로드 POST = 인증 사용자 → registry 기본 `required`(추가 등록 불필요). 클라이언트는 csrfFetch 사용(B1-2 뷰어에서).

## migration
- **없음.** B1-0 적용분 위 코드.

## 검증 (vitest)
- `sds-storage-signed-url-348b1-1.test.ts` → **3/3** (헬퍼/서명URL TODO 제거/업로드 POST). B1-0 sentinel 3/3 동반 green.
- ⚠️ 런타임 스토리지 동작은 `SUPABASE_*` env 필요(ops). env 없으면 업로드 503·서명URL은 msdsUrl 폴백 — 둘 다 graceful(장애 아님).

## Out of Scope (B-1 다음)
- B1-2: MSDS/COA 뷰어 UI(products/[id] + 안전). B1-3: 안전 페이지 mock→실데이터(§11.357). B1-4: COA 동형.

## Rollback
- 신규 helper + sentinel 삭제, signed-url/products-sds 패치 revert. migration 무관, 독립.
```
footer 없음
```
