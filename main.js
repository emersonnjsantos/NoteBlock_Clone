const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const iconPath = path.join(__dirname, 'notepad_icon.ico');

  const win = new BrowserWindow({
    width: 1050,
    height: 720,
    minWidth: 420,
    minHeight: 320,
    title: 'Sem título - Bloco de Notas',
    icon: iconPath,
    backgroundColor: '#202020',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // Handle external links (e.g. Bing search, help)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Sync title from document
  win.on('page-title-updated', (e, title) => {
    // allow web page title to update the native window title
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
