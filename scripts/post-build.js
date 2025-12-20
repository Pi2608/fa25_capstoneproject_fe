// Post-build script to copy static files to standalone
const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`Source not found: ${src}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying static files to standalone...');

const standaloneDir = path.join(__dirname, '../.next/standalone');
const staticDir = path.join(__dirname, '../.next/static');
const publicDir = path.join(__dirname, '../public');

// Copy .next/static to standalone/.next/static
const targetStaticDir = path.join(standaloneDir, '.next/static');
if (fs.existsSync(staticDir)) {
  console.log('Copying .next/static...');
  copyRecursive(staticDir, targetStaticDir);
}

// Copy public to standalone/public
const targetPublicDir = path.join(standaloneDir, 'public');
if (fs.existsSync(publicDir)) {
  console.log('Copying public...');
  copyRecursive(publicDir, targetPublicDir);
}

console.log('Post-build complete!');
