const path = require('path');

const buf = fs.readFileSync('C:\\Windows\\System32\\notepad.exe');
// From REA inspect_pe_resources:
// Resource ID 9 (candidate 11) offset is 244808, size 72024
// Let's check what kind of data is at offset 244808
const iconOffset = 244808;
const iconSize = 72024;
const iconBytes = buf.subarray(iconOffset, iconOffset + iconSize);

// Check if PNG header (89 50 4E 47 0D 0A 1A 0A)
const isPng = iconBytes[0] === 0x89 && iconBytes[1] === 0x50 && iconBytes[2] === 0x4E && iconBytes[3] === 0x47;
console.log('Icon is PNG:', isPng);

if (isPng) {
  fs.writeFileSync(path.join(__dirname, 'notepad_icon.png'), iconBytes);
  console.log('Saved notepad_icon.png');
}

// Let's also extract a 32x32 icon (offset 326472, size 4264)
// And construct a valid .ico file containing standard sizes
// An .ico file starts with ICONDIR (idReserved=0, idType=1, idCount=N)
// followed by ICONDIRENTRY array, followed by image data.
// In RT_GROUP_ICON (offset 334304, size 188):
const grpOffset = 334304;
const grpSize = 188;
const grpBytes = buf.subarray(grpOffset, grpOffset + grpSize);

const idCount = grpBytes.readUInt16LE(4);
console.log('Icon count in group:', idCount);

// Build .ico header
// Header: 6 bytes
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type 1 = icon
icoHeader.writeUInt16LE(idCount, 4);

// Group entries are 14 bytes:
// bWidth, bHeight, bColorCount, bReserved, wPlanes, wBitCount, dwBytesInRes (DWORD), nID (WORD)
// ICO file entries are 16 bytes:
// bWidth, bHeight, bColorCount, bReserved, wPlanes, wBitCount, dwBytesInRes (DWORD), dwImageOffset (DWORD)

// Let's find offsets and sizes for each nID from PE resources
// From REA output:
const resourceMap = {
  1: { offset: 232552, size: 1640 },
  2: { offset: 234192, size: 744 },
  3: { offset: 234936, size: 488 },
  4: { offset: 235424, size: 296 },
  5: { offset: 235720, size: 3752 },
  6: { offset: 239472, size: 2216 },
  7: { offset: 241688, size: 1736 },
  8: { offset: 243424, size: 1384 },
  9: { offset: 244808, size: 72024 },
  10: { offset: 316832, size: 9640 },
  11: { offset: 326472, size: 4264 },
  12: { offset: 330736, size: 2440 },
  13: { offset: 333176, size: 1128 }
};

let currentOffset = 6 + idCount * 16;
const entries = [];
const imageBuffers = [];

for (let i = 0; i < idCount; i++) {
  const gEntry = grpBytes.subarray(6 + i * 14, 6 + (i + 1) * 14);
  const nID = gEntry.readUInt16LE(12);
  const res = resourceMap[nID];
  if (!res) continue;

  const icoEntry = Buffer.alloc(16);
  gEntry.copy(icoEntry, 0, 0, 12); // copy width, height, colors, planes, bitcount, bytesInRes
  icoEntry.writeUInt32LE(currentOffset, 12); // write image offset
  entries.push(icoEntry);

  const imgData = buf.subarray(res.offset, res.offset + res.size);
  imageBuffers.push(imgData);
  currentOffset += res.size;
}

const fullIco = Buffer.concat([icoHeader, ...entries, ...imageBuffers]);
fs.writeFileSync(path.join(__dirname, 'notepad_icon.ico'), fullIco);
console.log('Saved notepad_icon.ico, total bytes:', fullIco.length);
