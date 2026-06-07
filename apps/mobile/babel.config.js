module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // §11.380 Phase 2 — VisionCamera frame processor 는 worklet 으로 컴파일.
    //   react-native-worklets-core install 후 활성. (install 전 Metro 시작 시 미존재 에러 →
    //   deps 설치와 원자적으로 적용할 것.)
    plugins: ["react-native-worklets-core/plugin"],
  };
};
