import { exec } from 'child_process';
import { NextResponse } from 'next/server';

/**
 * macOS osascript 기반 알림 송출.
 * - 'system': 화면 중앙 경고 다이얼로그 (display alert)
 * - 'browser': OS 표준 슬라이드 배너 알림 (display notification)
 */
export async function notifyHandler(request: Request): Promise<NextResponse> {
  try {
    const { title, body, type } = await request.json();
    const safeTitle = String(title).replace(/"/g, '\\"');
    const safeBody = String(body).replace(/"/g, '\\"');
    
    if (type === 'browser') {
      exec(`osascript -e 'display notification "${safeBody}" with title "${safeTitle}"'`);
    } else {
      exec(`osascript -e 'display alert "${safeTitle}" message "${safeBody}" giving up after 10'`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
