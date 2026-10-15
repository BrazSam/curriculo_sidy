const fs = require('node:fs');
const path = require('node:path');
fs.mkdirSync('dist/vendor/pdfjs', { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css', 'pdf-preview.js']) {
  fs.copyFileSync(file, path.join('dist', file));
}
fs.cpSync('img', 'dist/img', { recursive: true });
for (const file of ['pdf.mjs', 'pdf.worker.mjs']) {
  fs.copyFileSync(`node_modules/pdfjs-dist/legacy/build/${file}`, `dist/vendor/pdfjs/${file}`);
}
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  if (fs.existsSync(`node_modules/pdfjs-dist/${folder}`)) {
    fs.cpSync(`node_modules/pdfjs-dist/${folder}`, `dist/vendor/pdfjs/${folder}`, { recursive: true });
  }
}
