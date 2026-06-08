// Preload (격리 컨텍스트) — contextIsolation:true + sandbox:true 환경에서
// 렌더러(원격 웹 콘텐츠)에 "꼭 필요한 IPC만" 화이트리스트로 노출한다.
// 렌더러는 Node/ipcRenderer에 직접 접근할 수 없고, 오직 window.electronAPI만 사용한다.
const { contextBridge, ipcRenderer } = require('electron');

// 채널 구독 헬퍼 — on/removeListener 쌍을 캡슐화하고 해제 함수를 돌려준다.
function subscribe(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // 렌더러가 Electron 환경인지 감지하는 단일 신호원
  isElectron: true,

  // ── 렌더러 → 메인 (단방향 send; 채널 고정) ──
  sendNotification: (payload) => ipcRenderer.send('send-notification', payload),
  focusWindow: () => ipcRenderer.send('focus-window'),
  resizeWindow: (payload) => ipcRenderer.send('resize-window', payload),
  quickNlpSubmit: (text) => ipcRenderer.send('quick-nlp-submit', text),
  quickNlpClose: () => ipcRenderer.send('quick-nlp-close'),
  quickAction: (action) => ipcRenderer.send('quick-action', action),

  // ── 메인 → 렌더러 (구독; 호출하면 해제 함수를 반환) ──
  // 콜백에는 IpcRendererEvent를 넘기지 않고 가공된 인자만 전달한다(누수 방지).
  onTrayAction: (cb) => subscribe('tray-action', (_e, action) => cb(action)),
  onFocusNlpInput: (cb) => subscribe('focus-nlp-input', () => cb()),
  onExecuteQuickNlp: (cb) => subscribe('execute-quick-nlp', (_e, text) => cb(text)),
  onClearQuickInput: (cb) => subscribe('clear-quick-input', () => cb()),
});
