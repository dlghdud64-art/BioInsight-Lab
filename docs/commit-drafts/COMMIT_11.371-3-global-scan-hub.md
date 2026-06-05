feat(inventory) §11.371-3 #global-scan-hub — 글로벌 스캔 단일 진입 허브(라벨/거래명세서/QR) (호영님 P-라이브 2026-06-05)

호영님 spec: Header 글로벌 "스마트입고"가 단품 라벨(Endotoxin test tube)을
거래명세서(quote) 파서(parse-image)로 보내 items:[] → 빈 폼(분기 X 확정).
진입점 이원화(§11.315-b) 해소 + 입력유형 사용자 선택으로 파서 미스매치 원천 차단.

Fix:
- modal-store.ts: ModalType scan_hub/smart_receiving 추가
- ScanHubModal.tsx(신규): 3카드 picker → openModal(label_scanner/smart_receiving/qr_scanner)
- global-modal.tsx: scan_hub/smart_receiving 레지스트리 등록(label_scanner 보존)
- Header.tsx: 단일 "스캔" 버튼 → openModal("scan_hub"), SmartReceiving 직접 import/렌더·로컬 state 제거
- SmartReceivingScannerModal.tsx: _renderContentOnly + SmartReceivingContent 어댑터 + 거짓 카피("거래명세서 또는 라벨") 정정(거래명세서 전용)
- LabelScannerModal.tsx: LabelScannerContent 기본 onDirectReceive(helper 자기완결, front-only success 금지)
- submit-label-receive.ts(신규): 라벨 직접등록 영속화 단일점(/api/inventory)
- inventory-content.tsx: 인라인 핸들러 → helper 치환(회귀 0), 미사용 mapLabelToReceiving import 제거

canonical truth 보존: 입고 영속화 = /api/inventory(불변). §11.326 mapLabelToReceiving
(packSize 규격 vs 받은 통 개수) helper 내부로 이동, 분리 로직 동일.

production effect: 글로벌 스캔 1탭 → 입력유형 선택 → 단품 라벨 정상 추출·직접등록.
거래명세서·QR 진입 보존(inventory-main SmartReceiving 잔존).

Out of scope: §11.326 Phase 3(섹션분리/자동계산/마스터영속화) RED — 별도 트랙, push 금지.
§11.371-1 진입 가드 — 다음 트랙. scan-label(§11.369-1) — 기 반영.

Rollback: Header.tsx revert 시 즉시 구버전 진입. 파일별 독립 revert 가능.
