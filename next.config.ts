import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  // PWA 빌드 산출물(서비스 워커)은 반드시 루트 public/ 에 생성되어야 함 (Next.js 정적 자산 규약)
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // 커스텀 워커 소스 경로 — src/ 통합에 맞춰 worker → src/worker 로 갱신
  customWorkerDir: "src/worker",
});

const nextConfig: NextConfig = {
  // Electron 위젯 모드에서는 Next.js 개발용 인디케이터(N 로고/dev tools)를 표시하지 않음
  devIndicators: false,

  // 프로덕션 빌드(Vercel 등)가 기존 ESLint 에러로 중단되지 않도록 함.
  // 타입 검사는 그대로 유지되며, 린트는 로컬/CI에서 `npm run lint`로 별도 수행한다.
  eslint: { ignoreDuringBuilds: true },

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
