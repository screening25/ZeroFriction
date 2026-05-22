import { execFile } from 'child_process';
import { NextResponse } from 'next/server';

/**
 * macOS osascript 기반 알림 송출.
 * - 'system': 화면 중앙 경고 다이얼로그 (display alert)
 * - 'browser': OS 표준 슬라이드 배너 알림 (display notification)
 */
export async function notifyHandler(request: Request): Promise<NextResponse> {
  try {
    const { title, body, type } = await request.json();
    
    if (type === 'browser') {
      execFile('osascript', [
        '-e', 'on run argv',
        '-e', 'display notification (item 2 of argv) with title (item 1 of argv)',
        '-e', 'end run',
        String(title),
        String(body)
      ]);
    } else {
      execFile('osascript', [
        '-e', 'on run argv',
        '-e', 'display alert (item 1 of argv) message (item 2 of argv) giving up after 10',
        '-e', 'end run',
        String(title),
        String(body)
      ]);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
