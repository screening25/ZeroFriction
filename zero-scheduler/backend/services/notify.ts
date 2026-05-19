import { exec } from 'child_process';
import { NextResponse } from 'next/server';

/**
 * macOS osascript 기반 강제 알림 송출.
 * 방해금지 모드를 우회해 화면 중앙에 alert 다이얼로그를 띄운다 (10초 후 자동 닫힘).
 */
export async function notifyHandler(request: Request): Promise<NextResponse> {
  try {
    const { title, body } = await request.json();
    const safeTitle = String(title).replace(/"/g, '\\"');
    const safeBody = String(body).replace(/"/g, '\\"');
    exec(`osascript -e 'display alert "${safeTitle}" message "${safeBody}" giving up after 10'`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
