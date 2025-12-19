const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' https://custommaposm.vercel.app https://*.vercel.app https://*.firebase.com https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://*.maptiler.com https://*.openstreetmap.org https://*.tile.openstreetmap.org data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob: 'unsafe-inline'; connect-src * 'unsafe-inline'; style-src * 'unsafe-inline'; font-src *; script-src * 'unsafe-inline' 'unsafe-eval';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IMOS</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body, #app {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <div id="app">
        <iframe 
            src="https://custommaposm.vercel.app"
            allow="geolocation; microphone; camera; midi; encrypted-media; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
        ></iframe>
    </div>
</body>
</html>`;

const outDir = path.join(__dirname, '../out');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log('Created production HTML pointing to Vercel deployment');
