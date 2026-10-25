// Copies the static site into dist/ so `npm start` serves a clean build.
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, 'dist');
const files = ['index.html', 'styles.css', 'data.js', 'app.js'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of files) fs.copyFileSync(path.join(__dirname, f), path.join(out, f));

// Local icons for languages devicon doesn't cover (see .claude/skills/add-language).
const icons = path.join(__dirname, 'icons');
if (fs.existsSync(icons)) fs.cpSync(icons, path.join(out, 'icons'), { recursive: true });

console.log(`Built ${files.length} files -> ${path.relative(process.cwd(), out) || 'dist'}`);
