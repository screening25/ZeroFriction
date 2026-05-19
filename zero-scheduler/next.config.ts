import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  customWorkerDir: "worker",
});

const nextConfig: NextConfig = {
  // Electron 위젯 모드에서는 Next.js 개발용 인디케이터(N 로고/dev tools)를 표시하지 않음
  devIndicators: false,

  // 같은 Wi-Fi 안의 모바일 기기(Galaxy S25 Edge 등)에서 dev 서버 접근을 허용
  allowedDevOrigins: [
    'localhost:3005',
    '192.168.0.214:3005',
    '192.168.0.214'
  ],

  // Turbopack에서 webpack 설정을 활용할 수 있도록 명시
  // @ts-ignore
  turbopack: {}
};

export default withPWA(nextConfig);
