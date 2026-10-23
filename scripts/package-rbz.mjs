// Packs the plugin folder into dist/ai_render_suite.rbz (a zip file) for
// Extension Manager > Install Extension. Run `npm run rbz`.
import { deflateRawSync, crc32 } from "node:zlib";
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = "plugin";
const DOS_DATE = (1 << 5) | 1; // 1980-01-01, fixed so builds are repeatable
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(root);
files.sort();

const local = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(root, file).split("\\").join("/"));
  const raw = readFileSync(file);
  const data = deflateRawSync(raw);
  const crc = crc32(raw);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6); // UTF-8 names
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(raw.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, data);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(data.length, 20);
  entry.writeUInt32LE(raw.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += header.length + name.length + data.length;
}
const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync("dist", { recursive: true });
const out = "dist/ai_render_suite.rbz";
writeFileSync(out, Buffer.concat([...local, centralBuf, end]));
console.log(`Wrote ${out} with ${files.length} files`);
