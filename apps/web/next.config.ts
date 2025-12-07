import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler: true, // 일시적으로 비활성화 (babel-plugin-react-compiler 오류 해결 후 활성화)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // 성능 최적화
  compress: true,
  poweredByHeader: false,
  // 실험적 기능
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
