
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`[postbuild] (omitido, no existe) ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

if (!fs.existsSync(standalone)) {
  console.error('[postbuild] ERROR: no existe .next/standalone. ¿Configuraste output:\'standalone\' en next.config.mjs?');
  process.exit(1);
}

console.log('[postbuild] Copiando .next/static → .next/standalone/.next/static');
copyDir(
  path.join(root, '.next', 'static'),
  path.join(standalone, '.next', 'static')
);

console.log('[postbuild] Copiando public/ → .next/standalone/public');
copyDir(
  path.join(root, 'public'),
  path.join(standalone, 'public')
);

console.log('[postbuild] Listo. El standalone está armado para empaquetar.');
