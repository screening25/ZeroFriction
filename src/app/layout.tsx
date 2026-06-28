import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/frontend/context/AppContext';
import ClientLayout from '@/frontend/components/ClientLayout';

export const metadata: Metadata = {
  title: 'FitoDesk',
  description: 'Fitogether 운영 허브 — 일정·재고·ERP를 한 화면에서 관리하는 데스크 위젯',
  manifest: '/manifest.json',
  applicationName: 'FitoDesk',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FitoDesk'
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
