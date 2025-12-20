// Script to start Next.js standalone server
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3000;
const MAX_RETRIES = 30;

function waitForServer(retries = 0) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}`, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        resolve();
      } else {
        if (retries < MAX_RETRIES) {
          setTimeout(() => waitForServer(retries + 1).then(resolve).catch(reject), 1000);
        } else {
          reject(new Error('Server failed to start'));
        }
      }
    });

    req.on('error', () => {
      if (retries < MAX_RETRIES) {
        setTimeout(() => waitForServer(retries + 1).then(resolve).catch(reject), 1000);
      } else {
        reject(new Error('Server failed to start'));
      }
    });

    req.setTimeout(2000, () => {
      req.destroy();
      if (retries < MAX_RETRIES) {
        setTimeout(() => waitForServer(retries + 1).then(resolve).catch(reject), 1000);
      } else {
        reject(new Error('Server connection timeout'));
      }
    });
  });
}

async function startServer() {
  const serverPath = path.join(__dirname, '../.next/standalone/server.js');
  const serverDir = path.join(__dirname, '../.next/standalone');

  console.log('Starting Next.js server...');
  console.log('Server path:', serverPath);

  const serverProcess = spawn('node', ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: PORT.toString(),
      NODE_ENV: 'production'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Server exited with code ${code}`);
      process.exit(code);
    }
  });

  // Wait for server to be ready
  try {
    await waitForServer();
    console.log('Server is ready!');
  } catch (error) {
    console.error('Server failed to start:', error);
    serverProcess.kill();
    process.exit(1);
  }

  // Keep process alive
  process.on('SIGTERM', () => {
    serverProcess.kill();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    serverProcess.kill();
    process.exit(0);
  });
}

startServer();
