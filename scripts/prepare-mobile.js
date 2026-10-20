const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..');
const outDir = path.join(__dirname, '..', 'www');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Files to copy to www
const filesToCopy = ['index.html', 'styles.css', 'app.js', 'manifest.json'];

filesToCopy.forEach(file => {
  const src = path.join(srcDir, file);
  const dest = path.join(outDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[Mobile Build] Copied ${file} -> www/${file}`);
  }
});

console.log('[Mobile Build] Web assets prepared in www/');
