# DRAFT — VisionCamera dev build 셋업 (§11.380 Phase 2 선결)

> 상태: **초안(미적용)**. 호영님 검토·승인 후 적용. 적용 시 네이티브 모듈 추가 → **새 dev build 필수**(OTA 불가).
> 작성: 2026-06-07

---

## 0. 개념 정리 (호영님 질문 답)

Expo는 React Native 네이티브 앱 프레임워크가 맞습니다. 실행 방식이 3가지:

| 방식 | 커스텀 네이티브 모듈 | §11.380 검출 |
| :--- | :--- | :--- |
| **Expo Go** (스토어 런처 앱) | ❌ 기본 모듈만 (expo-camera는 됨) | ❌ VisionCamera 불가 |
| **Dev build** (자체 컴파일 앱) | ✅ VisionCamera·ML Kit 가능 | ✅ |
| **Production build** | ✅ | ✅ (배포) |

**현 상태 (정정):** `eas.json`에 `development` 프로파일(`developmentClient: true`)이 **이미 구성됨** → dev build 파이프라인 완비. VisionCamera는 **추가 + 재빌드**만 하면 됨. (앞서 "빌드 환경 부재"는 Glob 툴 오류로 인한 오보였음. app.json·eas.json 모두 존재.)

**왜 재빌드가 필요한가:** VisionCamera는 네이티브 코드. JS만 바뀌는 OTA로는 안 들어감. `eas build --profile development` 한 번 더 돌려 새 dev client 설치 필요.

---

## 1. 현 환경 (확인됨)

- expo `~55.0.5`, react-native `0.83.2`, react `19.2.0`
- 카메라: `expo-camera ~55.0.9` — **scan.tsx에서만 사용** (타 화면은 expo-image-picker, 별개)
- eas.json: development(devClient, simulator) / preview / production 프로파일 존재
- app.json: plugins에 expo-camera 등록, iOS Info.plist 카메라 권한 문구 존재
- babel.config.js: babel-preset-expo + nativewind (worklets plugin 없음 ← 추가 필요)

---

## 2. 적용 Diff 초안 (minimal)

### 2-1. package.json — dependencies 추가

⚠️ 버전은 직접 박지 말고 **`npx expo install`로 SDK 호환 버전 자동 선택** 권장.

```bash
cd apps/mobile
npx expo install react-native-vision-camera react-native-worklets-core
# ML Kit 텍스트 인식 frame processor (커뮤니티 패키지 — 3-1 리스크 참조)
npm i react-native-vision-camera-text-recognition
```

추가될 dependencies (대략):
```jsonc
"react-native-vision-camera": "^4.x",        // 카메라 + frame processor + code scanner
"react-native-worklets-core": "^1.x",        // frame processor worklet 런타임
"react-native-vision-camera-text-recognition": "^x"  // ML Kit 텍스트 라인 검출 plugin
```

### 2-2. app.json — plugins 에 VisionCamera 추가

`"plugins"` 배열에 추가 (expo-camera는 Phase 2 이전 완료 시 제거):

```jsonc
[
  "react-native-vision-camera",
  {
    "cameraPermission": "시약 라벨 인식 및 QR/바코드 스캔을 위해 카메라 접근이 필요합니다.",
    "enableCodeScanner": true,        // 기존 바코드/QR 을 VisionCamera CodeScanner 로 대체
    "enableMicrophonePermission": false
  }
]
```

- config plugin이 iOS Info.plist `NSCameraUsageDescription` + Android `CAMERA` 권한 자동 처리.
- 기존 expo-camera plugin 블록은 **scan.tsx 이전 완료 후** 삭제(이전 중에는 병존 무방).

### 2-3. babel.config.js — worklets plugin 추가

frame processor는 worklet으로 컴파일되므로 plugin 필수:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-worklets-core/plugin", // ← 추가 (VisionCamera frame processor)
    ],
  };
};
```

### 2-4. eas.json — 변경 없음

development 프로파일이 이미 `developmentClient: true`. VisionCamera는 dev build에 자동 포함. **수정 불필요.**

---

## 3. 리스크 & 검증

### 3-1. ML Kit frame processor 패키지 안정성 (主 리스크)
- `react-native-vision-camera-text-recognition`는 커뮤니티 패키지 → VisionCamera v4 / RN 0.83 / New Arch 호환성 설치 시점 확인 필수.
- 불안정 시 fallback: (a) 자체 frame processor plugin(네이티브, 큰 비용) 또는 (b) Phase 3에서 라이브 검출을 "저빈도 캡처+OCR"로 축소(호영님 차선).
- → **Phase 2 착수 첫 단계 = 패키지 호환 설치 PoC**. 빈 frame processor가 디바이스에서 도는지부터 확인.

### 3-2. New Architecture
- expo SDK 55는 New Arch 기본 on 가능성. VisionCamera v4는 New Arch 지원 → 문제 없을 것이나 빌드 시 확인.

### 3-3. 바코드 회귀
- 기존 `onBarcodeScanned`(expo-camera)를 VisionCamera `useCodeScanner`로 이전. barcodeTypes 9종(qr/ean13/...) 매핑 일치 확인.

### 빌드·검증 절차
```bash
cd apps/mobile
npx expo install react-native-vision-camera react-native-worklets-core
npm i react-native-vision-camera-text-recognition
# babel/app.json 적용 후
npx expo prebuild --clean      # 네이티브 프로젝트 재생성(필요 시)
eas build --profile development --platform ios   # 또는 android
# 새 dev client 설치 → Metro 연결 → 실기기/시뮬 검증
```

검증 체크리스트:
- [ ] dev build 성공(iOS·Android)
- [ ] VisionCamera 카메라 프리뷰 표시
- [ ] 빈 frame processor 호출 확인(콘솔 로그)
- [ ] ML Kit 텍스트 라인 검출 frame processor 디바이스 동작
- [ ] 기존 바코드 9종 스캔 회귀 0
- [ ] takePhoto(라벨 촬영) → 기존 scanLabel OCR 경로 유지
- [ ] §11.378 후단 게이트(Phase 1) 우회 0

---

## 4. 요약

- dev build 환경은 **이미 있음**. VisionCamera는 deps 3개 + app.json plugin 1개 + babel plugin 1줄 + **재빌드**.
- 코드(scan.tsx 카메라 이전 + frame processor + 상태머신)는 §11.380 Phase 2~3 본작업.
- 최대 불확실성 = ML Kit frame processor 패키지 호환성 → Phase 2 첫 PoC로 조기 검증.
