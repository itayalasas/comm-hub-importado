const encoder = new TextEncoder();

function normalizeEntryPath(path: string): string {
  return String(path || '').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function combineRootPath(rootFolder: string, path: string): string {
  const root = normalizeEntryPath(rootFolder).replace(/\/+$/, '');
  const entry = normalizeEntryPath(path);
  return root ? `${root}/${entry}` : entry;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    Math.floor(date.getSeconds() / 2);
  const day =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);

  return { time, date: day };
}

function writeUint16LE(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32LE(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function buildLocalFileHeader(fileNameBytes: Uint8Array, crc: number, size: number, modTime: number, modDate: number) {
  const header = new Uint8Array(30);
  writeUint32LE(header, 0, 0x04034b50);
  writeUint16LE(header, 4, 20);
  writeUint16LE(header, 6, 0x0800);
  writeUint16LE(header, 8, 0);
  writeUint16LE(header, 10, modTime);
  writeUint16LE(header, 12, modDate);
  writeUint32LE(header, 14, crc);
  writeUint32LE(header, 18, size);
  writeUint32LE(header, 22, size);
  writeUint16LE(header, 26, fileNameBytes.length);
  writeUint16LE(header, 28, 0);
  return header;
}

function buildCentralDirectoryHeader(
  fileNameBytes: Uint8Array,
  crc: number,
  size: number,
  modTime: number,
  modDate: number,
  localHeaderOffset: number,
) {
  const header = new Uint8Array(46);
  writeUint32LE(header, 0, 0x02014b50);
  writeUint16LE(header, 4, 20);
  writeUint16LE(header, 6, 20);
  writeUint16LE(header, 8, 0x0800);
  writeUint16LE(header, 10, 0);
  writeUint16LE(header, 12, modTime);
  writeUint16LE(header, 14, modDate);
  writeUint32LE(header, 16, crc);
  writeUint32LE(header, 20, size);
  writeUint32LE(header, 24, size);
  writeUint16LE(header, 28, fileNameBytes.length);
  writeUint16LE(header, 30, 0);
  writeUint16LE(header, 32, 0);
  writeUint16LE(header, 34, 0);
  writeUint16LE(header, 36, 0);
  writeUint32LE(header, 38, 0);
  writeUint32LE(header, 42, localHeaderOffset);
  return header;
}

function buildEndOfCentralDirectory(recordCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const header = new Uint8Array(22);
  writeUint32LE(header, 0, 0x06054b50);
  writeUint16LE(header, 4, 0);
  writeUint16LE(header, 6, 0);
  writeUint16LE(header, 8, recordCount);
  writeUint16LE(header, 10, recordCount);
  writeUint32LE(header, 12, centralDirectorySize);
  writeUint32LE(header, 16, centralDirectoryOffset);
  writeUint16LE(header, 20, 0);
  return header;
}

export function createZipBlob(files: Record<string, string>, rootFolder = ''): Blob {
  const now = dosDateTime();
  const entries = Object.entries(files);
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let localOffset = 0;

  for (const [relativePath, content] of entries) {
    const fileName = combineRootPath(rootFolder, relativePath);
    const nameBytes = encoder.encode(fileName);
    const dataBytes = encoder.encode(content);
    const crc = crc32(dataBytes);
    const localHeader = buildLocalFileHeader(nameBytes, crc, dataBytes.length, now.time, now.date);
    const centralHeader = buildCentralDirectoryHeader(nameBytes, crc, dataBytes.length, now.time, now.date, localOffset);

    parts.push(localHeader, nameBytes, dataBytes);
    centralDirectory.push(centralHeader, nameBytes);

    localOffset += localHeader.length + nameBytes.length + dataBytes.length;
  }

  const centralDirectorySize = centralDirectory.reduce((total, part) => total + part.length, 0);
  const endOfCentralDirectory = buildEndOfCentralDirectory(entries.length, centralDirectorySize, localOffset);

  const blobParts: BlobPart[] = [...parts, ...centralDirectory, endOfCentralDirectory].map((part) => {
    const buffer = part.buffer as ArrayBuffer;
    return buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
  });

  return new Blob(blobParts, {
    type: 'application/zip',
  });
}
