const fs = require('fs');
const path = require('path');

// 1. Parse PE headers and imports of notepad.exe
function parsePE(filePath) {
  const buf = fs.readFileSync(filePath);
  const peOffset = buf.readUInt32LE(0x3C);
  const magic = buf.readUInt16LE(peOffset + 24); // 0x20b for PE32+ (x64)
  const is64 = magic === 0x20b;

  const numSections = buf.readUInt16LE(peOffset + 6);
  const optHeaderSize = buf.readUInt16LE(peOffset + 20);
  const sectionHeaderOffset = peOffset + 24 + optHeaderSize;

  const sections = [];
  for (let i = 0; i < numSections; i++) {
    const secOffset = sectionHeaderOffset + i * 40;
    const name = buf.toString('utf8', secOffset, secOffset + 8).replace(/\0/g, '');
    const virtSize = buf.readUInt32LE(secOffset + 8);
    const virtAddr = buf.readUInt32LE(secOffset + 12);
    const rawSize = buf.readUInt32LE(secOffset + 16);
    const rawOffset = buf.readUInt32LE(secOffset + 20);
    sections.push({ name, virtSize, virtAddr, rawSize, rawOffset });
  }

  function rvaToOffset(rva) {
    for (const sec of sections) {
      if (rva >= sec.virtAddr && rva < sec.virtAddr + sec.virtSize) {
        return sec.rawOffset + (rva - sec.virtAddr);
      }
    }
    return null;
  }

  // Import Directory: Entry 1 in DataDirectory
  const dataDirOffset = peOffset + 24 + (is64 ? 112 : 96);
  const importRVA = buf.readUInt32LE(dataDirOffset + 8);
  const importSize = buf.readUInt32LE(dataDirOffset + 12);

  const imports = {};
  if (importRVA && importSize) {
    let importDescOffset = rvaToOffset(importRVA);
    if (importDescOffset) {
      while (true) {
        const origFirstThunk = buf.readUInt32LE(importDescOffset);
        const nameRVA = buf.readUInt32LE(importDescOffset + 12);
        const firstThunk = buf.readUInt32LE(importDescOffset + 16);
        if (!origFirstThunk && !nameRVA && !firstThunk) break;

        const nameOffset = rvaToOffset(nameRVA);
        let dllName = '';
        if (nameOffset) {
          let p = nameOffset;
          while (buf[p] !== 0) {
            dllName += String.fromCharCode(buf[p]);
            p++;
          }
        }

        const thunkRVA = origFirstThunk || firstThunk;
        const thunkOffset = rvaToOffset(thunkRVA);
        const funcs = [];
        if (thunkOffset) {
          let p = thunkOffset;
          while (true) {
            const entryVal = is64 ? buf.readBigUInt64LE(p) : BigInt(buf.readUInt32LE(p));
            if (entryVal === 0n) break;
            const isOrdinal = is64 ? (entryVal & (1n << 63n)) !== 0n : (entryVal & (1n << 31n)) !== 0n;
            if (!isOrdinal) {
              const hintNameRVA = Number(entryVal & 0x7fffffffn);
              const hintNameOffset = rvaToOffset(hintNameRVA);
              if (hintNameOffset) {
                let fn = '';
                let fp = hintNameOffset + 2;
                while (buf[fp] !== 0) {
                  fn += String.fromCharCode(buf[fp]);
                  fp++;
                }
                funcs.push(fn);
              }
            } else {
              funcs.push(`Ordinal_${entryVal & 0xffffn}`);
            }
            p += is64 ? 8 : 4;
          }
        }
        imports[dllName] = funcs;
        importDescOffset += 20;
      }
    }
  }

  return { sections, imports };
}

// 2. Parse Menu Resource from MUI
function parseMenu(muiPath) {
  const buf = fs.readFileSync(muiPath);
  // Find strings in Unicode
  // Standard Win32 Menu template header:
  // MENUITEMTEMPLATEHEADER: version (WORD), offset (WORD)
  // Or MENUITEMTEMPLATE: mtOption (WORD), mtID (WORD), mtString (WCHAR[])
  // Let's dump all Unicode strings that look like menu labels
  const text = buf.toString('utf16le');
  // Match menu labels like &Arquivo, &Salvar, etc.
  const menuMatches = [];
  const regex = /(&[A-Za-zÀ-ÿ0-9]|Salvar|Abrir|Novo|Exibir|Localizar|Substituir|Desfazer|Copiar|Colar|Excluir|Selecionar|Hora|Quebra|Fonte|Barra|Zoom|Ajuda|File|Edit|Format|View|Help|Open|Save|Undo|Cut|Copy|Paste)[^\0\x01\x02\x03\x04\x05\x06\x07\x08\x0e\x0f]{1,60}/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const clean = m[0].trim();
    if (clean.length > 1 && !menuMatches.includes(clean)) {
      menuMatches.push(clean);
    }
  }
  return menuMatches;
}

try {
  const notepadPE = parsePE('C:\\Windows\\System32\\notepad.exe');
  console.log('=== SECTIONS ===');
  console.log(notepadPE.sections.map(s => `${s.name}: RVA 0x${s.virtAddr.toString(16)} (raw 0x${s.rawOffset.toString(16)})`).join('\n'));

  console.log('\n=== RELEVANT IMPORTS ===');
  for (const [dll, funcs] of Object.entries(notepadPE.imports)) {
    const interesting = funcs.filter(f => /Window|Menu|Edit|Font|File|Dialog|Print|Draw|Text|Message|Scroll|Command|Find|Replace/i.test(f));
    if (interesting.length > 0) {
      console.log(`[${dll}]:`);
      console.log('  ' + interesting.join(', '));
    }
  }

  console.log('\n=== MENU LABELS (pt-BR) ===');
  const ptMenu = parseMenu('C:\\Windows\\System32\\pt-BR\\notepad.exe.mui');
  console.log(ptMenu.join('\n'));

  console.log('\n=== MENU LABELS (en-US) ===');
  const enMenu = parseMenu('C:\\Windows\\System32\\en-US\\notepad.exe.mui');
  console.log(enMenu.join('\n'));

} catch (e) {
  console.error(e);
}
