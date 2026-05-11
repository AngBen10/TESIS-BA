const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "LA PARADA - Sistema de Gestión",
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // Ocultar barra de menú por defecto para look de escritorio limpio
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'favicon.ico')
  });

  // En desarrollo, cargar la URL de Next.js. En producción, cargar el build estático.
  const url = isDev 
    ? 'http://localhost:3000/login' 
    : `file://${path.join(__dirname, '../out/index.html')}`;

  win.loadURL(url);

  if (isDev) {
    // Opcional: abrir herramientas de desarrollador en dev
    // win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
