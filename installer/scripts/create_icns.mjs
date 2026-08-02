import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [iconsetDirectory, outputPath] = process.argv.slice(2);
if (!iconsetDirectory || !outputPath) {
  throw new Error("Usage: node create_icns.mjs <iconset-directory> <output-path>");
}

const entries = [
  ["icp4", "icon_16x16.png"],
  ["icp5", "icon_32x32.png"],
  ["icp6", "icon_32x32@2x.png"],
  ["ic07", "icon_128x128.png"],
  ["ic08", "icon_256x256.png"],
  ["ic09", "icon_512x512.png"],
  ["ic10", "icon_512x512@2x.png"],
  ["ic11", "icon_16x16@2x.png"],
  ["ic12", "icon_32x32@2x.png"],
  ["ic13", "icon_256x256@2x.png"],
  ["ic14", "icon_512x512@2x.png"]
];

const chunks = [];
for (const [type, filename] of entries) {
  const image = await readFile(join(iconsetDirectory, filename));
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, "ascii");
  header.writeUInt32BE(header.length + image.length, 4);
  chunks.push(header, image);
}

const body = Buffer.concat(chunks);
const fileHeader = Buffer.alloc(8);
fileHeader.write("icns", 0, 4, "ascii");
fileHeader.writeUInt32BE(fileHeader.length + body.length, 4);
await writeFile(outputPath, Buffer.concat([fileHeader, body]));
