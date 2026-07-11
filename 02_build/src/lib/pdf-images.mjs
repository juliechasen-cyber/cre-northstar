import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Photos in OM PDFs are embedded as verbatim JPEG streams (DCTDecode).
// Scan the raw bytes for structurally-valid JPEGs instead of parsing the
// PDF object graph — handles the 90% case (real photos) with zero deps.
// Vector art / Flate-encoded graphics are intentionally ignored.

const MIN_BYTES = 12 * 1024; // below this it's an icon or a logo fragment
const MIN_DIM = 260;
const MAX_IMAGES = 24; // biggest N by pixel area

// Walk JPEG segments from an SOI offset. Returns { end, width, height }
// or null if the bytes aren't a structurally valid JPEG.
function walkJpeg(buf, start) {
  let pos = start + 2; // past FF D8
  let width = 0, height = 0;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) return null;
    const marker = buf[pos + 1];
    if (marker === 0xd8) return null; // nested SOI — corrupt
    if (marker === 0xd9) return null; // EOI before any scan — empty
    if (marker >= 0xd0 && marker <= 0xd7) { pos += 2; continue; } // RST
    if (marker === 0x01) { pos += 2; continue; }
    const len = buf.readUInt16BE(pos + 2);
    if (len < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      height = buf.readUInt16BE(pos + 5);
      width = buf.readUInt16BE(pos + 7);
    }
    if (marker === 0xda) {
      // entropy-coded data: FF D9 cannot occur inside it — first hit is EOI
      const eoi = buf.indexOf(Buffer.from([0xff, 0xd9]), pos + 2 + len);
      if (eoi === -1) return null;
      return { end: eoi + 2, width, height };
    }
    pos += 2 + len;
  }
  return null;
}

export function extractJpegs(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const soi = Buffer.from([0xff, 0xd8, 0xff]);
  const seen = new Set();
  const out = [];
  let from = 0;
  while (true) {
    const at = buf.indexOf(soi, from);
    if (at === -1) break;
    const jpg = walkJpeg(buf, at);
    if (!jpg) { from = at + 3; continue; }
    from = jpg.end;
    const bytes = jpg.end - at;
    if (bytes < MIN_BYTES || jpg.width < MIN_DIM || jpg.height < MIN_DIM) continue;
    const data = buf.subarray(at, jpg.end);
    const sha = crypto.createHash("sha256").update(data).digest("hex");
    if (seen.has(sha)) continue;
    seen.add(sha);
    out.push({ data, width: jpg.width, height: jpg.height, bytes });
  }
  out.sort((a, b) => b.width * b.height - a.width * a.height);
  return out.slice(0, MAX_IMAGES);
}

// Extract, save to <dealDir>/images/img-NN.jpg, return metadata list.
export function saveDealImages(pdfPath, dealDir) {
  const images = extractJpegs(pdfPath);
  if (!images.length) return [];
  const dir = path.join(dealDir, "images");
  fs.mkdirSync(dir, { recursive: true });
  return images.map((img, i) => {
    const id = `img-${String(i + 1).padStart(2, "0")}`;
    const file = `images/${id}.jpg`;
    fs.writeFileSync(path.join(dealDir, file), img.data);
    return { id, file, width: img.width, height: img.height, bytes: img.bytes };
  });
}
