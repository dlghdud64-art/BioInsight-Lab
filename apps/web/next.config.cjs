const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // 필요하면 여기 설정 더 넣어줘
  // images: {
  //   domains: ['example.com'],
  // },

  webpack(config) {
    // Vercel 빌드 환경에서 tsconfig path를 자동 인식 못할 수 있음
    // webpack alias 명시 필요
    config.resolve.alias["@"] = path.resolve(__dirname);
    return config;
  }
};

module.exports = nextConfig;
