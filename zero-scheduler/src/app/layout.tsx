import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/frontend/context/AppContext';
import ClientLayout from '@/frontend/components/ClientLayout';

export const metadata: Metadata = {
  title: 'Zero-Friction',
  description: '자연어 한 줄로 일정·재고·변동사항을 동시에 다루는 데일리 오퍼레이션 위젯',
  manifest: '/manifest.json',
  applicationName: 'Zero-Friction',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Zero-Friction'
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icon.png',
    shortcut: '/favicon.png'
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AppProvider>
          <ClientLayout>{children}</ClientLayout>
        </AppProvider>
      </body>
    </html>
  );
}
