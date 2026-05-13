const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false, // SWC minifier가 radix-ui + 대규모 client component에서 TDZ 발생 → terser 사용
  generateBuildId: () => `v${Date.now()}`,

  // pdf-parse / pdfjs-dist는 Node.js 네이티브 모듈이므로 서버 컴포넌트에서 외부 패키지로 처리
  // pdfjs-dist: pdf-parse v2의 종속 라이브러리 (번들링 시 DOM API 참조 오류 방지)
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  },

  // 이미지 최적화 설정
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // 컴파일 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // §11.225 hot fix root cause 차단 (§11.231 ~ §11.239 release-prep batches):
  //   `ignoreBuildErrors: true` 가 tsc error 를 build pass 시켜 silent type drift
  //   가 production runtime 까지 통과하던 패턴 차단 (`quote.order` 무존재,
  //   `orderNumber` legacy fallback ReferenceError 등). tsc --noEmit 0 errors
  //   달성 (§11.239) — production build 도 strict 검증 통과.
  //
  // 회귀 시 절대 다시 enable 하지 말 것. 새 type error 가 production build 를
  // 막을 경우 source 수정으로 해결 (release-prep batches 패턴 정합).
  typescript: {
    ignoreBuildErrors: false,
  },

  // 압축 설정
  compress: true,

  webpack(config, { isServer }) {
    // Vercel 빌드 환경에서 tsconfig path를 자동 인식 못할 수 있음
    config.resolve.alias["@"] = path.resolve(__dirname);

    // pdf-parse는 Node.js 전용이므로 클라이언트 번들에서 제외
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // SWC minifier TDZ 회피: 클라이언트 번들 minimize 완전 비활성화
    // 번들 크기가 증가하지만 런타임 TDZ 에러를 근본적으로 제거
    if (!isServer) {
      config.optimization.minimize = false;
    }

    return config;
  }
};

module.exports = nextConfig;
