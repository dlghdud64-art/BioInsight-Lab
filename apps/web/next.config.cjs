const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // pdf-parse는 Node.js 네이티브 모듈이므로 서버 컴포넌트에서 외부 패키지로 처리
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },

  // 필요하면 여기 설정 더 넣어줘
  // images: {
  //   domains: ['example.com'],
  // },

  webpack(config) {
    // Vercel 빌드 환경에서 tsconfig path를 자동 인식 못할 수 있음
    // webpack alias 명시 필요
    config.resolve.alias["@"] = path.resolve(__dirname);
    
    // pdf-parse는 Node.js 전용이므로 클라이언트 번들에서 제외
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    
    return config;
  }
};

module.exports = nextConfig;
