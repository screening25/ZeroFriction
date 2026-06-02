const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, screen } = require('electron');
const path = require('path');

ipcMain.on('send-notification', (event, { title, body }) => {
  new Notification({
    title: title || 'Zero-Friction',
    body: body || ''
  }).show();
});

ipcMain.on('focus-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

let mainWindow;
let quickInputWindow;
let tray;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 850,
    titleBarStyle: 'hiddenInset',
    // 앱 기본 배경색과 일치 — 로딩/재컴파일로 웹뷰가 잠깐 비어도 검게 깜빡이지 않게 함
    backgroundColor: '#F2F2F7',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setAspectRatio(420 / 850);

  const APP_URL = 'https://zero-friction-roan.vercel.app';
  let retryTimer = null;

  // 서버에 연결되지 않을 때 하얀 화면 대신 안내 화면을 표시 (자동 재연결)
  const showWaiting = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const html =
      '<!doctype html><meta charset="utf-8">' +
      '<body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#F2F2F7;color:#8e8e93;font-family:-apple-system,BlinkMacSystemFont,sans-serif;-webkit-app-region:drag">' +
      '<div style="font-size:14px;font-weight:600">서버에 연결하는 중…</div>' +
      '<div style="font-size:12px;text-align:center">개발 서버가 켜져 있는지 확인하세요<br/>npm run dev (포트 3005)</div>' +
      '</body>';
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  };

  const tryLoadApp = () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(APP_URL);
  };

  tryLoadApp();

  // 로드 실패(서버 미실행/재컴파일) → 안내 화면 후 2초 간격 재시도
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, _desc, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;               // -3: 정상 내비게이션 취소
    if (validatedURL && validatedURL.startsWith('data:')) return; // 안내 화면 자체는 무시
    showWaiting();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(tryLoadApp, 2000);
  });
  // 렌더러 크래시·무응답 → 재로드
  mainWindow.webContents.on('render-process-gone', () => setTimeout(tryLoadApp, 500));
  mainWindow.webContents.on('unresponsive', () => tryLoadApp());
  
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function createQuickInputWindow() {
  quickInputWindow = new BrowserWindow({
    width: 440,
    height: 120,
    frame: false,
    transparent: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 메인 창과 동일한 배포 주소를 사용해야 같은 데이터/세션을 본다 (로컬 dev 서버 의존 제거)
  quickInputWindow.loadURL('https://zero-friction-roan.vercel.app/quick-input');

  quickInputWindow.on('blur', () => {
    quickInputWindow.hide();
  });

  quickInputWindow.on('closed', () => {
    quickInputWindow = null;
  });
}

function positionWindowUnderTray(targetWindow = mainWindow) {
  if (!targetWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const windowBounds = targetWindow.getBounds();
  const activeScreen = screen.getDisplayMatching(trayBounds);
  const workArea = activeScreen.workArea;

  // Align window center with tray center horizontally
  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  // Align window top with tray bottom vertically
  let y = Math.round(trayBounds.y + trayBounds.height);

  // Clamp horizontal coordinates to work area to prevent offscreen rendering
  if (x < workArea.x) {
    x = workArea.x;
  } else if (x + windowBounds.width > workArea.x + workArea.width) {
    x = workArea.x + workArea.width - windowBounds.width;
  }

  // Clamp vertical coordinates
  if (y < workArea.y) {
    y = workArea.y;
  } else if (y + windowBounds.height > workArea.y + workArea.height) {
    // If tray is at the bottom (e.g. taskbar at the bottom of the screen), show window above tray
    y = trayBounds.y - windowBounds.height;
  }

  targetWindow.setPosition(x, y, false);
}

function createTray() {
  const iconPath = path.join(__dirname, 'public', 'trayTemplate.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Zero-Friction');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        if (mainWindow) {
          positionWindowUnderTray(mainWindow);
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('focus-nlp-input');
        }
      }
    },
    { type: 'separator' },
    {
      label: '새 일정 등록',
      click: () => {
        if (mainWindow) {
          positionWindowUnderTray(mainWindow);
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('tray-action', 'new-schedule');
          mainWindow.webContents.send('focus-nlp-input');
        }
      }
    },
    {
      label: '새 재고 등록',
      click: () => {
        if (mainWindow) {
          positionWindowUnderTray(mainWindow);
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('tray-action', 'new-inventory');
          mainWindow.webContents.send('focus-nlp-input');
        }
      }
    },
    {
      label: '새 메모 작성',
      click: () => {
        if (mainWindow) {
          positionWindowUnderTray(mainWindow);
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('tray-action', 'new-memo');
          mainWindow.webContents.send('focus-nlp-input');
        }
      }
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.on('click', () => {
    if (quickInputWindow) {
      if (quickInputWindow.isVisible() && quickInputWindow.isFocused()) {
        quickInputWindow.hide();
      } else {
        positionWindowUnderTray(quickInputWindow);
        quickInputWindow.show();
        quickInputWindow.focus();
        quickInputWindow.webContents.send('clear-quick-input');
      }
    }
  });

  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });
}

ipcMain.on('resize-window', (event, { width, height, aspectRatio }) => {
  if (mainWindow) {
    mainWindow.setResizable(true);
    if (aspectRatio) {
      mainWindow.setAspectRatio(aspectRatio);
    } else {
      mainWindow.setAspectRatio(0);
    }
    mainWindow.setSize(width, height);
  }
});

ipcMain.on('quick-nlp-submit', (event, text) => {
  if (mainWindow) {
    mainWindow.webContents.send('execute-quick-nlp', text);
  }
  if (quickInputWindow) {
    quickInputWindow.hide();
  }
});

ipcMain.on('quick-nlp-close', () => {
  if (quickInputWindow) {
    quickInputWindow.hide();
  }
});

ipcMain.on('quick-action', (event, action) => {
  if (action === 'open') {
    if (mainWindow) {
      positionWindowUnderTray(mainWindow);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('focus-nlp-input');
    }
  } else if (action === 'quit') {
    isQuitting = true;
    app.quit();
  } else {
    if (mainWindow) {
      positionWindowUnderTray(mainWindow);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('tray-action', action);
      mainWindow.webContents.send('focus-nlp-input');
    }
  }
  if (quickInputWindow) {
    quickInputWindow.hide();
  }
});

app.on('ready', () => {
  createWindow();
  createQuickInputWindow();
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

