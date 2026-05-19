import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron 위젯 모드에서는 Next.js 개발용 인디케이터(N 로고/dev tools)를 표시하지 않음
  devIndicators: false,
};

export default nextConfig;
