const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const fs = require('fs');

// Load environment variables from .env file at runtime
const envPath = isDev 
  ? path.join(__dirname, '../.env') 
  : path.join(process.resourcesPath, '.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Set to true and use preload script for better security in production
    },
    icon: path.join(__dirname, 'favicon.ico'),
    title: "AutoShift Showroom Management"
  });

  console.log(`App starting. isDev: ${isDev}, isPackaged: ${app.isPackaged}`);

  if (isDev) {
    const startURL = 'http://localhost:3000';
    console.log(`Loading Dev URL: ${startURL}`);
    mainWindow.loadURL(startURL);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../build/index.html');
    console.log(`Loading Production File: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    app.quit();
  });
}

app.on('ready', createWindow);

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
