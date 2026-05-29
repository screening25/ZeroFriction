import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 설정 — "호스팅 셸" 방식.
 *
 * Vercel 등에 배포한 Next.js 앱(HTTPS)을 네이티브 안드로이드 셸이 그대로 로드한다.
 * 모든 기능(AI 명령바 등)이 서버 그대로 동작하며, 맥/같은 Wi-Fi에 의존하지 않는다.
 *
 * ⚠️ 배포 후 아래 server.url 을 실제 Vercel 주소로 반드시 교체하세요.
 *    예) https://zero-friction.vercel.app
 */
const config: CapacitorConfig = {
  appId: 'com.zero.friction',
  appName: 'Zero-Friction',

  // server.url 사용 시 로컬 webDir 은 오프라인 폴백용으로만 쓰인다(필수 필드).
  webDir: 'public',

  server: {
    url: 'https://zero-friction-roan.vercel.app',
    cleartext: false,
  },

  android: {
    // 앱 기본 배경색과 일치 — 웹뷰 로딩 중 검은 깜빡임 방지
    backgroundColor: '#F2F2F7',
  },
};

export default config;
