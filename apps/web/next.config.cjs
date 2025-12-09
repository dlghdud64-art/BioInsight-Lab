const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // 필요하면 여기 설정 더 넣어줘
  // images: {
  //   domains: ['example.com'],
  // },

  webpack(config, { dir, isServer }) {
    // 경로 alias 설정 - Vercel 빌드 환경을 위한 명시적 설정
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // dir은 apps/web 디렉토리를 가리킴 (Vercel: /vercel/path0/apps/web)
    // __dirname은 next.config.cjs 파일의 위치 (apps/web)
    const projectRoot = dir || __dirname;
    const srcPath = path.resolve(projectRoot, 'src');
    
    // 기존 alias 유지하면서 @ 추가
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': srcPath,
    };
    
    return config;
  }
};

module.exports = nextConfig;
