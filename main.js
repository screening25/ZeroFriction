const { app, BrowserWindow, ipcMain, Notification, Tray, Menu } = require('electron');
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
let tray;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 850,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setAspectRatio(420 / 850);
  mainWindow.loadURL('http://localhost:3005');
  
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

function createTray() {
  const iconPath = path.join(__dirname, 'public', 'trayTemplate.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Zero-Friction');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '새 일정 등록',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('tray-action', 'new-schedule');
        }
      }
    },
    {
      label: '새 재고 등록',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('tray-action', 'new-inventory');
        }
      }
    },
    {
      label: '새 메모 작성',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('tray-action', 'new-memo');
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

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    }
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

app.on('ready', () => {
  createWindow();
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

