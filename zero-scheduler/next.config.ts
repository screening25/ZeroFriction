import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron 위젯 모드에서는 Next.js 개발용 인디케이터(N 로고/dev tools)를 표시하지 않음
  devIndicators: false,

  // 같은 Wi-Fi 안의 모바일 기기(Galaxy S25 Edge 등)에서 dev 서버 접근을 허용
  // Next 16+ 보안 정책: 명시되지 않은 origin은 HMR을 거부함
  allowedDevOrigins: [
    'http://192.168.0.0/16',
    'http://10.0.0.0/8',
    'http://172.16.0.0/12',
    'http://localhost:3005'
  ]
};

export default nextConfig;
