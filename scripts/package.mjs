// A dependency-free ZIP writer (stored entries), plus a standalone offline HTML.
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const out = path.join(root, 'release');
await mkdir(out, { recursive: true });
const table = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(b) {
  let crc = 0xffffffff;
  for (const byte of b) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
async function walk(dir, prefix = '') {
  let files = [];
  for (const ent of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const name = prefix + ent.name;
    if (ent.isDirectory()) files.push(...(await walk(path.join(dir, ent.name), name + '/')));
    else if (ent.isFile()) files.push([name, await readFile(path.join(dir, ent.name))]);
  }
  return files;
}
const locals = [],
  central = [];
let offset = 0;
for (const [name, data] of await walk(path.join(root, 'dist'))) {
  const filename = Buffer.from(name),
    crc = crc32(data),
    local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(0x800, 8);
  directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(crc, 16);
  directory.writeUInt32LE(data.length, 20);
  directory.writeUInt32LE(data.length, 24);
  directory.writeUInt16LE(filename.length, 28);
  directory.writeUInt32LE(offset, 42);
  locals.push(local, filename, data);
  central.push(directory, filename);
  offset += local.length + filename.length + data.length;
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(central.length / 2, 8);
end.writeUInt16LE(central.length / 2, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const zipName = `room-study-v${pkg.version}.zip`,
  htmlName = `room-study-v${pkg.version}.html`;
await writeFile(path.join(out, zipName), Buffer.concat([...locals, directory, end]));
await copyFile(path.join(root, 'dist/index.html'), path.join(out, htmlName));
let sums = '';
for (const name of [zipName, htmlName])
  sums += `${createHash('sha256')
    .update(await readFile(path.join(out, name)))
    .digest('hex')}  ${name}\n`;
await writeFile(path.join(out, 'SHA256SUMS.txt'), sums);
console.log(`Packaged ${zipName}, ${htmlName}, SHA256SUMS.txt`);
