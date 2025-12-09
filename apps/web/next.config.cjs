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
    // 경로 alias 설정 - Vercel 빌드 환경을 위한 강화된 설정
    const projectRoot = path.resolve(dir || __dirname);
    const srcPath = path.resolve(projectRoot, 'src');
    
    // 기존 resolve 설정 보존
    const existingResolve = config.resolve || {};
    const existingAlias = existingResolve.alias || {};
    
    // @ alias를 절대 경로로 명시적으로 설정
    config.resolve = {
      ...existingResolve,
      alias: {
        ...existingAlias,
        '@': srcPath,
      },
      // 모듈 해결 순서 명시
      modules: existingResolve.modules || ['node_modules', srcPath],
    };
    
    return config;
  }
};

module.exports = nextConfig;
