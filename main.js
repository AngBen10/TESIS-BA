
const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow = null;
let nextServerProcess = null;
let nextPort = 3000;


const ENV_TEMPLATE = `# Configuración del Sistema
# Editá este archivo con los datos de tu SQL Server local y reiniciá la app.

DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=LaParadaBar
DB_USER=sa
DB_PASSWORD=tu_password_aqui
DB_ENCRYPT=false
DB_TRUST_CERT=true
`;

function getEnvFilePath() {
  return path.join(app.getPath('userData'), '.env.local');
}

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}

function ensureEnvFile() {
  const envFile = getEnvFilePath();
  if (fs.existsSync(envFile)) {
    loadEnvFile(envFile);
    return true;
  }
  try {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, ENV_TEMPLATE, 'utf8');
  } catch (e) {
    dialog.showErrorBox('Error', `No pude crear el archivo de configuración:\n${e.message}`);
    return false;
  }
  const choice = dialog.showMessageBoxSync({
    type: 'info',
    title: 'Configuración inicial',
    message: 'Configuración inicial requerida',
    detail:
      `Es la primera vez que abrís el sistema en esta máquina.\n\n` +
      `Se creó un archivo de configuración en:\n${envFile}\n\n` +
      `Editalo con los datos de tu SQL Server local (servidor, base, usuario, contraseña), guardalo y volvé a abrir la aplicación.`,
    buttons: ['Abrir carpeta y salir', 'Solo salir'],
    defaultId: 0,
  });
  if (choice === 0) shell.openPath(path.dirname(envFile));
  return false;
}


function findFreePort(start = 3000) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const srv = net.createServer();
      srv.once('error', () => tryPort(p + 1));
      srv.once('listening', () => srv.close(() => resolve(p)));
      srv.listen(p, '127.0.0.1');
    };
    tryPort(start);
  });
}

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryReq = () => {
      const req = http.get(url, () => resolve());
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('timeout esperando al server'));
        else setTimeout(tryReq, 300);
      });
    };
    tryReq();
  });
}

function startNextServer() {
  const appRoot = app.isPackaged ? app.getAppPath() : __dirname;
  const serverPath = path.join(appRoot, '.next', 'standalone', 'server.js');
  if (!fs.existsSync(serverPath)) {
    dialog.showErrorBox('Error', `No encuentro el servidor de la app:\n${serverPath}\n\n¿Olvidaste correr "npm run build:standalone" antes de empaquetar?`);
    app.quit();
    return;
  }
  const env = {
    ...process.env,
    PORT: String(nextPort),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
  };
  nextServerProcess = spawn(process.execPath, [serverPath], {
    env,
    cwd: path.join(appRoot, '.next', 'standalone'),
    stdio: 'inherit',
  });
  nextServerProcess.on('exit', (code) => {
    console.log(`[next-server] exit code ${code}`);
  });
}

function killNextServer() {
  if (nextServerProcess && !nextServerProcess.killed) {
    try { nextServerProcess.kill(); } catch (_) {}
  }
}


async function createWindow() {
  if (!isDev) {
    nextPort = await findFreePort(3000);
    startNextServer();
    try {
      await waitForServer(`http://127.0.0.1:${nextPort}/login`);
    } catch (e) {
      dialog.showErrorBox('Error al iniciar', `No pudo arrancar el servidor interno:\n${e.message}\n\nRevisá la configuración en:\n${getEnvFilePath()}`);
      killNextServer();
      app.quit();
      return;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Sistema de Gestión',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    icon: path.join(app.isPackaged ? process.resourcesPath : __dirname, 'build', 'icon.ico'),
  });

  mainWindow.maximize();

  const url = isDev
    ? 'http://localhost:3000/login'
    : `http://127.0.0.1:${nextPort}/login`;

  mainWindow.loadURL(url);
}


app.whenReady().then(() => {
  if (!isDev) {
    const ok = ensureEnvFile();
    if (!ok) { app.quit(); return; }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  killNextServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  killNextServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
