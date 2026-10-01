/* Just enough of the zip format for pandoc's release archive and for the packages a docx is made of. */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const STORED = 0;
const DEFLATED = 8;

/** Bit 11 of the general purpose flags: the name is UTF-8. */
const UTF8_NAMES = 0x0800;

/** 1980-01-01 00:00 in DOS form, the date Word itself stamps on its parts. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0;

/** Where the central directory starts, found by walking back from the end of the archive. */
const endOfCentralDirectory = (view: DataView): number => {
  // The record is 22 bytes plus a comment of up to 64 KB.
  const from = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= from; at -= 1) {
    if (view.getUint32(at, true) === EOCD) {
      return at;
    }
  }
  throw new Error('Not a zip archive');
};

const through = async (data: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> => {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const inflate = (data: Uint8Array) => through(data, new DecompressionStream('deflate-raw'));
const deflate = (data: Uint8Array) => through(data, new CompressionStream('deflate-raw'));

interface Entry {
  name: string;
  read: () => Promise<Uint8Array>;
}

/** Every file in `archive`, read lazily. */
function* entries(archive: ArrayBuffer | Uint8Array): Generator<Entry> {
  const bytes = archive instanceof Uint8Array ? archive : new Uint8Array(archive);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = endOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  const decoder = new TextDecoder();

  let at = view.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== CENTRAL) {
      break;
    }
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    yield {
      name,
      read: async () => {
        if (view.getUint32(localAt, true) !== LOCAL) {
          throw new Error(`"${name}" is not where the archive says it is`);
        }
        // The local header repeats the name and can carry different extra fields, so its own lengths are the ones to use.
        const start = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
        const data = bytes.subarray(start, start + compressed);
        if (method === STORED) {
          return data.slice();
        }
        if (method === DEFLATED) {
          return await inflate(data);
        }
        throw new Error(`"${name}" is packed in a way this cannot unpack (${method})`);
      },
    };

    at += 46 + nameLength + extraLength + commentLength;
  }
}

/**
 * The contents of the first file in `archive` whose name ends in `name`, decompressed.
 *
 * Matched by its tail because the release archive puts the binary in a folder named after the version.
 */
export async function extractFromZip(archive: ArrayBuffer, name: string): Promise<Uint8Array> {
  for (const entry of entries(archive)) {
    if (entry.name === name || entry.name.endsWith(`/${name}`)) {
      return await entry.read();
    }
  }
  throw new Error(`The archive has no "${name}" in it`);
}

/** Every file in `archive`, by its name, in the order the archive lists them. Folders are left out. */
export async function readZip(archive: ArrayBuffer | Uint8Array): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const entry of entries(archive)) {
    if (!entry.name.endsWith('/')) {
      files.set(entry.name, await entry.read());
    }
  }
  return files;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

/** An archive of `files`, in the order given. Each is deflated unless that would not make it smaller. */
export async function writeZip(files: Iterable<readonly [string, Uint8Array]>): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;

  for (const [name, data] of files) {
    const packed = await deflate(data);
    const method = packed.length < data.length ? DEFLATED : STORED;
    const body = method === DEFLATED ? packed : data;
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, UTF8_NAMES, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const header = new Uint8Array(46 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, CENTRAL, true);
    hv.setUint16(4, 20, true);
    hv.setUint16(6, 20, true);
    hv.setUint16(8, UTF8_NAMES, true);
    hv.setUint16(10, method, true);
    hv.setUint16(12, DOS_TIME, true);
    hv.setUint16(14, DOS_DATE, true);
    hv.setUint32(16, crc, true);
    hv.setUint32(20, body.length, true);
    hv.setUint32(24, data.length, true);
    hv.setUint16(28, nameBytes.length, true);
    hv.setUint32(42, offset, true);
    header.set(nameBytes, 46);

    locals.push(local, body);
    central.push(header);
    offset += local.length + body.length;
    count += 1;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, EOCD, true);
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const part of [...locals, ...central, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
