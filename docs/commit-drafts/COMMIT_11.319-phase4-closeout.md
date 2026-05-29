test+docs(plan): §11.319 Phase 4 #closeout — 회귀 점검 + plan closeout (호영님 P1, 2026-05-29)

§11.319 회귀 점검 결과 (정적 audit):
- §11.290 cluster: ConfidenceBadge/ProviderBadge/ocr-correct/retry testid 보존 (LabelScannerModal 파일피커+503 경로 무변경)
- §11.315 cluster: gemini-config import 보존 (LabelScannerModal runScan 경로 그대로)
- §11.320 cluster: inventory-context-panel 변경 0 (scan 경로 별개)
- §11.321 cluster: scan.tsx 바코드 모드 5 액션 전부 보존 (lookupInventory wiring 무변경)
- 명칭 정합: "스마트 재고 등록 (AI 라벨 스캔)" (§11.315-b closeout 이후 유지)

§11.319 종결 (Phase 0~4 Complete):
- Phase 0+1: capture-quality 순수 모듈 + 22 단언 (8244c3a8)
- Phase 2: 모바일 scan.tsx OCR 라벨 모드 + 바코드 보존 (2f87e918)
- Phase 3: 웹 LabelScannerModal 라이브 프레임 + 휴리스틱 게이트 (c528858e)
- Phase 4: 회귀 0 audit + closeout (본 commit)

Out of Scope (후속 batch):
- §11.290 Phase 5: OcrResult 영속화 / 보정 저장 실제 wiring
- 모바일 실시간 흐림/조명 휴리스틱 (프레임 접근 dep 확보 시)
- 바코드 결정적 인식 강화 (ⓑ)
