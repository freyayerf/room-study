import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dest = path.join(root, 'dist');
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const css = await readFile(path.join(root, 'src/styles.css'), 'utf8');
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\.\/src\/styles.css"\s*\/?>/,
  () => `<style>${css}</style>`,
);
for (const name of ['engine', 'model', 'layout-store', 'app']) {
  const code = await readFile(path.join(root, `src/${name}.js`), 'utf8');
  const tag = new RegExp(`<script\\s+src="\\./src/${name}\\.js"\\s+defer></script>`);
  if (!tag.test(html)) throw new Error(`Missing source tag: ${name}`);
  html = html.replace(tag, () => `<script>\n${code}\n</script>`);
}
if (/fonts\.googleapis|data:image|src="\.\/src\//.test(html))
  throw new Error('Unexpected external or embedded private resource');
await writeFile(path.join(dest, 'index.html'), html);
await writeFile(path.join(dest, '.nojekyll'), '');
await cp(path.join(root, 'docs'), path.join(dest, 'docs'), { recursive: true });
await cp(path.join(root, 'examples'), path.join(dest, 'examples'), { recursive: true });
for (const name of [
  'LICENSE',
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
]) {
  await cp(path.join(root, name), path.join(dest, name));
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(
  path.join(dest, 'version.json'),
  JSON.stringify({ version: pkg.version }, null, 2) + '\n',
);
console.log(`Built Room Study ${pkg.version}: dist/index.html (offline, no runtime dependencies)`);
