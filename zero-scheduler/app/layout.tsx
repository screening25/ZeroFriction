import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/frontend/context/AppContext';
import ClientLayout from '@/frontend/components/ClientLayout';

export const metadata: Metadata = {
  title: 'Zero-Friction Scheduler',
  description: '자연어 기반 초경량 일정 관리 앱',
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
