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
    
    // 디버깅을 위한 로그 (Vercel 빌드 로그에서 확인 가능)
    if (process.env.VERCEL) {
      console.log('Webpack alias config:', {
        dir,
        __dirname,
        projectRoot,
        srcPath,
      });
    }
    
    // 기존 alias 유지하면서 @ 추가 (절대 경로 사용)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': srcPath,
    };
    
    // 모듈 해결 순서 확인
    if (!config.resolve.modules) {
      config.resolve.modules = ['node_modules'];
    }
    
    return config;
  }
};

module.exports = nextConfig;
