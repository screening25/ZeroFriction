const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

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
  
  mainWindow.on('closed', function () {
    mainWindow = null;
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

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  app.quit();
});
