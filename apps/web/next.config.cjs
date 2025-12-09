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
    // 경로 alias 설정 - Vercel 빌드 환경을 고려한 절대 경로
    // dir은 apps/web을 가리키므로 src 경로를 정확히 설정
    const srcPath = path.resolve(dir || __dirname, 'src');
    
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // 기존 alias 유지하면서 @ 추가
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': srcPath,
    };
    
    return config;
  }
};

module.exports = nextConfig;
