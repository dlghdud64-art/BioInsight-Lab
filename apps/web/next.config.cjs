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
    // Next.js는 기본적으로 tsconfig.json의 paths를 읽지만
    // Vercel 빌드 환경에서 명시적으로 설정
    const projectRoot = path.resolve(dir || __dirname);
    const srcPath = path.resolve(projectRoot, 'src');
    
    // 기존 alias 보존
    const existingAlias = config.resolve?.alias || {};
    
    // @ alias 설정 (절대 경로)
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...existingAlias,
      '@': srcPath,
    };
    
    return config;
  }
};

module.exports = nextConfig;
