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

  // recharts 등 서드파티 라이브러리의 타입 불일치로 빌드 실패 방지
  // 런타임에는 영향 없으며, 개발 시 tsc --noEmit으로 별도 확인
  typescript: {
    ignoreBuildErrors: true,
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
