const fs = require('fs');
const path = require('path');

// Create a minimal index.html that redirects to server
const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>IMOS Loading...</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: system-ui;
            background: #0f172a;
            color: white;
        }
        .loader { text-align: center; }
        .spinner {
            border: 4px solid #334155;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loader">
        <div class="spinner"></div>
        <p>Starting IMOS...</p>
        <p><small>Please wait while the server initializes</small></p>
    </div>
    <script>
        // Redirect to localhost after brief delay
        setTimeout(() => {
            window.location.href = 'http://localhost:3000';
        }, 2000);
    </script>
</body>
</html>`;

const outDir = path.join(__dirname, '../out');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('Created placeholder index.html for Tauri');
