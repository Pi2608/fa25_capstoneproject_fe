const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let nextServer = null;
const PORT = 3000;

function waitForServer(url, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkServer = () => {
      attempts++;
      const http = require('http');
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          if (attempts >= maxAttempts) {
            reject(new Error(`Server returned status ${res.statusCode}`));
          } else {
            setTimeout(checkServer, 500);
          }
        }
      });
      req.on('error', (err) => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server failed to start: ${err.message}`));
        } else {
          setTimeout(checkServer, 500);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error('Server connection timeout'));
        } else {
          setTimeout(checkServer, 500);
        }
      });
    };
    checkServer();
  });
}

function startNextServer() {
  if (isDev) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const appPath = app.getAppPath();
    const serverPath = path.join(appPath, '.next/standalone/server.js');
    const serverDir = path.join(appPath, '.next/standalone');
    const fs = require('fs');
    
    console.log('App path:', appPath);
    console.log('Server path:', serverPath);
    console.log('Server dir:', serverDir);
    
    if (!fs.existsSync(serverPath)) {
      const error = new Error(`Next.js server not found at ${serverPath}`);
      console.error(error.message);
      reject(error);
      return;
    }
    
    console.log('Starting Next.js server...');
    nextServer = spawn('node', [path.basename(serverPath)], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: PORT.toString(),
        NODE_ENV: 'production'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverOutput = '';
    nextServer.stdout.on('data', (data) => {
      serverOutput += data.toString();
      console.log('Server stdout:', data.toString());
    });

    nextServer.stderr.on('data', (data) => {
      serverOutput += data.toString();
      console.error('Server stderr:', data.toString());
    });

    nextServer.on('error', (error) => {
      console.error('Failed to start Next.js server:', error);
      reject(error);
    });

    nextServer.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Next.js server exited with code ${code}`);
        console.error('Server output:', serverOutput);
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    console.log('Waiting for server to be ready...');
    waitForServer(`http://localhost:${PORT}`)
      .then(() => {
        console.log('Server is ready!');
        resolve();
      })
      .catch((err) => {
        console.error('Server failed to start:', err.message);
        if (nextServer) {
          nextServer.kill();
        }
        reject(err);
      });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  const startUrl = `http://localhost:${PORT}`;
  
  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl).catch((err) => {
    console.error('Failed to load URL:', err);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorCode, errorDescription);
    if (errorCode === -106) {
      setTimeout(() => {
        mainWindow.loadURL(startUrl);
      }, 2000);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    mainWindow.focus();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('Window crashed');
    const { dialog } = require('electron');
    dialog.showErrorBox('Application Crashed', 'The application has crashed. Please restart.');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  createWindow();
  
  try {
    await startNextServer();
  } catch (error) {
    console.error('Failed to start Next.js server:', error);
    const { dialog } = require('electron');
    
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.openDevTools();
      
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
          document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; font-family: Arial; padding: 20px; text-align: center;"><h1 style="color: #e74c3c;">Startup Error</h1><p style="color: #555; max-width: 600px; margin: 20px 0;">Failed to start Next.js server. Please check the DevTools console for details.</p><button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button></div>';
        `);
      });
      
      dialog.showErrorBox('Startup Error', `Failed to start Next.js server:\n\n${error.message}\n\nPlease check the DevTools console for more details.`);
    } else {
      dialog.showErrorBox('Startup Error', `Failed to start application: ${error.message}`);
      app.quit();
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  createMenu();
});

app.on('window-all-closed', () => {
  if (nextServer) {
    nextServer.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (nextServer) {
    nextServer.kill();
  }
});

function createMenu() {
  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { 
          label: 'Show Console',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.openDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
