import { withResolution } from '../../src/convert/excalidraw';

/*
 * The resolution written into a drawing's PNG. Excalidraw draws two pixels to the drawing's one, and a PNG that says
 * nothing about its own resolution is read at 96 dpi — so without this the drawing arrives twice the size it is.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of bytes) {
    let mixed = (c ^ byte) & 0xff;
    for (let bit = 0; bit < 8; bit++) {
      mixed = mixed & 1 ? 0xedb88320 ^ (mixed >>> 1) : mixed >>> 1;
    }
    c = mixed ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

/** One chunk, as the format lays it out: length, type, data, and the CRC of the two last. */
const chunk = (type: string, data: number[]): number[] => {
  const body = new Uint8Array([...[...type].map(c => c.charCodeAt(0)), ...data]);
  const crc = crc32(body);
  return [...[24, 16, 8, 0].map(shift => (data.length >>> shift) & 0xff), ...body, ...[24, 16, 8, 0].map(shift => (crc >>> shift) & 0xff)];
};

const png = (...chunks: number[][]) => new Uint8Array([...SIGNATURE, ...chunks.flat()]);

/** The chunks a PNG is made of, as `type` against the bytes it holds. */
const chunks = (file: Uint8Array): [string, number[]][] => {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const found: [string, number[]][] = [];
  for (let at = 8; at + 8 <= file.length;) {
    const length = view.getUint32(at);
    found.push([String.fromCharCode(...file.subarray(at + 4, at + 8)), [...file.subarray(at + 8, at + 8 + length)]]);
    at += length + 12;
  }
  return found;
};

const IHDR = chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const IDAT = chunk('IDAT', [1, 2, 3]);
const IEND = chunk('IEND', []);

/** 192 dpi in the pixels per metre `pHYs` is written in, twice, and the byte saying the unit is the metre. */
const AT_192_DPI = [0, 0, 0x1d, 0x87, 0, 0, 0x1d, 0x87, 1];

describe('a drawing’s PNG', () => {
  test('is told the resolution it was drawn at, right after the header', () => {
    const written = chunks(withResolution(png(IHDR, IDAT, IEND), 192));

    expect(written.map(([type]) => type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(written[1][1]).toEqual(AT_192_DPI);
  });

  test('says it once, whatever the encoder wrote itself', () => {
    const written = chunks(withResolution(png(IHDR, chunk('pHYs', [0, 0, 0x0e, 0xc4, 0, 0, 0x0e, 0xc4, 1]), IDAT, IEND), 192));

    expect(written.map(([type]) => type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(written[1][1]).toEqual(AT_192_DPI);
  });

  test('carries a CRC the format reads, or nothing opens it', () => {
    const written = withResolution(png(IHDR, IDAT, IEND), 192);
    const at = 8 + IHDR.length;

    expect([...written.subarray(at, at + 21)]).toEqual(chunk('pHYs', AT_192_DPI));
  });
});
