const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // 필요하면 여기 설정 더 넣어줘
  // images: {
  //   domains: ['example.com'],
  // },

  webpack(config, { dir }) {
    // 경로 alias 설정 - Vercel 빌드 환경을 고려한 절대 경로
    const srcPath = path.join(dir, 'src');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': srcPath,
    };
    return config;
  }
};

module.exports = nextConfig;
